/**
 * Post-processing script: assign districts to events that have bundesland but no district.
 * Uses postal code → district lookup, then coordinates → district fallback.
 * Run with: npx tsx src/scripts/assign-districts.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { getDistrictByPostalCodeAT, getDistrictByCoordsAT, getDistrictByLocationAT } from '../lib/districtsAT';

const DB_PATH = path.join(process.cwd(), 'data', 'events.db');
const db = new Database(DB_PATH);

interface EventRow {
  id: number;
  bundesland: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  address: string | null;
}

const events = db.prepare(`
  SELECT id, bundesland, postal_code, latitude, longitude, location_name, address
  FROM events
  WHERE (district IS NULL OR district = '')
    AND bundesland IS NOT NULL
`).all() as EventRow[];

console.log(`Assigning districts to ${events.length} events...`);

const updateDistrict = db.prepare('UPDATE events SET district = ? WHERE id = ?');

let assigned = 0;
let byPostal = 0;
let byCoords = 0;
let byLocation = 0;
let skipped = 0;

for (const event of events) {
  let district: string | null = null;

  // 1. Try postal code
  if (event.postal_code) {
    const result = getDistrictByPostalCodeAT(event.postal_code);
    if (result && result.bundesland === event.bundesland) {
      district = result.district;
      byPostal++;
    }
  }

  // 2. Try coordinates
  if (!district && event.latitude && event.longitude) {
    district = getDistrictByCoordsAT(event.latitude, event.longitude, event.bundesland);
    if (district) byCoords++;
  }

  // 3. Try location name
  if (!district && event.location_name) {
    district = getDistrictByLocationAT(event.location_name, event.bundesland);
    if (district) byLocation++;
  }

  // 4. Try address
  if (!district && event.address) {
    district = getDistrictByLocationAT(event.address, event.bundesland);
    if (district) byLocation++;
  }

  if (district) {
    updateDistrict.run(district, event.id);
    assigned++;
  } else {
    skipped++;
  }
}

db.close();

console.log(`\nDistrict assignment complete:`);
console.log(`  Total processed: ${events.length}`);
console.log(`  Assigned: ${assigned}`);
console.log(`    - by postal code: ${byPostal}`);
console.log(`    - by coordinates: ${byCoords}`);
console.log(`    - by location name: ${byLocation}`);
console.log(`  Skipped (no data): ${skipped}`);
