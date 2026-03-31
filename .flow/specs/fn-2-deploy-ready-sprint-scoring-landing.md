# Deploy-Ready Sprint: Scoring, Landing Page, SEO, Docker

## Overview

LassTreffen.at (burgenland-events-v5) must be deployable to Hetzner (Coolify + Docker) immediately after this sprint. The app has solid features from fn-1 (security, scrapers, multi-tag, pagination, animations) but lacks Docker support, SEO infrastructure, event ranking, and a content-rich landing page.

**Sprint goal:** After this epic, `docker build` produces a working image, Google can crawl and rank events, the landing page shows featured events + regions + categories, and events are scored/ranked by quality.

## Scope

### In Scope
- `output: 'standalone'` in next.config.ts + multi-stage Dockerfile (node:20-slim + sharp)
- `/api/health` endpoint for container health checks
- Event scoring: `event_score` Supabase column + `calculate-scores.ts` script
- `/api/events/featured` endpoint (top events by score, start_date >= today)
- `/api/stats/counts` endpoint (single query for all 9 region + 13 category counts)
- `sort=score` parameter on `/api/events` (with score-aware cursor pagination)
- Landing page: `WeeklyHighlights`, `RegionExplorer`, `PopularCategories` components
- Full SEO: OG tags, Twitter cards, `metadataBase`, `robots.ts`, `sitemap.ts` (with `generateSitemaps()`)
- `/events/[id]/page.tsx` — SEO event detail page with `generateMetadata` + JSON-LD Event schema
- `.env.example` update + CHANGELOG.md / CLAUDE.md documentation

### Out of Scope
- Impressum/Datenschutz pages (legal content, not blocking deploy)
- Custom 404/error pages
- Monitoring/alerting (Sentry, etc.)
- Cron job for score recalculation (out of Coolify scope; document as manual step)
- Favicon / OG image assets (placeholder is acceptable for launch)
- Domain DNS / SSL (infrastructure, not code)

## Architecture

```mermaid
graph TD
    subgraph Landing
        A[page.tsx] --> B[WeeklyHighlights]
        A --> C[RegionExplorer]
        A --> D[PopularCategories]
        B --> E[/api/events/featured]
        C --> F[/api/stats/counts]
        D --> F
    end
    subgraph Scoring
        G[calculate-scores.ts] --> H[Supabase events.event_score]
        E --> H
    end
    subgraph SEO
        I[/events/id/page.tsx] --> J[generateMetadata + JSON-LD]
        K[sitemap.ts generateSitemaps] --> H
    end
    subgraph Docker
        L[Dockerfile multi-stage] --> M[.next/standalone]
        N[/api/health] --> O[{ status: ok }]
    end
```

## Key Technical Decisions

1. **node:20-slim (not Alpine)** for Docker runner — Alpine lacks glibc, `better-sqlite3` and `sharp` native addons fail
2. **sharp must be explicitly installed** in Docker builder — Next.js standalone file tracer misses it
3. **`generateSitemaps()` for sitemap** — 40k+ events approach Google's 50k/sitemap limit; split into chunks of 5000
4. **Single `/api/stats/counts` endpoint** — avoids 22 N+1 API calls (9 regions + 13 categories) from landing page
5. **Score-aware cursor pagination** — when `sort=score`, cursor must use `(event_score, id)` not `(start_date, id)`
6. **`better-sqlite3` only used in scraper scripts, not API routes** — confirmed by context-scout; standalone Docker build is safe
7. **`"use client"` wrappers** for all Framer Motion components — App Router Server Component constraint

## Quick Commands

```bash
# Verify build
npm run build

# Calculate event scores (run after deploy and daily)
npm run score

# Test Docker build locally
docker build -t lasstreffen-test \
  --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=test \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=test \
  .

# Check SEO endpoints
curl http://localhost:3000/sitemap.xml | head -20
curl http://localhost:3000/robots.txt
curl http://localhost:3000/api/health

# Run tests
npm test
```

## Acceptance

- [ ] `npm run build` passes with 0 TypeScript errors (no ignoreBuildErrors)
- [ ] `docker build` completes successfully with `node:20-slim`
- [ ] `/api/health` returns `{ status: "ok" }`
- [ ] All events with `start_date >= today` have `event_score > 0` after `npm run score`
- [ ] `/api/events/featured?limit=8` returns top 8 events ordered by score
- [ ] `/api/events?sort=score` returns events sorted by `event_score DESC`
- [ ] Landing page shows WeeklyHighlights, RegionExplorer, PopularCategories sections
- [ ] `/sitemap.xml` returns valid XML with event URLs
- [ ] `/robots.txt` disallows `/api/`, `/admin/`, `/auth/`
- [ ] `/events/[id]` renders event detail with OG meta tags and JSON-LD
- [ ] Homepage has OG tags visible in `curl http://localhost:3000 | grep "og:"`
- [ ] `npm test` — 127 tests still pass

## References

- `src/app/api/events/route.ts` — cursor pagination logic to extend for score sort
- `src/types/events.ts` — Event interface to extend with event_score
- `src/types/database.ts` — DB Row types
- `src/app/page.tsx` — Landing page (67 lines, server component)
- `src/components/Landing/` — 7 existing landing components
- `src/app/layout.tsx` — metadata location (29 lines)
- `next.config.ts` — add standalone output
- `supabase/migrations/` — existing migrations pattern
- [Next.js generateSitemaps docs](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps)
- [Next.js standalone Docker](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- [schema.org/Event](https://schema.org/Event)
