/**
 * OSM Overpass Import: Fetch Austrian bars, pubs, nightclubs, and biergartens
 * from OpenStreetMap and upsert them into the Supabase venues table.
 *
 * Uses the Overpass API to query for amenity={bar,pub,nightclub,biergarten}
 * and leisure=nightclub within Austria's bounding box.
 *
 * Run: npx tsx src/scripts/import-osm-venues.ts
 *      npx tsx src/scripts/import-osm-venues.ts --dry-run
 *      npx tsx src/scripts/import-osm-venues.ts --limit=100
 *
 * ODbL: Data (c) OpenStreetMap contributors, ODbL 1.0
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

/** Raw element from Overpass JSON response */
export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: { timestamp_osm_base: string };
  elements: OverpassElement[];
}

/** Venue row ready for upsert */
export interface VenueRow {
  name: string;
  name_normalized: string;
  type: string;
  subtype: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  event_feed_url: string | null;
  event_feed_type: string | null;
  osm_id: number;
  osm_tags: Record<string, string>;
  registry_source: 'osm';
  is_student_relevant: boolean;
  localness_score: number;
  last_scraped_at: string | null;
  scrape_status: 'pending';
}

// ─── OVERPASS QUERY ─────────────────────────────────────────────────────────

/**
 * Overpass API endpoints. Primary + fallback mirrors.
 * See https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
let currentEndpointIdx = 0;
function getOverpassUrl(): string {
  return OVERPASS_ENDPOINTS[currentEndpointIdx % OVERPASS_ENDPOINTS.length];
}

/**
 * Austria bounding box: [south, west, north, east]
 * Slightly expanded to catch border venues.
 */
const AUSTRIA_BBOX = '46.3,9.5,49.1,17.2';

/**
 * Regional bounding boxes for Austria (south,west,north,east).
 * Split into regions to avoid Overpass API timeouts on country-wide queries.
 */
const REGIONAL_BBOXES: { name: string; bbox: string }[] = [
  { name: 'Wien', bbox: '48.10,16.18,48.33,16.58' },
  { name: 'Niederoesterreich', bbox: '47.40,14.45,49.02,17.07' },
  { name: 'Burgenland', bbox: '46.83,16.00,48.12,17.17' },
  { name: 'Oberoesterreich', bbox: '47.46,13.00,48.77,14.99' },
  { name: 'Salzburg', bbox: '46.95,12.05,48.05,14.00' },
  { name: 'Steiermark', bbox: '46.60,13.55,47.83,16.17' },
  { name: 'Kaernten', bbox: '46.37,12.65,47.13,15.05' },
  { name: 'Tirol', bbox: '46.65,10.10,47.75,12.97' },
  { name: 'Vorarlberg', bbox: '46.84,9.52,47.59,10.24' },
];

/**
 * Build the Overpass QL query for a regional bounding box.
 * Uses `out center` for ways/relations to get a single coordinate point.
 */
export function buildOverpassQuery(bbox?: string): string {
  const bboxFilter = bbox ? `(${bbox})` : '(area.austria)';
  const areaSetup = bbox ? '' : 'area["ISO3166-1"="AT"][admin_level=2]->.austria;';
  return `
[out:json][timeout:120];
${areaSetup}
(
  node["amenity"="bar"]${bboxFilter};
  way["amenity"="bar"]${bboxFilter};
  node["amenity"="pub"]${bboxFilter};
  way["amenity"="pub"]${bboxFilter};
  node["amenity"="nightclub"]${bboxFilter};
  way["amenity"="nightclub"]${bboxFilter};
  node["amenity"="biergarten"]${bboxFilter};
  way["amenity"="biergarten"]${bboxFilter};
  node["leisure"="nightclub"]${bboxFilter};
  way["leisure"="nightclub"]${bboxFilter};
);
out center tags;
`.trim();
}

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch venues from a single Overpass query with retry logic.
 */
async function fetchOverpassRegion(query: string, regionName: string, retries = 4): Promise<OverpassElement[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const apiUrl = getOverpassUrl();
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(120_000),
      });

      if (response.status === 429 || response.status === 504) {
        // Read error body for details
        let detail = '';
        try { detail = (await response.text()).slice(0, 200); } catch { /* ignore */ }
        const waitSec = attempt * 45;
        console.log(`  ${regionName}: HTTP ${response.status} from ${new URL(apiUrl).hostname}`);
        if (detail) console.log(`    Detail: ${detail.replace(/\n/g, ' ').trim()}`);
        // Switch to fallback mirror on repeated failures
        if (attempt >= 2) {
          currentEndpointIdx++;
          console.log(`    Switching to mirror: ${new URL(getOverpassUrl()).hostname}`);
        }
        console.log(`    Retrying in ${waitSec}s (attempt ${attempt}/${retries})`);
        await sleep(waitSec * 1000);
        continue;
      }

      if (!response.ok) {
        let detail = '';
        try { detail = (await response.text()).slice(0, 300); } catch { /* ignore */ }
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
      }

      const data: OverpassResponse = await response.json();
      return data.elements;
    } catch (err: unknown) {
      if (attempt === retries) throw err;
      const waitSec = attempt * 45;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${regionName}: ${msg}`);
      if (attempt >= 2) {
        currentEndpointIdx++;
        console.log(`    Switching to mirror: ${new URL(getOverpassUrl()).hostname}`);
      }
      console.log(`    Retrying in ${waitSec}s (attempt ${attempt}/${retries})`);
      await sleep(waitSec * 1000);
    }
  }
  return [];
}

/**
 * Fetch venues from the Overpass API using regional batches.
 * Queries each Bundesland separately to avoid 504 timeouts on full-country queries.
 */
export async function fetchOverpassData(): Promise<OverpassElement[]> {
  console.log('Querying Overpass API for Austrian bars/pubs/nightclubs (9 regions)...\n');

  const allElements: OverpassElement[] = [];

  for (const region of REGIONAL_BBOXES) {
    const query = buildOverpassQuery(region.bbox);
    process.stdout.write(`  ${region.name}... `);
    const elements = await fetchOverpassRegion(query, region.name);
    console.log(`${elements.length} elements`);
    allElements.push(...elements);

    // Polite delay between requests (Overpass fair-use: 15s minimum)
    if (region !== REGIONAL_BBOXES[REGIONAL_BBOXES.length - 1]) {
      await sleep(15000);
    }
  }

  console.log(`\nTotal received: ${allElements.length} elements (before dedup)`);
  return allElements;
}

// ─── MAPPING LOGIC ──────────────────────────────────────────────────────────

/**
 * Map OSM amenity/leisure tag to our VenueType.
 */
export function mapOsmToVenueType(tags: Record<string, string>): { type: string; subtype: string | null } {
  const amenity = tags.amenity?.toLowerCase();
  const leisure = tags.leisure?.toLowerCase();

  if (amenity === 'nightclub' || leisure === 'nightclub') {
    return { type: 'nightclub', subtype: tags.music ? `${tags.music}_club` : null };
  }
  if (amenity === 'pub') {
    return { type: 'pub', subtype: tags.microbrewery === 'yes' ? 'brewpub' : null };
  }
  if (amenity === 'biergarten') {
    return { type: 'bar', subtype: 'biergarten' };
  }
  if (amenity === 'bar') {
    // Detect subtypes from common OSM tags
    if (tags.karaoke === 'yes') return { type: 'bar', subtype: 'karaoke_bar' };
    if (tags.cocktails === 'yes') return { type: 'bar', subtype: 'cocktail_bar' };
    if (tags.wine === 'yes' || tags.drink?.includes('wine')) return { type: 'bar', subtype: 'wine_bar' };
    return { type: 'bar', subtype: null };
  }

  return { type: 'other', subtype: null };
}

/**
 * Normalize a venue name for deduplication: lowercase, trim, remove common suffixes.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"');
}

/**
 * Austrian Bundesland bounding boxes for coordinate-based assignment.
 * Order matters: Wien is checked before NÖ because Wien is fully inside NÖ's bbox.
 */
const BUNDESLAND_BOUNDS: Array<{ id: string; bounds: [number, number, number, number] }> = [
  { id: 'wien', bounds: [16.182, 48.118, 16.578, 48.323] },
  { id: 'burgenland', bounds: [15.996, 46.831, 17.161, 48.119] },
  { id: 'niederoesterreich', bounds: [14.453, 47.422, 17.069, 49.021] },
  { id: 'oberoesterreich', bounds: [12.749, 47.461, 14.992, 48.773] },
  { id: 'salzburg', bounds: [12.076, 46.944, 13.996, 48.041] },
  { id: 'steiermark', bounds: [13.563, 46.612, 16.172, 47.828] },
  { id: 'kaernten', bounds: [12.657, 46.372, 15.065, 47.131] },
  { id: 'tirol', bounds: [10.098, 46.651, 12.966, 47.743] },
  { id: 'vorarlberg', bounds: [9.531, 46.841, 10.237, 47.596] },
];

/**
 * Determine Bundesland from coordinates using bounding box matching.
 * Wien is checked first since it's fully contained within NÖ's bbox.
 */
export function bundeslandFromCoords(lat: number, lon: number): string | null {
  for (const { id, bounds } of BUNDESLAND_BOUNDS) {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
      return id;
    }
  }
  return null;
}

/**
 * Determine if a venue is likely student-relevant based on OSM tags.
 */
export function isStudentRelevant(tags: Record<string, string>): boolean {
  const name = (tags.name || '').toLowerCase();
  const studentKeywords = ['studi', 'uni ', 'campus', 'mensa', 'fachschaft', 'hochschul'];
  return studentKeywords.some(kw => name.includes(kw));
}

/**
 * Calculate localness score (0-100) for a venue.
 * Bars/pubs/clubs are inherently hyperlocal.
 */
export function calculateLocalnessScore(tags: Record<string, string>, venueType: string): number {
  let score = 70; // Default high localness for bars/pubs

  // Chains are less local
  const brand = tags.brand || tags.operator || '';
  if (brand) score -= 20;

  // Nightclubs are slightly less local (people travel for them)
  if (venueType === 'nightclub') score -= 10;

  // Biergartens are very local
  if (tags.amenity === 'biergarten') score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Extract website URL from OSM tags.
 */
function extractWebsite(tags: Record<string, string>): string | null {
  return tags.website || tags['contact:website'] || tags.url || null;
}

/**
 * Extract Facebook URL from OSM tags.
 */
function extractFacebook(tags: Record<string, string>): string | null {
  const fb = tags['contact:facebook'] || tags.facebook || null;
  if (!fb) return null;
  // Normalize to full URL if just a page name
  if (fb.startsWith('http')) return fb;
  return `https://www.facebook.com/${fb}`;
}

/**
 * Extract Instagram URL from OSM tags.
 */
function extractInstagram(tags: Record<string, string>): string | null {
  const ig = tags['contact:instagram'] || tags.instagram || null;
  if (!ig) return null;
  if (ig.startsWith('http')) return ig;
  return `https://www.instagram.com/${ig.replace('@', '')}`;
}

/**
 * Build address string from OSM tags.
 */
function buildAddress(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  const street = tags['addr:street'];
  const housenumber = tags['addr:housenumber'];
  if (street) {
    parts.push(housenumber ? `${street} ${housenumber}` : street);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Get coordinates from an Overpass element (node has lat/lon directly,
 * way/relation has center from `out center`).
 */
export function getCoordinates(element: OverpassElement): { lat: number; lon: number } | null {
  if (element.lat != null && element.lon != null) {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

/**
 * Convert an Overpass element to a VenueRow for upsert.
 * Returns null if the element lacks required data (name, coordinates).
 */
export function elementToVenue(element: OverpassElement): VenueRow | null {
  const tags = element.tags || {};
  const name = tags.name;
  if (!name) return null;

  const coords = getCoordinates(element);
  if (!coords) return null;

  const { type, subtype } = mapOsmToVenueType(tags);
  const bundesland = bundeslandFromCoords(coords.lat, coords.lon);

  return {
    name,
    name_normalized: normalizeName(name),
    type,
    subtype,
    address: buildAddress(tags),
    postal_code: tags['addr:postcode'] || null,
    city: tags['addr:city'] || null,
    bundesland,
    latitude: coords.lat,
    longitude: coords.lon,
    website: extractWebsite(tags),
    facebook_url: extractFacebook(tags),
    instagram_url: extractInstagram(tags),
    event_feed_url: null,
    event_feed_type: null,
    osm_id: element.id,
    osm_tags: tags,
    registry_source: 'osm',
    is_student_relevant: isStudentRelevant(tags),
    localness_score: calculateLocalnessScore(tags, type),
    last_scraped_at: null,
    scrape_status: 'pending',
  };
}

// ─── DEDUPLICATION ──────────────────────────────────────────────────────────

/**
 * Deduplicate elements by OSM ID (ways and nodes can overlap).
 * Prefer nodes over ways when both exist for the same place.
 */
export function deduplicateElements(elements: OverpassElement[]): OverpassElement[] {
  // OSM IDs are only unique within their type (node vs way vs relation).
  // Use type:id as the key. No cross-type dedup needed since Overpass
  // returns distinct elements.
  const seen = new Map<string, OverpassElement>();
  for (const el of elements) {
    const key = `${el.type}:${el.id}`;
    if (!seen.has(key)) {
      seen.set(key, el);
    }
  }
  return Array.from(seen.values());
}

// ─── UPSERT ─────────────────────────────────────────────────────────────────

const UPSERT_BATCH_SIZE = 200;

/**
 * Upsert venues into Supabase in batches.
 * Uses osm_id as the conflict key for idempotent imports.
 */
export async function upsertVenues(
  supabase: SupabaseClient,
  venues: VenueRow[],
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < venues.length; i += UPSERT_BATCH_SIZE) {
    const batch = venues.slice(i, i + UPSERT_BATCH_SIZE);
    const batchNum = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(venues.length / UPSERT_BATCH_SIZE);

    const { data, error } = await supabase
      .from('venues')
      .upsert(batch, {
        onConflict: 'osm_id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      console.error(`  Batch ${batchNum}/${totalBatches} error: ${error.message}`);
      errors += batch.length;
    } else {
      const count = data?.length || 0;
      // Supabase upsert doesn't distinguish insert vs update, so we count all as upserted
      updated += count;
      if (batchNum % 5 === 0 || batchNum === totalBatches) {
        console.log(`  Batch ${batchNum}/${totalBatches}: ${count} venues upserted`);
      }
    }
  }

  return { inserted, updated, errors };
}

// ─── STATS ──────────────────────────────────────────────────────────────────

export function printStats(venues: VenueRow[]): void {
  const byType = new Map<string, number>();
  const byBundesland = new Map<string, number>();
  let withWebsite = 0;
  let withAddress = 0;
  let studentRelevant = 0;

  for (const v of venues) {
    byType.set(v.type, (byType.get(v.type) || 0) + 1);
    const bl = v.bundesland || 'unknown';
    byBundesland.set(bl, (byBundesland.get(bl) || 0) + 1);
    if (v.website) withWebsite++;
    if (v.address) withAddress++;
    if (v.is_student_relevant) studentRelevant++;
  }

  console.log('\n=== OSM Import Statistics ===');
  console.log(`Total venues: ${venues.length}`);
  console.log(`With website: ${withWebsite} (${((withWebsite / venues.length) * 100).toFixed(1)}%)`);
  console.log(`With address: ${withAddress} (${((withAddress / venues.length) * 100).toFixed(1)}%)`);
  console.log(`Student relevant: ${studentRelevant}`);

  console.log('\nBy type:');
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\nBy Bundesland:');
  for (const [bl, count] of [...byBundesland.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bl}: ${count}`);
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

  if (dryRun) console.log('DRY RUN: No data will be written to Supabase\n');

  // Validate env
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !key)) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // 1. Fetch from Overpass
  const rawElements = await fetchOverpassData();

  // 2. Deduplicate
  const elements = deduplicateElements(rawElements);
  console.log(`After deduplication: ${elements.length} elements`);

  // 3. Convert to venue rows
  let venues = elements
    .map(elementToVenue)
    .filter((v): v is VenueRow => v !== null);
  console.log(`Valid venues (with name + coords): ${venues.length}`);

  // Apply limit if specified
  if (limit && limit > 0) {
    venues = venues.slice(0, limit);
    console.log(`Limited to ${venues.length} venues`);
  }

  // 4. Print statistics
  printStats(venues);

  // 5. Upsert to Supabase
  if (!dryRun) {
    console.log('\nUpserting to Supabase...');
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const result = await upsertVenues(supabase, venues);
    console.log(`\nDone: ${result.updated} upserted, ${result.errors} errors`);
  } else {
    console.log('\nDry run complete. No data written.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
