'use client';

/**
 * V4ArtistsPageClient — v4 redesign of /artists.
 *
 * Loads followed-artists + matched-events client-side via existing
 * /api/artists/following and /api/artists/events endpoints. Follow-Search
 * is now in V4ArtistSearchResult only (oben im Hero) — die alte
 * AddArtistsPanel-Sektion am Seitenende ist Phase-6 entfernt, weil sie
 * doppelt war und die Seite künstlich verlängert hat.
 *
 * Auth: anon users still see the hero + search input. Follow click
 * redirects them to /auth/login?next=. Followed-grid + matches show
 * empty-states when no user / no data.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import {
  V4ArtistsHero,
  V4ArtistSearchResult,
  V4FollowedArtistsGrid,
  V4MatchingEvents,
  type FollowedArtistWithMatches,
  type ArtistMatchEvent,
} from '@/components/Artists/v4';

export function V4ArtistsPageClient() {
  const { user, loading } = useAuth();
  const [followed, setFollowed] = useState<FollowedArtistWithMatches[]>([]);
  const [matches, setMatches] = useState<ArtistMatchEvent[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) {
      setMatchesLoading(false);
      return;
    }
    let alive = true;
    setMatchesLoading(true);

    (async () => {
      const [followingRes, eventsRes] = await Promise.all([
        fetch('/api/artists/following?limit=100'),
        fetch('/api/artists/events?limit=50'),
      ]);

      if (!alive) return;

      if (followingRes.ok) {
        const data = await followingRes.json();
        const artists = (data.artists ?? []) as Array<{
          id: string;
          artist_name: string;
          artist_name_normalized: string;
          spotify_image_url: string | null;
        }>;
        const countByArtist = new Map<string, number>();
        if (eventsRes.ok) {
          const evData = await eventsRes.json();
          for (const ev of (evData.events ?? [])) {
            for (const ma of (ev.matched_artists ?? [])) {
              const k = (ma.name as string).toLowerCase();
              countByArtist.set(k, (countByArtist.get(k) ?? 0) + 1);
            }
          }
        }
        setFollowed(artists.map(a => ({
          ...a,
          upcoming_matches: countByArtist.get(a.artist_name.toLowerCase()) ?? 0,
        })));
      }

      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        const mapped: ArtistMatchEvent[] = (evData.events ?? []).map((ev: Record<string, unknown>) => {
          const matched = (ev.matched_artists ?? []) as Array<{ name: string; match_source: string }>;
          const lineupHit = matched.find(m => m.match_source === 'lineup');
          const first = matched[0];
          return {
            id: ev.id as string,
            slug: (ev.slug as string | null) ?? null,
            title: ev.title as string,
            start_date: ev.start_date as string,
            location_name: (ev.location_name as string | null) ?? null,
            bundesland: (ev.bundesland as string | null) ?? null,
            image_url: (ev.image_url as string | null) ?? null,
            ticket_url: (ev.ticket_url as string | null) ?? null,
            price_text: (ev.price_text as string | null) ?? null,
            matched_artist: (lineupHit?.name ?? first?.name ?? '') as string,
            match_kind: (lineupHit ? 'lineup' : 'match'),
          };
        });
        setMatches(mapped);
      }
      setMatchesLoading(false);
    })();

    return () => { alive = false; };
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4ArtistsHero/>

      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-8 md:py-12 pb-24">
        <div className="mb-10">
          <V4ArtistSearchResult/>
        </div>

        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 md:gap-12">
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
                  Gefundene Auftritte in Österreich
                </h2>
                {matches.length > 0 && (
                  <span className="text-[11.5px] text-[var(--v4-ink-50)] uppercase tracking-[0.16em] font-bold">
                    {matches.length}
                  </span>
                )}
              </div>
              {matchesLoading ? (
                <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-2)] p-6 text-center text-[var(--v4-ink-50)] text-[13px] animate-pulse">
                  Treffer werden geladen …
                </div>
              ) : (
                <V4MatchingEvents events={matches}/>
              )}
            </section>
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
                  Deine Lieblingskünstler
                </h2>
                <span className="text-[11.5px] text-[var(--v4-ink-50)] uppercase tracking-[0.16em] font-bold">
                  {followed.length}
                </span>
              </div>
              <V4FollowedArtistsGrid artists={followed}/>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
