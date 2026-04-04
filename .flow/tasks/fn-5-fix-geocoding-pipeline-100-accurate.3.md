# fn-5-fix-geocoding-pipeline-100-accurate.3 Fix geocoding.ts KNOWN_LOCATIONS + remove Bundesland-capital fallback

## Description
Fix the KNOWN_LOCATIONS substring matching in geocoding.ts and remove the dangerous Bundesland-capital fallback in force-geocode-all.ts. Also fix findCityCoords substring matching. Use Unicode-aware normalized token matching throughout.

**Size:** M
**Files:** src/lib/geocoding.ts, src/scripts/force-geocode-all.ts

## Approach

**Root Cause A (Bundesland-capital fallback):** Phase 3 in force-geocode-all.ts:270-284 assigns BUNDESLAND_CENTERS coordinates to any event that could not be resolved. Remove this entire fallback. Events that cannot be geocoded should keep NULL coordinates with a log warning. Never assign approximate coords that place events in the wrong city.

**Root Cause E (KNOWN_LOCATIONS matching):** The lookup at geocoding.ts:54-57 uses queryLower.includes(key) which causes false positives. Replace with Unicode-aware normalized token matching:
- Normalize both key and query (lowercase, collapse umlauts: ae->a, oe->o, ue->u, ss->ss)
- Split query into tokens by whitespace/punctuation
- Match key as a complete token sequence within the query tokens
- For multi-word keys like "St. Margarethen", match "st" + "margarethen" as consecutive normalized tokens
- This avoids \b regex which fails on umlauts and punctuation

**findCityCoords fix:** The same .includes() problem exists in force-geocode-all.ts:166-175 where city names are matched as substrings. Apply the identical Unicode-aware token matching fix. Consider extracting a shared matchPlaceName(query, placeName) utility function.

**Nominatim result validation:** In geocoding.ts, add validation for Nominatim responses:
- Check place_rank from response. Reject results with place_rank < 16 (state/county level, too broad)
- Verify result coordinates fall within Austria bounding box (lat 46.3-49.1, lng 9.5-17.2)
- Log rejected results as warnings

## Key context

- KNOWN_LOCATIONS has 37 hardcoded Burgenland venue entries
- BUNDESLAND_CENTERS maps all 9 Bundeslaender to their capital coords
- findCityCoords is sorted by key length (longest first) but still uses .includes()
- Nominatim public API: 1 request/second, countrycodes=at already used
- The geocode_cache stores results by query+hint key - cache invalidation not needed for this task
- Diacritics matter: "Moerbisch" must match "Moerbisch am See", "St. Margarethen" must match as complete name

## Acceptance
- [ ] BUNDESLAND_CENTERS fallback completely removed from force-geocode-all.ts
- [ ] Events that cannot be geocoded keep NULL coordinates (not capital city coords)
- [ ] KNOWN_LOCATIONS matching uses Unicode-aware normalized token matching
- [ ] findCityCoords matching uses Unicode-aware normalized token matching
- [ ] "Rust" does not match strings containing "frustrated" or "rustic"
- [ ] "Hall" does not match "Hallein"
- [ ] "Moerbisch" correctly matches "Moerbisch am See" (diacritics handled)
- [ ] "St. Margarethen" matches as complete multi-word name, not substring
- [ ] Nominatim results with place_rank < 16 are rejected
- [ ] Nominatim results outside Austria bounding box are rejected
- [ ] Log warnings emitted for events that could not be geocoded
- [ ] Existing tests pass

## Done summary
Replaced .includes() substring matching with Unicode-aware token matching (matchPlaceName utility) for KNOWN_LOCATIONS and findCityCoords, preventing false positives like "Rust" matching "frustrated". Removed the BUNDESLAND_CENTERS capital fallback so unresolvable events keep NULL coords. Added Nominatim result validation (place_rank >= 16, Austria bounding box). Added Sankt/St. normalization for abbreviation equivalence.
## Evidence
- Commits: 085abdc, 21db137
- Tests: npx vitest run (156 passed)
- PRs: