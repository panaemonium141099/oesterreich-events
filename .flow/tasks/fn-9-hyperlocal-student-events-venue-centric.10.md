# fn-9-hyperlocal-student-events-venue-centric.10 Backfill: Assign venue_id to existing 108K events via fuzzy matching

## Description
TBD

## Acceptance
- [ ] TBD

## Done summary
Implemented venue backfill script that assigns venue_id to existing events via fuzzy matching (Jaro-Winkler >= 0.9 threshold) with geographic proximity validation (2km max for fuzzy matches). Includes 18 tests, --dry-run/--limit/--verbose flags, and npm script.
## Evidence
- Commits: d24d96f2bfaecca97e903d516cdbecd5d0230567, 7cc51503a7e2fac77e66aee199b81af6e0e32c14
- Tests: npx vitest run src/__tests__/scripts/backfill-venue-ids.test.ts (18 passed), npx vitest run (401 passed, 20 files)
- PRs: