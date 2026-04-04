# Fix Geocoding Pipeline: 100% Accurate Location Assignment

## Overview

Critical bug fix: Events are assigned wrong coordinates. Events at Burgruine Landsee, Kobersdorf, Oggau all appear as Eisenstadt on the map. Additionally, /api/events returns HTTP 500.

**Two distinct bugs:**
1. **Wrong coordinates**: Multiple root causes in the geocoding pipeline cause events to cluster at Bundesland capitals (especially Eisenstadt)
2. **HTTP 500**: Module-level throw in route.ts crashes the entire route module

## Root Cause Analysis

### Bug 1: Wrong Coordinates (5 root causes)

| # | Root Cause | File:Line | Impact |
|---|-----------|-----------|--------|
| A | force-geocode-all.ts Phase 3 uses BUNDESLAND_CENTERS as last-resort fallback. Burgenland = Eisenstadt [47.8453, 16.5189] | src/scripts/force-geocode-all.ts:270-284 | Every unresolvable Burgenland event gets Eisenstadt coords |
| B | normalizeEventLocation fails on compound/venue names (Burgruine Landsee, Oggauer Weinbauern) | src/lib/location-normalizer.ts:421-463 | Venue names do not match GeoNames entries |
| C | getHint for Burgenland defaults to Eisenstadt center for disambiguation, biases closest-match | src/lib/location-normalizer.ts:209-224 | Disambiguation always prefers locations near Eisenstadt |
| D | supabase-sync.ts only fills missing coords (!latitude or !longitude), never corrects wrong ones | src/lib/db/supabase-sync.ts:44-46 | Once wrong coords assigned, they persist forever |
| E | KNOWN_LOCATIONS and findCityCoords use .includes() matching. Rust matches frustrated, Hall matches Hallein | src/lib/geocoding.ts:54-57, src/scripts/force-geocode-all.ts:166-175 | Substring false positives assign wrong coords |

### Bug 2: HTTP 500

| # | Root Cause | File:Line | Impact |
|---|-----------|-----------|--------|
| F | Module-level throw on missing SUPABASE_SERVICE_ROLE_KEY + module-level Supabase client creation with NEXT_PUBLIC_SUPABASE_URL! assertion | src/app/api/events/route.ts:8-15 | Route module fails to load, every request returns 500 |
| G | Potential: event_score null in cursor pagination .lt.0 filter | src/app/api/events/route.ts:259-272 | Malformed PostgREST query on null scores |

## Architecture: Current Geocoding Pipeline

Scraper produces ScrapedEvent -- Has lat/lng? -- Yes: Keep scraper coords / No: supabase-sync calls normalizeEventLocation -- GeoNames match? -- Yes: Use GeoNames coords / No: Try title/description extraction -- Found? -- Yes: GeoNames lookup / No: Nominatim free-form query -- Result? -- Yes: Use Nominatim / No: BUNDESLAND_CENTERS fallback (Eisenstadt for Burgenland) BUG!

## Architecture: Target Pipeline (after fix)

Scraper produces ScrapedEvent -- Has lat/lng? -- Yes: Confidence check (in Austria bbox?) -- No: Enhanced normalizeEventLocation -- GeoNames exact? -- Yes: confidence=exact / No: Compound name split + each part? -- Match: confidence=normalized / No: Title/desc extraction? -- Match: confidence=from_title / No: Leave NULL + log warning (CORRECT!)

Note: Nominatim is NOT part of the live sync pipeline (too slow at 1 req/sec). It remains a batch-only tool in geocode.ts for offline re-geocoding scripts.

## Confidence Model

### Canonical enum (total precedence order, highest first):
1. manual - Human-verified coordinates
2. scraper - Scraper-provided native coordinates (e.g., from JSON-LD, API)
3. exact - Exact GeoNames match on location_name
4. normalized - GeoNames match after normalization (suffix removal, comma split)
5. from_title - GeoNames match on place name extracted from event title
6. from_description - GeoNames match on place name extracted from description
7. nominatim - Nominatim geocoding result (batch scripts only)
8. null - Unknown/legacy (lowest priority, any result can overwrite)

**Fuzzy matching**: The normalizer currently supports fuzzy (Levenshtein distance <= 2). Given the "NULL over wrong coords" principle, fuzzy results MUST NOT be persisted as coordinates. Fuzzy matches should be logged as warnings but treated as "no match" for coordinate assignment.

### Source enum:
- geonames - From local GeoNames database lookup
- nominatim - From Nominatim API
- known_locations - From hardcoded KNOWN_LOCATIONS map
- scraper - From scraper-provided data
- manual - Human-set
- null - Unknown/legacy

## Scope

### In Scope
- Fix all 7 root causes (A-G)
- Add geocoding_confidence and geocoding_source columns to Supabase events table (via migration SQL)
- Improve normalizer for compound/venue names
- Remove Bundesland-capital fallback (NULL coords over wrong coords)
- Fix word-boundary matching in KNOWN_LOCATIONS and findCityCoords (Unicode-aware normalized token matching)
- Disable fuzzy matching from producing coordinate assignments
- Fix supabase-sync to correct high-confidence mismatches (with row-prefetch for conditional overwrite)
- Re-geocode all wrongly-placed events with backup and rollback
- Fix API: move ALL env validation + client creation inside handler, return 503 JSON on misconfiguration
- Handle NULL-coord events: return separately via includeUnmapped=true query param (not mixed into bbox results)
- Update CLAUDE.md + CHANGELOG.md

### Out of Scope
- FeratelScraper per-region center fallback (separate epic)
- User-facing suggest correction feature
- Self-hosted Nominatim
- Geocode cache TTL
- Frontend changes for NULL-coord events display (separate task if needed)

## Key Design Decisions

1. **NULL coords over wrong coords**: Events that cannot be accurately geocoded get NULL latitude/longitude. They are NOT returned in bbox-filtered map queries. They can be requested separately via includeUnmapped=true query param.

2. **Confidence tracking**: Every coordinate assignment stores confidence (enum above) and source. Defines a total precedence order for overwrite decisions.

3. **Correction threshold**: supabase-sync will correct existing coords only when:
   - New confidence rank is strictly higher than existing confidence rank
   - Distance difference > 5km (prevents overwriting precise scraper coords with town-center GeoNames coords)
   - Requires batch-prefetch of existing rows to read current confidence before upsert

4. **Migration safety**: Back up current coords to a durable JSON file at data/coord-backup-YYYY-MM-DD.json before re-geocoding. Include restore script. Require SUPABASE_SERVICE_ROLE_KEY (never anon key).

5. **Unicode-aware token matching**: Replace .includes() with normalized token/segment matching that handles umlauts, St. prefixes, and punctuation. NOT plain \b regex (fails on umlauts and multiword names like St. Margarethen).

6. **No fuzzy coord persistence**: Fuzzy Levenshtein matches are logged but never stored as coordinates.

7. **API error contract**: When SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing, return 503 JSON { error: "Service unavailable", code: "ENV_MISSING" }. All env validation + client creation happens inside GET handler, not at module scope.

8. **NULL score pagination**: Events with NULL event_score are treated as score=0 for sort ordering. Cursor generation uses COALESCE(event_score, 0) consistently. NULLS LAST in score-descending sort.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration corrupts coordinates at scale | Medium | High | Durable JSON backup + restore script, dry-run mode, batch processing |
| Events vanish from map (NULL coords) | High | Medium | Separate API path (includeUnmapped), not mixed into bbox results |
| Nominatim rate limiting during re-geocode | Medium | Low | Already has 1.1s delay, cache negative results |
| Improved normalizer causes new false positives | Low | Medium | Test against known problem cases first |
| fn-1.7 and fn-1.9 also touch route.ts | Medium | Low | Task 1 is isolated to env-check + error handling |
| Conditional upsert complexity | Medium | Medium | Batch-prefetch existing rows before upsert, not SQL-side RPC |

## Rollout Plan

1. Task 1: Fix HTTP 500 + API error contract (immediate, unblocks everything)
2. Tasks 2-3: Fix normalizer + geocoding (parallel, different files)
3. Task 4: Fix supabase-sync + add confidence columns (depends on 2+3)
4. Task 5: Migration with backup/rollback (depends on 2+3+4)
5. Task 6: Docs update (after all code changes)

## Non-Functional Targets

- Accuracy: 0 events with wrong Bundesland-capital fallback coordinates
- Coverage: <10 events with NULL coordinates (down from ~93 currently)
- Performance: Geocoding pipeline adds <50ms per event during scraper sync
- Observability: All geocoding decisions logged with confidence + source

## Quick commands

```bash
# Run normalizer test cases
npx tsx src/scripts/test-normalizer.ts

# Verify no HTTP 500
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/events

# Run re-geocoding in dry-run mode (after implementation)
npx tsx src/scripts/fix-geocoding.ts --dry-run
```

## Acceptance

- [ ] /api/events returns 503 JSON error when env vars are missing (not raw 500 or module crash)
- [ ] /api/events returns 200 with events when env vars are properly set
- [ ] Events at Burgruine Landsee show correct coordinates (near Markt Sankt Martin, not Eisenstadt)
- [ ] Events in Kobersdorf show correct coordinates (47.5922, 16.3153, not Eisenstadt)
- [ ] Events in Oggau show correct coordinates (47.7833, 16.6667, not Eisenstadt)
- [ ] No event has coordinates from BUNDESLAND_CENTERS fallback
- [ ] geocoding_confidence and geocoding_source columns exist in Supabase events table
- [ ] Fuzzy matches are NOT persisted as coordinates
- [ ] NULL-coord events available via includeUnmapped=true, NOT mixed into bbox results
- [ ] KNOWN_LOCATIONS matching uses Unicode-aware normalized token matching
- [ ] supabase-sync.ts corrects wrong coords using confidence precedence + 5km threshold
- [ ] Migration script requires service role key, creates durable backup, has restore procedure
- [ ] CLAUDE.md and CHANGELOG.md updated with geocoding pipeline changes
- [ ] All existing tests pass (npm test)

## References

- src/lib/location-normalizer.ts -- Core normalizer
- src/lib/geocoding.ts -- Nominatim + KNOWN_LOCATIONS
- src/scripts/force-geocode-all.ts -- Bundesland fallback
- src/lib/db/supabase-sync.ts -- Coord-fill logic
- src/app/api/events/route.ts -- Events API
- src/scripts/test-normalizer.ts -- Test cases for known problem locations
- data/geonames-at.json -- 34k+ Austrian places
- docs/superpowers/specs/2026-04-03-geolocation-normalisierung-design.md -- Existing design spec
- Nominatim Search API: https://nominatim.org/release-docs/latest/api/Search/
- Nominatim Place Ranking: https://nominatim.org/release-docs/latest/customize/Ranking/
