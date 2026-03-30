/**
 * Post-processing script: Fix geolocation issues
 * 1. Normalize Bundesland names
 * 2. Fix events in wrong Bundesland based on coordinates
 * 3. Assign Bundesland to events without one based on coordinates
 * 4. Remove events with clearly invalid coordinates
 *
 * Run with: npx tsx src/scripts/fix-geolocation.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'events.db');
const db = new Database(DB_PATH);

// Bundesland bounding boxes (approximate)
const BUNDESLAND_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  wien:              { minLat: 48.118, maxLat: 48.323, minLng: 16.183, maxLng: 16.577 },
  niederoesterreich: { minLat: 47.39, maxLat: 48.97, minLng: 14.45, maxLng: 17.07 },
  burgenland:        { minLat: 46.84, maxLat: 48.12, minLng: 16.02, maxLng: 17.17 },
  oberoesterreich:   { minLat: 47.46, maxLat: 48.77, minLng: 12.75, maxLng: 14.99 },
  steiermark:        { minLat: 46.61, maxLat: 47.83, minLng: 13.56, maxLng: 16.17 },
  salzburg:          { minLat: 46.97, maxLat: 47.85, minLng: 12.04, maxLng: 13.90 },
  tirol:             { minLat: 46.65, maxLat: 47.74, minLng: 10.10, maxLng: 12.97 },
  kaernten:          { minLat: 46.37, maxLat: 47.13, minLng: 12.65, maxLng: 15.05 },
  vorarlberg:        { minLat: 46.84, maxLat: 47.59, minLng: 9.53, maxLng: 10.24 },
};

// Austria bounding box
const AUSTRIA = { minLat: 46.37, maxLat: 49.02, minLng: 9.53, maxLng: 17.17 };

// Normalization map
const NORMALIZE_BL: Record<string, string> = {
  'wien': 'wien', 'Wien': 'wien',
  'niederoesterreich': 'niederoesterreich', 'Niederösterreich': 'niederoesterreich', 'niederösterreich': 'niederoesterreich', 'noe': 'niederoesterreich', 'NÖ': 'niederoesterreich',
  'oberoesterreich': 'oberoesterreich', 'Oberösterreich': 'oberoesterreich', 'oberösterreich': 'oberoesterreich', 'ooe': 'oberoesterreich', 'OÖ': 'oberoesterreich',
  'steiermark': 'steiermark', 'Steiermark': 'steiermark',
  'salzburg': 'salzburg', 'Salzburg': 'salzburg',
  'tirol': 'tirol', 'Tirol': 'tirol',
  'kaernten': 'kaernten', 'Kärnten': 'kaernten', 'kärnten': 'kaernten',
  'vorarlberg': 'vorarlberg', 'Vorarlberg': 'vorarlberg',
  'burgenland': 'burgenland', 'Burgenland': 'burgenland',
};

function getBundeslandFromCoords(lat: number, lng: number): string | null {
  // Check if in Austria at all
  if (lat < AUSTRIA.minLat || lat > AUSTRIA.maxLat || lng < AUSTRIA.minLng || lng > AUSTRIA.maxLng) {
    return null;
  }

  // Wien is the most specific — check first
  const wienBounds = BUNDESLAND_BOUNDS.wien;
  if (lat >= wienBounds.minLat && lat <= wienBounds.maxLat &&
      lng >= wienBounds.minLng && lng <= wienBounds.maxLng) {
    return 'wien';
  }

  // Score each Bundesland by how well the point fits
  let bestBl: string | null = null;
  let bestScore = -1;

  for (const [bl, bounds] of Object.entries(BUNDESLAND_BOUNDS)) {
    if (bl === 'wien') continue; // Already checked
    if (lat >= bounds.minLat && lat <= bounds.maxLat &&
        lng >= bounds.minLng && lng <= bounds.maxLng) {
      // Calculate how centered the point is (higher = better fit)
      const latCenter = (bounds.minLat + bounds.maxLat) / 2;
      const lngCenter = (bounds.minLng + bounds.maxLng) / 2;
      const latRange = bounds.maxLat - bounds.minLat;
      const lngRange = bounds.maxLng - bounds.minLng;
      const score = 1 - (Math.abs(lat - latCenter) / latRange + Math.abs(lng - lngCenter) / lngRange) / 2;
      if (score > bestScore) {
        bestScore = score;
        bestBl = bl;
      }
    }
  }

  return bestBl;
}

// PLZ ranges for Bundesland
function getBundeslandFromPLZ(plz: string): string | null {
  const p = parseInt(plz, 10);
  if (isNaN(p)) return null;

  if (p >= 1000 && p <= 1239) return 'wien';
  if (p >= 2000 && p <= 2999) return 'niederoesterreich';
  if (p >= 3000 && p <= 3999) return 'niederoesterreich';
  if (p >= 4000 && p <= 4999) return 'oberoesterreich';
  if (p >= 5000 && p <= 5999) return 'salzburg';
  if (p >= 6000 && p <= 6699) return 'tirol';
  if (p >= 6700 && p <= 6999) return 'vorarlberg';
  if (p >= 7000 && p <= 7999) return 'burgenland';
  if (p >= 8000 && p <= 8999) return 'steiermark';
  if (p >= 9000 && p <= 9999) return 'kaernten';

  // Exceptions
  if (p >= 8380 && p <= 8385) return 'burgenland'; // Jennersdorf area

  return null;
}

console.log('=== GEOLOCATION FIX ===\n');

// Phase 1: Normalize Bundesland names
console.log('Phase 1: Bundesland-Namen normalisieren...');
const updateBl = db.prepare('UPDATE events SET bundesland = ? WHERE bundesland = ?');

let normalized = 0;
for (const [from, to] of Object.entries(NORMALIZE_BL)) {
  if (from !== to) {
    const result = updateBl.run(to, from);
    if (result.changes > 0) {
      console.log(`  "${from}" → "${to}": ${result.changes} Events`);
      normalized += result.changes;
    }
  }
}
console.log(`  ${normalized} Events normalisiert\n`);

// Phase 2: Fix events with coordinates in wrong Bundesland
console.log('Phase 2: Events im falschen Bundesland fixen...');
interface EventRow {
  id: number;
  bundesland: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

const allEventsWithCoords = db.prepare(`
  SELECT id, bundesland, postal_code, latitude, longitude
  FROM events
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL
`).all() as EventRow[];

const updateBundesland = db.prepare('UPDATE events SET bundesland = ? WHERE id = ?');
let fixed = 0;
let outsideAustria = 0;

for (const ev of allEventsWithCoords) {
  if (!ev.latitude || !ev.longitude) continue;

  const correctBl = getBundeslandFromCoords(ev.latitude, ev.longitude);

  if (correctBl === null) {
    // Outside Austria — check if it's way off
    if (ev.latitude < 45 || ev.latitude > 50 || ev.longitude < 8 || ev.longitude > 18) {
      outsideAustria++;
    }
    continue;
  }

  // If current Bundesland is wrong, fix it
  if (ev.bundesland && ev.bundesland !== correctBl) {
    // Double-check with PLZ if available
    const plzBl = ev.postal_code ? getBundeslandFromPLZ(ev.postal_code) : null;

    // If PLZ agrees with coords, definitely fix
    if (!plzBl || plzBl === correctBl) {
      updateBundesland.run(correctBl, ev.id);
      fixed++;
    }
  }
}
console.log(`  ${fixed} Events korrigiert`);
console.log(`  ${outsideAustria} Events außerhalb Österreichs\n`);

// Phase 3: Assign Bundesland to events without one
console.log('Phase 3: Bundesland zuweisen wo fehlend...');
const noBl = db.prepare(`
  SELECT id, postal_code, latitude, longitude
  FROM events
  WHERE bundesland IS NULL
`).all() as EventRow[];

let assigned = 0;
for (const ev of noBl) {
  let bl: string | null = null;

  // Try PLZ first
  if (ev.postal_code) {
    bl = getBundeslandFromPLZ(ev.postal_code);
  }

  // Try coords
  if (!bl && ev.latitude && ev.longitude) {
    bl = getBundeslandFromCoords(ev.latitude, ev.longitude);
  }

  if (bl) {
    updateBundesland.run(bl, ev.id);
    assigned++;
  }
}
console.log(`  ${assigned} von ${noBl.length} Events zugewiesen\n`);

// Phase 4: Final stats
console.log('=== ERGEBNIS ===');
const blStats = db.prepare(`
  SELECT COALESCE(bundesland, 'OHNE') as bl, COUNT(*) as c
  FROM events
  GROUP BY bundesland
  ORDER BY c DESC
`).all() as { bl: string; c: number }[];

let total = 0;
for (const r of blStats) {
  console.log(`  ${r.bl.padEnd(25)} ${r.c}`);
  total += r.c;
}
console.log(`  ${'TOTAL'.padEnd(25)} ${total}`);
