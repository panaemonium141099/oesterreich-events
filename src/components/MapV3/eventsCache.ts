/**
 * Lightweight session cache for the /map events list.
 *
 * The full event set takes ~6+ seconds to fetch in batches. Without a
 * cache, every navigation to /map (Liste from the landing page, /map
 * from a detail page back-button, etc.) triggers a full refetch and the
 * user stares at a skeleton. With this cache, we render the previously-
 * loaded list instantly and silently kick off a background refetch.
 *
 * Persistence layer: sessionStorage. Survives in-tab navigation and
 * reloads, dies when the tab closes — that matches the user's expected
 * "freshness" model. Storage budget: ~5MB per origin which fits ~30k
 * events comfortably (we trim to a hard cap below).
 *
 * Cache key: a hash of the current filter set. Two users with different
 * Bundesland/Datum/Search filters get separate cache entries so we don't
 * show stale-irrelevant data.
 *
 * Versioning: bumping CACHE_VERSION invalidates every previously-saved
 * entry across all clients (e.g. after a schema change to Event[]).
 */
import type { Event, EventFilters } from '@/types/events';

const CACHE_VERSION = 'v2';
const TTL_MS = 10 * 60 * 1000; // 10 minutes
// 8000 slimmed events ≈ 3-4MB JSON. Stays well under the 5MB sessionStorage
// quota Safari enforces, with headroom for the parser overhead. The list
// view's infinite scroll still pages through the full 60k via the API on
// demand; the cache only needs to render the first screenful instantly.
const MAX_EVENTS = 8_000;
const KEY_PREFIX = `mv3-events-cache-${CACHE_VERSION}::`;

/** The slim subset the /map list and Mapbox markers actually read. Caching
 *  the full Event with all enrichment + descriptions blew through the 5MB
 *  quota on Safari. We re-fetch the heavy details lazily via the detail
 *  modal anyway, so dropping them here is safe. */
type CachedEvent = Pick<
  Event,
  | 'id'
  | 'title'
  | 'start_date'
  | 'end_date'
  | 'location_name'
  | 'address'
  | 'postal_code'
  | 'bundesland'
  | 'district'
  | 'latitude'
  | 'longitude'
  | 'category'
  | 'price_text'
  | 'image_url'
  | 'tags'
  | 'event_score'
  | 'created_at'
  | 'updated_at'
>;

function slim(e: Event): CachedEvent {
  return {
    id: e.id,
    title: e.title,
    start_date: e.start_date,
    end_date: e.end_date,
    location_name: e.location_name,
    address: e.address,
    postal_code: e.postal_code,
    bundesland: e.bundesland,
    district: e.district,
    latitude: e.latitude,
    longitude: e.longitude,
    category: e.category,
    price_text: e.price_text,
    image_url: e.image_url,
    tags: e.tags,
    event_score: e.event_score,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

interface CacheEntry {
  ts: number;
  events: CachedEvent[];
  total: number | null;
}

/**
 * Hash the slice of filters that affect the API query, NOT the local
 * client-side filters (district, sort, viewMode). Must mirror buildParams
 * in /map/page.tsx exactly — if the server query changes, the cache key
 * must change too, otherwise we'd serve cached results that don't match.
 */
function filterKey(filters: EventFilters): string {
  const k = {
    cat: filters.category ?? null,
    tags: filters.tags?.slice().sort().join(',') ?? null,
    df: filters.dateFrom ?? null,
    dt: filters.dateTo ?? null,
    pmin: filters.priceMin ?? null,
    pmax: filters.priceMax ?? null,
    s: filters.search ?? null,
    bb: filters.bbox?.map((n) => n.toFixed(3)).join(',') ?? null,
    pn: filters.placeName ?? null,
    pp: filters.placePostalCode ?? null,
    bl: filters.bundesland ?? null,
    en: filters.eveningOnly ?? null,
    src: filters.sourceName ?? null,
    sf: filters.studentFriendly ?? null,
    ff: filters.familyFriendly ?? null,
    pt: filters.priceTier ?? null,
  };
  return KEY_PREFIX + JSON.stringify(k);
}

export function readCache(filters: EventFilters): CacheEntry | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(filterKey(filters));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (!entry.ts || Date.now() - entry.ts > TTL_MS) return null;
    if (!Array.isArray(entry.events)) return null;
    return entry;
  } catch {
    return null;
  }
}

export function writeCache(
  filters: EventFilters,
  events: Event[],
  total: number | null,
): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const trimmed = events.length > MAX_EVENTS ? events.slice(0, MAX_EVENTS) : events;
    // Slim each event to the fields the list/map actually render so we
    // stay under sessionStorage's ~5MB quota even with the full 8k cap.
    const slimmed = trimmed.map(slim);
    const entry = { ts: Date.now(), events: slimmed, total };
    window.sessionStorage.setItem(filterKey(filters), JSON.stringify(entry));
  } catch {
    // Quota exceeded or serialization failed — best-effort, ignore.
  }
}

/**
 * Wipe every cache entry across all filter combinations. Call when the
 * user explicitly resets filters (so a stale 60k-event list doesn't sit
 * in storage when they're now looking at "Heute · Wien · 200 Events").
 */
export function clearCache(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) toDelete.push(key);
    }
    toDelete.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
