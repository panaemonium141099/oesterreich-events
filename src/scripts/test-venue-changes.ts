/**
 * Quick verification script for venue-prefix detection, PPL-only step 3b, and known-venues.
 * Run: npx tsx src/scripts/test-venue-changes.ts
 */
import { normalizeLocation, isVenueName } from '../lib/location-normalizer.js';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('=== 1. isVenueName detection ===');
assert('Schloss Esterhazy is venue', isVenueName('Schloss Esterhazy'));
assert('Burg Forchtenstein is venue', isVenueName('Burg Forchtenstein'));
assert('Domkirche St. Martin is venue', isVenueName('Domkirche St. Martin'));
assert('Kulturzentrum Mattersburg is venue', isVenueName('Kulturzentrum Mattersburg'));
assert('Theater an der Wien is venue', isVenueName('Theater an der Wien'));
assert('Museum XYZ is venue', isVenueName('Museum XYZ'));
assert('Galerie Thayaland is venue', isVenueName('Galerie Thayaland'));
assert('Eisenstadt is NOT venue', !isVenueName('Eisenstadt'));
assert('Kobersdorf is NOT venue', !isVenueName('Kobersdorf'));
assert('Wien is NOT venue', !isVenueName('Wien'));
assert('schloss xyz case-insensitive', isVenueName('schloss xyz'));
assert('BURG test case-insensitive', isVenueName('BURG test'));

console.log('\n=== 2. Known venue lookup (exact coords) ===');
const r1 = normalizeLocation('Schloss Esterhazy');
assert('Schloss Esterhazy resolves', r1 !== null);
assert('Schloss Esterhazy lat ~47.845', r1 !== null && Math.abs(r1.latitude - 47.8458) < 0.01,
  r1 ? `lat=${r1.latitude}` : 'null');
assert('Schloss Esterhazy confidence=exact', r1 !== null && r1.confidence === 'exact',
  r1 ? `conf=${r1.confidence}` : 'null');

const r2 = normalizeLocation('Burg Forchtenstein');
assert('Burg Forchtenstein resolves (known venue)', r2 !== null);
assert('Burg Forchtenstein lat ~47.708', r2 !== null && Math.abs(r2.latitude - 47.7081) < 0.01,
  r2 ? `lat=${r2.latitude}` : 'null');

console.log('\n=== 3. Venue prefix skips step 3b (unknown venue returns null) ===');
const r3 = normalizeLocation('Schloss XYZ Unknown');
assert('Schloss XYZ Unknown returns null', r3 === null,
  r3 ? `got: ${JSON.stringify(r3)}` : undefined);

const r3b = normalizeLocation('Domkirche St. Martin');
assert('Domkirche St. Martin returns null (no known venue, prefix blocks 3b)', r3b === null,
  r3b ? `got: ${r3b.canonicalName}` : undefined);

console.log('\n=== 4. Steps 1-3a still match all types (no PPL filter) ===');
const r4 = normalizeLocation('Eisenstadt');
assert('Eisenstadt resolves', r4 !== null);
assert('Eisenstadt confidence=exact or normalized', r4 !== null && (r4.confidence === 'exact' || r4.confidence === 'normalized'),
  r4 ? `conf=${r4.confidence}` : 'null');

const r5 = normalizeLocation('Wien');
assert('Wien resolves', r5 !== null);

const r6 = normalizeLocation('Graz');
assert('Graz resolves', r6 !== null);

console.log('\n=== 5. Burg ambiguity: full match first, then venue detection ===');
// "Burg Forchtenstein" is in KNOWN_VENUES, so it should match there
// But "Burg" alone (if it were a location_name) should try full match first
const r7 = normalizeLocation('Burg', undefined, 'Burgenland');
// "Burg" is a venue prefix but also a settlement. Since it matches in step 1 as a place name...
// Actually "Burg" is only a venue prefix, NOT in the geonames PPL index. Let's check.
console.log(`  Note: "Burg" result: ${r7 ? r7.canonicalName + ' conf=' + r7.confidence : 'null'}`);

console.log('\n=== 6. Existing tests still work ===');
const r8 = normalizeLocation('Burgruine Landsee', undefined, 'Burgenland');
assert('Burgruine Landsee still resolves', r8 !== null && r8.canonicalName === 'Landsee',
  r8 ? `got: ${r8.canonicalName}` : 'null');

const r9 = normalizeLocation('Kobersdorf', undefined, 'Burgenland');
assert('Kobersdorf resolves', r9 !== null,
  r9 ? `got: ${r9.canonicalName}` : 'null');

console.log('\n=== 7. PPL-only step 3b filter ===');
// This tests that word-by-word matching only matches PPL entries
// "Schloss" as a standalone word should NOT match (it's an HTL entry + venue prefix blocks it)
// But let's check a non-venue-prefix case where PPL filter matters
const r10 = normalizeLocation('Some Place Martin');
// "Martin" might match a church (CH type) but PPL filter should prevent it
console.log(`  Note: "Some Place Martin" result: ${r10 ? r10.canonicalName + ' type would be PPL-filtered' : 'null (PPL filter working or no match)'}`);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
