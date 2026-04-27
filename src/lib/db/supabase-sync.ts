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
import { generateEventSlug } from '@/lib/utils/slugify';
import { scoreEvent } from '@/lib/quality/score-event';

/**
 * Confidence precedence order (highest first).
 * Index = rank; lower index = higher confidence.
 * NULL is treated as lowest priority (rank = Infinity).
 */
// Priority order (lower number = higher confidence = wins on overwrite).
//
// Rationale: refinement pipelines (openai-geocode, manual fixes, fix-geocoding)
// run AFTER scraping with full context (venue name + address + bundesland),
// so they deserve priority over raw scraper coords. Scrapers often give
// bundesland-capital fallback coordinates (see the Georgi Kirtag case:
// Feratel placed it at Eisenstadt-Hauptplatz instead of St. Georgen) — those
// must not clobber a targeted geocode.
const CONFIDENCE_RANK: Record<string, number> = {
  manual: 0,                 // Hand-fixed by admin / user — never overwrite
  'gemeinde-registry': 0,    // Mapbox-verified Austrian Gemeinde centroids from
                             // data/gemeinden-registry/*.json — authoritative
                             // truth for PLZ→(lat,lng). Tied with manual at
                             // rank 0: once a row wears this confidence, no
                             // scraper/normalizer/nominatim pass is allowed
                             // to move the pin. See refresh-gemeinden-coords.ts.
  openai: 1,                 // openai-geocode.ts refinement
  gemini: 1,                 // legacy alias for openai
  exact: 2,                  // normalizer exact match
  normalized: 3,             // normalizer best-guess
  nominatim: 4,              // reverse-geocoded
  scraper: 5,                // raw scraper output — lowest among "ok" values
  from_title: 6,
  from_description: 7,
  gemini_low: 8,             // low-confidence fallback
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
  /** The URL slug. Once persisted it MUST NOT change — it's baked into
   *  Google-indexed URLs, bookmarks, and social shares. See
   *  `resolveStableSlug()` below. */
  slug: string | null;
  /** Existing publish_status — used to preserve non-computed values
   *  (e.g. 'duplicate' set by dedup, or any future manual admin status)
   *  on re-upsert. See COMPUTED_PUBLISH_STATUSES below. */
  publish_status: string | null;
}

/** Statuses that the scoring pipeline owns. Everything else (e.g.
 *  'duplicate' from dedup, future admin overrides) is preserved on
 *  re-upsert so a routine scrape can't accidentally promote a
 *  duplicate row back to 'published'. */
const COMPUTED_PUBLISH_STATUSES = new Set([
  'published',
  'published_low_confidence',
  'needs_review',
  'suppressed',
]);

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
          'category_locked, category_needs_review, category_reason, category_candidates, slug, ' +
          'publish_status',
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
  /** PLZ derived from the normalizer's Gemeinde lookup. Only set when the
   *  scraper didn't supply one — we never override an existing PLZ with an
   *  inferred guess. Populated whether or not we use the normalizer's
   *  coords, because PLZ is orthogonal to coord confidence. */
  postalCode: string | null;
} {
  // Start with scraper-provided values
  let latitude = event.latitude ?? null;
  let longitude = event.longitude ?? null;
  let locationName = event.location_name ?? null;
  let confidence: string | null = null;
  let source: string | null = null;
  let postalCode: string | null = event.postal_code ?? null;

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

      // Back-fill postal_code from the normalizer's nearest-Gemeinde
      // lookup if the scraper didn't provide one. Regardless of which
      // coord source wins above, the PLZ is always useful downstream
      // (URL prefix resolution, gemeinde-hub linking, registry-based
      // coord correction) so we write it even when keeping scraper coords.
      if (!postalCode && normalized.postal_code) {
        postalCode = normalized.postal_code;
      }
    }
  } catch {
    /* normalization failure should not block sync */
  }

  return { latitude, longitude, locationName, confidence, source, postalCode };
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

  // ─── Quality scoring at ingest ───────────────────────────────────
  // Compute against the FINAL resolved values (post-geocoding,
  // post-canonical-category) so the score reflects what we'll actually
  // persist, not the raw scraper input. Identical scoring function as
  // backfill-quality.ts — they share src/lib/quality/score-event.ts.
  //
  // publish_status: only overwrite when the existing value is one of
  // the computed statuses (or absent). Preserves dedup's 'duplicate'
  // marking and any future admin overrides.
  const score = scoreEvent({
    title: event.title,
    description: event.description ?? null,
    start_date: event.start_date,
    end_date: event.end_date ?? null,
    location_name: resolved.locationName,
    address: event.address ?? null,
    postal_code: resolved.postalCode,
    bundesland: event.bundesland ?? null,
    category: canonical.category,
    latitude: finalLat,
    longitude: finalLng,
    image_url: event.image_url ?? null,
    source_url: event.source_url,
    ticket_url: event.ticket_url ?? null,
  });

  const finalPublishStatus =
    existing?.publish_status && !COMPUTED_PUBLISH_STATUSES.has(existing.publish_status)
      ? existing.publish_status
      : score.publish_status;

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
    // postal_code is handled below via conditional spread — when
    // resolved.postalCode is null we OMIT the field entirely so the
    // Supabase upsert preserves whatever the existing row has (e.g.
    // a value written earlier by the backfill-plz-from-coords script).
    // Writing `null` explicitly here would clobber that value.
    ...(resolved.postalCode !== null ? { postal_code: resolved.postalCode } : {}),
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
    // Quality score + publish_status set at ingest. Eliminates the
    // "scrape writes qs=NULL → backfill-quality runs later" cycle.
    // Same scoring function as backfill (src/lib/quality/score-event.ts);
    // preserves non-computed publish_status values like 'duplicate'.
    quality_score: score.quality_score,
    publish_status: finalPublishStatus,
    geocoding_confidence: finalConfidence,
    geocoding_source: finalSource,
    content_fingerprint: generateFingerprint(event.title, event.start_date),
    // Slug preservation rule:
    //   - If the row already has a slug in the DB, KEEP IT. The slug is a
    //     path segment in the canonical URL (/events/{plz-ort}/{date}/{slug})
    //     and changing it would silently break every Google-indexed URL
    //     because the catch-all's (slug, date) lookup would miss.
    //   - If the row is new (or legacy without slug), generate one from
    //     title + location_name.
    //
    // We learned this the hard way — pre-phase-1 the slug was regenerated
    // every upsert, which was fine when the URL was {shortId}-{slug} because
    // the shortId anchored the lookup. With the new {plz-ort}/{date}/{slug}
    // shape, slug = primary lookup key, so it MUST be stable.
    slug: existing?.slug ?? generateEventSlug(event.title, resolved.locationName ?? event.location_name),
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
