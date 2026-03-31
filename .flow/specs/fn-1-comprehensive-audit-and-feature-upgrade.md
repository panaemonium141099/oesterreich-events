# Comprehensive Audit and Feature Upgrade

## Overview

Full-scope audit and feature upgrade for the Burgenland Events platform â€” an Austrian event discovery app built with Next.js 16, React 19, Supabase (22 tables), and Mapbox GL JS. Currently has 44 scrapers, dual-DB architecture (SQLite for scraping, Supabase for production), Supabase Auth with Google OAuth, DM + group chat with realtime, and 41K+ events.

This epic covers 10 phases: codebase documentation, test infrastructure, code audit/security, image quality, university scrapers, multi-tag system, performance optimization, UI animations, chat event sharing, and regional/niche event sources.

## Scope

### In Scope
- Architecture documentation in CHANGELOG.md
- Vitest test infrastructure + core tests
- TypeScript strictness (remove `ignoreBuildErrors`), security fixes, code deduplication
- Scraper image extraction improvements
- Multi-category/tag DB schema (Supabase junction table) + API + frontend
- API pagination, viewport-based map loading, bundle optimization
- Framer Motion animations (page transitions, micro-interactions)
- Chat inline event search and rich preview enhancement
- Austrian university/FH event scrapers (~40 institutions)
- Niche event category scrapers (festivals, nightlife, outdoor, culture, food, family)
- CHANGELOG.md updates after each phase

### Out of Scope
- Eventim/oeticket scrapers (require Puppeteer, deferred)
- Mobile app
- Payment/ticketing integration
- Full Supabase RLS policy rewrite (audit only, fix critical gaps)

## Architecture Context

```mermaid
graph TB
    subgraph Frontend
        A[Next.js 16 App Router] --> B[Mapbox GL JS Map]
        A --> C[Event Cards/Detail]
        A --> D[Chat DM + Groups]
        A --> E[Filters/Search]
    end
    subgraph API
        F[/api/events] --> G[Supabase PostgreSQL]
        H[/api/scrape] --> I[44 Scrapers]
        I --> J[SQLite Staging DB]
        J -.->|manual sync| G
    end
    subgraph Auth
        K[Supabase Auth] --> L[Google OAuth]
        K --> M[Email/Password]
        K --> N[Role System: user/business/admin/god]
    end
    subgraph Realtime
        O[Supabase Channels] --> D
        O --> P[Notifications]
    end
```

## Key Technical Decisions

1. **Test framework**: Vitest (standard for Next.js/Vite, fast, ESM-native)
2. **Multi-category approach**: Supabase junction table `event_tags` with GIN index on tag array, backwards-compatible API (new `tags` param alongside existing `category`)
3. **Performance strategy**: API pagination (cursor-based), viewport-based map loading, remove Leaflet deps, ISR for static pages
4. **Animation library**: Framer Motion (React-native, tree-shakeable, `motion-reduce` support built-in)
5. **University scrapers**: Batch in 2 groups (15 + remaining), following existing BaseScraper pattern

## Known Risks

| Risk | Mitigation |
|------|-----------|
| Removing `ignoreBuildErrors` may surface 100s of TS errors | Run `tsc --noEmit` first to scope; fix incrementally, start with `any` â†’ proper types |
| Multi-tag schema migration could break 44 scrapers | Backwards-compatible: keep `category` column, add `event_tags` junction table alongside |
| University sites may block scrapers | Respect robots.txt, add User-Agent, rate limiting per BaseScraper |
| Framer Motion adds ~30KB to bundle | Tree-shake, lazy-load animation components, measure after Phase 7 optimization |
| Dual-DB sync (SQLite â†’ Supabase) must handle schema changes | Migration updates both schemas in lockstep |

## Quick commands
```bash
# Run tests
npm test

# Build check
npm run build

# Run scrapers
npm run scrape

# Check TypeScript
npx tsc --noEmit
```

## Acceptance

- [ ] CHANGELOG.md documents full architecture and all changes
- [ ] Test infrastructure works, core tests pass
- [ ] `ignoreBuildErrors` removed, build succeeds
- [ ] Security issues fixed (service role key, search sanitization, scrape auth)
- [ ] Duplicated code extracted to shared utilities
- [ ] Scraper image extraction improved (no more stub `extractImageUrl`)
- [ ] Multi-tag system working (DB, API, frontend filters)
- [ ] API paginated, map viewport-loaded, Leaflet removed from bundle
- [ ] Framer Motion animations on pages, cards, micro-interactions
- [ ] Chat inline event search with rich preview
- [ ] University/FH scrapers implemented and tested
- [ ] Niche event sources added (festivals, clubs, outdoor, culture, food, family)
- [ ] All changes documented in CHANGELOG.md

## References

- `src/lib/scrapers/BaseScraper.ts` â€” abstract scraper base class
- `src/lib/scrapers/index.ts` â€” 44 scraper registry, `runAllScrapers()`
- `src/types/events.ts` â€” Event type, 13 categories, EventFilters
- `src/lib/supabase/auth-context.tsx` â€” AuthProvider, useAuth, role system
- `src/app/api/events/route.ts` â€” events API, 50K limit, search sanitization
- `src/components/Map/EventMap.tsx` â€” Mapbox GL JS map
- `src/app/messages/[userId]/page.tsx` â€” DM thread, event_share message type exists
- `data/uni-event-sources.json` â€” 40+ university event source URLs
- `HANDOFF.md` â€” migration status, known issues
