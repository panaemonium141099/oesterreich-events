import { normalizeLocation, extractPlaceFromText, normalizeEventLocation } from '../lib/location-normalizer';

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ============================================================
// 1. Existing problem cases (Landsee, Oggau)
// ============================================================
console.log('\n=== 1. Existing problem cases ===');

const r1 = normalizeLocation('Landsee', undefined, 'Burgenland');
assert('Landsee direct resolves', r1 !== null);
assert('Landsee in Burgenland', r1?.bundesland === 'Burgenland', `got: ${r1?.bundesland}`);
assert('Landsee NOT near Eisenstadt (lat < 47.7)', r1 !== null && r1.latitude < 47.7,
  `got lat: ${r1?.latitude}`);

const r2 = extractPlaceFromText('Ostereiersuche auf der Burgruine Landsee', undefined, 'Burgenland');
assert('Title extract finds Landsee', r2 !== null && r2.canonicalName === 'Landsee');

const r3 = normalizeEventLocation({
  title: 'Ostereiersuche auf der Burgruine Landsee',
  location_name: 'Burgruine Landsee',
  bundesland: 'Burgenland',
});
assert('Full Landsee event resolves', r3 !== null);
assert('Landsee event NOT at Eisenstadt coords', r3 !== null && r3.latitude < 47.7,
  `got lat: ${r3?.latitude}`);

const r4 = normalizeEventLocation({
  title: 'Oggauer Weinglueck',
  location_name: 'Oggauer Weinbauern, Oggau am Neusiedler See',
  bundesland: 'Burgenland',
});
assert('Oggau event resolves', r4 !== null);
assert('Oggau event coords near 47.83', r4 !== null && Math.abs(r4.latitude - 47.833) < 0.1,
  `got lat: ${r4?.latitude}`);

const r5 = normalizeLocation('Oggau am Neusiedler See', undefined, 'Burgenland');
assert('Oggau direct resolves', r5 !== null);
assert('Oggau direct coords match', r5 !== null && Math.abs(r5.latitude - 47.833) < 0.1);

// ============================================================
// 2. Kobersdorf (new test case per spec)
// ============================================================
console.log('\n=== 2. Kobersdorf ===');

const r6 = normalizeLocation('Kobersdorf', undefined, 'Burgenland');
assert('Kobersdorf resolves', r6 !== null);
assert('Kobersdorf lat ~47.59', r6 !== null && Math.abs(r6.latitude - 47.5922) < 0.05,
  `got lat: ${r6?.latitude}`);
assert('Kobersdorf lng ~16.3-16.4', r6 !== null && Math.abs(r6.longitude - 16.35) < 0.1,
  `got lng: ${r6?.longitude}`);
assert('Kobersdorf in Burgenland', r6?.bundesland === 'Burgenland', `got: ${r6?.bundesland}`);

// ============================================================
// 3. Disambiguation NOT biased toward capital
// ============================================================
console.log('\n=== 3. Disambiguation (no capital bias) ===');

// Landsee should NOT be near Eisenstadt (47.845) — it should be near Markt Sankt Martin area
assert('Landsee lat is south of Eisenstadt', r1 !== null && r1.latitude < 47.7,
  `got: ${r1?.latitude}, Eisenstadt is 47.845`);

// ============================================================
// 4. Fuzzy matching does NOT produce coordinates
// ============================================================
console.log('\n=== 4. Fuzzy matching disabled for coords ===');

// A typo that would be a fuzzy match should return null
const r7 = normalizeLocation('Koebrsdorf', undefined, 'Burgenland');
assert('Fuzzy typo "Koebrsdorf" returns null (no coord assignment)', r7 === null,
  r7 ? `got: ${JSON.stringify(r7)}` : undefined);

const r7b = normalizeLocation('Eisnstadt', undefined, 'Burgenland');
assert('Fuzzy typo "Eisnstadt" returns null', r7b === null,
  r7b ? `got: ${JSON.stringify(r7b)}` : undefined);

// ============================================================
// 5. Unicode/diacritics: Moerbisch matches Moerbisch am See
// ============================================================
console.log('\n=== 5. Unicode/diacritics ===');

const r8 = normalizeLocation('Moerbisch', undefined, 'Burgenland');
// Moerbisch might be in GeoNames as "Moerbisch am See" — should still match via suffix removal
assert('Moerbisch resolves (exact or normalized)',
  r8 !== null && r8.confidence !== 'fuzzy',
  r8 ? `got: ${JSON.stringify(r8)}` : 'null');

const r8b = extractPlaceFromText('Konzert in Moerbisch am See', undefined, 'Burgenland');
assert('Moerbisch from title extraction', r8b !== null,
  r8b ? `got: ${JSON.stringify(r8b)}` : 'null');

// ============================================================
// 6. Negative test: "Rust" does not match inside "frustrated"/"rustic"
// ============================================================
console.log('\n=== 6. Negative: Rust substring matching ===');

const r9 = extractPlaceFromText('frustrated and rustic atmosphere in the old building', undefined, 'Burgenland');
assert('"frustrated/rustic" does NOT match Rust', r9 === null,
  r9 ? `false positive: ${JSON.stringify(r9)}` : undefined);

const r9b = extractPlaceFromText('The rust on the old gate was thick', undefined, 'Burgenland');
assert('"rust" (lowercase, not a place) does NOT match', r9b === null,
  r9b ? `false positive: ${JSON.stringify(r9b)}` : undefined);

// Positive: "Rust" as standalone place should still match
const r9c = extractPlaceFromText('Weinfest in Rust am Neusiedler See', undefined, 'Burgenland');
assert('"Rust" as standalone place in text matches', r9c !== null,
  r9c ? `matched: ${r9c.canonicalName}` : 'null');

// ============================================================
// 7. Common-word filter (Berg, Stein, Au, Egg, Hard)
// ============================================================
console.log('\n=== 7. Common-word filter ===');

const r10 = extractPlaceFromText('Ein schoener Berg bei Sonnenuntergang', undefined, undefined);
assert('"Berg" without Bundesland context does NOT match', r10 === null,
  r10 ? `false positive: ${JSON.stringify(r10)}` : undefined);

const r10b = extractPlaceFromText('Das Ei liegt auf dem Stein', undefined, undefined);
assert('"Stein" without Bundesland does NOT match', r10b === null,
  r10b ? `false positive: ${JSON.stringify(r10b)}` : undefined);

const r10c = extractPlaceFromText('Die Au ist wunderschoen', undefined, undefined);
assert('"Au" without Bundesland does NOT match', r10c === null,
  r10c ? `false positive: ${JSON.stringify(r10c)}` : undefined);

// ============================================================
// 8. Compound venue names
// ============================================================
console.log('\n=== 8. Compound venue names ===');

const r11 = normalizeLocation('Burgruine Landsee', undefined, 'Burgenland');
assert('"Burgruine Landsee" resolves to Landsee', r11 !== null && r11.canonicalName === 'Landsee',
  r11 ? `got: ${r11.canonicalName}` : 'null');

const r12 = normalizeLocation('Schloss Kobersdorf', undefined, 'Burgenland');
assert('"Schloss Kobersdorf" resolves', r12 !== null,
  r12 ? `got: ${r12.canonicalName}` : 'null');

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
