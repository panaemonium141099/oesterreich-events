/**
 * Post-processing pipeline: run after any large scrape.
 * 1. Geocode events without coordinates (rate-limited Nominatim)
 * 2. Assign districts + Bundesland from coordinates/PLZ
 * 3. Normalize Bundesland capitalization
 * 4. Fix known coordinate mismatches (events outside declared Bundesland bounds)
 *
 * Run with: npx tsx src/scripts/post-process.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { readFileSync } from 'fs';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon, multiPolygon } from '@turf/helpers';
import { geocodeEventsWithoutCoords } from '../lib/geocoding';
import { getDistrictByPostalCodeAT, getDistrictByCoordsAT } from '../lib/districtsAT';

const DB_PATH = path.join(process.cwd(), 'data', 'events.db');

// ─────────────────────────────────────────────
// 1. Normalize Bundesland capitalization
// ─────────────────────────────────────────────
function normalizeBundesland(): void {
  const db = new Database(DB_PATH);
  const normalizations: [string, string][] = [
    ['Tirol', 'tirol'],
    ['Vorarlberg', 'vorarlberg'],
    ['Niederösterreich', 'niederoesterreich'],
    ['Kärnten', 'kaernten'],
    ['Burgenland', 'burgenland'],
    ['Steiermark', 'steiermark'],
    ['Wien', 'wien'],
    ['Salzburg', 'salzburg'],
    ['Oberösterreich', 'oberoesterreich'],
  ];
  let total = 0;
  for (const [from, to] of normalizations) {
    const r = db.prepare('UPDATE events SET bundesland = ? WHERE bundesland = ?').run(to, from);
    total += r.changes;
  }
  if (total > 0) console.log(`  Normalized ${total} Bundesland values`);
  db.close();
}

// ─────────────────────────────────────────────
// 2. Assign/fix Bundesland using GeoJSON polygon boundaries
// ─────────────────────────────────────────────
const BL_NAMES = [
  'wien', 'niederoesterreich', 'oberoesterreich', 'salzburg',
  'tirol', 'vorarlberg', 'steiermark', 'kaernten', 'burgenland'
] as const;

function loadPolygons() {
  const polys: Record<string, ReturnType<typeof polygon> | ReturnType<typeof multiPolygon>> = {};
  for (const bl of BL_NAMES) {
    try {
      const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'public', `${bl}.geojson`), 'utf-8'));
      const geom = raw.geometry || raw.features?.[0]?.geometry;
      if (geom.type === 'Polygon') polys[bl] = polygon(geom.coordinates);
      else if (geom.type === 'MultiPolygon') polys[bl] = multiPolygon(geom.coordinates);
    } catch {}
  }
  return polys;
}

function findBundeslandByCoords(lat: number, lng: number, polys: Record<string, any>): string | null {
  const pt = point([lng, lat]);
  for (const [bl, poly] of Object.entries(polys)) {
    if (booleanPointInPolygon(pt, poly)) return bl;
  }
  return null;
}

function assignAndFixBundesland(): { assigned: number; corrected: number } {
  const db = new Database(DB_PATH);
  const polys = loadPolygons();
  console.log(`  Loaded ${Object.keys(polys).length} GeoJSON polygons`);

  const events = db.prepare(
    'SELECT id, latitude, longitude, bundesland FROM events WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
  ).all() as { id: number; latitude: number; longitude: number; bundesland: string | null }[];

  const update = db.prepare('UPDATE events SET bundesland = ? WHERE id = ?');
  let assigned = 0;
  let corrected = 0;

  db.transaction(() => {
    for (const ev of events) {
      const detected = findBundeslandByCoords(ev.latitude, ev.longitude, polys);
      if (!detected) continue; // Outside all polygons (border areas), keep current

      if (!ev.bundesland) {
        update.run(detected, ev.id);
        assigned++;
      } else if (ev.bundesland !== detected) {
        update.run(detected, ev.id);
        corrected++;
      }
    }
  })();

  db.close();
  return { assigned, corrected };
}

// ─────────────────────────────────────────────
// 3. Assign districts
// ─────────────────────────────────────────────
function assignDistricts(): number {
  const db = new Database(DB_PATH);
  const events = db.prepare(`
    SELECT id, bundesland, postal_code, latitude, longitude, location_name, address
    FROM events
    WHERE (district IS NULL OR district = '')
      AND bundesland IS NOT NULL
  `).all() as { id: number; bundesland: string; postal_code: string | null; latitude: number | null; longitude: number | null; location_name: string | null; address: string | null }[];

  let assigned = 0;
  const update = db.prepare('UPDATE events SET district = ? WHERE id = ?');

  for (const ev of events) {
    let district: string | null = null;
    if (ev.postal_code) {
      const r = getDistrictByPostalCodeAT(ev.postal_code);
      if (r && r.bundesland === ev.bundesland) district = r.district;
    }
    if (!district && ev.latitude && ev.longitude) {
      district = getDistrictByCoordsAT(ev.latitude, ev.longitude, ev.bundesland);
    }
    if (district) {
      update.run(district, ev.id);
      assigned++;
    }
  }
  db.close();
  return assigned;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log('\n=== Post-Processing Pipeline ===\n');

  console.log('Step 1: Normalize Bundesland capitalization...');
  normalizeBundesland();

  console.log('Step 2: Geocode events without coordinates (Nominatim, ~1/sec)...');
  const geocoded = await geocodeEventsWithoutCoords();
  console.log(`  Geocoded: ${geocoded} events`);

  console.log('Step 3: Assign/fix Bundesland via GeoJSON polygon test...');
  const { assigned: blAssigned, corrected: blCorrected } = assignAndFixBundesland();
  console.log(`  Assigned: ${blAssigned}, Corrected: ${blCorrected}`);

  console.log('Step 4: Assign districts from coordinates/PLZ...');
  const districtFixed = assignDistricts();
  console.log(`  Assigned districts: ${districtFixed} events`);

  // Final stats
  const db = new Database(DB_PATH);
  const total = (db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number }).c;
  const withCoords = (db.prepare('SELECT COUNT(*) as c FROM events WHERE latitude IS NOT NULL').get() as { c: number }).c;
  const nullBL = (db.prepare('SELECT COUNT(*) as c FROM events WHERE bundesland IS NULL').get() as { c: number }).c;
  db.close();

  console.log('\n=== Final Stats ===');
  console.log(`  Total events: ${total.toLocaleString('de')}`);
  console.log(`  With coordinates: ${withCoords.toLocaleString('de')} (${Math.round(withCoords/total*100)}%)`);
  console.log(`  Without Bundesland: ${nullBL}`);
  console.log('\nPost-processing complete!');
}

main().catch(console.error);
