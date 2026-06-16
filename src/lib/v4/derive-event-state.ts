import type { Event } from '@/types/events';

/**
 * V4 card-state slug. Drives V4Badge.kind and which side-box / sticky-bar
 * variant the event-detail page renders in Phase 3.
 *
 * Priority order (first match wins):
 *   1. expired      → 'unknown' (safety; suppress promotion)
 *   2. soldout      → reserved; not derivable yet (waiting for Eventim API
 *                     or `ausverkauft` flag enrichment)
 *   3. inplan       → user already saved
 *   4. match        → user follows a single artist tied to this event
 *   5. lineup       → user follows an artist on this event's festival
 *   6. ticket       → Eventim source + ticket_url (feed = authoritative availability)
 *   7. free         → price_tier=gratis OR freier-eintritt/spende-erbeten flag
 *   8. doorsale     → abendkasse flag
 *   9. unknown      → fallback
 */
export type V4EventState =
  | 'soldout'
  | 'inplan'
  | 'match'
  | 'lineup'
  | 'ticket'
  | 'free'
  | 'doorsale'
  | 'unknown';

export interface DeriveCtx {
  /** Event IDs the current user has saved (anon: empty). */
  savedEventIds: Set<string>;
  /** Artist IDs the current user follows (anon: empty). */
  followedArtistIds: Set<string>;
  /** Pre-computed event IDs that link to a followed artist via artist_events. */
  artistMatchEventIds: Set<string>;
  /** Pre-computed event IDs that are festivals containing a followed artist via festival_artists. */
  lineupMatchEventIds: Set<string>;
}

export function deriveEventState(event: Event, ctx: DeriveCtx): V4EventState {
  // Safety: expired events never show promotional badges.
  if (event.publish_status === 'expired') return 'unknown';

  // 2. soldout — reserved slot, currently uncommented stays inactive.
  //    When `ausverkauft` joins PRICE_FLAGS or Eventim availability is wired:
  //      if (event.price_flags?.includes('ausverkauft')) return 'soldout';

  if (ctx.savedEventIds.has(event.id))         return 'inplan';
  if (ctx.artistMatchEventIds.has(event.id))   return 'match';
  if (ctx.lineupMatchEventIds.has(event.id))   return 'lineup';

  // Buy button is exclusive to the Eventim feed (authoritative ticket truth).
  // The importer sets ticket_url ONLY when the event is actually bookable
  // (status AVAILABLE + a "buchbar" price category), so ticket_url presence on
  // an Eventim event is itself the live-availability signal. Other sources
  // never show a buy button, even if they carry a ticket_url.
  if (event.source_name === 'Eventim' && event.ticket_url) {
    return 'ticket';
  }

  const flags = event.price_flags ?? [];
  if (event.price_tier === 'gratis' ||
      flags.includes('freier-eintritt') ||
      flags.includes('spende-erbeten')) {
    return 'free';
  }

  if (flags.includes('abendkasse')) return 'doorsale';

  return 'unknown';
}
