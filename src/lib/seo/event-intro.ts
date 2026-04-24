/**
 * AI-citable intro sentence for event detail pages.
 *
 * Phase 7 (AI-Search / GEO) requires every event page to have a
 * self-contained first sentence that an AI agent can lift verbatim
 * into an answer:
 *
 *   "[Event] findet am [Datum] [um Uhrzeit] in [Venue] in [Stadt]
 *    statt."
 *
 * We can't trust DB-sourced `event.description` for this — a large
 * chunk of events have scraped descriptions that start with
 * boilerplate ("Hier findest du…", "An diesem Abend…") or no
 * description at all. So we compute a guaranteed intro sentence from
 * the structured fields (title + start_date + location_name +
 * address) that are always populated. The scraped description then
 * renders _below_ the generated intro, so agents see the citable
 * sentence first and the editorial description second.
 *
 * Keep the language German (de-AT) throughout — the target audience +
 * AI queries are both in German.
 */

import { formatDateLong, formatTime } from '@/lib/utils/date';

export interface EventIntroInput {
  title: string;
  start_date: string;
  end_date?: string | null;
  location_name?: string | null;
  address?: string | null;
  venue_name?: string | null;
  city?: string | null;
  category?: string | null;
  price_text?: string | null;
}

/**
 * Generates a self-contained citable German sentence describing the
 * event. Always returns a valid string — no "undefined" or "null"
 * leaks. Grammatically complete even when optional fields are missing.
 */
export function buildCitableIntro(e: EventIntroInput): string {
  const title = e.title.trim();
  const dateLong = formatDateLong(e.start_date);
  const startTime = formatTime(e.start_date);

  // ─── Location fragment ───
  // Venue with city produces: "in der Wiener Stadthalle in Wien"
  // Venue alone:              "in der Wiener Stadthalle"
  // City alone:               "in Wien"
  // Nothing:                  "" (omitted from sentence)
  const venue = (e.venue_name ?? e.location_name ?? '').trim();
  const city = (e.city ?? e.address ?? '').trim();
  let locationPart = '';
  if (venue && city && !venue.toLowerCase().includes(city.toLowerCase())) {
    locationPart = `in ${venue} in ${city}`;
  } else if (venue) {
    locationPart = `in ${venue}`;
  } else if (city) {
    locationPart = `in ${city}`;
  }

  // ─── Time fragment ───
  // If no time is given (00:00 is usually a "date-only" marker), leave
  // it out entirely rather than saying "um 00:00 Uhr" which is wrong.
  const timePart = startTime ? ` um ${startTime} Uhr` : '';

  // ─── Sentence 1: when + where ───
  // Core grammar: "<Title> findet am <Datum>[ um <Uhrzeit>][ <Ort>] statt."
  let sentence = `${title} findet am ${dateLong}${timePart}`;
  if (locationPart) sentence += ` ${locationPart}`;
  sentence += ' statt.';

  // ─── Optional sentence 2: category + price ───
  // These only fire when the respective field is present. Keeps the
  // intro concise for most events (one sentence) and adds colour for
  // events that have richer metadata.
  const extras: string[] = [];
  if (e.category && e.category.trim()) {
    extras.push(`Die Veranstaltung zählt zur Kategorie ${e.category}`);
  }
  if (e.price_text && e.price_text.trim()) {
    // If the scraper captured a "free" signal use a friendlier phrase
    const priceLower = e.price_text.toLowerCase();
    if (/(gratis|frei|kostenlos|free)/.test(priceLower)) {
      extras.push('Der Eintritt ist frei');
    } else {
      extras.push(`Der Eintritt: ${e.price_text.trim()}`);
    }
  }
  if (extras.length > 0) sentence += ` ${extras.join('. ')}.`;

  // ─── Optional sentence 3: end date (multi-day events) ───
  if (e.end_date) {
    const end = new Date(e.end_date);
    const start = new Date(e.start_date);
    // Only mention the end date when it's at least the next calendar
    // day — avoids "bis 15. Mai 2026 um 22:00 Uhr" for single-evening
    // events where the scraper happened to record both times.
    if (end.toDateString() !== start.toDateString()) {
      sentence += ` Das Event läuft bis zum ${formatDateLong(e.end_date)}.`;
    }
  }

  return sentence;
}
