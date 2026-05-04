/**
 * Import the consolidated Overpass dataset into the venues table.
 *
 * Reads data/overpass-venues.json (produced by fetch-overpass-all-venues.ts)
 * and upserts each named POI with coordinates into the venues table.
 *
 * Dedup strategy:
 *   - Primary key for upsert: `osm_id` (existing UNIQUE INDEX)
 *   - OSM IDs are only unique per type (node/way/relation), so we offset:
 *       node     → raw id (≤ ~10^10 today)
 *       way      → id + 10^13
 *       relation → id + 2 × 10^13
 *     BIGINT max is 9.2 × 10^18 so we have plenty of headroom.
 *   - Existing rows (bars/pubs/clubs from import-osm-venues) all use raw node
 *     IDs, which are < 10^11. Our offset scheme is backward compatible.
 *
 * Type mapping:
 *   - Primary identifying tag drives the type (amenity > leisure > tourism > …)
 *   - For categories already in the venues table (bar/pub/nightclub) we keep
 *     the canonical short name so existing rows are upserted in place.
 *   - Everything else gets the raw tag value (restaurant, museum, hotel, …).
 *
 * Run:
 *   npx tsx src/scripts/import-overpass-all-venues.ts --dry-run
 *   npx tsx src/scripts/import-overpass-all-venues.ts --limit 100
 *   npx tsx src/scripts/import-overpass-all-venues.ts          # full apply
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  bundeslandFromCoords,
  getCoordinates,
  isStudentRelevant,
  namespacedOsmId,
  normalizeName,
  type OverpassElement,
} from './lib/osm-venue-utils';

// ─── ENV ────────────────────────────────────────────────────────────────────

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
} catch {
  /* missing .env.local is fine for --dry-run */
}

// ─── TYPE MAPPING ───────────────────────────────────────────────────────────

/**
 * Pure-infrastructure tag values that are NEVER venues. We import everything
 * else (restaurants, schools, kindergartens, etc. — these can host events
 * even if not "classic" event venues), but skip these because they're just
 * physical infrastructure with no possibility of hosting people:
 *
 *   - benches, fountains, vending machines, parcel lockers, ATMs
 *   - recycling bins, waste baskets, toilets
 *   - parking lots, charging stations, fuel pumps, bicycle racks
 *   - post boxes, telephone boxes, compressed-air pumps
 *
 * Use --include-infrastructure to import these anyway.
 */
const SKIP_TAG_VALUES = new Set([
  // amenity=*
  'bench', 'fountain', 'vending_machine', 'parcel_locker', 'atm',
  'recycling', 'waste_basket', 'waste_disposal', 'toilets', 'shower',
  'parking', 'parking_space', 'parking_entrance', 'motorcycle_parking',
  'bicycle_parking', 'bicycle_rental', 'charging_station', 'fuel',
  'car_wash', 'car_rental', 'compressed_air',
  'post_box', 'telephone', 'clock', 'drinking_water', 'water_point',
  'grit_bin', 'street_lamp', 'hunting_stand',
  // leisure=*
  'picnic_table', 'fitness_station', 'firepit', 'bird_hide',
  'wildlife_hide', 'outdoor_seating', 'common',
  // tourism=*
  'information', 'viewpoint', // signs/markers, not venues
  // public_transport (we'll keep stations though)
]);

/** Tag families in priority order. The first match wins for `type`. */
const TYPE_PRIORITY = [
  'amenity',
  'leisure',
  'tourism',
  'historic',
  'sport',
  'shop',
  'office',
  'club',
  'craft',
  'healthcare',
  'public_transport',
  'building',
] as const;

/** Canonical short names for venue types we already use in the schema.
 *  Keep these stable so existing rows upsert in place. */
const CANONICAL_TYPES: Record<string, string> = {
  // amenity
  bar: 'bar',
  pub: 'pub',
  nightclub: 'nightclub',
  biergarten: 'bar', // existing convention
};

interface TypeAssignment {
  type: string;
  subtype: string | null;
}

export function classifyVenue(
  tags: Record<string, string>,
  opts: { includeInfrastructure?: boolean } = {},
): TypeAssignment {
  for (const family of TYPE_PRIORITY) {
    const value = tags[family]?.toLowerCase();
    if (!value) continue;

    // Pure-infrastructure POIs (benches, fountains, parking, …) are skipped
    // unless the caller explicitly wants them.
    if (!opts.includeInfrastructure && SKIP_TAG_VALUES.has(value)) {
      return { type: 'skip', subtype: null };
    }

    // Canonical short name for venue types we already use
    if (CANONICAL_TYPES[value]) {
      return refineSubtype(family, value, tags);
    }

    // Otherwise use the raw tag value as the type, normalised
    const type = sanitizeTypeName(value);
    return refineSubtype(family, type, tags);
  }
  return { type: 'other', subtype: null };
}

/** Add subtype hints from secondary tags. */
function refineSubtype(
  family: string,
  type: string,
  tags: Record<string, string>,
): TypeAssignment {
  // Family-specific subtype rules
  if (family === 'amenity') {
    if (type === 'bar') {
      if (tags.karaoke === 'yes') return { type, subtype: 'karaoke_bar' };
      if (tags.cocktails === 'yes') return { type, subtype: 'cocktail_bar' };
      if (tags.wine === 'yes' || tags.drink?.includes('wine'))
        return { type, subtype: 'wine_bar' };
    }
    if (type === 'restaurant' && tags.cuisine) {
      return { type, subtype: sanitizeTypeName(tags.cuisine.split(';')[0]) };
    }
  }
  if (family === 'tourism') {
    if (type === 'hotel' && tags.stars) {
      return { type, subtype: `${tags.stars}_star` };
    }
  }
  if (family === 'leisure') {
    if (type === 'sports_centre' && tags.sport) {
      return { type, subtype: sanitizeTypeName(tags.sport.split(';')[0]) };
    }
  }
  if (family === 'shop' && tags.shop) {
    // For generic shop=*, store the shop subtype
    return { type: 'shop', subtype: sanitizeTypeName(tags.shop) };
  }
  return { type, subtype: null };
}

function sanitizeTypeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

// ─── ADDRESS / CONTACT EXTRACTION (re-used from import-osm-venues style) ────

function buildAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:street'];
  const housenumber = tags['addr:housenumber'];
  if (!street) return null;
  return housenumber ? `${street} ${housenumber}` : street;
}

function extractWebsite(tags: Record<string, string>): string | null {
  return tags.website || tags['contact:website'] || tags.url || null;
}

function extractFacebook(tags: Record<string, string>): string | null {
  const fb = tags['contact:facebook'] || tags.facebook || null;
  if (!fb) return null;
  if (fb.startsWith('http')) return fb;
  return `https://www.facebook.com/${fb}`;
}

function extractInstagram(tags: Record<string, string>): string | null {
  const ig = tags['contact:instagram'] || tags.instagram || null;
  if (!ig) return null;
  if (ig.startsWith('http')) return ig;
  return `https://www.instagram.com/${ig.replace('@', '')}`;
}

// (coordinates extraction comes from lib/osm-venue-utils → getCoordinates)

// ─── LOCALNESS / EVENT-VENUE HEURISTIC ─────────────────────────────────────

const HIGH_LOCALNESS_TYPES = new Set([
  'bar', 'pub', 'nightclub', 'cafe', 'restaurant',
  'community_centre', 'arts_centre', 'theatre', 'cinema',
  'library', 'biergarten', 'dance_hall',
]);

const LOW_LOCALNESS_TYPES = new Set([
  'hotel', 'motel', 'hostel', 'attraction', 'zoo',
  'museum', 'gallery', // tourists travel for these
]);

function calculateLocalness(type: string, tags: Record<string, string>): number {
  let score = 50;
  if (HIGH_LOCALNESS_TYPES.has(type)) score = 75;
  if (LOW_LOCALNESS_TYPES.has(type)) score = 30;
  if (tags.brand || tags.operator) score -= 20;
  if (tags['operator:type'] === 'religious') score += 10;
  return Math.max(0, Math.min(100, score));
}

// ─── ROW BUILDER ────────────────────────────────────────────────────────────

interface VenueRow {
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
  event_feed_url: null;
  event_feed_type: null;
  osm_id: number;
  osm_tags: Record<string, string>;
  registry_source: 'osm';
  is_student_relevant: boolean;
  localness_score: number;
  last_scraped_at: null;
  scrape_status: 'pending';
}

function elementToVenue(
  el: OverpassElement,
  opts: { includeInfrastructure?: boolean } = {},
): VenueRow | null {
  const tags = el.tags || {};
  const name = tags.name?.trim();
  if (!name || name.length < 2) return null;

  const coords = getCoordinates(el);
  if (!coords) return null;

  const { type, subtype } = classifyVenue(tags, opts);
  if (type === 'other' || type === 'skip') return null; // skip unclassified or infrastructure

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
    osm_id: namespacedOsmId(el),
    // Stash element type in tags so we can recover original ID if needed
    osm_tags: { ...tags, _osm_element_type: el.type },
    registry_source: 'osm',
    is_student_relevant: isStudentRelevant(tags),
    localness_score: calculateLocalness(type, tags),
    last_scraped_at: null,
    scrape_status: 'pending',
  };
}

// ─── UPSERT ─────────────────────────────────────────────────────────────────

const UPSERT_BATCH_SIZE = 250;

async function upsert(
  supabase: SupabaseClient,
  rows: VenueRow[],
): Promise<{ ok: number; err: number }> {
  let ok = 0;
  let err = 0;
  const total = Math.ceil(rows.length / UPSERT_BATCH_SIZE);

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const num = Math.floor(i / UPSERT_BATCH_SIZE) + 1;

    const { data, error } = await supabase
      .from('venues')
      .upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false })
      .select('id');

    if (error) {
      console.error(`  Batch ${num}/${total} ERROR: ${error.message}`);
      err += batch.length;
    } else {
      ok += data?.length || 0;
      if (num % 10 === 0 || num === total) {
        console.log(`  Batch ${num}/${total}: ${ok} upserted (running total)`);
      }
    }
  }
  return { ok, err };
}

// ─── STATS ──────────────────────────────────────────────────────────────────

function printStats(rows: VenueRow[]): void {
  const byType = new Map<string, number>();
  const byBundesland = new Map<string, number>();
  let withWebsite = 0;
  let withAddress = 0;

  for (const r of rows) {
    byType.set(r.type, (byType.get(r.type) || 0) + 1);
    const bl = r.bundesland || 'unknown';
    byBundesland.set(bl, (byBundesland.get(bl) || 0) + 1);
    if (r.website) withWebsite++;
    if (r.address) withAddress++;
  }

  console.log(`\n=== Stats ===`);
  console.log(`Total: ${rows.length}`);
  console.log(`With website: ${withWebsite} (${((withWebsite / rows.length) * 100).toFixed(1)}%)`);
  console.log(`With address: ${withAddress} (${((withAddress / rows.length) * 100).toFixed(1)}%)`);

  console.log(`\nTop 30 types:`);
  const sortedTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [t, c] of sortedTypes) console.log(`  ${t}: ${c}`);

  console.log(`\nBy Bundesland:`);
  for (const [bl, c] of [...byBundesland.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bl}: ${c}`);
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const includeInfrastructure = args.includes('--include-infrastructure');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const inputArg = args.find((a) => a.startsWith('--input='));
  const inputPath = inputArg
    ? inputArg.split('=')[1]
    : join(process.cwd(), 'data', 'overpass-venues.json');

  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    console.error(`Run "npx tsx src/scripts/fetch-overpass-all-venues.ts" first.`);
    process.exit(1);
  }

  console.log(`Reading ${inputPath}…`);
  const elements: OverpassElement[] = JSON.parse(readFileSync(inputPath, 'utf-8'));
  console.log(`Loaded ${elements.length} raw elements`);

  // Deduplicate by namespaced osm_id (keeps last seen — Overpass usually
  // returns identical tags so this is harmless; the merge happens here too)
  const byNsId = new Map<number, OverpassElement>();
  for (const el of elements) {
    const id = namespacedOsmId(el);
    const existing = byNsId.get(id);
    if (!existing) {
      byNsId.set(id, el);
    } else {
      existing.tags = { ...(existing.tags || {}), ...(el.tags || {}) };
    }
  }
  console.log(`Unique by namespaced osm_id: ${byNsId.size}`);

  // Convert to venue rows
  const rows: VenueRow[] = [];
  let skippedNoName = 0;
  let skippedNoCoords = 0;
  let skippedOther = 0;
  for (const el of byNsId.values()) {
    const tags = el.tags || {};
    if (!tags.name?.trim()) { skippedNoName++; continue; }
    if (!getCoordinates(el)) { skippedNoCoords++; continue; }
    const row = elementToVenue(el, { includeInfrastructure });
    if (!row) { skippedOther++; continue; }
    rows.push(row);
  }
  console.log(`Valid rows: ${rows.length} (skipped: ${skippedNoName} no-name, ${skippedNoCoords} no-coords, ${skippedOther} unclassified)`);

  // Optional limit
  const finalRows = limit ? rows.slice(0, limit) : rows;
  if (limit) console.log(`Limited to first ${finalRows.length} rows`);

  printStats(finalRows);

  if (dryRun) {
    console.log(`\nDRY RUN — no writes. Use without --dry-run to apply.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(`Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\nUpserting ${finalRows.length} rows to Supabase…`);
  const { ok, err } = await upsert(supabase, finalRows);
  console.log(`\nDone: ${ok} upserted, ${err} errors`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
