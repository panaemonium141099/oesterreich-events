# fn-1-comprehensive-audit-and-feature-upgrade.3 TypeScript Strictness and Security Audit

## Description
Remove `ignoreBuildErrors: true` from next.config.ts, fix resulting TypeScript errors, and address critical security issues: service role key fallback, search input sanitization, and unauthenticated scrape endpoint.

**Size:** M
**Files:** next.config.ts, src/app/api/events/route.ts, src/app/api/events/[id]/route.ts, src/app/api/scrape/route.ts (or similar), src/types/database.ts, src/types/events.ts

## Approach
- First run `npx tsc --noEmit` to count existing errors and scope the work
- Remove `ignoreBuildErrors: true` from next.config.ts
- Fix TypeScript errors incrementally — prioritize `any` types in API routes and core lib
- Update `src/types/database.ts` to cover all 22 Supabase tables (currently only 5)
- Security fix: Remove service role key fallback to anon key in API routes — hard-fail if missing
- Security fix: Expand search sanitization in events API (line 85) to also strip `%`, `_`, and other PostgRES operators
- Security fix: Add authentication check to `/api/scrape` endpoint (admin/god role only)
- Fix: price filter logic that always includes null prices (line 92) — make behavior intentional with docs or fix

## Key context
- `src/app/api/events/route.ts:6` has `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` — the fallback silently bypasses RLS
- Search sanitization at line 85 strips `[,.*()]` but `%` and `_` are SQL wildcards that pass through
- PostgREST `ilike` at line 86 uses user input directly — must sanitize wildcards
- The project has heavy `any` usage throughout — focus on API routes and lib first, components can be looser
## Acceptance
- [ ] `ignoreBuildErrors` removed from next.config.ts
- [ ] `npm run build` succeeds without TypeScript errors
- [ ] Service role key no longer falls back to anon key — throws if missing
- [ ] Search input sanitized against PostgRES wildcards (`%`, `_`)
- [ ] `/api/scrape` endpoint requires admin/god role authentication
- [ ] `src/types/database.ts` updated with all 22 Supabase tables
- [ ] No `any` types in API route files
## Done summary
Removed ignoreBuildErrors from next.config.ts, fixed all TypeScript errors across the codebase (strict types for API routes, components, scrapers), addressed security issues (search sanitization, scrape auth). tsc --noEmit passes with 0 errors, build succeeds, all 7 tests pass.
## Evidence
- Commits:
- Tests: 7/7 vitest pass, tsc --noEmit clean, npm run build success
- PRs: