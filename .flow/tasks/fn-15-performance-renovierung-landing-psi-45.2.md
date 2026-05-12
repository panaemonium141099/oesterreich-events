# fn-15-performance-renovierung-landing-psi-45.2 CLS-Stabilität: 0.535 → <0.05 (Skeletons + aspect-ratios + Footer-Fix)

## Description

PSI Mobile Lab-CLS ist 0.535 (Schwellwert "good" <= 0.1). PSI-Audit identifiziert
`<footer mt-auto pb-32>` als primären Shift-Treiber: Footer pusht via `mt-auto` ans
Container-Ende, async-loading Sections (WeeklyHighlights, RegionExplorer,
PopularCategories, FestivalBlog) wachsen den Container dann und der Footer rutscht
sichtbar nach unten. Plus: meshShift-Background-Animation animiert
`background-position-x/y` und ist nicht compositor-only.

**Size:** S-M (~1-2 Tage)

## Files

- `src/app/page.tsx` (Suspense-Boundaries)
- `src/components/Landing/WeeklyHighlights.tsx`, `RegionExplorer.tsx`,
  `PopularCategories.tsx`, `FestivalBlogSection.tsx` — pixel-perfect Skeletons
- `src/components/Layout/Footer.tsx` — mt-auto raus, container min-h-screen
- `src/app/globals.css` — meshShift-Animation auf transform: translate3d
- `src/components/Events/EventImage.tsx` — `showSkeleton` Prop ist seit fn-15.1
  als deprecated no-op markiert (RSC kann onLoad nicht observen).
  fn-15.2 sollte den Prop ganz entfernen und durch container-level Suspense-
  Skeletons ersetzen (siehe Acceptance unten). next/image's built-in
  `placeholder="blur"` mit `GENERIC_BLUR_DATA_URL` deckt das Loading-Fenster
  für die Remote-URLs bereits ab.
  <!-- Updated by plan-sync: fn-15.1 ließ showSkeleton als deprecated no-op in EventImage stehen, mit Hinweis "Removing it is fn-15.2 territory" -->

## Acceptance

- [ ] Alle 4 async-Sections haben `<Suspense fallback={<SectionSkeleton/>}>`
      mit Skeleton der **exakten Höhe** wie die geladene Section
      <!-- Updated by plan-sync: fn-15.1 setzte WeeklyHighlights[0] als LCP-Kandidat
           mit preload + fetchPriority="high" + loading="eager". Suspense-Skeleton
           für WeeklyHighlights darf das LCP-Image NICHT verzögern — Skeleton-Höhe
           muss exakt der Card-Höhe entsprechen, damit kein CLS-Shift beim
           Render-Switch passiert. -->
- [ ] Skeletons haben animated Shimmer-Effekt (CSS-only, kein JS)
- [ ] Footer ist NICHT mehr via `mt-auto` positioniert. Container hat
      explizites `min-h-screen` oder Grid-Layout das den Footer am Ende hält
      ohne dynamisches Pushing
- [ ] meshShift-Background-Animation nutzt nur `transform: translate3d`
      (compositor-only, verifizierbar via DevTools "Layer-borders")
- [ ] Alle Cards haben fixed aspect-ratios via Tailwind aspect-{w}-{h} Klassen
- [ ] PSI Mobile CLS Lab <= 0.1 (gemessen auf Preview)
- [ ] PSI Mobile CLS Lab <= 0.05 als SOFT-Target (für 95+ Score)

## Group-Level Acceptance (mit fn-15.1)

- [ ] PSI Mobile LCP <= 2.0s
- [ ] PSI Mobile Performance Score >= 65

## Evidence-Notes

- Commits, Skeleton-Component-Inventory, PSI-Delta für Gruppe (1+2)
- Rollback: Vercel-instant

## Done summary
fn-15.2 CLS-Stabilität SHIP after 4 codex impl-review rounds.

Implemented: pixel-perfect Suspense skeletons mirroring all 4 landing
sections 1:1 (SectionSkeletons.tsx, 241 LOC), gradient-mesh split into
shared-static + landing-animated classes (fixes modal stack-context
trap), Footer mt-auto removed (now pure document flow), meshShift
animation rewritten to compositor-only transform: translate3d,
WeeklyHighlights empty-state matches w-60 h-260 card footprint,
EventImage showSkeleton prop fully removed and 20 call-sites swept,
CLS-skel diagonal shimmer via CSS-only pseudo-element respecting
prefers-reduced-motion.

PSI verification: pending (group 1+2 PR will measure LCP <= 2.0s,
CLS <= 0.05).

Codex round-3 SHIP. 22/22 tests green. TypeScript clean.
## Evidence
- Commits: c904cad — fix(perf): CLS-Stabilität — Suspense skeletons, footer fix, mesh GPU (fn-15.2), a891362 — fix(perf): CLS empty-state + heading-wrap shifts (fn-15.2 round 2), 422d3a3 — fix(perf): gradient-mesh clip, empty-state width, skeleton a11y (fn-15.2 round 3), 945d64e — fix(perf): split gradient-mesh (landing only animates), empty h-260 (fn-15.2 r4)
- Tests: 22/22 passing in src/__tests__/components/EventImage.test.tsx (showSkeleton-related tests removed since prop is gone)
- PRs: