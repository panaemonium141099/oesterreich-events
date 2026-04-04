# fn-6-fix-venue-name-geocoding-context-aware.3 Re-migrate events with wrong venue-matched coordinates

## Description

Re-geocode events that got wrong coordinates from the old venue-name word-matching bug. Uses the same backup/migration pattern established in fn-5.5.

**Size:** M
**Files:** src/scripts/fix-geocoding.ts (modify)

## Approach

**Identify affected events**: Query Supabase for events where:
- location_name starts with a venue prefix (Schloss, Burg, Dom, Kirche, Stift, etc.)
- AND geocoding_confidence = "normalized" (the confidence level assigned by the old word-matching)
- AND geocoding_source = "geonames"
This captures events whose location_name was a venue and got word-matched to a wrong GeoNames entry.

**Alternative identification**: Also include events where location_name matches any KNOWN_LOCATIONS key but current coords differ by more than 1km from the KNOWN_LOCATIONS value. These are confirmed wrong.

**Migration flow** (reuse fn-5.5 pattern):
1. Create durable backup at data/coord-backup-venue-YYYY-MM-DD.json
2. --dry-run mode first
3. For each candidate: re-run normalizeEventLocation with the improved normalizer (tasks .1 + .2)
4. If new result has acceptable confidence (>= from_title): update coords + confidence + source
5. If no result: set to NULL (better than wrong)
6. Batch processing with checkpoint/resume

**Service-role-only**: Require SUPABASE_SERVICE_ROLE_KEY, no anon fallback.

## Key context

- fix-geocoding.ts already has backup, dry-run, checkpoint/resume from fn-5.5
- The venue prefix regex from task .1 can be reused to identify candidates
- KNOWN_LOCATIONS comparison gives a second identification vector
- Events with confidence "scraper" or "manual" should NOT be touched

## Acceptance
- [ ] Durable backup created before migration
- [ ] --dry-run mode shows what would change
- [ ] Affected events identified by venue-prefix location_name + confidence "normalized"
- [ ] KNOWN_LOCATIONS mismatches also identified and fixed
- [ ] "Schloss Esterhazy" events move to Eisenstadt coords
- [ ] "Domkirche St. Martin" events with Eisenstadt context move to Eisenstadt
- [ ] Events with confidence "scraper" or "manual" are NOT modified
- [ ] Migration report with corrected/nulled/unchanged counts
- [ ] Batch processing with checkpoint/resume

## Done summary
TBD
## Evidence
- Commits:
- Tests:
- PRs:
