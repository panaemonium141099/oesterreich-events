/**
 * Fix Bundesland assignments using actual GeoJSON polygon boundaries.
 * Tests every event's coordinates against all 9 Bundesland polygons
 * and reassigns events that are in the wrong Bundesland.
 *
 * Also used in post-processing to ensure future scrapes are correctly assigned.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon, multiPolygon } from '@turf/helpers';

const db = new Database(join(process.cwd(), 'data', 'events.db'));
db.pragma('journal_mode = WAL');

const BUNDESLAENDER = [
  'wien', 'niederoesterreich', 'oberoesterreich', 'salzburg',
  'tirol', 'vorarlberg', 'steiermark', 'kaernten', 'burgenland'
] as const;

// Load all GeoJSON polygons
const polygons: Record<string, ReturnType<typeof polygon> | ReturnType<typeof multiPolygon>> = {};

for (const bl of BUNDESLAENDER) {
  const geojsonPath = join(process.cwd(), 'public', `${bl}.geojson`);
  try {
    const raw = JSON.parse(readFileSync(geojsonPath, 'utf-8'));
    const geom = raw.geometry || raw.features?.[0]?.geometry;
    if (geom.type === 'Polygon') {
      polygons[bl] = polygon(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      polygons[bl] = multiPolygon(geom.coordinates);
    }
    console.log(`✓ Loaded ${bl} (${geom.type})`);
  } catch (e) {
    console.error(`✗ Failed to load ${bl}:`, (e as Error).message);
  }
}

function findBundesland(lat: number, lng: number): string | null {
  const pt = point([lng, lat]);
  for (const [bl, poly] of Object.entries(polygons)) {
    if (booleanPointInPolygon(pt, poly as any)) {
      return bl;
    }
  }
  return null;
}

// Process all events
const events = db.prepare(
  'SELECT id, latitude, longitude, bundesland FROM events WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
).all() as { id: number; latitude: number; longitude: number; bundesland: string }[];

console.log(`\nProcessing ${events.length} events...`);

const update = db.prepare('UPDATE events SET bundesland = ? WHERE id = ?');
let fixed = 0;
let noMatch = 0;
let correct = 0;
const fixes: Record<string, number> = {};

const updateBatch = db.transaction((batch: { id: number; bl: string }[]) => {
  for (const { id, bl } of batch) {
    update.run(bl, id);
  }
});

const batch: { id: number; bl: string }[] = [];

for (const event of events) {
  const detectedBl = findBundesland(event.latitude, event.longitude);

  if (!detectedBl) {
    // Coords outside Austria entirely
    noMatch++;
    continue;
  }

  if (detectedBl !== event.bundesland) {
    const key = `${event.bundesland || 'null'} → ${detectedBl}`;
    fixes[key] = (fixes[key] || 0) + 1;
    batch.push({ id: event.id, bl: detectedBl });
    fixed++;
  } else {
    correct++;
  }
}

// Apply all fixes in one transaction
updateBatch(batch);

console.log(`\n=== Results ===`);
console.log(`Correct: ${correct}`);
console.log(`Fixed: ${fixed}`);
console.log(`Outside Austria: ${noMatch}`);

if (Object.keys(fixes).length > 0) {
  console.log(`\nFix breakdown:`);
  Object.entries(fixes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => console.log(`  ${key}: ${count}`));
}

// Show events outside Austria
if (noMatch > 0) {
  console.log(`\nEvents outside all Bundesland polygons:`);
  const outside = db.prepare(
    'SELECT id, title, latitude, longitude, bundesland FROM events WHERE latitude IS NOT NULL AND longitude IS NOT NULL'
  ).all() as { id: number; title: string; latitude: number; longitude: number; bundesland: string }[];

  let shown = 0;
  for (const e of outside) {
    const detected = findBundesland(e.latitude, e.longitude);
    if (!detected && shown < 20) {
      console.log(`  [${e.bundesland}] ${e.latitude.toFixed(3)}, ${e.longitude.toFixed(3)} | ${e.title?.substring(0, 50)}`);
      shown++;
    }
  }
}

// Final distribution
console.log(`\nFinal distribution:`);
const dist = db.prepare('SELECT bundesland, COUNT(*) as c FROM events GROUP BY bundesland ORDER BY c DESC').all() as { bundesland: string; c: number }[];
dist.forEach(r => console.log(`  ${r.bundesland}: ${r.c}`));

db.close();
