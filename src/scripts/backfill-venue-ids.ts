/**
 * Backfill: Assign venue_id to existing events via fuzzy matching.
 *
 * Fetches all venues from Supabase, then iterates through events that
 * have no venue_id and attempts to match them to venues using:
 * 1. Normalized name matching (Jaro-Winkler similarity >= 0.9)
 * 2. Geographic proximity check (within 2km for name matches)
 *
 * Conservative: only assigns venue_id when confidence > 0.9 to avoid
 * false positives.
 *
 * Run: npx tsx src/scripts/backfill-venue-ids.ts
 *      npx tsx src/scripts/backfill-venue-ids.ts --dry-run
 *      npx tsx src/scripts/backfill-venue-ids.ts --limit=1000
 *      npx tsx src/scripts/backfill-venue-ids.ts --verbose
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jaroWinkler } from '../lib/dedup/jaro-winkler';

// ─── ENV LOADING ────────────────────────────────────────────────────────────
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* ignore missing .env.local */ }

// ─── TYPES ──────────────────────────────────────────────────────────────────

/** Minimal venue shape for matching */
export interface VenueCandidate {
  id: string;
  name: string;
  name_normalized: string;
  city: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Minimal event shape for matching */
export interface EventCandidate {
  id: string;
  title: string;
  location_name: string | null;
  address: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Result of a venue match attempt */
export interface VenueMatch {
  eventId: string;
  venueId: string;
  venueName: string;
  eventLocationName: string | null;
  similarity: number;
  distanceKm: number | null;
  method: 'name-exact' | 'name-fuzzy' | 'name-geo';
}

// ─── MATCHING CONSTANTS ─────────────────────────────────────────────────────

/** Minimum Jaro-Winkler similarity for venue matching (conservative). */
export const VENUE_MATCH_THRESHOLD = 0.9;

/** Maximum distance in kilometers for geo-proximity validation. */
export const MAX_DISTANCE_KM = 2.0;

/** Batch size for Supabase updates. */
const UPDATE_BATCH_SIZE = 200;

/** Batch size for fetching events from Supabase (pagination). */
const FETCH_BATCH_SIZE = 1000;

// ─── NORMALIZATION ──────────────────────────────────────────────────────────

/**
 * Normalize a location/venue name for matching.
 * Same approach as import-osm-venues normalizeName + extra cleanup.
 */
export function normalizeLocationName(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── GEO DISTANCE ───────────────────────────────────────────────────────────

/**
 * Haversine distance in kilometers between two lat/lon points.
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── VENUE INDEX ────────────────────────────────────────────────────────────

/**
 * Build a lookup index from normalized venue names to venue candidates.
 * Groups venues by their normalized name for fast lookup.
 */
export function buildVenueIndex(
  venues: VenueCandidate[],
): Map<string, VenueCandidate[]> {
  const index = new Map<string, VenueCandidate[]>();
  for (const venue of venues) {
    const key = venue.name_normalized;
    const list = index.get(key) ?? [];
    list.push(venue);
    index.set(key, list);
  }
  return index;
}

// ─── MATCHING ───────────────────────────────────────────────────────────────

/**
 * Build a Bundesland-based venue index for faster fuzzy matching.
 * Instead of scanning all 5600 venues, only scan venues in the same Bundesland.
 */
export function buildBundeslandIndex(
  venues: VenueCandidate[],
): Map<string, VenueCandidate[]> {
  const index = new Map<string, VenueCandidate[]>();
  for (const venue of venues) {
    const key = venue.bundesland || '__unknown__';
    const list = index.get(key) ?? [];
    list.push(venue);
    index.set(key, list);
  }
  return index;
}

/**
 * Try to match an event to a venue.
 *
 * Strategy:
 * 1. Normalize the event's location_name
 * 2. Check for exact normalized match in the venue index (O(1) via HashMap)
 * 3. If no exact match AND event has a Bundesland, fuzzy scan only same-Bundesland venues
 *
 * Returns the best match or null if no match meets the confidence threshold.
 */
export function matchEventToVenue(
  event: EventCandidate,
  venueIndex: Map<string, VenueCandidate[]>,
  allVenues: VenueCandidate[],
  bundeslandIndex?: Map<string, VenueCandidate[]>,
): VenueMatch | null {
  const locationName = event.location_name;
  if (!locationName || !locationName.trim()) return null;

  const normalizedLocation = normalizeLocationName(locationName);
  if (!normalizedLocation || normalizedLocation.length < 3) return null;

  // Strategy 1: Exact normalized name match (fast - HashMap lookup)
  const exactMatches = venueIndex.get(normalizedLocation);
  if (exactMatches && exactMatches.length > 0) {
    const best = pickClosestVenue(event, exactMatches);
    if (best) {
      const dist = computeDistance(event, best);
      return {
        eventId: event.id,
        venueId: best.id,
        venueName: best.name,
        eventLocationName: locationName,
        similarity: 1.0,
        distanceKm: dist,
        method: 'name-exact',
      };
    }
  }

  // Strategy 2: Fuzzy Jaro-Winkler scan (only same Bundesland to stay fast)
  // Skip fuzzy if no Bundesland (would require scanning all 5600 venues)
  const searchVenues = bundeslandIndex && event.bundesland
    ? bundeslandIndex.get(event.bundesland) ?? []
    : [];

  if (searchVenues.length === 0) return null;

  let bestMatch: VenueCandidate | null = null;
  let bestSimilarity = 0;

  for (const venue of searchVenues) {
    const sim = jaroWinkler(normalizedLocation, venue.name_normalized);
    if (sim >= VENUE_MATCH_THRESHOLD && sim > bestSimilarity) {
      bestSimilarity = sim;
      bestMatch = venue;
    }
  }

  if (!bestMatch) return null;

  // Validate geo proximity if both have coordinates
  const dist = computeDistance(event, bestMatch);
  if (dist !== null && dist > MAX_DISTANCE_KM) {
    return null;
  }

  return {
    eventId: event.id,
    venueId: bestMatch.id,
    venueName: bestMatch.name,
    eventLocationName: locationName,
    similarity: bestSimilarity,
    distanceKm: dist,
    method: dist !== null ? 'name-geo' : 'name-fuzzy',
  };
}

/**
 * Pick the geographically closest venue from a list of candidates.
 * If the event has no coordinates, returns the first candidate.
 */
function pickClosestVenue(
  event: EventCandidate,
  venues: VenueCandidate[],
): VenueCandidate | null {
  if (venues.length === 0) return null;
  if (venues.length === 1) return venues[0];

  // If event has no coords, try matching by bundesland
  if (event.latitude == null || event.longitude == null) {
    if (event.bundesland) {
      const sameRegion = venues.filter(v => v.bundesland === event.bundesland);
      if (sameRegion.length > 0) return sameRegion[0];
    }
    return venues[0];
  }

  let closest: VenueCandidate = venues[0];
  let minDist = Infinity;

  for (const venue of venues) {
    if (venue.latitude == null || venue.longitude == null) continue;
    const dist = haversineKm(
      event.latitude,
      event.longitude,
      venue.latitude,
      venue.longitude,
    );
    if (dist < minDist) {
      minDist = dist;
      closest = venue;
    }
  }

  return closest;
}

/**
 * Compute distance between an event and a venue.
 * Returns null if either lacks coordinates.
 */
function computeDistance(
  event: EventCandidate,
  venue: VenueCandidate,
): number | null {
  if (
    event.latitude == null ||
    event.longitude == null ||
    venue.latitude == null ||
    venue.longitude == null
  ) {
    return null;
  }
  return haversineKm(
    event.latitude,
    event.longitude,
    venue.latitude,
    venue.longitude,
  );
}

// ─── SUPABASE DATA ACCESS ───────────────────────────────────────────────────

/**
 * Fetch all venues from Supabase.
 */
export async function fetchAllVenues(
  supabase: SupabaseClient,
): Promise<VenueCandidate[]> {
  const venues: VenueCandidate[] = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('venues')
      .select('id, name, name_normalized, city, bundesland, latitude, longitude')
      .range(from, from + batchSize - 1);

    if (error) throw new Error(`Failed to fetch venues: ${error.message}`);
    if (!data || data.length === 0) break;

    venues.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return venues;
}

/**
 * Fetch events without venue_id from Supabase (paginated).
 */
export async function fetchUnmatchedEvents(
  supabase: SupabaseClient,
  limit?: number,
): Promise<EventCandidate[]> {
  const events: EventCandidate[] = [];
  let from = 0;

  while (true) {
    const remaining = limit ? limit - events.length : FETCH_BATCH_SIZE;
    if (limit && remaining <= 0) break;

    const batchSize = Math.min(FETCH_BATCH_SIZE, remaining);
    const { data, error } = await supabase
      .from('events')
      .select('id, title, location_name, address, bundesland, latitude, longitude')
      .is('venue_id', null)
      .not('location_name', 'is', null)
      .range(from, from + batchSize - 1);

    if (error) throw new Error(`Failed to fetch events: ${error.message}`);
    if (!data || data.length === 0) break;

    events.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return events;
}

/**
 * Update events with their matched venue_id in batches.
 */
export async function updateEventVenueIds(
  supabase: SupabaseClient,
  matches: VenueMatch[],
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < matches.length; i += UPDATE_BATCH_SIZE) {
    const batch = matches.slice(i, i + UPDATE_BATCH_SIZE);
    const batchNum = Math.floor(i / UPDATE_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(matches.length / UPDATE_BATCH_SIZE);

    // Supabase doesn't support bulk update with different values per row,
    // so we use individual updates within an RPC or iterate.
    // For simplicity and reliability, use individual updates.
    let batchSuccess = 0;
    for (const match of batch) {
      const { error } = await supabase
        .from('events')
        .update({ venue_id: match.venueId })
        .eq('id', match.eventId);

      if (error) {
        errors++;
      } else {
        batchSuccess++;
        updated++;
      }
    }

    if (batchNum % 10 === 0 || batchNum === totalBatches) {
      console.log(
        `  Batch ${batchNum}/${totalBatches}: ${batchSuccess}/${batch.length} updated`,
      );
    }
  }

  return { updated, errors };
}

// ─── STATISTICS ─────────────────────────────────────────────────────────────

export function printMatchStats(matches: VenueMatch[]): void {
  const byMethod = new Map<string, number>();
  let totalSimilarity = 0;
  let withDistance = 0;
  let totalDistance = 0;

  for (const m of matches) {
    byMethod.set(m.method, (byMethod.get(m.method) || 0) + 1);
    totalSimilarity += m.similarity;
    if (m.distanceKm !== null) {
      withDistance++;
      totalDistance += m.distanceKm;
    }
  }

  console.log('\n=== Venue Backfill Statistics ===');
  console.log(`Total matches: ${matches.length}`);
  console.log(
    `Average similarity: ${(totalSimilarity / matches.length).toFixed(4)}`,
  );
  if (withDistance > 0) {
    console.log(
      `Average distance (geo-verified): ${(totalDistance / withDistance).toFixed(2)} km`,
    );
  }

  console.log('\nBy method:');
  for (const [method, count] of [...byMethod.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${method}: ${count}`);
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

  if (dryRun) console.log('DRY RUN: No data will be written to Supabase\n');

  // Validate env
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1. Fetch all venues
  console.log('Fetching venues from Supabase...');
  const venues = await fetchAllVenues(supabase);
  console.log(`Loaded ${venues.length} venues`);

  if (venues.length === 0) {
    console.log('No venues found. Run import-osm-venues.ts and import-student-orgs.ts first.');
    process.exit(0);
  }

  // 2. Build venue indexes
  const venueIndex = buildVenueIndex(venues);
  const bundeslandIndex = buildBundeslandIndex(venues);
  console.log(`Venue index: ${venueIndex.size} unique normalized names`);
  console.log(`Bundesland index: ${bundeslandIndex.size} regions`);

  // 3. Fetch unmatched events
  console.log('\nFetching events without venue_id...');
  const events = await fetchUnmatchedEvents(supabase, limit);
  console.log(`Loaded ${events.length} unmatched events`);

  if (events.length === 0) {
    console.log('No unmatched events found. All events already have venue_id or no location_name.');
    process.exit(0);
  }

  // 4. Match events to venues
  console.log('\nMatching events to venues...');
  const matches: VenueMatch[] = [];
  let processed = 0;

  const startTime = Date.now();
  for (const event of events) {
    const match = matchEventToVenue(event, venueIndex, venues, bundeslandIndex);
    if (match) {
      matches.push(match);
      if (verbose) {
        console.log(
          `  MATCH: "${event.location_name}" -> "${match.venueName}" ` +
            `(sim=${match.similarity.toFixed(3)}, dist=${match.distanceKm?.toFixed(1) ?? 'N/A'}km, method=${match.method})`,
        );
      }
    }

    processed++;
    if (processed % 5000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `  Processed ${processed}/${events.length} events (${matches.length} matches, ${elapsed}s)`,
      );
    }
  }

  console.log(
    `\nMatching complete: ${matches.length}/${events.length} events matched ` +
      `(${((matches.length / events.length) * 100).toFixed(1)}%)`,
  );

  // 5. Print statistics
  if (matches.length > 0) {
    printMatchStats(matches);
  }

  // 6. Show sample matches (first 10)
  if (matches.length > 0) {
    console.log('\nSample matches (first 10):');
    for (const m of matches.slice(0, 10)) {
      console.log(
        `  "${m.eventLocationName}" -> "${m.venueName}" ` +
          `(sim=${m.similarity.toFixed(3)}, method=${m.method})`,
      );
    }
  }

  // 7. Apply updates
  if (!dryRun && matches.length > 0) {
    console.log(`\nUpdating ${matches.length} events with venue_id...`);
    const result = await updateEventVenueIds(supabase, matches);
    console.log(
      `\nDone: ${result.updated} updated, ${result.errors} errors`,
    );
  } else if (dryRun) {
    console.log('\nDry run complete. No data written.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
