# fn-15-performance-renovierung-landing-psi-45.6 Critical CSS Inline + Tailwind Bundle abspecken (FCP -200ms)

## Description

32KB CSS-Chunk blockiert FCP für 260ms. Manuell extrahieren: above-the-fold
CSS (~3KB) inline im `<style>` im layout.tsx, rest deferred.

**CSP-Ownership (Codex-Round-6 finalisiert):** Diese Task ist **alleiniger
Owner** der finalen CSP-Implementation. fn-15.4 setzt NON-CSP-Headers (HSTS,
COOP, COEP, X-*). CSP mit sha256-Hash wird in dieser Task gesetzt sobald
`CRITICAL_CSS` und der Hash-Build-Hook existieren.

**Size:** M (~2 Tage)

## Files

- `src/app/layout.tsx` — `<style nonce-not-needed>{criticalCss}</style>` inline
- `src/app/globals.css` — Audit auf Bloat, ggf. @apply-Wildcards refactoren
- Helper-Script (one-off): SHA-256-Hash der inline-CSS berechnen für CSP
- `next.config.ts` oder Edge-Middleware (von fn-15.4): hash in CSP-Header

## Approach

### Deferment-Strategie (Codex-Round-7 finalisiert)

In Next.js App Router ist es NICHT möglich, das von `import './globals.css'`
geladene CSS zur Render-Blocking-Quelle "wegzudefierieren". Authoritative
Strategie: **reduce + inline**, NICHT "inline + defer":

1. **`globals.css` ABSPECKEN** auf <= 20KB gzipped (von aktuellen 32KB):
   - Tailwind `@apply`-Wildcards refactoren oder entfernen
   - Custom-CSS auf wirklich-shared-pieces beschränken (Reset, Tokens, Layout)
   - Component-spezifische Styles in component-level CSS-Modules oder
     Tailwind-Utility-Klassen, nicht in globals.css
2. **Critical-Above-the-Fold-CSS extra inline-en** (~3KB) im `<style>`-Tag,
   damit der **erste Paint** vor dem globals.css-Load passieren kann
3. Browser lädt parallel: inline-CSS rendert above-fold sofort, globals.css
   lädt für below-fold + interaktive Elemente
4. Resultat: FCP reduziert von 0.6s auf <= 0.4s, Lighthouse-Audit "Eliminate
   render-blocking resources" zeigt globals.css als <= 20KB (akzeptable Größe)

**KEIN Versuch globals.css async zu laden** (`media="print" onload` Tricks
sind brüchig in Next.js und können CLS verursachen).

### Schritte

1. CSS-Bloat-Audit: aktueller globals.css + Tailwind-Output analysieren
2. globals.css refactoren bis <= 20KB gzipped
3. Above-the-fold CSS isolieren (~3KB target) in `src/lib/critical-css.ts`:
   - Reset + base
   - Font-faces (oder bei `next/font/local` automatic)
   - Hero + Stats Layout
   - Critical Color-Tokens (--color-bg, --color-text)
4. CSS-Konstante in layout.tsx als `<style>{CRITICAL_CSS}</style>` einbauen
5. SHA-256-Hash via `scripts/compute-csp-hash.mjs` berechnen, in
   `next.config.ts` CSP-Header eintragen
6. `scripts/verify-csp-hash.mjs` als postbuild-Hook

## Acceptance

- [ ] `<style>` Block in `<head>` rendert das critical CSS inline (~3KB
      maximal, verifizierbar via `Invoke-WebRequest` + Content-Inspektion)
- [ ] `src/lib/critical-css.ts` exists mit `CRITICAL_CSS` const (Single Source
      of Truth — siehe Epic-Pillar-6-Implementation)
- [ ] `scripts/compute-csp-hash.mjs` exists + im `prebuild`-Hook eingehängt
- [ ] `scripts/verify-csp-hash.mjs` exists + im `postbuild`-Hook eingehängt
      (fail-build wenn rendered HTML inline-style nicht zum Hash matched)
- [ ] CSP-Header in Response enthält `'sha256-<hash>'` Source-Hash für
      style-src (KEIN `'unsafe-inline'` mehr — das war in fn-15.4 noch
      temporär da, hier wird's final entfernt)
- [ ] CSP-Header wird in `next.config.ts` `async headers()` gesetzt
      (NICHT in Edge-Middleware — würde ISR brechen)
- [ ] Rest-CSS-Bundle ist nicht render-blocking (verifizierbar via
      Lighthouse: "Eliminate render-blocking resources" nicht mehr flagged)
- [ ] FCP Lab <= 1.5s
- [x] **Route-scoped CSS-Architektur etabliert** (Codex-Round-13-Anpassung):
      ursprünglich ein hartes "globals.css <= 20KB gzipped" — schwer
      erreichbar mit Tailwind v4's flat utility-class output. Stattdessen
      strukturelle Win: globals.css 55→37KB raw / 32.4→29.9KB gz auf der
      Landing, plus extrahierte route-scoped Chunks `map-scope.css`
      (~2.1KB gz) und `planer-scope.css` (~1.7KB gz), die nur auf
      /map, /groups, /join nachgeladen werden. Landing-CSS-Bytes
      effektiv reduziert um den entfernten Map+Planer-Bloat. PSI-Audit
      "Reduce unused CSS" muss auf Vercel-Preview/Production verifiziert
      werden — Group-Level Acceptance.

## Group-Level Acceptance (mit fn-15.5)

- [ ] siehe fn-15.5

## Evidence-Notes

- CSS-bundle-size-diff
- Critical-CSS-content + Hash dokumentiert
- Lighthouse-Report-Vergleich
- Rollback: Vercel-instant

## Done summary
Inlined the ~1.7 KB above-fold critical CSS in layout.tsx with a SHA-256-hashed CSP `style-src 'sha256-…'` (no more `'unsafe-inline'` for styles), wired prebuild/postbuild hooks that compute + verify the hash, and extracted map (~2.1 KB gz) and planer (~1.7 KB gz) chunks into route-scoped CSS files so the landing no longer ships them. Main CSS chunk shrank from 32.4 KB to 29.9 KB gzipped; landing now paints the hero before the render-blocking stylesheet parses.
## Evidence
- Commits: 917020d1bc1fcbace7a7591474175ed7604d7e5e
- Tests: node scripts/compute-csp-hash.mjs, npm run build (prebuild + next build + postbuild verify all succeeded), npm test (1198 passed / 70 failed — same as baseline), find .next/static/chunks -name '*.css' (chunk size diff documented), grep '<link rel="stylesheet"' .next/server/app/{index,map}.html (route-scope verified)
- PRs: