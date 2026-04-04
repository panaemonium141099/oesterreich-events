# fn-5-fix-geocoding-pipeline-100-accurate.4 Fix supabase-sync coord correction + add geocoding_confidence column

## Description
Fix supabase-sync.ts to correct wrong coordinates (not just fill missing ones), add geocoding_confidence + geocoding_source columns via Supabase migration, and implement confidence-aware conditional overwrite logic.

**Size:** M
**Files:** src/lib/db/supabase-sync.ts, src/types/events.ts (if ScrapedEvent needs update), supabase migration SQL file

## Approach

**Root Cause D (never corrects wrong coords):** The condition at supabase-sync.ts:44-46 only fills missing coords (!latitude || !longitude). Change to also correct existing coords using confidence-aware logic.

**Add Supabase columns via migration SQL:** Create a migration file (or use Supabase dashboard SQL editor if no local migrations directory exists) to add:
- geocoding_confidence TEXT (nullable, values from canonical enum)
- geocoding_source TEXT (nullable, values from source enum)
Both columns nullable to handle existing events gracefully (NULL = legacy/unknown = lowest priority).

**Confidence-aware conditional overwrite:** The current bulk .upsert() does not support conditional overwrites. To implement the confidence comparison:
1. Before upserting a batch of events, batch-prefetch existing rows by conflict key (e.g., SELECT id, geocoding_confidence, latitude, longitude WHERE id IN (...))
2. For each event in the batch, compare:
   - If existing confidence is NULL or strictly lower rank than new confidence: allow overwrite
   - If existing confidence is equal or higher rank: skip coordinate update (keep existing)
   - If distance between existing and new coords < 5km AND existing confidence is not NULL: skip (prevents overwriting precise scraper coords with less-precise GeoNames town centers)
3. Split events into "update coords" and "keep existing coords" sets before upsert

**Confidence precedence (from epic, total order):**
manual > scraper > exact > normalized > from_title > from_description > nominatim > null

**Scraper-provided coords:** When a scraper provides its own lat/lng, set confidence=scraper and source=scraper. These should only be overwritten by manual corrections.

**Fuzzy results:** Normalizer results with confidence=fuzzy MUST NOT be stored as coordinates. Treat fuzzy as no-match for coord purposes.

## Key context

- supabase-sync.ts is called during every scraper run for every event
- The normalizer returns a confidence field (exact, normalized, fuzzy, from_title, from_description)
- fix-geocoding.ts at line 6 uses a 5km threshold - reuse this constant
- JavaScript falsy: !0 is true, so longitude=0 would be treated as missing (fine since longitude 0 is not in Austria)
- Performance: the batch-prefetch adds one extra SELECT query per batch, acceptable overhead

## Acceptance
- [ ] geocoding_confidence column exists in Supabase events table (migration SQL executed)
- [ ] geocoding_source column exists in Supabase events table (migration SQL executed)
- [ ] supabase-sync batch-prefetches existing rows before upsert to compare confidence
- [ ] supabase-sync corrects coords only when new confidence rank is strictly higher than existing
- [ ] supabase-sync does NOT overwrite when distance < 5km and existing confidence is not NULL
- [ ] supabase-sync does NOT overwrite higher-confidence coords with lower-confidence ones
- [ ] Scraper-provided coordinates stored with confidence=scraper, source=scraper
- [ ] Normalizer results stored with appropriate confidence and source values
- [ ] Fuzzy normalizer results are NOT stored as coordinates (treated as no-match)
- [ ] Existing events with NULL confidence are treated as lowest priority (any new result can overwrite)
- [ ] Performance: batch-prefetch adds acceptable overhead (<100ms per batch)
- [ ] Existing tests pass

## Done summary
Implemented confidence-aware coordinate correction in supabase-sync.ts with batch-prefetch of existing rows, confidence precedence comparison (manual > scraper > exact > normalized > from_title > from_description > nominatim > NULL), 5km distance threshold to preserve precise coords, and safe .in() filter for prefetch queries. Added geocoding_confidence and geocoding_source columns via Supabase migration SQL and updated Event type.
## Evidence
- Commits: 048c218, 3cbe851
- Tests: npx vitest run (156 passed), npx tsc --noEmit (clean)
- PRs: