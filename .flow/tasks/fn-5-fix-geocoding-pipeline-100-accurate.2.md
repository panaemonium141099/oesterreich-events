# fn-5-fix-geocoding-pipeline-100-accurate.2 Overhaul location-normalizer: compound names, disambiguation, word boundaries

## Description
Overhaul the location normalizer to correctly handle compound venue names, improve disambiguation away from Bundesland centers, fix word-boundary matching, and disable fuzzy matching from producing coordinate assignments.

**Size:** M
**Files:** src/lib/location-normalizer.ts, src/scripts/test-normalizer.ts

## Approach

**Root Cause B (compound names):** The normalizer at location-normalizer.ts:421-463 fails on names like "Burgruine Landsee" and "Oggauer Weinbauern, Oggau am Neusiedler See". Fix the comma-split logic (lines 284-299) to:
1. Try each comma-separated part individually with full normalization (including suffix removal)
2. Try the LAST part first (often the actual place name, e.g., "Oggau am Neusiedler See")
3. After suffix removal (am Neusiedler See, an der, im), try the remaining name against GeoNames

**Root Cause C (disambiguation bias):** The getHint at location-normalizer.ts:209-224 uses Bundesland center coords (Eisenstadt for Burgenland). The disambiguate function then picks the closest match to this center, biasing everything toward the capital. Fix: use the geographic centroid of the Bundesland polygon, not the capital city. For Burgenland the geographic center is roughly 47.35, 16.42 (south of Oberpullendorf), not 47.845, 16.519 (Eisenstadt).

**Disable fuzzy coord persistence:** Per epic Confidence Model, fuzzy Levenshtein matches (distance <= 2) MUST NOT produce coordinate assignments. When the normalizer resolves via fuzzy matching, log a warning but return null/no-match for coordinate purposes. The fuzzy code path can remain for analytics/logging but must not feed into the coordinate assignment pipeline.

**Unicode-aware token matching in extractPlaceFromText:** The text extraction at lines 336-399 must use Unicode-aware normalized token/segment matching. NOT plain \b regex (fails on umlauts like Moerbisch, St. Margarethen). Approach:
- Normalize both the search term and the text (lowercase, collapse umlauts)
- Split text into tokens by whitespace/punctuation
- Match against normalized place name tokens as complete segments
- For multi-word place names like "St. Margarethen", match the full sequence of tokens

**Common-word filter:** Add protection against matching common German words that are also place names (Berg, Stein, Au, Egg, Hard). Skip these in from_title/from_description extraction unless confirmed by Bundesland context or minimum name length (>= 5 chars for text extraction).

## Key context

- The existing test-normalizer.ts has test cases for Landsee and Oggau but NOT Kobersdorf -- add it
- The GeoNames DB has 34k+ entries loaded from data/geonames-at.json
- The normalizer returns confidence levels: exact, normalized, fuzzy, from_title, from_description
- Recent commits already added from_title/from_description confidence handling
- Population=0 entries in GeoNames (small Katastralgemeinden) need special handling in disambiguation
- Canonical confidence precedence: manual > scraper > exact > normalized > from_title > from_description > nominatim > null

## Acceptance
- [ ] "Burgruine Landsee" resolves to Markt Sankt Martin area coords, not Eisenstadt
- [ ] "Oggauer Weinbauern, Oggau am Neusiedler See" resolves to Oggau coords
- [ ] "Kobersdorf" resolves correctly (47.5922, 16.3153)
- [ ] Disambiguation does not bias toward Bundesland capital (uses geographic centroid)
- [ ] Fuzzy Levenshtein matches do NOT produce coordinate assignments (logged as warning only)
- [ ] Unicode-aware token matching handles umlauts (Moerbisch, Kaernten) and punctuation (St. Margarethen)
- [ ] Short common-word place names (Berg, Stein, Au) do not produce false matches in title/description extraction
- [ ] test-normalizer.ts has explicit test cases for Landsee, Kobersdorf, Oggau
- [ ] test-normalizer.ts has negative test: "Rust" does not match inside "frustrated"/"rustic"
- [ ] test-normalizer.ts has test for diacritics: "Moerbisch" matches Moerbisch am See
- [ ] Existing normalizer tests still pass

## Done summary
Overhauled location-normalizer with geographic centroid disambiguation, compound venue name handling, fuzzy-match coord rejection, umlaut transliteration, Unicode-aware token matching, and common-word filtering. All 27 normalizer test cases and 156 vitest tests pass.
## Evidence
- Commits: 766e93171ad3d5d0ee37af9dab81587c449325dc
- Tests: npm test (156 passed), npx tsx src/scripts/test-normalizer.ts (27 passed)
- PRs: