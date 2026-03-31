# fn-2-deploy-ready-sprint-scoring-landing.7 Final Build Validation, Docker Test & Docs

## Description
Run final `npm run build`, test Docker build, and update CHANGELOG.md + CLAUDE.md + .env.example to document everything added in this sprint.

**Size:** M
**Files:** `CHANGELOG.md`, `CLAUDE.md`, `.env.example`

## Approach

**Build verification:** Run `npm run build`. Fix any TypeScript errors, missing imports, or build-time failures that surfaced from Tasks 1-6. Common issues to check: missing type annotations on new components, `any` types introduced, async params not properly awaited in Next.js 16 routes.

**Docker build test:** Run `docker build -t lasstreffen-test --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=test --build-arg NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=test .` — must complete without errors. If Docker is unavailable locally, verify the Dockerfile syntax and layer ordering manually.

**`CHANGELOG.md` updates:**
- "Frontend Pages" route table: add `/events/[id]` (SEO event detail), `/sitemap.xml`, `/robots.txt`, `/api/events/featured`, `/api/stats/counts`, `/api/health`
- "Build & Run Commands": add `npm run score`
- "File Structure": add new files in their correct positions in the tree
- "Architecture Overview": note Docker/standalone deployment support added
- Add new phase entry at the bottom: "Phase 13: Deploy-Ready Sprint" with commit list and feature summary

**`CLAUDE.md` updates:**
- "Wichtige Pfade": add `src/app/api/events/featured/route.ts`, `src/app/api/health/route.ts`, `src/app/api/stats/counts/route.ts`, `src/app/events/[id]/page.tsx`, `src/scripts/calculate-scores.ts`, `Dockerfile`
- "Build & Test": add `npm run score — Event-Scores berechnen`
- Known Issues: remove "ignoreBuildErrors" if still listed (already fixed in fn-1)
- Add brief Docker section: `docker build` command and Coolify deployment note

**`.env.example`:** Ensure it has all vars: NEXT_PUBLIC_MAPBOX_TOKEN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN, GITHUB_REPO, SCRAPE_API_KEY, ANALYTICS_SALT. Add brief comments per section.

## Key Context
- Follow CHANGELOG phase entry pattern from existing entries (format: `### Phase N: Title`, then bullet-point commits and features)
- CLAUDE.md "Wichtige Pfade" uses `- \`path\` — Description` format
- This task only updates docs and fixes any remaining build issues — no new features
## Acceptance
- [ ] `npm run build` passes with 0 errors
- [ ] `npm test` — 127 tests pass
- [ ] `docker build` completes successfully (or Dockerfile verified if Docker unavailable)
- [ ] `curl http://localhost:3000/api/health` returns `{ "status": "ok" }`
- [ ] `curl http://localhost:3000/sitemap.xml` returns valid XML
- [ ] `curl http://localhost:3000/robots.txt` returns correct rules
- [ ] `curl http://localhost:3000 | grep "og:title"` returns a result
- [ ] `CHANGELOG.md` has Phase 13 entry with all new routes and scripts documented
- [ ] `CLAUDE.md` updated with new paths and `npm run score`
- [ ] `.env.example` has SCRAPE_API_KEY and ANALYTICS_SALT entries
- [ ] Git working tree clean after final commit
## Done summary
Updated CHANGELOG.md with Phase 13 entry documenting all sprint deliverables (Docker, scoring, landing, SEO), new routes table entries, file structure additions, and extended summary table. Updated CLAUDE.md with all new Wichtige Pfade entries, npm run score command, and Docker build section. Build passes with 0 errors; all 127 tests pass.
## Evidence
- Commits: e7c003d77a0cf769615c3aceb5c9da65f72e0006
- Tests: npm test -- 127 passed (127)
- PRs: