# fn-2-deploy-ready-sprint-scoring-landing.4 RegionExplorer, PopularCategories & Landing Integration

## Description
Build `RegionExplorer` and `PopularCategories` landing components (both use `/api/stats/counts`), then integrate all 3 new sections into `page.tsx` after the existing HeroSection.

**Size:** M
**Files:** `src/components/Landing/RegionExplorer.tsx` (new), `src/components/Landing/PopularCategories.tsx` (new), `src/app/page.tsx`

## Approach

**`RegionExplorer`:** `"use client"`. Fetches `/api/stats/counts` once (shared with PopularCategories if both are in the same parent — see integration note). 9 tiles for the 9 Bundeslaender. Each tile: Bundesland name, event count, hover scale+shadow effect. Click navigates to `/map?bundesland={name}`. 3×3 grid desktop, 2-col tablet, 1-col mobile. Subtle dark-theme background variants per tile (different shades of `gray-800`/`gray-900` or slight hue tints — no bright colors). Framer Motion `whileInView` staggered entrance.

**`PopularCategories`:** `"use client"`. Uses counts from `/api/stats/counts`. 13 category tiles. Each: Lucide icon matching category (Music → Music, Nightlife → Moon, Kultur → Theater, etc.), category name, event count. Click navigates to `/map?category={name}`. 4-col desktop, 3-col tablet, 2-col mobile. Framer Motion stagger.

**`page.tsx` integration:** Import all 3 new components with `dynamic(() => import(...), { ssr: false })` to avoid hydration issues with client-only Framer Motion. Place after the existing `HeroSection` in this order: `WeeklyHighlights`, `PopularCategories`, `RegionExplorer`, `Footer`. Existing sections (ParticleBackground, Onboarding, LandingAuth, LandingStats, LiveActivity, HeroSection) MUST remain unchanged.

**Shared fetch optimization:** Create a thin context or pass counts as props from a shared fetch in the parent. Alternatively, both RegionExplorer and PopularCategories can independently fetch `/api/stats/counts` — it has a 1h cache so no extra DB calls after the first request.

## Key Context
- `src/app/page.tsx` is a Server Component (async function, no "use client") — the `dynamic` imports are the right pattern
- `src/lib/categories.ts` exports the 13 category names and likely icons/colors — check and reuse rather than re-defining
- The 9 Bundeslaender: Wien, Niederösterreich, Oberösterreich, Steiermark, Salzburg, Tirol, Vorarlberg, Kärnten, Burgenland
- `/map?bundesland=Wien` — verify `src/app/map/page.tsx` reads `searchParams.bundesland` at load time; if not, the links work but filters don't pre-apply (acceptable for now, note in PR)
## Acceptance
- [ ] `RegionExplorer` renders 9 Bundesland tiles with names and event counts
- [ ] Clicking a tile navigates to `/map?bundesland={name}`
- [ ] `PopularCategories` renders 13 category tiles with icons and event counts
- [ ] Clicking a category navigates to `/map?category={name}`
- [ ] Both components have Framer Motion viewport entrance animations
- [ ] All 3 new sections visible on landing page after HeroSection
- [ ] Existing landing sections (ParticleBackground, Onboarding, LandingAuth, LandingStats, LiveActivity, HeroSection) unchanged
- [ ] No hydration errors in browser console
- [ ] Responsive layout on mobile (1-col), tablet (2-col), desktop (3-4 col)
- [ ] `npm run build` passes
- [ ] `npm test` — 127 tests pass
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
