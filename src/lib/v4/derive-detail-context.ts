import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isFalsePositiveMatch } from '@/lib/artist-matching';
import type { DeriveCtx } from './derive-event-state';

/**
 * Loads the minimal context needed to derive a V4EventState for a
 * SINGLE event id. Cheaper than getLandingContext (which scopes a
 * 60-day window across all matched events).
 *
 *  - Anon: empty sets, no DB queries fired.
 *  - Authed: three small queries — saved_events for THIS event,
 *    artist_event_notifications for THIS event, plus a single artist
 *    name to thread through to V4TicketBox's match/lineup variant.
 */
export interface DetailContext extends DeriveCtx {
  signedIn: boolean;
  matchedArtistName?: string;
}

export async function deriveDetailContext(eventId: string): Promise<DetailContext> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const empty: DetailContext = {
    signedIn: false,
    savedEventIds: new Set(),
    followedArtistIds: new Set(),
    artistMatchEventIds: new Set(),
    lineupMatchEventIds: new Set(),
  };

  if (!user) return empty;

  const [savedRes, notifRes] = await Promise.all([
    supabase
      .from('saved_events')
      .select('event_id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('artist_event_notifications')
      .select('artist_name, match_source, events!inner(title)')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .limit(5),
  ]);

  const savedEventIds = new Set<string>();
  if (savedRes.data?.event_id) savedEventIds.add(savedRes.data.event_id);

  const artistMatchEventIds = new Set<string>();
  const lineupMatchEventIds = new Set<string>();
  let matchedArtistName: string | undefined;

  type NotifRow = {
    artist_name: string;
    match_source: string;
    events: { title: string } | Array<{ title: string }> | null;
  };

  for (const n of (notifRes.data ?? []) as NotifRow[]) {
    const eventInfo = Array.isArray(n.events) ? n.events[0] : n.events;
    const eventTitle = eventInfo?.title ?? '';
    if (n.match_source === 'lineup') {
      lineupMatchEventIds.add(eventId);
      matchedArtistName ??= n.artist_name;
    } else if (!isFalsePositiveMatch(n.artist_name, eventTitle)) {
      artistMatchEventIds.add(eventId);
      matchedArtistName ??= n.artist_name;
    }
  }

  return {
    signedIn: true,
    savedEventIds,
    followedArtistIds: new Set(),
    artistMatchEventIds,
    lineupMatchEventIds,
    matchedArtistName,
  };
}
