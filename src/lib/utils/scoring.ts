/**
 * Event scoring algorithm.
 *
 * Pure scoring logic with no side effects, importable for testing.
 *
 * Score formula (0-100, clamped):
 *  - Image present (non-empty):               +15
 *  - Description > 50 chars:                  +10
 *  - Description > 200 chars (extra):          +5
 *  - ticket_url host-based bonus:        +0 / +2 / +10
 *      0 = no ticket_url
 *      2 = ticket_url present but unknown host
 *     10 = ticket_url host in TRUSTED_TICKET_HOSTS
 *  - price_min > 0 OR price_text non-empty:    +5
 *  - price_min > 20 (extra):                   +5
 *  - tags array non-empty:                     +5
 *  - organizer non-empty:                      +5
 *  - source_url present:                       +5
 *  - Engagement (views*0.5 + saves*2 + shares*3, max 20): up to +20
 *  - Time bonus: next 7 days +10, 8-30 days +5
 *
 * Venue/series bonuses (Phase E - hyperlocal student events):
 *  - Student-relevant venue (is_student_relevant):  +10
 *  - Localness bonus (bar/pub/nightclub venue):      +5
 *  - Recurring series event (event_series_id):       +5
 *  - Student org source (registry_source=oeh/esn):  +10
 */

export interface ScoringEventRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  ticket_url: string | null;
  price_min: number | null;
  price_text: string | null;
  tags: string[] | null;
  organizer: string | null;
  source_url: string | null;
  view_count: number;
  save_count: number;
  share_count: number;
  start_date: string;
  venue_id: string | null;
  event_series_id: string | null;
}

export interface ScoringVenueRow {
  id: string;
  type: string;
  is_student_relevant: boolean;
  localness_score: number;
  registry_source: string | null;
}

/** Local venue types that get a localness bonus */
export const LOCAL_VENUE_TYPES = new Set(['bar', 'pub', 'nightclub', 'biergarten', 'club']);

/** Student org registry sources that get a bonus */
export const STUDENT_ORG_SOURCES = new Set(['oeh', 'esn', 'iaeste', 'aiesec', 'aegee']);

/**
 * Trusted Austrian ticketing hosts. Identical copy lives in
 * `src/lib/quality/score-event.ts` (ingest scorer) — keep both in sync.
 */
export const TRUSTED_TICKET_HOSTS = new Set<string>([
  'oeticket.com', 'oeticket.at',
  'eventim.de', 'eventim.at',
  'ticketmaster.at', 'ticketmaster.com',
  'wien-ticket.at',
  'ntry.at',
  'feverup.com',
]);

/**
 * Host-based ticket bonus. Returns:
 *   0 — no ticket_url
 *   1 — ticket_url present but host not in TRUSTED_TICKET_HOSTS
 *   5 — ticket_url host is in TRUSTED_TICKET_HOSTS
 *
 * The backfill scorer scales this by ×2 to fit its 0-100 scale.
 * Defensive: returns 0 if `new URL(...)` throws on a malformed value.
 */
export function getTrustedTicketBonus(ticketUrl: string | null | undefined): number {
  if (!ticketUrl) return 0;
  try {
    const host = new URL(ticketUrl).hostname.toLowerCase().replace(/^www\./, '');
    return TRUSTED_TICKET_HOSTS.has(host) ? 5 : 1;
  } catch {
    return 0;
  }
}

/**
 * Calculate event score with optional venue/series bonuses.
 */
export function calculateScore(event: ScoringEventRow, venue?: ScoringVenueRow | null): number {
  let score = 0;

  // Image present
  if (event.image_url && event.image_url.trim().length > 0) {
    score += 15;
  }

  // Description length bonuses
  const descLen = event.description ? event.description.trim().length : 0;
  if (descLen > 50) score += 10;
  if (descLen > 200) score += 5;

  // Ticket URL — host-based bonus (fn-14.1).
  //   no ticket_url       -> +0
  //   untrusted host      -> +2
  //   trusted ticket host -> +10
  // Replaces the previous unconditional +15 which over-rewarded any random
  // ticket-shaped URL.
  score += getTrustedTicketBonus(event.ticket_url) * 2;

  // Price signals
  const hasPriceMin = event.price_min !== null && event.price_min > 0;
  const hasPriceText = event.price_text !== null && event.price_text.trim().length > 0;
  if (hasPriceMin || hasPriceText) {
    score += 5;
    if (hasPriceMin && event.price_min! > 20) {
      score += 5;
    }
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    score += 5;
  }

  // Organizer
  if (event.organizer && event.organizer.trim().length > 0) {
    score += 5;
  }

  // Source URL
  if (event.source_url && event.source_url.trim().length > 0) {
    score += 5;
  }

  // Engagement score (max 20)
  const engagementScore = Math.min(
    event.view_count * 0.5 + event.save_count * 2 + event.share_count * 3,
    20
  );
  score += engagementScore;

  // Time bonus
  const now = new Date();
  const startDate = new Date(event.start_date);
  const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil >= 0 && daysUntil <= 7) {
    score += 10;
  } else if (daysUntil >= 8 && daysUntil <= 30) {
    score += 5;
  }

  // --- Venue/series bonuses (hyperlocal student events) ---

  // Student-relevant venue bonus: +10
  if (venue?.is_student_relevant) {
    score += 10;
  }

  // Localness bonus: bar/pub/nightclub venue type: +5
  if (venue && LOCAL_VENUE_TYPES.has(venue.type)) {
    score += 5;
  }

  // Recurring series event bonus: +5
  if (event.event_series_id) {
    score += 5;
  }

  // Student org source bonus: +10
  if (venue?.registry_source && STUDENT_ORG_SOURCES.has(venue.registry_source)) {
    score += 10;
  }

  // Clamp to 0-100
  return Math.min(100, Math.max(0, score));
}
