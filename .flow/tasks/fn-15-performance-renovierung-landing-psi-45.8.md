# fn-15-performance-renovierung-landing-psi-45.8 next/font/local + Latin-1 Subsetting + Caveat weg (-150KB)

## Description

Aktuell: Geist (Body) + Fraunces (Display) + Caveat (Handwriting) via
`next/font/google`, jeweils ~100KB woff2 = 266KB Font-Bytes. Migration auf
`next/font/local` mit self-hosted woff2 in `/public/fonts/`, Latin-1 Subsetting,
Caveat komplett raus.

**Size:** S-M (~1 Tag)

## Files

- `src/lib/fonts.ts` — Migration auf `next/font/local`
- `public/fonts/` — Latin-1-subsetted woff2 Files (via fonttools pyftsubset)
- `src/app/layout.tsx` — Caveat-Variable raus
- `src/app/planer/layout.tsx` (oder ähnlich) — Fraunces lazy auf /planer scope

## Approach

1. Geist Variable woff2 von Google CDN downloaden, mit `pyftsubset` auf
   Latin-1 reduzieren (`--unicodes=U+0020-007F,U+00A0-00FF`)
2. Fraunces analog subsetten, plus reduzierte Variations-Axes (`--axes=wght`)
3. Files in `/public/fonts/{geist,fraunces}/*.woff2`
4. `next/font/local` in `src/lib/fonts.ts`:
   ```ts
   import localFont from 'next/font/local';
   export const geist = localFont({
     src: [{ path: '../../public/fonts/geist/Geist-Variable.woff2',
              weight: '100 900', style: 'normal' }],
     variable: '--font-geist',
     display: 'optional',  // KEIN swap, eliminiert Layout-Shift
     preload: true,         // einziger preloaded Font
   });
   ```
5. Fraunces nur auf /planer-Route importieren (subroute-layout)
6. Caveat komplett aus root entfernen

## Acceptance

- [ ] Geist + Fraunces sind self-hosted via `next/font/local` (woff2 in
      `/public/fonts/`, kein fonts.googleapis.com Request mehr)
- [ ] Geist hat `display: 'optional'` und `preload: true` (eliminiert
      Font-Flash und Layout-Shift bei FCP)
- [ ] Geist woff2 ist <= 35KB (Latin-1 subset)
- [ ] Fraunces wird NUR auf `/planer`-Route geladen (verifizierbar via
      Network-Tab: kein Fraunces-Request auf Landing `/`)
- [ ] Caveat ist KOMPLETT entfernt aus root-layout — `rg "caveat|Caveat"
      src/lib/fonts.ts src/app/layout.tsx` zeigt 0 Treffer
- [ ] Falls Caveat in einzelnen Components genutzt: dynamic import oder
      Component-lokaler font-import
- [ ] Total Font-Bytes auf Landing: <= 50KB (von 266KB)

## Evidence-Notes

- Network-Tab-Screenshot vor/nach
- Bundle-Size-diff (Fonts-Chunk)
- Rollback: Vercel-instant + revert fonts.ts

## Done summary
fn-15.8: migrated Geist + Fraunces + Caveat from `next/font/google` to
self-hosted `next/font/local` with Latin-1 subsets in /public/fonts/.
Geist (28 KB, display:optional, preload:true) stays at the root for the
brand wordmark; Fraunces + Caveat split into `src/lib/fonts-planer.ts`
and import only from /groups, /groups/[id], /join layouts. Landing font
weight dropped from ~266 KB to ~28 KB (well under the 50 KB target).
## Evidence
- Commits: ed30a7437f9b44e9971a7067d06ac0f5095faa0c
- Tests: npm run build (green: 90+ routes built, no errors), baseline npm test compared pre/post: identical 70/1268 pre-existing failures (none introduced by fn-15.8), rg "caveat|Caveat" src/lib/fonts.ts src/app/layout.tsx -> 0 matches, ls -la public/fonts/geist/Geist-Variable.woff2 -> 28,400 B (< 35 KB target)
- PRs: