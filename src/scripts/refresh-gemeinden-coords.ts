#!/usr/bin/env npx tsx
/**
 * Refresh Austrian gemeinden coordinates from Mapbox Geocoding API.
 *
 * Problem: the hand-collected coordinates in data/gemeinden-registry/*.json
 * are systematically off by ~1-5 km for many municipalities. A user-visible
 * example: Zillingtal (7034) was stored at (47.8198, 16.5112) but that's
 * on the S31 Autobahn, not in the village. The actual village centre is
 * ~2 km west.
 *
 * Fix: re-geocode every PLZ+name pair through Mapbox Geocoding, validate
 * the result is inside Austria + inside the expected bundesland bbox,
 * and write corrected coordinates back to the registry JSON files.
 *
 * History: we tried Nominatim first (see git history pre-April 2026). OSM
 * blocked the whole batch with 429 after ~18 requests — policy is 1 req/s
 * but in practice they're strict about bulk use, and a Node script pinging
 * from a residential IP is indistinguishable from abuse. Swapped to Mapbox
 * because we already have a token in NEXT_PUBLIC_MAPBOX_TOKEN and the free
 * tier (100k/month) dwarfs our 1,933 requests.
 *
 * Mapbox Geocoding v6 policy (https://docs.mapbox.com/api/search/geocoding-v6/):
 *   - rate limit is 600 req/min — we pace at 6 req/s (150 ms) for headroom
 *   - token is public-safe (signed-URL access is what matters)
 *   - cache         → write all responses to disk so re-runs are free/instant
 *
 * Usage:
 *   npx tsx src/scripts/refresh-gemeinden-coords.ts                # dry run, prints diffs
 *   npx tsx src/scripts/refresh-gemeinden-coords.ts --apply        # write updated JSON files
 *   npx tsx src/scripts/refresh-gemeinden-coords.ts --only burgenland
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const ONLY = (() => {
  const idx = process.argv.indexOf('--only');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// Load .env.local so MAPBOX_TOKEN is available outside of Next.js runtime.
try {
  const env = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  env.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  });
} catch { /* missing .env.local is fine if token is in shell env */ }

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN) {
  console.error('NEXT_PUBLIC_MAPBOX_TOKEN not set. Put it in .env.local or export it.');
  process.exit(1);
}
const RATE_LIMIT_MS = 150;

// Bundesland bbox for sanity-checking geocoded results. A lookup coming
// back outside the expected bounding box is treated as suspicious.
const BL_BBOX: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  Burgenland:       { minLat: 46.70, maxLat: 48.15, minLng: 16.05, maxLng: 17.20 },
  'Kärnten':        { minLat: 46.35, maxLat: 47.10, minLng: 12.70, maxLng: 15.10 },
  'Niederösterreich': { minLat: 47.40, maxLat: 49.05, minLng: 14.40, maxLng: 17.10 },
  'Oberösterreich': { minLat: 47.40, maxLat: 48.80, minLng: 12.70, maxLng: 14.95 },
  Salzburg:         { minLat: 46.80, maxLat: 48.10, minLng: 12.00, maxLng: 13.55 },
  Steiermark:       { minLat: 46.60, maxLat: 47.85, minLng: 13.55, maxLng: 16.20 },
  Tirol:            { minLat: 46.70, maxLat: 47.75, minLng: 10.00, maxLng: 12.75 },
  Vorarlberg:       { minLat: 46.85, maxLat: 47.60, minLng: 9.50,  maxLng: 10.25 },
  Wien:             { minLat: 48.10, maxLat: 48.35, minLng: 16.18, maxLng: 16.58 },
};

const BUNDESLAENDER = ['burgenland', 'kaernten', 'niederoesterreich', 'oberoesterreich',
  'salzburg', 'steiermark', 'tirol', 'vorarlberg', 'wien'] as const;

interface RegistryEntry {
  name: string;
  plz: string;
  bezirk?: string;
  bundesland?: string;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
}

/** Shape we normalize all geocoder responses into. `lat`/`lon` are strings to
 *  match the old Nominatim code paths that parseFloat them. */
interface GeoResult {
  lat: string;
  lon: string;
  place_type?: string;
  display_name?: string;
  relevance?: number;
}

/** Mapbox v6 response shape (trimmed to what we consume). */
interface MapboxFeature {
  properties: {
    coordinates: { latitude: number; longitude: number };
    feature_type?: string;
    place_formatted?: string;
    full_address?: string;
    name?: string;
    match_code?: { postcode?: string; locality?: string };
  };
  geometry?: { coordinates: [number, number] };
}

const CACHE_DIR = join(process.cwd(), '.cache/mapbox-geo');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

function cacheKey(plz: string, name: string): string {
  return `${plz}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Handle transient failures with exponential backoff. Mapbox rarely 429s us
 *  at 6 req/s but a momentary hiccup shouldn't poison a whole bundesland. */
async function fetchWithBackoff(url: string, attempt = 0): Promise<Response> {
  const resp = await fetch(url);
  if (resp.ok || resp.status === 404) return resp;
  if ((resp.status === 429 || resp.status >= 500) && attempt < 3) {
    const wait = 2_000 * 2 ** attempt; // 2s, 4s, 8s
    console.warn(`    ${resp.status} — backing off ${wait}ms (attempt ${attempt + 1}/3)`);
    await sleep(wait);
    return fetchWithBackoff(url, attempt + 1);
  }
  return resp;
}

async function mapboxLookup(plz: string, name: string): Promise<GeoResult | null> {
  const cacheFile = join(CACHE_DIR, cacheKey(plz, name));
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
      return cached === null ? null : (cached as GeoResult);
    } catch { /* fall through and re-fetch */ }
  }

  // Mapbox Geocoding v6 — forward search. We use `q=` free-text with
  // "Name PLZ, Austria" (name first improves locality match over postcode
  // when both share the query). `country=at` restricts to Austria;
  // `types=locality,place` keeps us at settlement level — explicitly NOT
  // including `postcode`, because PLZ-centroid is noisier than village-
  // centroid for Austrian Gemeinden (one PLZ often covers multiple villages).
  const q = encodeURIComponent(`${name} ${plz}, Austria`);
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${q}&country=at&types=locality,place&limit=1&access_token=${MAPBOX_TOKEN}`;

  const resp = await fetchWithBackoff(url);
  if (!resp.ok) {
    console.warn(`    mapbox ${resp.status} for ${plz} ${name}`);
    return null;
  }
  const json = await resp.json() as { features?: MapboxFeature[] };
  const first = json.features?.[0];
  if (!first) {
    // Negative cache — tells us "Mapbox doesn't know this one" so we skip
    // on re-runs instead of asking again.
    writeFileSync(cacheFile, JSON.stringify(null));
    return null;
  }
  // Mapbox returns geometry.coordinates as [lng, lat]; properties.coordinates
  // is the authoritative centre. We prefer properties.coordinates because
  // for postcode features geometry.coordinates sometimes points at a random
  // corner of the postcode polygon instead of the centroid.
  const propCoord = first.properties.coordinates;
  const geomCoord = first.geometry?.coordinates;
  const lat = propCoord?.latitude ?? geomCoord?.[1];
  const lng = propCoord?.longitude ?? geomCoord?.[0];
  if (lat == null || lng == null) {
    writeFileSync(cacheFile, JSON.stringify(null));
    return null;
  }
  const out: GeoResult = {
    lat: String(lat),
    lon: String(lng),
    place_type: first.properties.feature_type,
    display_name: first.properties.full_address ?? first.properties.place_formatted,
  };
  writeFileSync(cacheFile, JSON.stringify(out));
  return out;
}

async function processBundesland(slug: string): Promise<void> {
  const file = join(process.cwd(), 'data/gemeinden-registry', `${slug}.json`);
  if (!existsSync(file)) { console.warn(`skip ${slug}: file missing`); return; }

  const raw = readFileSync(file, 'utf8');
  const entries = JSON.parse(raw) as RegistryEntry[];

  console.log(`\n=== ${slug}  (${entries.length} gemeinden) ===`);

  const stats = {
    total: entries.length,
    lookedUp: 0,
    notFound: 0,
    outsideBBox: 0,
    moved: 0,
    moveDistanceBuckets: { '<500m': 0, '500m-2km': 0, '2-5km': 0, '5-20km': 0, '>20km': 0 },
    unchanged: 0,
  };

  const examples: Array<{ plz: string; name: string; oldLat: number; oldLng: number; newLat: number; newLng: number; distKm: number }> = [];

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.plz || !/^\d{4}$/.test(e.plz) || !e.name) continue;

    const result = await mapboxLookup(e.plz, e.name);
    stats.lookedUp++;

    if (!result) { stats.notFound++; continue; }

    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    if (isNaN(newLat) || isNaN(newLng)) { stats.notFound++; continue; }

    // Validate within bundesland bbox
    const bbox = e.bundesland ? BL_BBOX[e.bundesland] : null;
    if (bbox && (newLat < bbox.minLat || newLat > bbox.maxLat || newLng < bbox.minLng || newLng > bbox.maxLng)) {
      stats.outsideBBox++;
      continue;
    }

    // Compare with old
    const oldLat = e.lat;
    const oldLng = e.lng;
    let moved = false;
    let dist = 0;
    if (typeof oldLat === 'number' && typeof oldLng === 'number') {
      const R = 6371;
      const dLat = (newLat - oldLat) * Math.PI / 180;
      const dLng = (newLng - oldLng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(oldLat * Math.PI/180) * Math.cos(newLat * Math.PI/180) * Math.sin(dLng/2)**2;
      dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      if (dist > 0.05) {
        moved = true;
        stats.moved++;
        if (dist < 0.5) stats.moveDistanceBuckets['<500m']++;
        else if (dist < 2) stats.moveDistanceBuckets['500m-2km']++;
        else if (dist < 5) stats.moveDistanceBuckets['2-5km']++;
        else if (dist < 20) stats.moveDistanceBuckets['5-20km']++;
        else stats.moveDistanceBuckets['>20km']++;

        if (examples.length < 10 && dist > 2) {
          examples.push({ plz: e.plz, name: e.name, oldLat, oldLng, newLat, newLng, distKm: dist });
        }
      } else {
        stats.unchanged++;
      }
    }

    // Update the entry
    if (moved || typeof oldLat !== 'number') {
      entries[i] = { ...e, lat: newLat, lng: newLng };
    }

    if (stats.lookedUp % 25 === 0) {
      process.stdout.write(`\r  ${stats.lookedUp}/${stats.total} gemeinden processed  (${stats.moved} moved, ${stats.notFound} not found)…`);
    }

    // Rate limit between uncached requests. Cache hits skip the delay.
    const hadCache = existsSync(join(CACHE_DIR, cacheKey(e.plz, e.name)));
    if (!hadCache) await sleep(RATE_LIMIT_MS);
  }

  console.log(`\n\n  Summary for ${slug}:`);
  console.log(`    total:       ${stats.total}`);
  console.log(`    looked up:   ${stats.lookedUp}`);
  console.log(`    not found:   ${stats.notFound}`);
  console.log(`    outside bbox: ${stats.outsideBBox}`);
  console.log(`    unchanged:   ${stats.unchanged}`);
  console.log(`    moved:       ${stats.moved}`);
  console.log(`      <500m:     ${stats.moveDistanceBuckets['<500m']}`);
  console.log(`      500m-2km:  ${stats.moveDistanceBuckets['500m-2km']}`);
  console.log(`      2-5km:     ${stats.moveDistanceBuckets['2-5km']}`);
  console.log(`      5-20km:    ${stats.moveDistanceBuckets['5-20km']}`);
  console.log(`      >20km:     ${stats.moveDistanceBuckets['>20km']}`);

  if (examples.length > 0) {
    console.log(`\n  Big-move samples (>2km):`);
    examples.forEach(ex => {
      console.log(`    ${ex.plz} ${ex.name.padEnd(30)}  ${ex.distKm.toFixed(1)}km  (${ex.oldLat.toFixed(4)},${ex.oldLng.toFixed(4)}) → (${ex.newLat.toFixed(4)},${ex.newLng.toFixed(4)})`);
    });
  }

  if (APPLY) {
    writeFileSync(file, JSON.stringify(entries, null, 2) + '\n');
    console.log(`\n  ✓ Wrote ${file}`);
  } else {
    console.log(`\n  (dry run — pass --apply to write)`);
  }
}

(async () => {
  const list = ONLY ? [ONLY] : [...BUNDESLAENDER];
  console.log(`Refreshing coords for: ${list.join(', ')}`);
  console.log(`Rate limit: ~6 req/s  (Mapbox Geocoding v6, 600/min quota)`);
  console.log(`Cache: ${CACHE_DIR}`);
  console.log(APPLY ? 'APPLY mode' : 'DRY RUN (no writes)');

  for (const bl of list) {
    await processBundesland(bl);
  }

  console.log(`\n\nAll done. Cache re-usable for subsequent runs.`);
})().catch(err => { console.error(err); process.exit(1); });
