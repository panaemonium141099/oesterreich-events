import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isFalsePositiveMatch } from '@/lib/artist-matching';
import type { DeriveCtx } from './derive-event-state';

export interface LandingContext extends DeriveCtx {
  signedIn: boolean;
  userId: string | null;
}

/**
 * Loads the per-request derivation context for the Landing page.
 *
 *  - Anonymous: returns empty Sets, signedIn=false. NO DB queries fired.
 *  - Authenticated: queries saved_events + artist_event_notifications
 *    (the pre-computed match table). Splits notifications by match_source:
 *    'lineup' (always trusted) vs other sources (filtered via
 *    isFalsePositiveMatch against stale-match noise).
 *
 * Constrained to the upcoming 60-day window so the Sets stay small and
 * relevant to what the Landing sections actually render.
 *
 * Server-only — relies on next/headers cookies via createServerSupabaseClient.
 */
export async function getLandingContext(): Promise<LandingContext> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      signedIn: false,
      userId: null,
      savedEventIds: new Set(),
      followedArtistIds: new Set(),
      artistMatchEventIds: new Set(),
      lineupMatchEventIds: new Set(),
    };
  }

  const today = new Date().toISOString();
  const horizon = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

  const [savedRes, notificationsRes] = await Promise.all([
    supabase.from('saved_events').select('event_id').eq('user_id', user.id),
    supabase
      .from('artist_event_notifications')
      .select(`
        event_id,
        artist_name,
        match_source,
        events!inner ( title, start_date, publish_status )
      `)
      .eq('user_id', user.id)
      .gte('events.start_date', today)
      .lte('events.start_date', horizon)
      .eq('events.publish_status', 'published'),
  ]);

  const savedEventIds = new Set<string>(
    (savedRes.data ?? []).map(r => r.event_id as string)
  );

  const artistMatchEventIds = new Set<string>();
  const lineupMatchEventIds = new Set<string>();

  type NotificationRow = {
    event_id: string;
    artist_name: string;
    match_source: string;
    events: { title: string } | { title: string }[] | null;
  };

  for (const n of (notificationsRes.data ?? []) as NotificationRow[]) {
    const eventInfo = Array.isArray(n.events) ? n.events[0] : n.events;
    const eventTitle = eventInfo?.title ?? '';

    if (n.match_source === 'lineup') {
      lineupMatchEventIds.add(n.event_id);
    } else if (!isFalsePositiveMatch(n.artist_name, eventTitle)) {
      artistMatchEventIds.add(n.event_id);
    }
  }

  // followedArtistIds is part of the DeriveCtx interface but Phase 2 doesn't
  // need it for derivation (the notifications table already encodes the
  // join). Return empty to keep the type-contract intact; future phases can
  // populate from followed_artists if needed.
  const followedArtistIds = new Set<string>();

  return {
    signedIn: true,
    userId: user.id,
    savedEventIds,
    followedArtistIds,
    artistMatchEventIds,
    lineupMatchEventIds,
  };
}
