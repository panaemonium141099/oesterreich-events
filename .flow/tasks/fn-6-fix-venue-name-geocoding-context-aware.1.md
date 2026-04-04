# fn-6-fix-venue-name-geocoding-context-aware.1 Add venue-prefix detection, PPL-only step 3b filter, and merge KNOWN_LOCATIONS into normalizer

## Description

Three changes to the normalizer to prevent venue names from matching as cities:

1. **Venue-prefix detection**: Add a function `isVenueName(name: string): boolean` that checks if a location_name starts with a known German venue prefix (Schloss, Burg, Dom, Kirche, Stift, Kloster, Kurpark, Kurhaus, Therme, Gasthof, Gasthaus, Hotel, Pension, Halle, Stadthalle, Kulturzentrum, Konzerthaus, Theater, Museum, Galerie, Rathaus, Arena, Stadion, Pfarrkirche, Kapelle, Festspielhaus, Kongresszentrum). When detected in normalizeLocation, skip step 3b word-by-word matching for the location_name and return null so normalizeEventLocation falls through to title/address/description extraction.

2. **PPL-only filter on step 3b**: Even when no venue prefix is detected, step 3b word-by-word matching (lines 343-361) should only match against entries with featureClass P (populated places: PPL, PPLA, PPLA2, PPLA3, PPLA4, PPLC, PPLX, PPLL, etc.). Exclude S-class entries (HTL, CSTL, CH, MUS, THTR, etc.). The `type` field already exists in geonames-at.json entries. Build a separate PPL-only index or filter at query time in step 3b.

3. **Extract KNOWN_LOCATIONS into shared module**: Move the 35 hardcoded venue coordinates from geocoding.ts into a shared module (e.g., src/lib/known-venues.ts). Both the normalizer AND geocoding.ts import from this shared module. The normalizer checks the venue lookup BEFORE step 3b. Matches get confidence "exact" (rank 2). geocoding.ts/geocodeLocation() continues to use the same data for the Nominatim batch path. This prevents drift without breaking batch geocoding.

**Handle "Burg" ambiguity**: "Burg" is both a prefix and a Burgenland settlement. In normalizeLocation, try full name match (steps 1-3a) BEFORE venue-prefix detection. "Burg Forchtenstein" will fail exact match, then venue-prefix detection triggers and returns null, allowing title extraction to find the city.

**Size:** M
**Files:** src/lib/location-normalizer.ts, src/lib/geocoding.ts, src/lib/known-venues.ts (new)

## Key context

- GeoNames entries have `type` field with feature codes (PPL, HTL, CSTL, CH, etc.)
- 3,716 of 34,331 GeoNames entries are S-class (buildings/venues)
- The normalizedIndex is built lazily at module load. PPL filtering can be done at query time in step 3b or by building a separate pplIndex
- Steps 1-3a (exact match, suffix removal, comma split) should NOT be filtered -- they legitimately need to match any entry type
- KNOWN_LOCATIONS has entries like "schloss esterhazy" -> {lat: 47.8456, lng: 16.5189}
- geocodeLocation() in geocoding.ts depends on KNOWN_LOCATIONS for the Nominatim batch path -- must keep working
- 4 PPL entries in GeoNames have "Schloss" prefix (e.g., "Schloss Haus") -- these are real settlements and PPL-only filter correctly keeps them

## Acceptance
- [ ] isVenueName detects all listed venue prefixes (case-insensitive)
- [ ] When venue prefix detected in location_name, step 3b is skipped, normalizeLocation returns null
- [ ] Step 3b word-by-word matching only matches PPL-type entries (not HTL, CSTL, CH, MUS, etc.)
- [ ] Steps 1-3a still match all entry types (no filtering)
- [ ] KNOWN_LOCATIONS extracted to shared module (src/lib/known-venues.ts)
- [ ] Both normalizer and geocoding.ts import from shared module (no duplication)
- [ ] "Schloss Esterhazy" in known-venues returns Eisenstadt coords directly via normalizer
- [ ] geocodeLocation() in geocoding.ts still works using the shared venue data
- [ ] "Burg Forchtenstein" tries full name first, then falls through to venue detection
- [ ] Existing tests pass (npm test)

## Done summary
Added venue-prefix detection (isVenueName), PPL-only filtering on step 3b word-by-word matching, and extracted KNOWN_LOCATIONS into shared src/lib/known-venues.ts module. Known venues resolve with exact confidence before step 3b; unknown venue-prefix names return null to fall through to title/address extraction.
## Evidence
- Commits: f5f47e6, fc7a9a7
- Tests: npm test (156 passed), npx tsx src/scripts/test-venue-changes.ts (25/25 passed)
- PRs: