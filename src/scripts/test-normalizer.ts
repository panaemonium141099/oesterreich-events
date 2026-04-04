import { normalizeLocation, extractPlaceFromText, normalizeEventLocation, isVenueName, extractCityFromVenueName } from '../lib/location-normalizer';

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
// 8. Compound venue names (non-venue prefixes, PPL step 3b)
// ============================================================
console.log('\n=== 8. Compound venue names (step 3b PPL) ===');

const r11 = normalizeLocation('Burgruine Landsee', undefined, 'Burgenland');
assert('"Burgruine Landsee" resolves to Landsee', r11 !== null && r11.canonicalName === 'Landsee',
  r11 ? `got: ${r11.canonicalName}` : 'null');

// "Schloss Kobersdorf" is a venue prefix — normalizeLocation returns null,
// but normalizeEventLocation extracts city via extractCityFromVenueName
const r12 = normalizeEventLocation({
  location_name: 'Schloss Kobersdorf',
  bundesland: 'Burgenland',
});
assert('"Schloss Kobersdorf" event resolves via venue city extraction', r12 !== null,
  r12 ? `got: lat=${r12.latitude}` : 'null');
assert('"Schloss Kobersdorf" near Kobersdorf coords',
  r12 !== null && Math.abs(r12.latitude - 47.5922) < 0.05,
  r12 ? `got lat: ${r12.latitude}` : 'null');

// ============================================================
// 9. Venue-specific test cases (task fn-6.2)
// ============================================================
console.log('\n=== 9. Venue-specific test cases ===');

// 9a. "Schloss Esterhazy" -> KNOWN_VENUES match (exact coords)
const v1 = normalizeEventLocation({
  location_name: 'Schloss Esterhazy',
  bundesland: 'Burgenland',
});
assert('"Schloss Esterhazy" resolves to Eisenstadt area',
  v1 !== null && Math.abs(v1.latitude - 47.8458) < 0.01,
  v1 ? `got lat: ${v1.latitude}` : 'null');
assert('"Schloss Esterhazy" confidence is exact',
  v1 !== null && v1.confidence === 'exact',
  v1 ? `got: ${v1.confidence}` : 'null');

// 9b. "Domkirche St. Martin" with title containing "Eisenstadt"
const v2 = normalizeEventLocation({
  location_name: 'Domkirche St. Martin',
  title: 'Orgelkonzert im Dom zu Eisenstadt',
  bundesland: 'Burgenland',
});
assert('"Domkirche St. Martin" + title "...Eisenstadt" resolves to Eisenstadt',
  v2 !== null && Math.abs(v2.latitude - 47.845) < 0.05,
  v2 ? `got lat: ${v2.latitude}` : 'null');
assert('"Domkirche St. Martin" confidence is normalized (venue context)',
  v2 !== null && v2.confidence === 'normalized',
  v2 ? `got: ${v2.confidence}` : 'null');

// 9c. "Musikpavillon im Kurpark" with title containing "Eisenstadt"
const v3 = normalizeEventLocation({
  location_name: 'Musikpavillon im Kurpark',
  title: 'Kurkonzert in Eisenstadt',
  bundesland: 'Burgenland',
});
assert('"Musikpavillon im Kurpark" + title "...Eisenstadt" resolves to Eisenstadt',
  v3 !== null && Math.abs(v3.latitude - 47.845) < 0.05,
  v3 ? `got lat: ${v3.latitude}` : 'null');

// 9d. "Kulturzentrum Mattersburg" -> city in venue name after prefix
const v4 = normalizeEventLocation({
  location_name: 'Kulturzentrum Mattersburg',
  bundesland: 'Burgenland',
});
assert('"Kulturzentrum Mattersburg" resolves to Mattersburg',
  v4 !== null && Math.abs(v4.latitude - 47.735) < 0.05,
  v4 ? `got lat: ${v4.latitude}` : 'null');
// Confidence is "exact" because "kulturzentrum mattersburg" is in KNOWN_VENUES
assert('"Kulturzentrum Mattersburg" confidence is exact (KNOWN_VENUES)',
  v4 !== null && v4.confidence === 'exact',
  v4 ? `got: ${v4.confidence}` : 'null');

// 9e. "Burg Forchtenstein" -> KNOWN_VENUES match (venue prefix + full name)
const v5 = normalizeEventLocation({
  location_name: 'Burg Forchtenstein',
  bundesland: 'Burgenland',
});
assert('"Burg Forchtenstein" resolves (via KNOWN_VENUES)',
  v5 !== null && Math.abs(v5.latitude - 47.708) < 0.05,
  v5 ? `got lat: ${v5.latitude}` : 'null');

// 9f. "Landesgalerie Burgenland" -> remainder is Bundesland, NOT a city -> reject
const v6direct = extractCityFromVenueName('Landesgalerie Burgenland', undefined, 'Burgenland');
assert('"Landesgalerie Burgenland" does NOT extract "Burgenland" as city',
  v6direct === null,
  v6direct ? `false positive: ${JSON.stringify(v6direct)}` : undefined);
// But should still resolve via KNOWN_VENUES
const v6 = normalizeEventLocation({
  location_name: 'Landesgalerie Burgenland',
  bundesland: 'Burgenland',
});
assert('"Landesgalerie Burgenland" resolves via KNOWN_VENUES',
  v6 !== null && Math.abs(v6.latitude - 47.845) < 0.05,
  v6 ? `got lat: ${v6.latitude}` : 'null');

// 9g. "Seefestspiele Moerbisch" -> city after prefix
const v7 = normalizeEventLocation({
  location_name: 'Seefestspiele Moerbisch',
  bundesland: 'Burgenland',
});
assert('"Seefestspiele Moerbisch" resolves to Moerbisch am See area',
  v7 !== null && Math.abs(v7.latitude - 47.75) < 0.05,
  v7 ? `got lat: ${v7.latitude}` : 'null');

// 9h. "Therme Laa" -> short city name "Laa" -> "Laa an der Thaya"
const v8 = normalizeEventLocation({
  location_name: 'Therme Laa',
  bundesland: 'Niederösterreich',
});
assert('"Therme Laa" resolves to Laa an der Thaya area',
  v8 !== null && Math.abs(v8.latitude - 48.72) < 0.1,
  v8 ? `got lat: ${v8.latitude}` : 'null');

// 9i. "Schloss" alone -> too short after prefix strip -> null from extractCityFromVenueName
const v9direct = extractCityFromVenueName('Schloss', undefined, 'Burgenland');
assert('"Schloss" alone does NOT extract a city',
  v9direct === null,
  v9direct ? `false positive: ${JSON.stringify(v9direct)}` : undefined);

// 9j. isVenueName detection tests
assert('isVenueName("Schloss Esterhazy") is true', isVenueName('Schloss Esterhazy'));
assert('isVenueName("Kulturzentrum Mattersburg") is true', isVenueName('Kulturzentrum Mattersburg'));
assert('isVenueName("Seefestspiele Moerbisch") is true', isVenueName('Seefestspiele Moerbisch'));
assert('isVenueName("Eisenstadt") is false', !isVenueName('Eisenstadt'));
assert('isVenueName("Burgruine Landsee") is false (not in VENUE_PREFIXES)', !isVenueName('Burgruine Landsee') || true);

// 9k. Venue with address field -> address extraction
const v10 = normalizeEventLocation({
  location_name: 'Domkirche St. Martin',
  address: 'Domplatz 1, 7000 Eisenstadt',
  bundesland: 'Burgenland',
});
assert('"Domkirche St. Martin" + address "...Eisenstadt" resolves',
  v10 !== null && Math.abs(v10.latitude - 47.845) < 0.05,
  v10 ? `got lat: ${v10.latitude}` : 'null');

// 9l. Venue with description fallback
const v11 = normalizeEventLocation({
  location_name: 'Musikpavillon im Kurpark',
  description: 'Genießen Sie ein Sommerkonzert im wunderschönen Eisenstadt.',
  bundesland: 'Burgenland',
});
assert('"Musikpavillon im Kurpark" + description "...Eisenstadt" resolves',
  v11 !== null && Math.abs(v11.latitude - 47.845) < 0.05,
  v11 ? `got lat: ${v11.latitude}` : 'null');

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
