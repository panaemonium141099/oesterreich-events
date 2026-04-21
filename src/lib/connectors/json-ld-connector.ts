/**
 * JSON-LD Connector: Extracts Schema.org Event objects from venue web pages.
 *
 * Parses <script type="application/ld+json"> blocks, handles:
 * - Direct Event objects
 * - @graph arrays containing mixed types
 * - Arrays of JSON-LD objects
 * - Nested Event subtypes (MusicEvent, SportsEvent, etc.)
 * - Multiple events per page
 *
 * Used by the registry-based scraper to ingest events from venues
 * whose websites embed Schema.org structured data.
 */

import * as cheerio from 'cheerio';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';
import type { Venue } from '@/types/venues';

/** Schema.org Event types we recognize (exported for scrapers and fetchers). */
export const EVENT_TYPES = new Set([
  'Event',
  'MusicEvent',
  'SportsEvent',
  'SocialEvent',
  'BusinessEvent',
  'ChildrensEvent',
  'ComedyEvent',
  'CourseInstance',
  'DanceEvent',
  'DeliveryEvent',
  'EducationEvent',
  'ExhibitionEvent',
  'Festival',
  'FoodEvent',
  'Hackathon',
  'LiteraryEvent',
  'PublicationEvent',
  'SaleEvent',
  'ScreeningEvent',
  'TheaterEvent',
  'VisualArtsEvent',
]);

/** Options for JSON-LD extraction */
export interface JsonLdConnectorOptions {
  /** Maximum number of events to extract per page (default: 100) */
  maxEventsPerPage?: number;
  /** Minimum date for events (ISO string, default: today) */
  minDate?: string;
  /** Maximum date for events (ISO string, default: 90 days from now) */
  maxDate?: string;
  /** User-Agent header for HTTP requests */
  userAgent?: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
}

/** Result of a JSON-LD extraction attempt */
export interface JsonLdExtractionResult {
  events: ScrapedEvent[];
  /** Number of JSON-LD blocks found on the page */
  jsonLdBlocksFound: number;
  /** Number of Event objects found (before date filtering) */
  eventsFound: number;
  /** Errors encountered during parsing (non-fatal) */
  errors: string[];
}

/**
 * Extracts Schema.org Event objects from HTML containing JSON-LD.
 * This is a pure function -- it does not fetch any URLs.
 */
export function extractEventsFromHtml(
  html: string,
  pageUrl: string,
  venue: Pick<Venue, 'name' | 'city' | 'bundesland' | 'latitude' | 'longitude' | 'address' | 'postal_code'> | null,
  options: JsonLdConnectorOptions = {},
): JsonLdExtractionResult {
  const {
    maxEventsPerPage = 100,
    minDate,
    maxDate,
  } = options;

  const now = new Date();
  const minDateObj = minDate ? new Date(minDate) : now;
  const maxDateObj = maxDate
    ? new Date(maxDate)
    : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const $ = cheerio.load(html);
  const result: JsonLdExtractionResult = {
    events: [],
    jsonLdBlocksFound: 0,
    eventsFound: 0,
    errors: [],
  };

  // Collect all JSON-LD blocks
  const jsonLdBlocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    result.jsonLdBlocksFound++;
    const text = $(el).html();
    if (!text) return;

    try {
      const parsed = JSON.parse(text);
      jsonLdBlocks.push(parsed);
    } catch (err) {
      result.errors.push(
        `Failed to parse JSON-LD block #${result.jsonLdBlocksFound}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });

  // Extract Event objects from all blocks
  const eventObjects: Record<string, unknown>[] = [];
  for (const block of jsonLdBlocks) {
    extractEventObjects(block, eventObjects);
  }

  result.eventsFound = eventObjects.length;

  // Convert to ScrapedEvent, apply date filtering
  for (const eventObj of eventObjects) {
    if (result.events.length >= maxEventsPerPage) break;

    try {
      const scraped = convertToScrapedEvent(eventObj, pageUrl, venue);
      if (!scraped) continue;

      // Date filtering
      const startDate = new Date(scraped.start_date);
      if (isNaN(startDate.getTime())) {
        result.errors.push(`Invalid start_date for event "${scraped.title}"`);
        continue;
      }
      if (startDate < minDateObj || startDate > maxDateObj) continue;

      result.events.push(scraped);
    } catch (err) {
      const title = typeof eventObj.name === 'string' ? eventObj.name : 'unknown';
      result.errors.push(
        `Failed to convert event "${title}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}

/**
 * Fetches a URL and extracts Schema.org Events from the page.
 */
export async function fetchAndExtractEvents(
  url: string,
  venue: Pick<Venue, 'name' | 'city' | 'bundesland' | 'latitude' | 'longitude' | 'address' | 'postal_code'> | null,
  options: JsonLdConnectorOptions = {},
): Promise<JsonLdExtractionResult> {
  const {
    userAgent = 'BurgenlandEvents-Scraper/1.0 (educational project)',
    timeoutMs = 10000,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        events: [],
        jsonLdBlocksFound: 0,
        eventsFound: 0,
        errors: [`HTTP ${response.status}: ${response.statusText} for ${url}`],
      };
    }

    const html = await response.text();
    return extractEventsFromHtml(html, url, venue, options);
  } catch (err) {
    return {
      events: [],
      jsonLdBlocksFound: 0,
      eventsFound: 0,
      errors: [
        `Fetch failed for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract Event-typed objects from a parsed JSON-LD structure.
 * Handles: direct objects, @graph arrays, plain arrays, and nested sub-events.
 */
function extractEventObjects(
  data: unknown,
  out: Record<string, unknown>[],
): void {
  if (!data || typeof data !== 'object') return;

  if (Array.isArray(data)) {
    for (const item of data) {
      extractEventObjects(item, out);
    }
    return;
  }

  const obj = data as Record<string, unknown>;

  // Check @graph
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      extractEventObjects(item, out);
    }
    return;
  }

  // Check if this object itself is an Event type
  if (isEventObject(obj)) {
    out.push(obj);

    // Also check subEvent / subEvents
    const subEvents = obj.subEvent || obj.subEvents;
    if (Array.isArray(subEvents)) {
      for (const sub of subEvents) {
        extractEventObjects(sub, out);
      }
    }
  }
}

/**
 * Check whether a JSON-LD `@type` value represents a Schema.org Event.
 * Accepts any of:
 *   - a bare string  e.g. "Event", "MusicEvent", "TheaterEvent"
 *   - an array       e.g. ["Event", "SomeOtherType"]
 *   - null/undefined (returns false)
 *
 * Matches against the full Schema.org Event type tree (MusicEvent,
 * TheaterEvent, ComedyEvent, Festival, etc.) — NOT just the narrow
 * `=== 'Event'` check that was buggy in many scrapers.
 *
 * This is the ONE PLACE that decides what counts as an Event for the
 * entire pipeline. fetch-page.ts and individual scrapers import this
 * instead of rolling their own check.
 */
export function isEventType(typeValue: unknown): boolean {
  if (!typeValue) return false;
  if (typeof typeValue === 'string') return EVENT_TYPES.has(typeValue);
  if (Array.isArray(typeValue)) {
    return typeValue.some((t) => typeof t === 'string' && EVENT_TYPES.has(t));
  }
  return false;
}

/**
 * Convenience overload: accepts the whole JSON-LD object and reads `@type`
 * from it. Kept for internal callers that already have the object in hand.
 */
function isEventObject(obj: Record<string, unknown>): boolean {
  return isEventType(obj['@type']);
}

/**
 * Convert a Schema.org Event JSON-LD object to a ScrapedEvent.
 * Returns null if required fields (name, startDate) are missing.
 */
function convertToScrapedEvent(
  eventObj: Record<string, unknown>,
  pageUrl: string,
  venue: Pick<Venue, 'name' | 'city' | 'bundesland' | 'latitude' | 'longitude' | 'address' | 'postal_code'> | null,
): ScrapedEvent | null {
  const name = getString(eventObj, 'name');
  const startDate = getString(eventObj, 'startDate');

  if (!name || !startDate) return null;

  const description = stripHtml(getString(eventObj, 'description') || '');
  const endDate = getString(eventObj, 'endDate') || undefined;
  const imageUrl = extractImage(eventObj) || undefined;

  // Location: prefer JSON-LD location, fallback to venue
  const location = extractLocation(eventObj);
  const locationName = location.name || venue?.name || undefined;
  const address = location.address || venue?.address || undefined;
  const postalCode = location.postalCode || venue?.postal_code || undefined;
  const latitude = location.latitude ?? venue?.latitude ?? undefined;
  const longitude = location.longitude ?? venue?.longitude ?? undefined;
  const city = location.city || venue?.city || undefined;
  const bundesland = venue?.bundesland || undefined;

  // Organizer
  const organizer = extractOrganizer(eventObj) || undefined;

  // Price
  const priceInfo = extractPrice(eventObj);

  // Tags from keywords
  const tags = extractTags(eventObj);

  // Category
  const category = categorizeEvent(name, description, tags.length > 0 ? tags : undefined);

  // Source ID: use @id, or URL, or fallback to name+date hash
  const sourceId = getString(eventObj, '@id')
    || getString(eventObj, 'url')
    || `jsonld:${hashString(name + startDate)}`;

  // Source URL: prefer the event's own URL, then the page URL
  const sourceUrl = getString(eventObj, 'url') || pageUrl;

  // Ticket URL
  const ticketUrl = extractTicketUrl(eventObj) || undefined;

  const event: ScrapedEvent = {
    source_id: sourceId,
    source_name: `json-ld:${new URL(pageUrl).hostname}`,
    source_url: sourceUrl,
    title: name,
    description: description || undefined,
    start_date: startDate,
    end_date: endDate,
    location_name: locationName,
    address: address,
    postal_code: postalCode,
    bundesland: bundesland,
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
    category,
    price_text: priceInfo.text || undefined,
    price_min: priceInfo.min ?? undefined,
    price_max: priceInfo.max ?? undefined,
    image_url: imageUrl,
    organizer,
    tags: tags.length > 0 ? tags : undefined,
    ticket_url: ticketUrl,
  };

  return event;
}

/** Safely get a string property from an object */
function getString(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  if (typeof val === 'string') return val.trim() || null;
  return null;
}

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/** Simple hash for generating source IDs */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract image URL from a Schema.org Event object.
 * Handles string, array, and ImageObject variants.
 */
function extractImage(eventObj: Record<string, unknown>): string | null {
  const img = eventObj.image;
  if (!img) return null;

  if (typeof img === 'string') return img;

  if (Array.isArray(img)) {
    const first = img[0];
    if (!first) return null;
    if (typeof first === 'string') return first;
    if (typeof first === 'object' && first !== null) {
      const obj = first as Record<string, unknown>;
      return (getString(obj, 'url') || getString(obj, 'contentUrl'));
    }
    return null;
  }

  if (typeof img === 'object' && img !== null) {
    const obj = img as Record<string, unknown>;
    return (getString(obj, 'url') || getString(obj, 'contentUrl'));
  }

  return null;
}

/**
 * Extract location information from a Schema.org Event.
 * Handles Place, PostalAddress, VirtualLocation, and string locations.
 */
function extractLocation(eventObj: Record<string, unknown>): {
  name: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
} {
  const empty = { name: null, address: null, postalCode: null, city: null, latitude: null, longitude: null };
  const loc = eventObj.location;
  if (!loc) return empty;

  // Handle array of locations (take first physical one)
  const locObj = Array.isArray(loc)
    ? loc.find((l) => typeof l === 'object' && l !== null && (l as Record<string, unknown>)['@type'] !== 'VirtualLocation')
      || loc[0]
    : loc;

  if (typeof locObj === 'string') {
    return { ...empty, name: locObj };
  }

  if (typeof locObj !== 'object' || locObj === null) return empty;

  const place = locObj as Record<string, unknown>;

  // Skip VirtualLocation
  if (place['@type'] === 'VirtualLocation') return empty;

  const name = getString(place, 'name');

  // Address
  let address: string | null = null;
  let postalCode: string | null = null;
  let city: string | null = null;

  const addr = place.address;
  if (typeof addr === 'string') {
    address = addr;
  } else if (typeof addr === 'object' && addr !== null) {
    const addrObj = addr as Record<string, unknown>;
    const street = getString(addrObj, 'streetAddress');
    postalCode = getString(addrObj, 'postalCode');
    city = getString(addrObj, 'addressLocality');
    const parts = [street, postalCode, city].filter(Boolean);
    address = parts.length > 0 ? parts.join(', ') : null;
  }

  // Geo coordinates
  let latitude: number | null = null;
  let longitude: number | null = null;

  const geo = place.geo;
  if (typeof geo === 'object' && geo !== null) {
    const geoObj = geo as Record<string, unknown>;
    const lat = geoObj.latitude;
    const lng = geoObj.longitude;
    if (typeof lat === 'number') latitude = lat;
    else if (typeof lat === 'string') latitude = parseFloat(lat) || null;
    if (typeof lng === 'number') longitude = lng;
    else if (typeof lng === 'string') longitude = parseFloat(lng) || null;
  }

  return { name, address, postalCode, city, latitude, longitude };
}

/**
 * Extract organizer name from a Schema.org Event.
 */
function extractOrganizer(eventObj: Record<string, unknown>): string | null {
  const org = eventObj.organizer;
  if (!org) return null;

  const orgObj = Array.isArray(org) ? org[0] : org;

  if (typeof orgObj === 'string') return orgObj;
  if (typeof orgObj === 'object' && orgObj !== null) {
    return getString(orgObj as Record<string, unknown>, 'name');
  }
  return null;
}

/**
 * Extract price information from a Schema.org Event (offers).
 */
function extractPrice(eventObj: Record<string, unknown>): {
  text: string | null;
  min: number | null;
  max: number | null;
} {
  const empty = { text: null, min: null, max: null };
  const offers = eventObj.offers;
  if (!offers) return empty;

  const offerList = Array.isArray(offers) ? offers : [offers];
  const prices: number[] = [];
  let currency = '';

  for (const offer of offerList) {
    if (typeof offer !== 'object' || offer === null) continue;
    const o = offer as Record<string, unknown>;

    const price = o.price;
    if (typeof price === 'number') {
      prices.push(price);
    } else if (typeof price === 'string') {
      const parsed = parseFloat(price);
      if (!isNaN(parsed)) prices.push(parsed);
    }

    const lowPrice = o.lowPrice;
    if (typeof lowPrice === 'number') prices.push(lowPrice);
    else if (typeof lowPrice === 'string') {
      const p = parseFloat(lowPrice);
      if (!isNaN(p)) prices.push(p);
    }

    const highPrice = o.highPrice;
    if (typeof highPrice === 'number') prices.push(highPrice);
    else if (typeof highPrice === 'string') {
      const p = parseFloat(highPrice);
      if (!isNaN(p)) prices.push(p);
    }

    if (!currency && typeof o.priceCurrency === 'string') {
      currency = o.priceCurrency;
    }
  }

  if (prices.length === 0) return empty;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currencyStr = currency || 'EUR';

  let text: string;
  if (min === max) {
    text = min === 0 ? 'Gratis' : `${min.toFixed(2)} ${currencyStr}`;
  } else {
    text = `${min.toFixed(2)} - ${max.toFixed(2)} ${currencyStr}`;
  }

  return { text, min, max: max !== min ? max : null };
}

/**
 * Extract tags/keywords from a Schema.org Event.
 */
function extractTags(eventObj: Record<string, unknown>): string[] {
  const tags: string[] = [];

  const keywords = eventObj.keywords;
  if (typeof keywords === 'string') {
    tags.push(...keywords.split(',').map((k) => k.trim()).filter(Boolean));
  } else if (Array.isArray(keywords)) {
    for (const k of keywords) {
      if (typeof k === 'string') tags.push(k.trim());
    }
  }

  // Also consider eventAttendanceMode and eventStatus as implicit tags
  const attendanceMode = getString(eventObj, 'eventAttendanceMode');
  if (attendanceMode?.includes('Online')) {
    tags.push('online');
  }

  return [...new Set(tags)]; // deduplicate
}

/**
 * Extract ticket/registration URL from offers.
 */
function extractTicketUrl(eventObj: Record<string, unknown>): string | null {
  const offers = eventObj.offers;
  if (!offers) return null;

  const offerList = Array.isArray(offers) ? offers : [offers];
  for (const offer of offerList) {
    if (typeof offer !== 'object' || offer === null) continue;
    const o = offer as Record<string, unknown>;
    const url = getString(o, 'url');
    if (url) return url;
  }

  return null;
}
