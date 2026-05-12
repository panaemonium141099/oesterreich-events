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

## Acceptance

- [ ] Alle 4 async-Sections haben `<Suspense fallback={<SectionSkeleton/>}>`
      mit Skeleton der **exakten Höhe** wie die geladene Section
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

## Evidence

- Commits, Skeleton-Component-Inventory, PSI-Delta für Gruppe (1+2)
- Rollback: Vercel-instant

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
