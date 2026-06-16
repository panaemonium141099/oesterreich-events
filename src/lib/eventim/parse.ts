import type { ScrapedEvent } from '@/types/events';
import type { EventimSeries, EventimEvent } from './types';
import { mapEventimCategory } from './category-map';
import { isBookable, isCancelled, priceText } from './availability';

const ALLOWED_COUNTRIES = new Set(['AT', 'DE', 'CH']);

const stripHtml = (s?: string): string | undefined =>
  s ? s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || undefined : undefined;

/**
 * Turn raw Eventim series into ScrapedEvents.
 * Filters: ticket events only (eventType "1"), not cancelled, future-dated,
 * AT/DE/CH only. `nowIso` is injected for deterministic "future" comparison.
 */
export function parseEventimFeed(series: EventimSeries[], nowIso: string): ScrapedEvent[] {
  const out: ScrapedEvent[] = [];
  for (const s of series) {
    const { category, tags } = mapEventimCategory((s.esCategories ?? []).map((c) => c.category));
    const description = stripHtml(s.esText);
    for (const e of s.events ?? []) {
      if (String(e.eventType) !== '1') continue; // ticket events only
      if (isCancelled(e)) continue;
      if (!e.eventDateIso8601 || e.eventDateIso8601 < nowIso) continue; // future only
      if (!ALLOWED_COUNTRIES.has(e.eventCountry)) continue;
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
  const hasCoords = !!e.venueLatitude && !!e.venueLongitude && e.venueLatitude !== 0;
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
    latitude: hasCoords ? e.venueLatitude : undefined,
    longitude: hasCoords ? e.venueLongitude : undefined,
    country: e.eventCountry,
    category,
    category_locked: true,
    tags,
    price_min: e.minPrice,
    price_max: e.maxPrice,
    price_text: priceText(e.minPrice, e.maxPrice),
    image_url: s.esPictureBig || undefined,
    source_type: 'scraped',
  };
}
