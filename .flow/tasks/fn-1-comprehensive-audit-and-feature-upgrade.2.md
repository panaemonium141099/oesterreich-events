# fn-1-comprehensive-audit-and-feature-upgrade.2 Test Infrastructure Setup with Vitest

## Description
Set up Vitest test infrastructure for the Next.js 16 + React 19 project. No tests currently exist — no test framework, no config, no test dependencies. Create the foundation that all subsequent test tasks build on.

**Size:** M
**Files:** package.json, vitest.config.ts (new), src/test/setup.ts (new), src/test/mocks/supabase.ts (new), src/test/mocks/next-navigation.ts (new)

## Approach
- Install vitest, @testing-library/react, @testing-library/jest-dom, happy-dom
- Create vitest.config.ts with path aliases matching `@/` → `src/`
- Create test setup file with jest-dom matchers
- Create Supabase client mock (mock `createBrowserClient` singleton from `src/lib/supabase/client.ts`)
- Create Next.js navigation mock (`useRouter`, `usePathname`, `useSearchParams`)
- Add `test` and `test:coverage` scripts to package.json
- Write one smoke test to verify the setup works

## Key context
- The project uses `@/` path alias mapping to `src/` — vitest config must mirror this
- Supabase client is a cached singleton in `src/lib/supabase/client.ts` — mock must replace the singleton
- React 19 requires @testing-library/react v16+
- App Router components use `'use client'` directive — happy-dom handles this better than jsdom for RSC
## Acceptance
- [ ] Vitest installed and configured
- [ ] `npm test` runs successfully
- [ ] Path aliases (`@/`) resolve correctly in tests
- [ ] Supabase client mock created and importable
- [ ] Next.js navigation mock created and importable
- [ ] At least one smoke test passes
- [ ] `npm run test:coverage` generates coverage report
## Done summary
Set up Vitest test infrastructure with vitest.config.ts, test setup with jest-dom matchers, Supabase client mock (thenable query builder), and Next.js navigation mock (with useParams/setMockParams). Added test/test:watch/test:coverage scripts and 7 smoke tests verifying all infrastructure works.
## Evidence
- Commits: 7f5a9f8, e9d471e
- Tests: npm test, npm run test:coverage
- PRs: