# fn-15-performance-renovierung-landing-psi-45.3 Browser-Targets Audit: Polyfill-Quelle identifizieren

## Description

PSI meldet 14KB Legacy-Polyfills (`Array.prototype.at`, `.flat`, `.flatMap`,
`Object.fromEntries`, `Object.hasOwn`, `String.prototype.trimEnd/Start`).
**Codex-Round-2-Korrektur:** Next.js 16 defaultet bereits auf `Chrome/Edge/Firefox
111+, Safari 16.4+` — die ursprüngliche Idee `chrome>=90` wäre älter als der
Framework-Default. Diese Task ist Audit-first: erst die Polyfill-Quelle finden,
dann gezielt reagieren.

**Size:** S (~0.5 Tag)

## Files

- `package.json` (potentiell: browserslist override)
- `next.config.ts` (potentiell: compiler-options)
- Audit-Output: `.flow/evidence/fn-15.3-polyfill-source.md`

## Approach

1. Bundle-analyzer-Run: `$env:ANALYZE="true"; npm run build`
2. Im Treemap die Chunks mit `core-js`, `regenerator-runtime`, `polyfill`-Modulen
   identifizieren
3. Falls Polyfills aus Next.js-Default-Output → browserslist `chrome>=120,
   safari>=16.4` setzen (matched Next.js 16 Default)
4. Falls Polyfills aus npm-Paket-Bundling → spezifisches Paket isolieren
   (Custom-Babel-Config oder dependency-internal-Polyfills)

## Acceptance

- [ ] Bundle-Analyzer-Output zeigt Source der 14KB Polyfills (Datei-Pfad oder
      Paket-Name) im evidence-File dokumentiert
- [ ] **EINE** der folgenden Outcomes:
  - (a) Polyfills wurden entfernt durch Browserslist-Adjustment ODER
  - (b) Polyfills sind aus specific npm-package, dieses ist isoliert oder
        durch Alternative ersetzt ODER
  - (c) Audit zeigt dass keine "echten" Polyfills mehr im Bundle sind (PSI
        false-positive oder bereits gefixt) → Task closed mit Verifikation
- [ ] Build erfolgreich nach Änderungen
- [ ] Falls Browserslist gesetzt: targets sind **nicht älter** als Next.js
      16 Default (`Chrome/Edge/Firefox 111+, Safari 16.4+`)

## Evidence

- Bundle-analyzer-diff vor/nach
- Browserslist-Begründung wenn geändert
- Rollback: Vercel-instant

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
