/**
 * Supabase sync for scraper pipeline.
 *
 * Upserts a batch of ScrapedEvents into the Supabase `events` table using
 * the service role key (bypasses RLS). Conflict resolution: ON CONFLICT
 * (source_name, source_id) -> update all mutable fields.
 *
 * Confidence-aware coordinate handling:
 * - Batch-prefetches existing rows to compare geocoding_confidence before upsert
 * - Only overwrites coords when new confidence is strictly higher rank
 * - Skips overwrite when distance < 5km and existing confidence is not NULL
 * - Fuzzy normalizer results are never stored as coordinates
 *
 * Confidence-aware category handling (central classifier):
 * - Raw scraper-provided category/tags are persisted as source_category_raw /
 *   source_tags_raw and are only signals, never the final answer.
 * - The deterministic classifier runs inline on every upsert and writes
 *   category + tags + category_confidence + category_source + category_version.
 * - category_locked=true on an existing row prevents any overwrite.
 * - New deterministic confidence only overwrites existing categorization when
 *   its rank is <= the existing rank (never downgrades ai -> ai_low silently).
 * - Events that the deterministic stage cannot accept are flagged
 *   category_needs_review=true for the batch AI script.
 *
 * Used by runScraper() so every scraper writes directly to Supabase
 * in addition to SQLite (dual-write pattern).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ScrapedEvent } from '@/types/events';
import {
  resolveCanonicalCategory,
  type ExistingCategoryRow,
} from '@/lib/category-classifier';
import { normalizeEventLocation } from '@/lib/location-normalizer';
import { generateFingerprint } from '@/lib/dedup/fingerprint';

/**
 * Confidence precedence order (highest first).
 * Index = rank; lower index = higher confidence.
 * NULL is treated as lowest priority (rank = Infinity).
 */
const CONFIDENCE_RANK: Record<string, number> = {
  manual: 0,
  scraper: 1,
  exact: 2,
  normalized: 3,
  from_title: 4,
  from_description: 5,
  nominatim: 6,
  gemini: 7,
  gemini_low: 8,
};

/** Distance threshold in km; below this we skip overwrite to preserve precise coords. */
const DISTANCE_THRESHOLD_KM = 5;

function getConfidenceRank(confidence: string | null | undefined): number {
  if (!confidence) return Infinity; // NULL = lowest priority
  return CONFIDENCE_RANK[confidence] ?? Infinity;
}

/** Haversine distance in km between two lat/lng pairs. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for scraper sync');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Existing row shape returned by batch-prefetch. */
interface ExistingRow {
  source_name: string;
  source_id: string;
  latitude: number | null;
  longitude: number | null;
  geocoding_confidence: string | null;
  geocoding_source: string | null;
  category: string | null;
  tags: string[] | null;
  category_confidence: string | null;
  category_source: string | null;
  category_version: string | null;
  category_locked: boolean | null;
  category_needs_review: boolean | null;
  category_reason: string | null;
  category_candidates: unknown;
}

/**
 * Batch-prefetch existing rows by composite key (source_name, source_id).
 * Returns a map keyed by "source_name::source_id".
 *
 * Strategy: fetch by unique source_names using .in() (safe, no escaping needed
 * since .in() uses Supabase SDK's array parameter binding), then filter
 * client-side by source_id to match the exact composite keys.
 */
async function prefetchExistingRows(
  supabase: SupabaseClient,
  keys: Array<{ source_name: string; source_id: string }>
): Promise<Map<string, ExistingRow>> {
  const map = new Map<string, ExistingRow>();
  if (keys.length === 0) return map;

  // Build a set of expected composite keys for client-side filtering
  const expectedKeys = new Set(keys.map(k => `${k.source_name}::${k.source_id}`));

  // Get unique source_names to query (within a batch, usually 1-3 unique scrapers)
  const uniqueSourceNames = [...new Set(keys.map(k => k.source_name))];

  // Also get unique source_ids for a secondary filter to reduce result set
  const uniqueSourceIds = [...new Set(keys.map(k => k.source_id))];

  // Supabase .in() has a practical limit; split source_ids into sub-batches
  const SUB_BATCH = 200;
  for (let i = 0; i < uniqueSourceIds.length; i += SUB_BATCH) {
    const idSlice = uniqueSourceIds.slice(i, i + SUB_BATCH);
    const { data, error } = await supabase
      .from('events')
      .select(
        'source_name, source_id, latitude, longitude, geocoding_confidence, geocoding_source, ' +
          'category, tags, category_confidence, category_source, category_version, ' +
          'category_locked, category_needs_review, category_reason, category_candidates',
      )
      .in('source_name', uniqueSourceNames)
      .in('source_id', idSlice);

    if (error) {
      console.error('[supabase-sync] prefetch error:', error.message);
      continue;
    }
    // Supabase's generated types infer a narrow row shape from the SELECT
    // string; our SELECT is long enough that it falls back to a pessimistic
    // union, so we widen to ExistingRow[] explicitly.
    const rows = (data ?? []) as unknown as ExistingRow[];
    for (const row of rows) {
      const key = `${row.source_name}::${row.source_id}`;
      // Client-side filter: only include rows that match our exact composite keys
      if (expectedKeys.has(key)) {
        map.set(key, row);
      }
    }
  }
  return map;
}

/**
 * Determine the geocoding confidence and source for an event,
 * plus resolved coordinates and location name.
 */
function resolveCoordinates(event: ScrapedEvent): {
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  confidence: string | null;
  source: string | null;
} {
  // Start with scraper-provided values
  let latitude = event.latitude ?? null;
  let longitude = event.longitude ?? null;
  let locationName = event.location_name ?? null;
  let confidence: string | null = null;
  let source: string | null = null;

  // If scraper provides coords, mark as scraper confidence
  if (latitude != null && longitude != null) {
    confidence = 'scraper';
    source = 'scraper';
  }

  // Try normalizer for better/additional data
  try {
    const normalized = normalizeEventLocation({
      location_name: event.location_name,
      address: event.address,
      postal_code: event.postal_code,
      bundesland: event.bundesland,
      latitude: event.latitude,
      longitude: event.longitude,
      title: event.title,
      description: event.description,
    });

    if (normalized && normalized.confidence !== 'fuzzy') {
      // Always update location name if normalizer found a canonical one
      if (normalized.location_name) {
        locationName = normalized.location_name;
      }

      // For coordinates: normalizer result can fill missing coords
      // or upgrade confidence when scraper didn't provide coords
      if (latitude == null || longitude == null) {
        // No scraper coords - use normalizer result
        latitude = normalized.latitude;
        longitude = normalized.longitude;
        confidence = normalized.confidence;
        source = 'geonames';
      }
      // If scraper provided coords, keep them (scraper rank > normalizer rank)
    }
  } catch {
    /* normalization failure should not block sync */
  }

  return { latitude, longitude, locationName, confidence, source };
}

/**
 * Decide whether to overwrite existing coordinates with new ones.
 * Returns true if the new coords should replace existing ones.
 */
function shouldOverwriteCoords(
  existing: ExistingRow,
  newLat: number | null,
  newLng: number | null,
  newConfidence: string | null
): boolean {
  // No new coords to write
  if (newLat == null || newLng == null) return false;

  // No existing coords - always write
  if (existing.latitude == null || existing.longitude == null) return true;

  const existingRank = getConfidenceRank(existing.geocoding_confidence);
  const newRank = getConfidenceRank(newConfidence);

  // Only overwrite when new confidence is strictly higher (lower rank number)
  if (newRank >= existingRank) return false;

  // Even with higher confidence, skip if distance < 5km and existing has confidence
  // (prevents overwriting precise scraper coords with nearby town-center GeoNames coords)
  if (existing.geocoding_confidence != null) {
    const distance = haversineKm(existing.latitude, existing.longitude, newLat, newLng);
    if (distance < DISTANCE_THRESHOLD_KM) return false;
  }

  return true;
}

/**
 * Build the category-reconciliation input shape from an existing row.
 * Returns null when there is no pre-existing event (fresh insert path).
 */
function toExistingCategoryRow(row: ExistingRow | undefined): ExistingCategoryRow | null {
  if (!row) return null;
  return {
    category: row.category,
    tags: row.tags,
    category_confidence: row.category_confidence,
    category_source: row.category_source,
    category_version: row.category_version,
    category_locked: row.category_locked,
    category_needs_review: row.category_needs_review,
    category_reason: row.category_reason,
    category_candidates: row.category_candidates,
  };
}

/** Maps a ScrapedEvent to the Supabase events row shape. */
function toSupabaseRow(
  event: ScrapedEvent,
  existingMap: Map<string, ExistingRow>
) {
  const resolved = resolveCoordinates(event);

  const key = `${event.source_name}::${event.source_id}`;
  const existing = existingMap.get(key);

  let finalLat = resolved.latitude;
  let finalLng = resolved.longitude;
  let finalConfidence = resolved.confidence;
  let finalSource = resolved.source;

  if (existing) {
    if (!shouldOverwriteCoords(existing, resolved.latitude, resolved.longitude, resolved.confidence)) {
      // Keep existing coords, confidence, and source
      finalLat = existing.latitude;
      finalLng = existing.longitude;
      finalConfidence = existing.geocoding_confidence;
      finalSource = existing.geocoding_source;
    }
  }

  const canonical = resolveCanonicalCategory(
    {
      title: event.title,
      description: event.description ?? null,
      source_tags_raw: event.tags ?? null,
      source_category_raw: event.category ?? null,
      source_name: event.source_name,
      organizer: event.organizer ?? null,
      location_name: event.location_name ?? null,
    },
    toExistingCategoryRow(existing),
  );

  return {
    source_type: 'scraped' as const,
    source_name: event.source_name,
    source_id: event.source_id,
    source_url: event.source_url,
    title: event.title,
    description: event.description ?? null,
    start_date: event.start_date,
    end_date: event.end_date ?? null,
    location_name: resolved.locationName,
    address: event.address ?? null,
    postal_code: event.postal_code ?? null,
    bundesland: event.bundesland ?? null,
    district: event.district ?? null,
    latitude: finalLat,
    longitude: finalLng,
    category: canonical.category,
    tags: canonical.tags && canonical.tags.length > 0 ? canonical.tags : null,
    source_category_raw: event.category ?? null,
    source_tags_raw: event.tags ?? null,
    category_confidence: canonical.category_confidence,
    category_source: canonical.category_source,
    category_version: canonical.category_version,
    category_locked: canonical.category_locked,
    category_needs_review: canonical.category_needs_review,
    category_reason: canonical.category_reason,
    category_candidates: canonical.category_candidates,
    price_text: event.price_text ?? null,
    price_min: event.price_min ?? null,
    price_max: event.price_max ?? null,
    image_url: event.image_url ?? null,
    organizer: event.organizer ?? null,
    ticket_url: event.ticket_url ?? null,
    visibility: 'public' as const,
    geocoding_confidence: finalConfidence,
    geocoding_source: finalSource,
    content_fingerprint: generateFingerprint(event.title, event.start_date),
    // venue_id from registry-based scraper (null for regular scrapers)
    ...(event.venue_id ? { venue_id: event.venue_id } : {}),
  };
}

const BATCH_SIZE = 100;

/**
 * Validate and filter events before sync:
 * - Reject events with missing/invalid start_date
 * - Reject events with start_date in the past (allows today)
 * - Reject events with end_date < start_date
 * - Reject events with empty title
 * Returns filtered events + count of rejected.
 */
function filterValidEvents(events: ScrapedEvent[]): { valid: ScrapedEvent[]; rejected: number } {
  const now = new Date();
  // Start of today (midnight) — events today are still valid
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  let rejected = 0;
  const valid = events.filter(e => {
    // Must have a title
    if (!e.title || !e.title.trim()) {
      rejected++;
      return false;
    }

    // Must have a parseable start_date
    if (!e.start_date) {
      rejected++;
      return false;
    }
    const startDate = new Date(e.start_date);
    if (isNaN(startDate.getTime())) {
      rejected++;
      return false;
    }

    // start_date must not be in the past (compare date strings to ignore time)
    const startStr = e.start_date.slice(0, 10); // "YYYY-MM-DD"
    if (startStr < todayStr) {
      rejected++;
      return false;
    }

    // If end_date exists, it must be valid and >= start_date
    if (e.end_date) {
      const endDate = new Date(e.end_date);
      if (isNaN(endDate.getTime())) {
        rejected++;
        return false;
      }
      const endStr = e.end_date.slice(0, 10);
      if (endStr < startStr) {
        rejected++;
        return false;
      }
    }

    return true;
  });

  return { valid, rejected };
}

/**
 * Upserts a list of scraped events into Supabase in batches.
 * Returns counts of inserted/updated rows.
 */
export async function syncEventsToSupabase(
  events: ScrapedEvent[]
): Promise<{ upserted: number; errors: number; filtered: number }> {
  if (events.length === 0) return { upserted: 0, errors: 0, filtered: 0 };

  // Validate events before sync
  const { valid: validEvents, rejected: filtered } = filterValidEvents(events);
  if (filtered > 0) {
    console.log(`[supabase-sync] Filtered ${filtered} invalid/past events (${validEvents.length} remaining)`);
  }
  if (validEvents.length === 0) return { upserted: 0, errors: 0, filtered };

  const supabase = getSupabaseAdminClient();
  let upserted = 0;
  let errors = 0;

  // Deduplicate events by source_name+source_id before syncing
  // (ON CONFLICT DO UPDATE fails if same key appears twice in one batch)
  const seen = new Set<string>();
  const dedupedEvents = validEvents.filter(e => {
    const key = `${e.source_name}::${e.source_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (let i = 0; i < dedupedEvents.length; i += BATCH_SIZE) {
    const batchEvents = dedupedEvents.slice(i, i + BATCH_SIZE);

    // Batch-prefetch existing rows for confidence comparison
    const keys = batchEvents.map(e => ({
      source_name: e.source_name,
      source_id: e.source_id,
    }));
    const existingMap = await prefetchExistingRows(supabase, keys);

    const batch = batchEvents.map(e => toSupabaseRow(e, existingMap));
    const { error, count } = await supabase
      .from('events')
      .upsert(batch, {
        onConflict: 'source_name,source_id',
        count: 'exact',
      });

    if (error) {
      console.error(`[supabase-sync] Batch ${i}-${i + batch.length} error:`, error.message);
      errors += batch.length;
    } else {
      upserted += count ?? batch.length;
    }
  }

  return { upserted, errors, filtered };
}
