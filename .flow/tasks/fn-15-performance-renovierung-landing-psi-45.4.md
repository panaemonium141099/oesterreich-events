# fn-15-performance-renovierung-landing-psi-45.4 Third-Party Cleanup + Security Headers (AdSense raus!)

## Description

PSI Best-Practices ist 88. Pillar deckt AdSense-Removal (Interview-Decision:
komplett raus, User nicht zugelassen), GA4-Lazy-Load + Security-Headers ab.
CSP-Strategie ist **hash-basiert (sha256)**, NICHT nonce — verifiziert in
Codex-Round-3 dass nonce-CSP via `headers()` ISR brechen würde.

**Size:** M (~1 Tag)

## Files

- `next.config.ts` — `async headers()` für HSTS site-wide + COOP/COEP NUR auf `/`
- Repo-weit: AdSense-Komponenten + Scripts entfernen
- `src/app/layout.tsx` — GA4 KOMPLETT entfernt bis ein Consent-Banner existiert.
  Auch GA4-Consent-Mode-v2 mit default-denied lädt gtag.js + sendet cookieless
  pings (Google "advanced consent mode") — das widerspricht der Datenschutz-Aussage
  "ausschließlich nach Einwilligung". Re-Einführung in einem späteren Task mit
  ConsentGate-Component. Vercel Analytics (cookieless, kein Consent nötig) bleibt
  funktional.
- **NICHT in dieser Task:** CSP-Hash-Header. Das wird in fn-15.6 ergänzt sobald
  `CRITICAL_CSS` exists. Edge-Middleware wird NICHT für CSP genutzt (würde
  ISR brechen) — `next.config.ts` `headers()` ist authoritative.
- **NICHT in dieser Task:** LHCI-Setup wurde nach fn-15.1 vorgezogen (Codex-
  Round-7-Korrektur), weil fn-15.1 selbst LHCI für seine Group-Acceptance braucht.
  Hier nur: bestehende LHCI-Config nutzen, Hard-Thresholds verifizieren.

## Acceptance

### PR-Preview Gates (BLOCKS merge)

- [ ] **AdSense komplett entfernt**: `rg -n "adsbygoogle|googlesyndication|google_ad_client|pagead2|ad-slot"` zeigt 0 Treffer im Source-Code
- [ ] Network-Tab auf Production zeigt KEINE Requests zu `pagead2.googlesyndication.com`,
      `googleads.g.doubleclick.net`, `partner.googleadservices.com`
- [ ] `next.config.ts` `images.remotePatterns` enthält keine AdSense-bezogenen Domains
- [ ] GA4 ist KEIN Script-Tag in layout.tsx (Codex-Round-4-Korrektur:
      Consent-Mode-v2-default-denied widerspricht datenschutz "ausschließlich
      nach Einwilligung"). Re-Einführung als separater ConsentGate-Task.
- [ ] Vercel-Analytics bleibt funktional (Pageviews messen in Vercel-Dashboard)
- [ ] Response-Headers gesetzt (verifiziert via `Invoke-WebRequest -Method Head`):
  - SITE-WIDE: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`,
    `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
    `X-Frame-Options: SAMEORIGIN`
  - NUR auf `/`: `Cross-Origin-Opener-Policy: same-origin`,
    `Cross-Origin-Embedder-Policy: credentialless`
- [ ] **Smoke-Tests dass COOP/COEP NICHT auf andere Routes leaken**:
  - `/entdecken` (Mapbox-Workers): kein COEP header
  - `/feed`, `/auth/callback`, `/auth/login`: kein COOP=same-origin
  - `/blog/*`, `/events/*`, `/planer`: kein COOP/COEP
  - `/` (Landing): COOP + COEP present
- [ ] **CSP wird in dieser Task NICHT gesetzt** — wird in fn-15.6 finalisiert
  weil dort der `CRITICAL_CSS`-Hash verfügbar wird. Für fn-15.4 Closure
  bleibt das aktuelle CSP-Verhalten (mit `'unsafe-inline'`) temporär
  unverändert. Pillar 6 löst's auf.
- [ ] PSI Best-Practices Score = 100 (auf Vercel-Preview-URL, NICHT production)

### Post-Deploy Validation (Follow-Up Evidence, NICHT merge-blocking)

- [ ] securityheaders.com Score = A oder A+ (gegen production lasstreffen.at,
      24h nach Merge wenn Cache propagiert ist)
- [ ] mozilla observatory Score >= 90 (production)
- [ ] Vercel-Dashboard zeigt unchanged Analytics-Eintrag-Rate vor/nach Deploy
- [ ] DevTools-Network auf production: KEINE Requests zu AdSense-Domains
- [ ] LHCI-Infrastructure ist live (eingerichtet in fn-15.1) und Thresholds
      wurden hier nicht regressiert (PR-Run zeigt Score >= Group-1-Baseline)
- [ ] **Landing-Smoke-Tests unter neuen Headers (`/` mit COOP/COEP):**
  - `/_next/image/...` funktioniert auf `/` (verifiziert: Image-Load 200 OK)
  - GA4-Smoke-Test ENTFÄLLT in dieser Task (deferred). Re-enable in ConsentGate-Folge-Task.
  - Vercel Analytics zeichnet Pageview auf (verifiziert: Vercel-Dashboard zeigt
    Eintrag nach Test-Visit)
  - Keine Console-Errors auf `/` (verifiziert via DevTools)

## Group-Level Acceptance (mit fn-15.3)

- [ ] PSI Performance Score Delta dokumentiert (kann minimal positive sein nach AdSense weg)

## Evidence

- Commits, securityheaders.com Screenshot, observatory Screenshot
- Repo-Grep-Output zur AdSense-Verifikation
- Rollback: Vercel-instant + revert AdSense-removal-commit falls Revenue-Impact

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
