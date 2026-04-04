# fn-6-fix-venue-name-geocoding-context-aware.2 Context-based city resolution for venue names + comprehensive test cases

## Description

When normalizeEventLocation detects that location_name is a venue (via isVenueName or because normalizeLocation returned null after venue detection), it needs to extract the actual city from other event fields. Currently it already tries title and description extraction (steps 3-4), but only AFTER location_name returns a match. With task .1 making venue-name location_name return null, the fallthrough to title/description now works. This task enhances the context resolution and adds comprehensive test cases.

**Size:** M
**Files:** src/lib/location-normalizer.ts, src/scripts/test-normalizer.ts

## Approach

**Enhanced city extraction for venue names**: When location_name is detected as a venue and normalizeLocation returns null:
1. Try address field (step 2 in normalizeEventLocation) — often contains "7000 Eisenstadt" or "Esterhazyplatz 1, Eisenstadt"
2. Try extracting city from the venue name itself — "Kulturzentrum Mattersburg" has "Mattersburg" after the prefix
3. Try title extraction (step 3) — "Kurkonzert in Eisenstadt" has the city
4. Try description extraction (step 4)
5. Try PLZ lookup via plzCoordinates.ts if postal code is available

**Venue-name city extraction**: When isVenueName returns true, also try stripping the venue prefix and checking if the remainder is a valid city. "Kulturzentrum Mattersburg" -> strip "Kulturzentrum" -> "Mattersburg" -> GeoNames PPL match. But validate: "Landesgalerie Burgenland" -> strip "Landesgalerie" -> "Burgenland" is a Bundesland, not a city -> reject. Only accept if remainder matches a PPL-type GeoNames entry.

**Comprehensive test cases**: Add venue-specific test cases to test-normalizer.ts:
- "Schloss Esterhazy" (KNOWN_LOCATIONS match)
- "Domkirche St. Martin" with bundesland=Burgenland (venue prefix, title has "Eisenstadt")
- "Musikpavillon im Kurpark" with title containing "Eisenstadt"
- "Kulturzentrum Mattersburg" (city in venue name after prefix)
- "Burg Forchtenstein" (prefix is also a settlement)
- "Landesgalerie Burgenland" (remainder is Bundesland, not city)
- "Seefestspiele Moerbisch" (non-standard prefix, city after it)
- "Therme Laa" (short city name "Laa" -> "Laa an der Thaya")
- Negative: "Schloss" alone (too short after prefix strip)

## Key context

- normalizeEventLocation at lines 553-621 already has steps for location_name, address, title, description
- extractPlaceFromText at lines 447-546 handles title/description extraction with word-boundary matching
- plzCoordinates.ts has PLZ-to-coordinate lookup
- Per epic design decision #5: venue-resolved results always get confidence "normalized" (rank 3), regardless of whether city was extracted from title, address, or venue name suffix. This outranks "from_title" (rank 4) and ensures venue-context resolutions can overwrite existing wrong "from_title" coords

## Acceptance
- [ ] Venue names with city in the name resolve correctly ("Kulturzentrum Mattersburg" -> Mattersburg)
- [ ] Venue names without city fall through to title/description extraction
- [ ] "Domkirche St. Martin" + title "...Eisenstadt" resolves to Eisenstadt
- [ ] "Musikpavillon im Kurpark" + title "...Eisenstadt" resolves to Eisenstadt
- [ ] "Landesgalerie Burgenland" does NOT resolve to "Burgenland" as a city
- [ ] "Seefestspiele Moerbisch" resolves to Moerbisch am See
- [ ] "Therme Laa" resolves to Laa an der Thaya
- [ ] test-normalizer.ts has at least 10 venue-specific test cases
- [ ] All existing tests pass (npm test)

## Done summary
TBD
## Evidence
- Commits:
- Tests:
- PRs:
