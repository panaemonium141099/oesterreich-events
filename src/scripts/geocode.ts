/**
 * Geocoding script: assign coordinates to events without lat/lng via Nominatim.
 * Rate-limited to 1 req/sec as per Nominatim usage policy.
 * Run with: npx tsx src/scripts/geocode.ts
 */

import { geocodeEventsWithoutCoords } from '../lib/geocoding';

async function main() {
  console.log('Starting geocoding of events without coordinates...');
  const geocoded = await geocodeEventsWithoutCoords();
  console.log(`\nGeocoding complete: ${geocoded} events now have coordinates.`);
}

main().catch(console.error);
