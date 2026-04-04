# Fix Venue-Name Geocoding: Context-Aware Location Resolution

## Overview

The location normalizer matches venue names (e.g., "Schloss Esterhazy", "Domkirche St. Martin", "Musikpavillon im Kurpark") as standalone place names in GeoNames, instead of recognizing them as venues and deriving the actual city from event context. "Schloss Esterhazy" maps to a hotel named "Schloss" in NÖ instead of Eisenstadt. Affects 1000s of events.

## Root Cause

normalizeLocation step 3b (lines 343-361 of location-normalizer.ts) splits the location_name into individual words and matches each against the ENTIRE GeoNames index (34k entries including 3,716 venue-type entries like hotels, castles, churches). The fatal sequence:

1. "Schloss Esterhazy" enters normalizeLocation
2. Steps 1-3a fail (no exact match, no suffix, no comma)
3. Step 3b splits into words: ["schloss", "esterhazy"]
4. 1-word "schloss" matches an HTL (hotel) entry in NÖ at 47.50, 16.20
5. Returns immediately with confidence "normalized" (rank 3)
6. normalizeEventLocation gets a result from location_name, NEVER reaches title extraction (step 3)
7. Title "Kurkonzert in Eisenstadt" is never consulted

Two compounding issues:
- KNOWN_LOCATIONS in geocoding.ts has correct coords for 35 Burgenland venues (including "schloss esterhazy"), but this map is ONLY used by the Nominatim batch path, NOT by the normalizer
- GeoNames entries include all feature classes (P=populated places AND S=buildings). Step 3b does not filter by type, so hotels/castles/churches match as if they were cities

## Design Decisions

1. **Venue-prefix detection**: Detect German venue prefixes (Schloss, Burg, Dom, Kirche, Stift, Kurpark, Theater, etc.) in location_name. When detected, skip step 3b word-by-word matching entirely for the location_name and fall through to title/address/description extraction.

2. **PPL-only filter on step 3b**: Even when no venue prefix is detected, step 3b word-by-word matching should only match against featureClass P entries (populated places). Exclude S-class entries (HTL, CSTL, CH, MUS, etc.) from word-fragment matching. This prevents single words like "schloss" or "martin" from matching buildings.

3. **Shared KNOWN_LOCATIONS module**: Extract the 35 hardcoded venue coordinates from geocoding.ts into a shared module (src/lib/known-venues.ts). Both the normalizer AND geocoding.ts import from this shared module. The normalizer checks the venue lookup BEFORE step 3b. Matches get confidence "exact" (rank 2). geocodeLocation() in geocoding.ts continues to use the same data for the Nominatim batch path. Single source of truth, no drift.

4. **Venue prefix + city extraction**: When "Schloss Esterhazy" is detected as venue, try to extract city from: (a) address field, (b) title, (c) description, (d) postal code lookup. If city found, geocode the CITY (not the venue name).

5. **Confidence for venue-resolved results**: When city is extracted from title/address after venue detection, use confidence "normalized" (rank 3) since the resolution used context, not just the location_name field.

6. **Handle "Burg" ambiguity**: "Burg" is both a venue prefix AND a settlement in Burgenland. Try full name first (step 1-3a), then venue-prefix interpretation. "Burg Forchtenstein" should first try exact match, then try prefix="Burg" + city="Forchtenstein".

## Scope

### In Scope
- Add venue-prefix detection to normalizeLocation
- Filter step 3b word-by-word matching to PPL-only feature codes
- Merge KNOWN_LOCATIONS into the normalizer pipeline (separate venue lookup before step 3b)
- Context-based city resolution when venue detected (title, address, description, PLZ)
- Re-migrate events with wrong venue-matched coords
- Add test cases for venue scenarios

### Out of Scope
- Expanding KNOWN_LOCATIONS beyond current 35 Burgenland entries (separate task)
- Nominatim structured amenity queries (too slow for live sync, nice-to-have for batch)
- English venue names ("Castle Forchtenstein")
- FeratelScraper title cleanup (separate commit already done)

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Venue prefix strips valid settlement name ("Burg" is a real place) | Medium | Medium | Try full name first before prefix stripping |
| PPL-only filter misses legitimate non-PPL matches | Low | Low | Only applied to step 3b word-by-word, not steps 1-3a |
| Re-migration overwrites manually corrected coords | Low | Medium | Respect confidence hierarchy, skip manual/scraper |
| KNOWN_LOCATIONS in two places causes drift | Medium | Low | Extract to shared module (known-venues.ts), both import from there |

## Quick commands

```bash
# Run normalizer test cases
npx tsx src/scripts/test-normalizer.ts

# Run tests
npm test

# Re-geocode in dry-run (after implementation)
npx tsx src/scripts/fix-geocoding.ts --dry-run
```

## Acceptance

- [ ] "Schloss Esterhazy" resolves to Eisenstadt coords (47.845, 16.519), not NÖ hotel
- [ ] "Domkirche St. Martin" with Eisenstadt context resolves to Eisenstadt, not Karnten
- [ ] "Musikpavillon im Kurpark" with Eisenstadt title context resolves to Eisenstadt
- [ ] "Kulturzentrum Mattersburg" resolves to Mattersburg (city extracted from venue name)
- [ ] "Burg Forchtenstein" resolves to Forchtenstein area (not "Burg" settlement)
- [ ] Step 3b word-by-word matching only matches PPL-type GeoNames entries
- [ ] KNOWN_LOCATIONS available in normalizer pipeline (not just Nominatim path)
- [ ] Re-migration fixes affected events with backup
- [ ] All existing tests pass (npm test)
- [ ] Normalizer test cases cover venue scenarios

## References

- src/lib/location-normalizer.ts:343-361 -- step 3b word-by-word matching (the bug)
- src/lib/location-normalizer.ts:553-621 -- normalizeEventLocation entry point
- src/lib/geocoding.ts:23-59 -- KNOWN_LOCATIONS map (35 Burgenland venues)
- src/lib/db/supabase-sync.ts:27-35 -- confidence rank order
- data/geonames-at.json -- 34k entries, type field has feature codes
- GeoNames Feature Codes: https://www.geonames.org/export/codes.html
