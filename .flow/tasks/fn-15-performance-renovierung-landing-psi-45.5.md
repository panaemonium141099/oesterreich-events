# fn-15-performance-renovierung-landing-psi-45.5 Bundle-Architektur: AnimatedLayout raus, AuthProvider scope, Mapbox split (459KB → 150KB)

## Description

PSI: 1 Mega-Chunk 459KB, 370KB unused, 370ms long task. Drei große Treiber:
framer-motion (~80-100KB), Mapbox-Code (~480KB), Supabase-client + AuthProvider
auf root-layout. Interview-Decisions:
- **framer-motion KOMPLETT raus** (View-Transitions via CSS feature-detect)
- **Mapbox geht raus aus Landing** → Link zu /entdecken
- **AuthProvider scope**: nur auf authenticated routes

**Size:** L (~3-4 Tage)

## Files

- `src/app/layout.tsx` — AuthProvider raus, page-transitions raus
- Components mit framer-motion: heart-pop, confetti, scale-press, marker-pulse,
  modal-transitions etc. → CSS-Migration
- `src/components/Map/EventMap.tsx` und Mapbox-Imports — von Landing entkoppeln
- `src/app/feed/layout.tsx`, `/profile/layout.tsx` etc. — AuthProvider in
  authenticated routes
- `package.json` — framer-motion entfernen
- `src/app/page.tsx` — Map-Button statt Map-Embed

## Acceptance

- [ ] `framer-motion` ist NICHT mehr in `package.json` dependencies
      (`rg "framer-motion"` zeigt 0 Treffer in src/)
- [ ] AnimatedLayout-Komponente entfernt, page-transitions via CSS
      `view-transition-name` mit feature-detect (Firefox: instant cut)
- [ ] Heart-pop, Scale-press, Marker-pulse, Confetti etc. nutzen CSS-Animations
      oder Tailwind utilities, nicht framer-motion
- [ ] AuthProvider ist NICHT in `src/app/layout.tsx`, sondern in:
  - `src/app/feed/layout.tsx`
  - `src/app/profile/layout.tsx`
  - `src/app/saved/layout.tsx`
  - `src/app/freunde/layout.tsx`
  - `src/app/messages/layout.tsx`
  - `src/app/admin/layout.tsx`
  - `src/app/groups/[id]/layout.tsx` (only for private groups, public OK ohne)
- [ ] Mapbox-Imports (mapbox-gl, EventMap-Komponente) sind NICHT auf Landing
      `/` route geladen — verifizierbar via bundle-analyzer
- [ ] Landing hat einen "Karte zeigen" Link/Button zu `/entdecken`, Map wird
      dort weiter geladen
- [ ] Initial JS Bundle für `/` < 150KB gzipped (verifizierbar via build-output)
- [ ] No visual regression: alle Components rendern korrekt nach CSS-Migration

## Group-Level Acceptance (mit fn-15.6)

- [ ] PSI Mobile Performance Score >= 80 nach Group (5+6)
- [ ] TBT Lab <= 100ms
- [ ] FCP Lab <= 1.5s

## Evidence

- Bundle-analyzer-diff (Treemap vor/nach mit Top-5 Chunk-Sizes)
- Component-inventory der framer-motion → CSS migrations
- Rollback: Vercel-instant; Notfall: framer-motion git-revert + npm install

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
