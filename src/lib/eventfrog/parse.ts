import type { ScrapedEvent } from '@/types/events';
import { demotePlaceholderCoords } from '@/lib/scrapers/source-coords-policy';
import type { EventfrogEvent, EventfrogI18n, EventfrogLocation } from './types';
import type { RubricIndex } from './rubric-map';

export const EVENTFROG_SOURCE_NAME = 'Eventfrog';

const LANGS = ['de', 'en', 'fr', 'it'] as const;

/** Erster nicht-leerer Text in der Reihenfolge de, en, fr, it. */
export function pickText(t: EventfrogI18n | null | undefined): string | undefined {
  if (!t) return undefined;
  for (const l of LANGS) {
    const v = t[l]?.replace(/\s+/g, ' ').trim();
    if (v) return v;
  }
  return undefined;
}

/** Wie FeratelScraper: Absätze bleiben als Zeilenumbrüche erhalten. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Kalendertag und Uhrzeit in Wiener Ortszeit ("2026-10-27", "19:30"). */
function viennaParts(iso: string): { day: string; time: string } {
  const s = new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Vienna' });
  return { day: s.slice(0, 10), time: s.slice(11, 16) };
}

/**
 * Dauerangebote erkennen: derselbe Veranstalter mit demselben Titel an
 * mindestens 30 verschiedenen Tagen, und zwar mindestens jeden zweiten Tag.
 *
 * Eventfrog führt buchbare Selbstläufer (Rätsel-Touren, Stadtspiele,
 * Öffnungszeiten) als ein Event pro Tag. Im AT-Bestand vom 2026-10-27 waren
 * das 12 Serien mit 2.494 von 3.455 Zeilen („Harry P.Otter und die
 * Zauberprüfung" 594-mal, „Schatzsuche Wien" täglich). Zwischen 11 und 35
 * Terminen lag keine Serie; eine wöchentliche Reihe (35 Termine über acht
 * Monate) bleibt über die Dichte-Bedingung erhalten.
 */
export const STANDING_OFFER_MIN_DAYS = 30;
export const STANDING_OFFER_MIN_DENSITY = 0.5;

function seriesKey(e: EventfrogEvent): string {
  return `${e.organizerId || e.organizerName || ''}|${(pickText(e.title) ?? '').toLowerCase()}`;
}

export function standingOfferKeys(events: EventfrogEvent[]): Set<string> {
  const days = new Map<string, Set<string>>();
  for (const e of events) {
    const k = seriesKey(e);
    const set = days.get(k) ?? new Set<string>();
    set.add(viennaParts(e.begin).day);
    days.set(k, set);
  }
  const out = new Set<string>();
  for (const [k, set] of days) {
    if (set.size < STANDING_OFFER_MIN_DAYS) continue;
    const sorted = [...set].sort();
    const spanDays = (Date.parse(sorted[sorted.length - 1]) - Date.parse(sorted[0])) / 86_400_000 + 1;
    if (set.size / spanDays >= STANDING_OFFER_MIN_DENSITY) out.add(k);
  }
  return out;
}

/**
 * Begin/Ende normalisieren. Eventfrog kennt kein Ganztags-Flag: Veranstalter
 * tragen 00:00 oder 00:01 bis 23:59 ein. 00:01 wird zur Platzhalter-
 * Mitternacht, die der Freigabevertrag als „nur Datum" erkennt; ein Ende
 * 23:59 am selben Tag trägt dann keine Information und entfällt.
 */
export function normalizeTimes(begin: string, end?: string | null): { start: string; end?: string } {
  const start = begin.replace(/T00:01(:00(\.0+)?)?(?=[+-]\d{2}:\d{2}|Z)/, 'T00:00:00');
  if (!end) return { start };
  if (Date.parse(end) <= Date.parse(start)) return { start };
  const b = viennaParts(start);
  const e = viennaParts(end);
  if (b.time === '00:00' && e.day === b.day && e.time >= '23:59') return { start };
  return { start, end };
}

function isPlausibleCoord(lat?: number, lng?: number): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

/**
 * Eine Location, die nur den Ort benennt („Wien", 1010, Stadtmittelpunkt),
 * ist eine Gebietsangabe, kein Veranstaltungsort.
 */
function locationPrecision(loc: EventfrogLocation): ScrapedEvent['coords_precision'] {
  const title = norm(pickText(loc.title));
  if (!loc.addressLine?.trim() || (title && title === norm(loc.city))) return 'municipality';
  return 'venue';
}

/**
 * Bild-URLs, die nicht als Eventbild taugen: KI-generierte Stockbilder
 * (Dateiname „…-ai-generated-…") und Bilder, die mindestens drei
 * verschiedene Veranstalter teilen (Rubrik-Platzhalter: `emblemToShow`
 * fällt laut Doku auf das Gruppen- oder Rubrikbild zurück).
 */
export function unusableImageUrls(events: EventfrogEvent[]): Set<string> {
  const orgs = new Map<string, Set<string>>();
  for (const e of events) {
    const u = e.emblemToShow?.url;
    if (!u) continue;
    const p = u.split('?')[0];
    const set = orgs.get(p) ?? new Set<string>();
    set.add(e.organizerId || e.organizerName || '');
    orgs.set(p, set);
  }
  const out = new Set<string>();
  for (const [p, set] of orgs) {
    if (set.size >= 3 || /ai-generated/i.test(p)) out.add(p);
  }
  return out;
}

const EURO_COUNTRIES = new Set(['AT', 'DE']);

export interface ParseStats {
  input: number;
  cancelled: number;
  hidden: number;
  noTitle: number;
  noLocation: number;
  standingOffer: number;
  /** Die gefilterten Dauerangebote, Titel → Anzahl, fürs Log. */
  standingOfferTitles: Record<string, number>;
  output: number;
}

export function parseEventfrogEvents(
  events: EventfrogEvent[],
  locations: Map<string, EventfrogLocation>,
  rubrics: RubricIndex,
  fallbackCountry: string,
): { events: ScrapedEvent[]; stats: ParseStats } {
  const stats: ParseStats = {
    input: events.length, cancelled: 0, hidden: 0, noTitle: 0, noLocation: 0,
    standingOffer: 0, standingOfferTitles: {}, output: 0,
  };
  const standing = standingOfferKeys(events);
  const badImages = unusableImageUrls(events);
  const out: ScrapedEvent[] = [];

  for (const e of events) {
    if (e.cancelled) { stats.cancelled++; continue; }
    if (!e.visible || !e.published) { stats.hidden++; continue; }
    const title = pickText(e.title);
    if (!title) { stats.noTitle++; continue; }
    if (standing.has(seriesKey(e))) {
      stats.standingOffer++;
      stats.standingOfferTitles[title] = (stats.standingOfferTitles[title] ?? 0) + 1;
      continue;
    }
    // Mehrere Locations kommen im Bestand nicht vor (0 von 3.455); die erste
    // bekannte gilt.
    const loc = e.locationIds.map((id) => locations.get(id)).find(Boolean);
    if (!loc) { stats.noLocation++; continue; }

    const { start, end } = normalizeTimes(e.begin, e.end);
    const country = loc.country || fallbackCountry;
    const hasCoords = isPlausibleCoord(loc.lat, loc.lng);
    const rubric = rubrics.map(e.rubricId);
    // Zeilenumbrüche im HTML sind nur Leerraum; Absätze kommen aus den Tags.
    const html = pickText(e.descriptionAsHTML);
    let description = html ? htmlToText(html) : pickText(e.shortDescription);
    if (description && description.length > 1000) description = `${description.substring(0, 997)}...`;
    const imageUrl = e.emblemToShow?.url;
    const imageOk = imageUrl && !badImages.has(imageUrl.split('?')[0]);
    const price = typeof e.lowestTicketPrice === 'number' && e.lowestTicketPrice > 0 && EURO_COUNTRIES.has(country)
      ? e.lowestTicketPrice : undefined;
    // Tickets nur, wenn Eventfrog selbst verkauft. Bei reinen
    // Kalendereinträgen ist `presaleLink` eine freie Veranstalter-Angabe
    // (gesehen: „/aktuelles/" einer Arztpraxis), kein Ticketshop.
    const ticketUrl = !e.agendaEntryOnly && !e.soldOut ? (e.presaleLink || e.url) : undefined;

    out.push({
      source_name: EVENTFROG_SOURCE_NAME,
      source_id: e.id,
      source_url: e.url,
      ticket_url: ticketUrl,
      title,
      description,
      start_date: start,
      end_date: end,
      location_name: pickText(e.locationAlias) ?? pickText(loc.title),
      address: loc.addressLine?.trim() || undefined,
      postal_code: loc.zip?.trim() || undefined,
      city: loc.city?.trim() || undefined,
      source_venue_id: `eventfrog:${loc.id}`,
      latitude: hasCoords ? loc.lat : undefined,
      longitude: hasCoords ? loc.lng : undefined,
      coords_precision: hasCoords ? locationPrecision(loc) : undefined,
      country,
      category: rubric.category,
      category_locked: rubric.locked || undefined,
      category_lock_reason: rubric.locked ? 'eventfrog rubric map' : undefined,
      tags: rubric.tags.length > 0 ? rubric.tags : undefined,
      organizer: e.organizerName?.trim() || undefined,
      price_min: price,
      price_text: price !== undefined ? `ab ${price.toFixed(2).replace('.', ',')} €` : undefined,
      image_url: imageOk ? imageUrl : undefined,
      image_width: imageOk ? e.emblemToShow?.width ?? undefined : undefined,
      image_height: imageOk ? e.emblemToShow?.height ?? undefined : undefined,
      image_credit: imageOk ? e.emblemCredits?.trim() || undefined : undefined,
      source_type: 'scraped',
    });
  }

  // Stadtmittelpunkte, die viele Locations teilen, sind Gebietsangaben.
  const policed = demotePlaceholderCoords(out);
  stats.output = policed.events.length;
  return { events: policed.events, stats };
}
