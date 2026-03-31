# fn-1-comprehensive-audit-and-feature-upgrade.5 Core Feature Tests

## Description
Write unit and integration tests for core features: events API, category engine, date utils, auth context, and filter logic. Uses the Vitest infrastructure from task 2 and the refactored utilities from task 4.

**Size:** M
**Files:** src/__tests__/api/events.test.ts (new), src/__tests__/lib/categories.test.ts (new), src/__tests__/lib/utils/date.test.ts (new), src/__tests__/lib/auth-context.test.ts (new), src/__tests__/lib/utils/profile.test.ts (new)

## Approach
- Test `formatDate`, `formatTime` from `src/lib/utils/date.ts` — including midnight/1am edge cases, various date formats, de-AT locale
- Test `isProfileComplete` from `src/lib/utils/profile.ts` — missing fields, partial profiles, edge cases
- Test `categorizeEvent()` from `src/lib/categories.ts` — keyword matching, priority ordering, Feratel tag mapping
- Test events API route handler — mock Supabase, test filter combinations, search sanitization, error responses
- Test filter logic — empty results, combined filters, category + district + date combinations
- Use Supabase mock from `src/test/mocks/supabase.ts`

## Key context
- `categorizeEvent()` in `src/lib/categories.ts` uses 200+ keywords with priority ordering — test the priority mechanism
- Events API at `src/app/api/events/route.ts` builds Supabase queries with chained filters — test each filter individually and in combination
- The evening filter (lines 124-134) runs client-side after Supabase fetch — test this separately
## Acceptance
- [ ] Date utility tests: 10+ test cases covering locales, midnight, 1am, ranges
- [ ] Profile completeness tests: complete profile, missing fields, null values
- [ ] Category engine tests: keyword matching, priority, unknown events, Feratel tags
- [ ] Events API tests: all filter params, search sanitization, error handling
- [ ] All tests pass with `npm test`
- [ ] Test coverage report shows >80% for tested modules
## Done summary
Added comprehensive unit and integration tests for core features: date utilities (25 tests), profile completeness (13 tests), category engine (32 tests), and events API route (21 tests). All 127 tests pass with >80% coverage for all tested modules.
## Evidence
- Commits: 3f974a1dfd07a657b2fa3b6ebb39eeed48473cc4
- Tests: npx vitest run, npx vitest run --coverage
- PRs: