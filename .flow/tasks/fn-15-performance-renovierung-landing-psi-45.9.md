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

## Evidence

- Bundle-analyzer-diff
- curl Production-URL output zeigt prerendered Stats-Zahlen
- Rollback: Vercel-instant

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
