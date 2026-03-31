# fn-2-deploy-ready-sprint-scoring-landing.1 Docker Setup & Standalone Build

## Description
Add `output: 'standalone'` to next.config.ts, create a production-ready multi-stage Dockerfile using `node:20-slim` (not Alpine — needed for native addons), add `.dockerignore`, and create `/api/health` endpoint. Verify `npm run build` passes cleanly before any other work.

**Size:** M
**Files:** `next.config.ts`, `Dockerfile` (new), `.dockerignore` (new), `src/app/api/health/route.ts` (new), `.env.example`

## Approach
- Add `output: 'standalone'` to the `nextConfig` object in `next.config.ts` (line 78 area, inside the config object before `serverExternalPackages`)
- Dockerfile: 3 stages — `deps` (npm ci --only=production), `builder` (full npm ci + npm run build with ARG/ENV for NEXT_PUBLIC_* vars), `runner` (node:20-slim, copy standalone + static + public, non-root USER node, EXPOSE 3000)
- Install `sharp` in the builder stage via `RUN npm install sharp` — Next.js standalone file tracer misses it; without it image optimization fails in production
- `better-sqlite3` is only used by scraper scripts, NOT by any API route — confirmed. No need for build-tools in the runner stage
- `.dockerignore`: exclude `node_modules`, `.next`, `.git`, `data/`, `.env.local`, `.flow`, `*.md`
- `/api/health`: returns `{ status: "ok", timestamp, version }` — static response, no Supabase check needed (Coolify uses it for container liveness only)
- `.env.example`: add `SCRAPE_API_KEY` and `ANALYTICS_SALT` (already documented in CHANGELOG but missing from file)
- Run `npm run build` at end — fix any TypeScript errors that surface. Do NOT add ignoreBuildErrors.

## Key Context
- `next.config.ts` currently at 86 lines; `serverExternalPackages: ['better-sqlite3']` is at line 79 — keep it, it's needed for scraper scripts
- `node:20-slim` uses glibc; Alpine uses musl — `sharp` and `better-sqlite3` native addons require glibc to build and run
- After adding `output: 'standalone'`, `npm start` changes behavior — `next start` no longer works; standalone server starts via `node .next/standalone/server.js`
- Build-time ARGs needed: `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — these are baked into client bundle
## Acceptance
- [ ] `output: 'standalone'` present in `next.config.ts`
- [ ] `Dockerfile` exists with 3-stage build using `node:20-slim` runner
- [ ] `sharp` installed in builder stage
- [ ] `.dockerignore` exists and excludes `node_modules`, `.next`, `.git`, `data/`, `.env.local`
- [ ] `/api/health` returns `{ status: "ok", timestamp, version }` with 200 status
- [ ] `.env.example` includes `SCRAPE_API_KEY` and `ANALYTICS_SALT`
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `npm test` — 127 tests still pass
## Done summary
Added Docker support with a 3-stage Dockerfile using node:20-slim, enabled Next.js standalone output, created a /api/health liveness endpoint, and updated .env.example with SCRAPE_API_KEY and ANALYTICS_SALT. Build and all 127 tests pass cleanly.
## Evidence
- Commits: 529e13859a090e3223a131be4e375a6b81d35dd9
- Tests: npm run build, npm test (127 passed)
- PRs: