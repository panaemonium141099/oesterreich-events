import type { ScrapedEvent } from '@/types/events';
import type { EventimSeries, EventimEvent } from './types';
import { mapEventimCategory } from './category-map';
import { isBookable, isCancelled, notBookableReason, priceText } from './availability';
import { getCoordinatesForPLZ, getBundeslandFromPLZ } from '@/lib/plzCoordinates';
import { bundeslandFromPolygon } from './bundesland-from-geo';

const ALLOWED_COUNTRIES = new Set(['AT', 'DE', 'CH']);

const stripHtml = (s?: string): string | undefined =>
  s ? s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || undefined : undefined;

// Eventim serves a blank placeholder image for series without a real picture
// (…/teaser/blank.gif). Treat it as "no image" so the UI falls back cleanly.
const PLACEHOLDER_IMAGE = /blank\.(gif|png|jpe?g)$/i;

/**
 * Turn raw Eventim series into ScrapedEvents.
 * Filters: ticket events only (eventType "1"), not cancelled, future-dated,
 * AT/DE/CH only. `nowIso` is injected for deterministic "future" comparison.
 */
/**
 * Warum Events keinen Ticket-Link bekamen, nach Ursache gezaehlt.
 *
 * Der Ticket-Link ist die Einnahmequelle der Seite — ohne ihn verdient
 * eine Event-Detailseite nichts. Das Import-Log nannte bisher nur die
 * Summe ("20363/22272 bookable"), womit sich nicht beurteilen liess, ob
 * die ~1900 Events ohne Link wirklich unverkaeuflich sind.
 */
export interface NotBookableEntry {
  count: number;
  /** Ein Beispiel-Link je Ursache — die eventStatus-Codes sind
   *  undokumentiert (im Repo stehen nur 1=CANCELED, 2=AVAILABLE und ein
   *  Testkommentar 4=sold out). Ob ein Code "ausverkauft" oder
   *  "Vorverkauf laeuft noch" heisst, laesst sich nur an der echten Seite
   *  ablesen — oeticket sperrt automatisierte Zugriffe (Akamai), also
   *  braucht es einen Menschen mit Browser. */
  sample?: string;
}

export type NotBookableStats = Record<string, NotBookableEntry>;

export function parseEventimFeed(
  series: EventimSeries[],
  nowIso: string,
  /** Wird, wenn uebergeben, mit der Ursachen-Zaehlung befuellt. */
  notBookable?: NotBookableStats,
): ScrapedEvent[] {
  const out: ScrapedEvent[] = [];
  for (const s of series) {
    const { category, tags } = mapEventimCategory((s.esCategories ?? []).map((c) => c.category));
    const description = stripHtml(s.esText);
    for (const e of s.events ?? []) {
      if (String(e.eventType) !== '1') continue; // ticket events only
      if (isCancelled(e)) continue;
      if (!e.eventDateIso8601 || e.eventDateIso8601 < nowIso) continue; // future only
      if (!ALLOWED_COUNTRIES.has(e.eventCountry)) continue;
      if (notBookable) {
        const reason = notBookableReason(e);
        if (reason) {
          const entry = notBookable[reason] ?? { count: 0 };
          entry.count++;
          if (!entry.sample && e.evoLink) entry.sample = e.evoLink;
          notBookable[reason] = entry;
        }
      }
      out.push(mapEvent(s, e, category, tags, description));
    }
  }
  return out;
}

function mapEvent(
  s: EventimSeries,
  e: EventimEvent,
  category: string,
  tags: string[],
  description?: string,
): ScrapedEvent {
  let latitude = e.venueLatitude && e.venueLatitude !== 0 ? e.venueLatitude : undefined;
  let longitude = e.venueLongitude && e.venueLongitude !== 0 ? e.venueLongitude : undefined;
  // A few feed rows have swapped lat/lng (lat holds a longitude value etc.).
  // Central-European lat is ~46–55, lng ~6–17, so a "latitude < 18, longitude > 40"
  // pair is unambiguously swapped.
  if (latitude !== undefined && longitude !== undefined && latitude < 18 && longitude > 40) {
    [latitude, longitude] = [longitude, latitude];
  }
  // Drop still-implausible coordinates (genuinely broken feed rows) so the PLZ
  // centroid is used instead of plotting an event in the ocean.
  if (latitude !== undefined && longitude !== undefined &&
      !(latitude >= 45.5 && latitude <= 55.5 && longitude >= 5 && longitude <= 18)) {
    latitude = undefined;
    longitude = undefined;
  }
  // Coordless AT events → PLZ centroid (Austria-only PLZ DB) for a map position.
  if ((latitude === undefined || longitude === undefined) && e.eventCountry === 'AT' && e.eventZip) {
    const plz = getCoordinatesForPLZ(e.eventZip);
    if (plz) { latitude = plz[0]; longitude = plz[1]; }
  }
  // Bundesland (AT only): exact via point-in-polygon on the coordinates; if none
  // resolve, the platform's PLZ→Bundesland range map (administrative ranges,
  // deterministic — not a first-digit guess).
  let bundesland: string | undefined;
  if (e.eventCountry === 'AT') {
    if (latitude !== undefined && longitude !== undefined) {
      bundesland = bundeslandFromPolygon(latitude, longitude) ?? undefined;
    }
    if (!bundesland && e.eventZip) {
      bundesland = getBundeslandFromPLZ(e.eventZip) ?? undefined;
    }
  }
  const imageUrl = s.esPictureBig && !PLACEHOLDER_IMAGE.test(s.esPictureBig) ? s.esPictureBig : undefined;
  return {
    source_name: 'Eventim',
    source_id: e.eventId,
    source_url: e.evoLink,
    ticket_url: isBookable(e) ? e.evoLink : undefined,
    title: e.eventName || s.esName,
    description,
    start_date: e.eventDateIso8601,
    location_name: e.eventVenue || undefined,
    address: e.eventStreet ?? undefined,
    postal_code: e.eventZip ?? undefined,
    latitude,
    longitude,
    country: e.eventCountry,
    bundesland,
    category,
    category_locked: true,
    tags,
    price_min: e.minPrice,
    price_max: e.maxPrice,
    price_text: priceText(e.minPrice, e.maxPrice),
    image_url: imageUrl,
    source_type: 'scraped',
  };
}
