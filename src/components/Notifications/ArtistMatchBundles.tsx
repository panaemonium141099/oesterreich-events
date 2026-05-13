'use client';

/**
 * ArtistMatchBundles — bundles all artist-event matches per artist so the
 * user sees ONE card per artist with their Spotify image + an expandable
 * list of events the artist is playing at.
 *
 * Replaces the per-event-row notification spam: previously every event
 * row in the DB produced its own notification, so a festival like Nova
 * Rock (~18 separate event rows in `events` due to scraper-side dedup
 * limitations) caused 18 identical-looking notifications. Now those
 * collapse into the festival title once per artist, and the user
 * decides whether to drill in.
 *
 * Data flow:
 *   1. Read `artist_event_notifications` (the canonical (user, event,
 *      artist) match table) joined to `events` for title/date/location.
 *   2. Read `followed_artists` for `spotify_image_url`.
 *   3. Group rows in JS by `artist_name`, then within each artist
 *      dedup by `event_title` (the festival is one entry across all
 *      its sub-rows), keeping the earliest start_date and a
 *      representative event_id for the link target.
 *   4. Link unread state by cross-referencing
 *      `notifications.{user_id, event_id, type='spotify_match'}` from
 *      the existing NotificationsProvider context.
 *
 * Click handler marks the underlying notification(s) as read via the
 * shared provider — so the bell unread count stays accurate.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/supabase/auth-context';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { navigateFromNotification } from '@/lib/utils/notification-nav';
import {
  useNotifications,
  type NotificationRow,
} from './NotificationsProvider';

interface EventJoin {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  bundesland: string | null;
  postal_code: string | null;
  address: string | null;
}

interface MatchRow {
  artist_name: string;
  event_id: string;
  created_at: string;
  events: EventJoin;
}

interface FollowedArtistRow {
  artist_name: string;
  spotify_image_url: string | null;
}

interface BundleEvent {
  event_id: string;
  event_title: string;
  start_date: string;
  location_name: string | null;
  bundesland: string | null;
  action_url: string;
  /** Earliest match timestamp across all duplicate event-rows for this title */
  matched_at: string;
  read: boolean;
}

interface ArtistBundle {
  artist_name: string;
  spotify_image_url: string | null;
  events: BundleEvent[];
  /** True if any of the linked notifications is unread */
  unread_count: number;
  /** Most recent match timestamp — for sort order of the bundle list */
  latest_match: string;
}

function fmtEventDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(d);
  eventDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Heute';
  if (diffDays === 1) return 'Morgen';
  if (diffDays >= 0 && diffDays < 7) {
    return d.toLocaleDateString('de-AT', { weekday: 'long' });
  }
  return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMatchAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} T.`;
  return new Date(iso).toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
}

export function ArtistMatchBundles() {
  const { user } = useAuth();
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { notifications, markOneRead } = useNotifications();

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [artists, setArtists] = useState<FollowedArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ─── Fetch ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setMatches([]);
      setArtists([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const todayIso = new Date().toISOString();

        const [matchesRes, artistsRes] = await Promise.all([
          supabase
            .from('artist_event_notifications')
            .select(`
              artist_name,
              event_id,
              created_at,
              events!inner(
                id,
                title,
                slug,
                start_date,
                end_date,
                location_name,
                bundesland,
                postal_code,
                address
              )
            `)
            .eq('user_id', user.id)
            .gte('events.start_date', todayIso)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('followed_artists')
            .select('artist_name, spotify_image_url')
            .eq('user_id', user.id),
        ]);

        if (cancelled) return;
        setMatches(((matchesRes.data ?? []) as unknown) as MatchRow[]);
        setArtists(((artistsRes.data ?? []) as unknown) as FollowedArtistRow[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  // ─── Group ─────────────────────────────────────────────────────────
  const bundles = useMemo<ArtistBundle[]>(() => {
    if (matches.length === 0) return [];

    const imageByArtist = new Map<string, string | null>();
    for (const a of artists) {
      imageByArtist.set(a.artist_name, a.spotify_image_url);
    }

    // Map<artist_name, Map<event_title, BundleEvent>>
    // Dedup within (artist, title) keeps the EARLIEST start_date and
    // earliest matched_at. event_id of that earliest row is used as the
    // link target.
    const groups = new Map<string, Map<string, BundleEvent>>();
    const readByEventId = new Map<string, { read: boolean; notification?: NotificationRow }>();
    for (const n of notifications) {
      if (n.type === 'spotify_match' && n.event_id) {
        const existing = readByEventId.get(n.event_id);
        // If multiple notifications for same event_id exist (legacy
        // dupes), the bundle is considered unread if ANY is unread.
        if (!existing || (!n.read && existing.read)) {
          readByEventId.set(n.event_id, { read: n.read, notification: n });
        }
      }
    }

    for (const m of matches) {
      const artist = m.artist_name;
      const e = m.events;
      if (!e) continue;
      const titleKey = e.title;

      const action_url = buildEventUrlV2({
        id: e.id,
        slug: e.slug,
        start_date: e.start_date,
        postal_code: e.postal_code,
        address: e.address,
        bundesland: e.bundesland,
        location_name: e.location_name,
      });

      const notifInfo = readByEventId.get(e.id);
      const read = notifInfo?.read ?? true; // if no linked notification, consider read

      const titleMap = groups.get(artist) ?? new Map<string, BundleEvent>();

      const existing = titleMap.get(titleKey);
      if (!existing) {
        titleMap.set(titleKey, {
          event_id: e.id,
          event_title: e.title,
          start_date: e.start_date,
          location_name: e.location_name,
          bundesland: e.bundesland,
          action_url,
          matched_at: m.created_at,
          read,
        });
      } else {
        // Keep earliest start_date as canonical date; treat unread
        // sticky so the bundle stays "unread" until all sub-rows are
        // marked.
        if (new Date(e.start_date).getTime() < new Date(existing.start_date).getTime()) {
          existing.start_date = e.start_date;
          existing.event_id = e.id;
          existing.action_url = action_url;
        }
        if (!read) existing.read = false;
        if (new Date(m.created_at).getTime() > new Date(existing.matched_at).getTime()) {
          existing.matched_at = m.created_at;
        }
      }

      groups.set(artist, titleMap);
    }

    const out: ArtistBundle[] = [];
    for (const [artist_name, titleMap] of groups) {
      const events = Array.from(titleMap.values()).sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );
      const unread_count = events.filter((e) => !e.read).length;
      const latest_match = events.reduce(
        (acc, e) => (new Date(e.matched_at).getTime() > new Date(acc).getTime() ? e.matched_at : acc),
        events[0]?.matched_at ?? new Date(0).toISOString(),
      );
      out.push({
        artist_name,
        spotify_image_url: imageByArtist.get(artist_name) ?? null,
        events,
        unread_count,
        latest_match,
      });
    }

    // Bundles sorted: unread first, then most-recent match first
    out.sort((a, b) => {
      const unreadDiff = (b.unread_count > 0 ? 1 : 0) - (a.unread_count > 0 ? 1 : 0);
      if (unreadDiff !== 0) return unreadDiff;
      return new Date(b.latest_match).getTime() - new Date(a.latest_match).getTime();
    });

    return out;
  }, [matches, artists, notifications]);

  // ─── Handlers ──────────────────────────────────────────────────────
  const toggleExpanded = (artist: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(artist)) next.delete(artist);
      else next.add(artist);
      return next;
    });
  };

  const openEvent = (bundle: ArtistBundle, ev: BundleEvent) => {
    // Mark every notification tied to a duplicate event_id for this
    // (artist, title) pair as read — so the bundle's unread counter
    // clears after one tap on any sub-event.
    const titleEventIds = new Set<string>();
    for (const m of matches) {
      if (m.artist_name === bundle.artist_name && m.events?.title === ev.event_title) {
        titleEventIds.add(m.event_id);
      }
    }
    for (const n of notifications) {
      if (
        n.type === 'spotify_match' &&
        !n.read &&
        n.event_id &&
        titleEventIds.has(n.event_id)
      ) {
        void markOneRead(n);
      }
    }
    navigateFromNotification(ev.action_url, router);
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2 mb-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl animate-pulse motion-reduce:animate-none"
          >
            <div className="w-12 h-12 rounded-full bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/[0.06] rounded w-1/3" />
              <div className="h-3 bg-white/[0.04] rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (bundles.length === 0) return null;

  return (
    <section className="mb-6">
      <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-1">
        Deine Artists
      </p>
      <div className="space-y-2">
        {bundles.map((b) => {
          const isOpen = expanded.has(b.artist_name);
          const isUnread = b.unread_count > 0;
          return (
            <div
              key={b.artist_name}
              className={`rounded-xl overflow-hidden transition-colors ${
                isUnread ? 'bg-white/[0.04]' : 'bg-white/[0.02]'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(b.artist_name)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/[0.04] transition-colors"
                aria-expanded={isOpen}
              >
                <div className="w-12 h-12 rounded-full bg-white/[0.08] flex items-center justify-center text-base font-semibold text-white/60 shrink-0 overflow-hidden">
                  {b.spotify_image_url ? (
                    <img
                      src={b.spotify_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  ) : (
                    <span>{b.artist_name[0]?.toUpperCase() ?? '?'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm truncate ${
                        isUnread ? 'text-white font-semibold' : 'text-white/70'
                      }`}
                    >
                      {b.artist_name}
                    </p>
                    {isUnread && (
                      <span
                        className="shrink-0 w-2 h-2 rounded-full bg-blue-500"
                        aria-label={`${b.unread_count} ungelesen`}
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {b.events.length === 1
                      ? '1 Event'
                      : `${b.events.length} Events`}
                    {' · '}
                    {fmtMatchAgo(b.latest_match)}
                  </p>
                </div>
                <svg
                  className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 0 1 1.08 1.04l-4.25 4.39a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {isOpen && (
                <ul className="border-t border-white/[0.04] divide-y divide-white/[0.04]">
                  {b.events.map((ev) => (
                    <li key={`${b.artist_name}:${ev.event_title}`}>
                      <button
                        type="button"
                        onClick={() => openEvent(b, ev)}
                        className="w-full text-left px-4 py-3 hover:bg-white/[0.04] transition-colors"
                      >
                        <p
                          className={`text-sm truncate ${
                            ev.read ? 'text-white/80' : 'text-white font-medium'
                          }`}
                        >
                          {ev.event_title}
                        </p>
                        <p className="text-[11px] text-white/40 mt-1 truncate">
                          {fmtEventDate(ev.start_date)}
                          {ev.location_name ? ` · ${ev.location_name}` : ''}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
