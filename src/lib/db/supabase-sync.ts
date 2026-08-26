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
import { normalizeDistrict } from '@/lib/district-normalizer';
import { districtFromPlz } from '@/lib/plz-district';
import { bundeslandToId } from '@/lib/bundeslaender';
import { generateFingerprint } from '@/lib/dedup/fingerprint';
import { generateEventSlug } from '@/lib/utils/slugify';
import { scoreEvent } from '@/lib/quality/score-event';
import { extractDimsFromUrl } from '@/lib/event-images/extract-dims-from-url';
import {
  validateAndUpgradeImageUrl,
  type ValidatedImage,
} from '@/lib/event-images/validate-upgrade';
import {
  shouldUpgradeImage,
  pickFinalImageWidth,
  pickFinalImageHeight,
  shouldOverwriteAddress,
  shouldOverwriteDescription,
  shouldOverwritePrice,
} from '@/lib/db/upsert-guards';

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

/** Unsere Eventim-Austria-Partner-ID. Steckt auch in den Deeplinks des
 *  PFT-Feeds (siehe src/lib/eventim/types.ts). */
export const EVENTIM_AFFILIATE_ID = 'J70';

/**
 * Schreibt oeticket.com-Deeplinks auf UNSERE Affiliate-ID um.
 *
 * oeticket.com ist Eventim Austria. Aggregator-Quellen liefern deren
 * Deeplinks samt eigener Partner-ID mit — eventfinder.at etwa mit
 * `?affiliate=H51`. V4SideBox rendert die TicketBox für jeden gesetzten
 * `ticketUrl`, nicht nur für source_name='Eventim'. Ungeprüft durchgereicht
 * steht damit ein echter Ticket-Button auf unserer Seite, dessen Provision
 * an einen Mitbewerber geht (Befund 2026-08-26: 520 kommende Events mit
 * H51, per Backfill bereinigt — dieser Guard hält es dauerhaft dicht).
 *
 * Nicht-oeticket-URLs und unparsbare Strings bleiben unangetastet.
 */
export function normalizeTicketUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw; // kein gültiger Absolut-Link → unverändert lassen
  }
  if (!/(^|\.)oeticket\.com$/i.test(url.hostname)) return raw;
  url.searchParams.set('affiliate', EVENTIM_AFFILIATE_ID);
  return url.toString();
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
  // ─── UPSERT-Guard fields (fn-14.5) ─────────────────────────────────
  // These are read so toSupabaseRow() can decide whether to upgrade or
  // preserve the existing value. When a guard says "keep old", the
  // existing value is written back VERBATIM into the upsert payload
  // (see the longer note above the guard imports for why omitting the
  // key would be unsafe with PostgREST bulk upsert). last_seen_at is
  // the only column that always advances on every upsert.
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  description: string | null;
  enrichment_version: string | null;
  price_text: string | null;
  address: string | null;
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
          'publish_status, ' +
          // fn-14.5 UPSERT-Guard fields:
          'image_url, image_width, image_height, description, enrichment_version, price_text, address',
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

// ─── fn-14.5 UPSERT-Guards ───────────────────────────────────────────
// Predicates live in `./upsert-guards.ts` so they can be unit-tested
// against the same production code, with no copy in the test file.
//
// IMPORTANT (Codex review): we cannot rely on omitting keys from
// individual rows in a bulk Supabase `.upsert(batch)` call to mean
// "leave this column untouched". PostgREST normalises rows to a
// uniform key set across the batch — a row that drops `image_url`
// while another row in the same batch includes it can end up with
// `image_url = NULL` after the upsert. So when a guard says "keep
// old", we WRITE BACK the existing value verbatim. That keeps the
// column unchanged in Postgres and guarantees consistent batch row
// shapes regardless of which rows win or lose the guard.
//
// `last_seen_at` is the only column that always advances on every
// upsert — it's the soft-delete anchor the fn-14.6 nightly job
// reads.

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
  existingMap: Map<string, ExistingRow>,
  imageMap: Map<string, ValidatedImage>,
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

  // Feed sources (e.g. Eventim) provide an authoritative category via an
  // explicit code map — `category_locked` short-circuits the text classifier
  // so the mapped category is never overwritten by title/description guessing.
  const canonical = event.category_locked && event.category
    ? ({
        category: event.category,
        tags: event.tags ?? null,
        category_confidence: 'manual',
        category_source: 'manual',
        category_version: 'eventim-feed',
        category_locked: true,
        category_needs_review: false,
        category_reason: 'eventim feed category code map',
        category_candidates: null,
        changed: true,
        reconcileReason: 'locked',
      } as unknown as ReturnType<typeof resolveCanonicalCategory>)
    : resolveCanonicalCategory(
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

  // ─── fn-14.5 Image guard ─────────────────────────────────────────
  // imageMap has the validated/upgraded URL + extracted dims (when
  // possible). Dim-resolution rule:
  //   - If the validator UPGRADED the URL (new URL ≠ scraper URL),
  //     we trust ONLY the validator's dims. The scraper's dims
  //     described the pre-upgrade variant — re-using them on a
  //     wider URL persists impossible metadata (e.g. w_2000 with
  //     scraper-supplied h_300 from the original w_400 variant).
  //   - If the validator kept the original URL (unknown CDN, HEAD
  //     failed, already at-target), fall back to the scraper's dims
  //     so HTML-attribute extraction still flows through.
  const validated = imageMap.get(key);
  const scraperImageUrl = event.image_url ?? null;
  const scraperImageWidth =
    typeof event.image_width === 'number' && event.image_width > 0 ? event.image_width : null;
  const scraperImageHeight =
    typeof event.image_height === 'number' && event.image_height > 0 ? event.image_height : null;
  const newImageUrl = validated?.url || scraperImageUrl;
  const urlWasUpgraded =
    !!validated?.url && !!scraperImageUrl && validated.url !== scraperImageUrl;
  const validatorWidth =
    validated?.width && validated.width > 0 ? validated.width : null;
  const validatorHeight =
    validated?.height && validated.height > 0 ? validated.height : null;
  const newImageWidth = urlWasUpgraded
    ? validatorWidth
    : (validatorWidth ?? scraperImageWidth);
  const newImageHeight = urlWasUpgraded
    ? validatorHeight
    : (validatorHeight ?? scraperImageHeight);
  const upgradeImage = shouldUpgradeImage(
    newImageUrl,
    newImageWidth,
    newImageHeight,
    existing?.image_url ?? null,
    existing?.image_width ?? null,
    existing?.image_height ?? null,
    // HEAD-validated CDN allowlist upgrade — accepts the new URL
    // even when extracted dims are absent (e.g. WordPress strip
    // pattern). Validator only sets this flag on actual URL change.
    validated?.upgraded === true,
  );

  // ─── fn-14.5 Description guard ───────────────────────────────────
  // For raw scraper writes the new enrichment_version is unknown
  // (null) — we never set it from this function. Pass null so the
  // length comparison runs but the version-upgrade branch is skipped.
  const newDescription = event.description ?? null;
  const overwriteDescription = shouldOverwriteDescription(
    newDescription,
    existing?.description ?? null,
    null,
    existing?.enrichment_version ?? null,
  );

  // ─── fn-14.5 Price-text guard ────────────────────────────────────
  const overwritePrice = shouldOverwritePrice(
    event.price_text ?? null,
    existing?.price_text ?? null,
  );

  // ─── Address guard (hourly-sync safe) ────────────────────────────
  // Don't let a re-scrape that no longer carries a street erase an
  // address that detail-fetch / enrichment populated earlier.
  const overwriteAddress = shouldOverwriteAddress(
    event.address ?? null,
    existing?.address ?? null,
  );
  const finalAddress = overwriteAddress
    ? (event.address ?? null)
    : (existing?.address ?? null);

  // Resolve final guarded values FIRST so every row in the batch
  // carries the SAME key set (otherwise PostgREST's bulk-upsert
  // key-shape normalisation can clobber preserved columns with NULL —
  // see Codex-review note above the imports). When the guard says
  // "keep old", we explicitly write back the existing value verbatim.
  //
  // Width and height are picked INDEPENDENTLY of the URL-upgrade
  // decision: even when we keep the existing URL, a freshly-known
  // dim from the same URL still backfills its column. And when we
  // adopt a wider new URL with unknown height, the existing height
  // is preserved instead of NULL-clobbered.
  //
  // CRITICAL: build these BEFORE scoring so quality_score reflects
  // the row that will actually be persisted (e.g. whitespace-only
  // description rejected by the guard → row stores NULL → score
  // must also evaluate against NULL, not the rejected raw input).
  const finalImageUrl = upgradeImage ? newImageUrl : (existing?.image_url ?? null);
  const finalImageWidth = pickFinalImageWidth(
    upgradeImage,
    newImageWidth,
    existing?.image_width ?? null,
  );
  const finalImageHeight = pickFinalImageHeight(
    upgradeImage,
    newImageHeight,
    existing?.image_height ?? null,
  );
  const finalDescription = overwriteDescription
    ? newDescription
    : (existing?.description ?? null);
  const finalPriceText = overwritePrice
    ? (event.price_text ?? null)
    : (existing?.price_text ?? null);
  // Fremde Affiliate-IDs in oeticket-Deeplinks auf J70 umbiegen, bevor der
  // Wert sowohl ins Quality-Scoring als auch in die Zeile geht.
  const finalTicketUrl = normalizeTicketUrl(event.ticket_url);

  // ─── Quality scoring at ingest ───────────────────────────────────
  // Compute against the FINAL resolved values (post-geocoding,
  // post-canonical-category, post-UPSERT-guard) so the score reflects
  // what we'll actually persist, not the raw scraper input. Identical
  // scoring function as backfill-quality.ts — they share
  // src/lib/quality/score-event.ts.
  //
  // publish_status: only overwrite when the existing value is one of
  // the computed statuses (or absent). Preserves dedup's 'duplicate'
  // marking and any future admin overrides.
  const score = scoreEvent({
    title: event.title,
    description: finalDescription,
    start_date: event.start_date,
    end_date: event.end_date ?? null,
    location_name: resolved.locationName,
    address: finalAddress,
    postal_code: resolved.postalCode,
    bundesland: event.bundesland ?? null,
    country: event.country ?? null,
    category: canonical.category,
    latitude: finalLat,
    longitude: finalLng,
    image_url: finalImageUrl,
    source_url: event.source_url,
    ticket_url: finalTicketUrl,
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
    description: finalDescription,
    start_date: event.start_date,
    end_date: event.end_date ?? null,
    location_name: resolved.locationName,
    address: finalAddress,
    // postal_code is handled below via conditional spread — when
    // resolved.postalCode is null we OMIT the field entirely so the
    // Supabase upsert preserves whatever the existing row has (e.g.
    // a value written earlier by the backfill-plz-from-coords script).
    // Writing `null` explicitly here would clobber that value.
    //
    // Note: this conditional-spread pattern is safe specifically for
    // postal_code because EITHER (a) every row in the batch has
    // resolved.postalCode (uniform shape) OR (b) we accept the
    // existing-clobber risk for the (rare) cross-batch mixed case —
    // an existing migration explicitly relies on "scrape can't
    // overwrite a backfilled PLZ", which the omit semantics covers
    // for the homogeneous-batch case. The guarded fields above
    // (image_url/description/price_text) cannot use the same trick
    // because their cross-batch heterogeneity is the COMMON case.
    ...(resolved.postalCode !== null ? { postal_code: resolved.postalCode } : {}),
    // Canonicalise bundesland to one of the 9 lowercase IDs that
    // bundeslandToId() recognises. The Feratel/TourData scrapers
    // emit "Salzburg" / "Kärnten" / "Tirol" Title-Case; without this
    // 9k+ events end up under a bundesland the client filter doesn't
    // know about, leaving them invisible on the map.
    bundesland: bundeslandToId(event.bundesland) ?? null,
    // Normalise district at scrape-time so the FilterDrawer chip can
    // match by exact string. Without this, every new scrape pumps
    // freshly-spelled aliases (e.g. "bruck/leitha", "suedoststeiermark")
    // back into the DB and undoes the canonical-rewrite migration.
    // Note: pass the canonicalised bundesland id so the alias map's
    // bundesland-scoped lookup actually hits.
    // fn-19: Quellen ohne Bezirksfeld (Feratel, Gemeinde-Kalender,
    // Eventim) liefern district=NULL — der Stadt-Filter der Smart-Suche
    // wirft solche Events dann komplett raus (Eisenstadt-Befund
    // 2026-07-31: Hub 59 Events, Suche 0). Fallback: Bezirk aus der PLZ.
    district:
      normalizeDistrict(
        event.district,
        bundeslandToId(event.bundesland) ?? null,
        resolved.postalCode ?? event.postal_code,
      ) ??
      districtFromPlz(
        resolved.postalCode ?? event.postal_code,
        bundeslandToId(event.bundesland),
      ),
    latitude: finalLat,
    longitude: finalLng,
    country: event.country ?? 'AT',
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
    // Guarded fields — always written, value picked above.
    price_text: finalPriceText,
    price_min: event.price_min ?? null,
    price_max: event.price_max ?? null,
    image_url: finalImageUrl,
    image_width: finalImageWidth,
    image_height: finalImageHeight,
    organizer: event.organizer ?? null,
    ticket_url: finalTicketUrl,
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
    // fn-14.5: ALWAYS bump last_seen_at — anchor for the soft-delete
    // job in fn-14.6. INSERT or UPDATE, doesn't matter.
    last_seen_at: new Date().toISOString(),
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

    // Batch-prefetch existing rows for confidence comparison + UPSERT-Guards
    const keys = batchEvents.map(e => ({
      source_name: e.source_name,
      source_id: e.source_id,
    }));
    const existingMap = await prefetchExistingRows(supabase, keys);

    // fn-14.5: validate + (when applicable) upgrade image URLs in
    // parallel with bounded concurrency. Pure no-op for events without
    // image_url. The map is keyed by `source_name::source_id` so
    // toSupabaseRow can look up the validated URL + extracted dims.
    const imageMap = await validateImagesForBatch(batchEvents);

    const batch = batchEvents.map(e => toSupabaseRow(e, existingMap, imageMap));
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

// ─── fn-14.5 image validate-and-upgrade pool ─────────────────────────
// Runs `validateAndUpgradeImageUrl()` per event with bounded
// concurrency (default 5). Events without an image_url short-circuit
// and never enter the pool. The result map is keyed by
// `source_name::source_id` to match toSupabaseRow's lookup.

const IMAGE_VALIDATE_CONCURRENCY = 5;

async function validateImagesForBatch(
  events: ScrapedEvent[],
): Promise<Map<string, ValidatedImage>> {
  const result = new Map<string, ValidatedImage>();

  const tasks: Array<{ key: string; event: ScrapedEvent }> = events
    .filter(e => !!e.image_url)
    .map(e => ({ key: `${e.source_name}::${e.source_id}`, event: e }));

  if (tasks.length === 0) return result;

  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const idx = cursor++;
      const { key, event } = tasks[idx];
      try {
        const validated = await validateAndUpgradeImageUrl(
          event.image_url!,
          event.image_width ?? null,
          event.image_height ?? null,
        );
        result.set(key, validated);
      } catch {
        // Never let a single bad URL halt the batch — fall back to
        // pattern-extracted dims off the original URL.
        const dims = extractDimsFromUrl(event.image_url || null);
        result.set(key, {
          url: event.image_url || '',
          width: dims.width ?? event.image_width ?? undefined,
          height: dims.height ?? event.image_height ?? undefined,
        });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(IMAGE_VALIDATE_CONCURRENCY, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return result;
}
