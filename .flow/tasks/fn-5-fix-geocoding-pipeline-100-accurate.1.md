# fn-5-fix-geocoding-pipeline-100-accurate.1 Fix HTTP 500 on /api/events + NULL-coord handling

## Description
Fix the HTTP 500 error on /api/events, establish the API error contract, and fix NULL-score cursor pagination.

**Size:** M
**Files:** src/app/api/events/route.ts

## Approach

**Root Cause F (HTTP 500):** Both the env validation throw (route.ts:8-9) AND the Supabase client creation (route.ts:12-15 using NEXT_PUBLIC_SUPABASE_URL! assertion) happen at module scope. Move ALL of this inside the GET handler:
- Create a lazy helper function getSupabaseClient() that validates both SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL, returns the client or null
- If either env var is missing, return Response with status 503 and JSON body { error: "Service unavailable", code: "ENV_MISSING" }
- No module-level throw, no module-level client creation

**Root Cause G (null score pagination):** The cursor pagination at route.ts:259-272 uses event_score which can be NULL. Fix:
- Use COALESCE(event_score, 0) semantics: treat NULL scores as 0 for ordering
- In score-descending sort, NULL scores should sort last (NULLS LAST)
- Cursor generation must use the same coalesced value to prevent skip/duplicate issues
- The .lt() filter should use the coalesced cursor value, not the raw possibly-null value

**NULL-coord API contract:** The bbox filter at route.ts:149 uses .gte(latitude, 46.3) which excludes all NULL-coord events. This is correct for map queries. Add support for includeUnmapped=true query param:
- When includeUnmapped=true is passed, run a SEPARATE query for events with NULL latitude/longitude
- Return these in a separate unmappedEvents array in the response (not mixed into events array)
- Do NOT include unmapped events in the regular bbox-filtered results

## Key context

- The env check pattern at route.ts:8-9 is a module-level throw that prevents the handler from ever registering
- NEXT_PUBLIC_SUPABASE_URL! non-null assertion at module scope is equally dangerous
- The existing try/catch at line 123-352 never executes because the module fails to load
- events API is called by src/app/map/page.tsx:165-166 (the fetchEventsProgressive callback)
- PostgREST .or() with bbox filters requires careful parenthesization

## Acceptance
- [ ] No module-level throw or non-null assertion in route.ts
- [ ] All env validation and Supabase client creation happens inside GET handler
- [ ] /api/events returns 503 JSON { error, code } when either env var is missing
- [ ] /api/events returns 200 with events when env vars are properly set
- [ ] NULL event_score handled with COALESCE semantics (treated as 0, NULLS LAST)
- [ ] Cursor pagination does not skip or duplicate rows with NULL scores
- [ ] includeUnmapped=true query param returns unmappedEvents array separately
- [ ] Regular bbox queries do NOT include NULL-coord events
- [ ] Existing tests pass (npm test)

## Done summary
Fixed HTTP 500 on /api/events by moving env validation and Supabase client creation from module scope into a lazy helper inside the GET handler (returns 503 JSON on missing env vars). Fixed NULL event_score cursor pagination with proper three-way branching (positive/zero/NULL). Added includeUnmapped=true query param that returns NULL-coordinate events in a separate unmappedEvents array with full content filtering (bundesland, category, search).
## Evidence
- Commits: 4c72b6a, 836c2ee, c64f13c72c0ae5e30ec838713fefbcc6c2d959c9
- Tests: npm test (128 passed)
- PRs: