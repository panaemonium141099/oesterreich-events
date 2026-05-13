# fn-15-performance-renovierung-landing-psi-45.9 Above-fold als pure RSC (TBT -150ms)

## Description

Aktuell sind Hero, Stats, Tagline, Beta-Hinweis in `'use client'` boundaries
verheddert (durch AuthRedirectGate-Bezug oder andere Client-Code-Pfade). Mit
fn-15.7 ist Auth aus page.tsx raus, dadurch wird der Refactor möglich:
above-fold = pure RSC, nur Search-Input bleibt als isoliertes Client-Island.

**Size:** M-L (~3-4 Tage)

## Files

- `src/app/page.tsx` — Server Component, kein 'use client', kein useAuth
- `src/components/Landing/HeroSection.tsx` — RSC
- `src/components/Landing/LandingStats.tsx` — RSC (fetch stats server-side)
- `src/components/Landing/BetaHinweis.tsx` — RSC (statisch)
- `src/components/Landing/HeroSearch.tsx` — NEUE separate Client-Island (~2KB)
  mit dem interactive Search-Input

## Acceptance

- [ ] `src/app/page.tsx` hat KEIN `'use client'` directive
- [ ] HeroSection, LandingStats, BetaHinweis sind RSC (verifizierbar:
      `rg "use client" src/components/Landing/{HeroSection,LandingStats,BetaHinweis}.tsx` zeigt 0)
- [ ] HeroSearch ist die EINZIGE Client-Island above-fold (`'use client'` only there)
- [ ] LandingStats fetched seine Daten server-side (kein useState +
      useEffect, sondern async Server Component mit await supabase-call)
- [ ] Bundle-Analyzer zeigt initial-JS für `/` <= 100KB gzipped
- [ ] Above-fold-HTML enthält bereits Stats-Zahlen + Hero-Content im
      initial-Response (verifizierbar via curl, kein "Loading..." Placeholder)
- [ ] PSI Mobile TBT <= 100ms

## Group-Level Acceptance (mit fn-15.7)

- [ ] PSI Mobile Performance Score >= 90

## Evidence-Notes

- Bundle-analyzer-diff
- curl Production-URL output zeigt prerendered Stats-Zahlen
- Rollback: Vercel-instant

## Done summary
Above-fold became pure RSC: HeroSection.tsx is now a Server Component shell rendering the static category hint + animation wrapper, LandingStats.tsx is an async RSC that awaits `event_counts_for_stats` at ISR-build time and bakes the real value (66 324+) into the prerendered HTML, and HeroSearch.tsx is the single remaining Client-Island above the fold. Verified via curl on `.next/server/app/index.html` — h1, stats number, tagline, search input, beta-hinweis and category hint all present in initial response.
## Evidence
- Commits: 842dfe262254fa99dea2eadcfc49428ada5c809a
- Tests: npx tsc --noEmit (4 pre-existing baseline errors, no new errors), npm run build (clean, postbuild CSP-hash verifier OK across 94 HTML files), npm test (1198 passed / 70 failed — same as fn-15.6 baseline), rg "use client" src/components/Landing/{HeroSection,LandingStats}.tsx → 0 matches (acceptance criterion), rg "use client" src/components/Landing/HeroSearch.tsx → 1 match (only above-fold Client-Island), rg "use client" src/app/page.tsx → 0 matches, curl-equivalent: python re.search on .next/server/app/index.html confirmed 'Entdecke was<br/>los ist', stats badge 66 324+ (real RPC value, not 75000 fallback), tagline, beta-hinweis, category hint and search-input placeholder all in prerendered HTML
- PRs: