/**
 * Parses GeoNames AT.txt dump into a compact JSON lookup database.
 * Only keeps populated places (PPL* feature codes) + administrative divisions.
 *
 * GeoNames format (tab-separated):
 * 0: geonameid, 1: name, 2: asciiname, 3: alternatenames, 4: latitude,
 * 5: longitude, 6: feature_class, 7: feature_code, 8: country_code,
 * 9: cc2, 10: admin1, 11: admin2, 12: admin3, 13: admin4, 14: population,
 * 15: elevation, 16: dem, 17: timezone, 18: modification_date
 *
 * Run: npx tsx src/scripts/build-geonames-db.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Austrian Bundesland codes from GeoNames admin1
const ADMIN1_MAP: Record<string, string> = {
  '01': 'Burgenland',
  '02': 'Kärnten',
  '03': 'Niederösterreich',
  '04': 'Steiermark',
  '05': 'Tirol',
  '06': 'Oberösterreich',
  '07': 'Salzburg',
  '08': 'Vorarlberg',
  '09': 'Wien',
};

// Feature codes to keep: populated places, admin divisions, buildings
const KEEP_FEATURES = new Set([
  'PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC', 'PPLL', 'PPLX', 'PPLS', 'PPLF', 'PPLG',
  'ADM1', 'ADM2', 'ADM3', 'ADM4',
  'CH', 'CSTL', 'MUS', 'THTR', 'STDM', 'CMTY', 'SCH', 'UNIV', 'HSP', 'HTL',
]);

interface GeoEntry {
  name: string;
  ascii: string;
  alt: string[];  // alternative names
  lat: number;
  lng: number;
  bundesland: string;
  pop: number;
  type: string;  // feature code
}

function main() {
  const inputPath = join(process.cwd(), 'data', 'AT.txt');
  const outputPath = join(process.cwd(), 'data', 'geonames-at.json');

  const content = readFileSync(inputPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  const entries: GeoEntry[] = [];
  let skipped = 0;

  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 19) continue;

    const featureCode = cols[7];
    const featureClass = cols[6];

    // Keep populated places, admin divisions, and notable buildings/venues
    if (!KEEP_FEATURES.has(featureCode) && featureClass !== 'P' && featureClass !== 'S') {
      skipped++;
      continue;
    }

    const admin1 = cols[10];
    const bundesland = ADMIN1_MAP[admin1] || '';

    const altNames = cols[3] ? cols[3].split(',').map(n => n.trim()).filter(n => n.length > 1) : [];

    entries.push({
      name: cols[1],
      ascii: cols[2],
      alt: altNames.slice(0, 5), // keep max 5 alt names
      lat: parseFloat(cols[4]),
      lng: parseFloat(cols[5]),
      bundesland,
      pop: parseInt(cols[14]) || 0,
      type: featureCode,
    });
  }

  // Sort by population (largest first) for disambiguation priority
  entries.sort((a, b) => b.pop - a.pop);

  writeFileSync(outputPath, JSON.stringify(entries));

  console.log(`Parsed ${entries.length} entries (skipped ${skipped} non-place features)`);
  console.log(`File size: ${(JSON.stringify(entries).length / 1024 / 1024).toFixed(1)} MB`);

  // Stats
  const byBL: Record<string, number> = {};
  for (const e of entries) {
    byBL[e.bundesland || 'unknown'] = (byBL[e.bundesland || 'unknown'] || 0) + 1;
  }
  console.log('\nBy Bundesland:');
  Object.entries(byBL).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

main();
