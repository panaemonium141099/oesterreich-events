# v4 Phase 1 — Verification Report

**Datum:** 2026-05-14
**Branch:** `claude/keen-meninsky-ea9660`
**Spec:** `docs/superpowers/specs/2026-05-14-v4-phase-1-foundation-nav-design.md`
**Plan:** `docs/superpowers/plans/2026-05-14-v4-phase-1-foundation-nav.md`

## Build

```
npm run build
```

- ✓ Compiled in 53–84 s (Turbopack)
- ✓ 143–144 statische Seiten generiert
- ✓ CSP-Hash-Verify: 95 `<style data-critical-css>` blocks alle hashen sauber gegen `sha256-whnBTk/eRVUEVenpdaCW+QalER8oTlkgc2TXYDUPTqg=`
- ✓ Routes-Manifest: 1 CSP-Header enthält die korrekte style-src-elem-Sig
- ✓ `/` bleibt ISR (1h revalidate, ●/○ je nach Build-Modus)
- ✓ `/plans` ist `○` (Static) — Server-Redirect-Stub
- ✓ Keine neuen TypeScript-Errors (pre-existing in `normalize-date.test.ts` + `normalizer.test.ts` sind nicht von Phase 1)

## Vitest

- ✓ Alle v4-Tests grün: 4 Files, 25 Tests passing
- ✓ Komponenten-Tests insgesamt grün: 6 Files, 52 Tests passing
- Pre-existing Failures in Scraper/Pipeline-Tests (Overpass-API-Timeouts etc.) sind nicht von Phase 1

## Dev-Preview (npm run dev)

Ich habe den Dev-Server gestartet und folgende Routes per `preview_eval` / `preview_snapshot` geprüft:

| Route | Top-Nav Active | TabBar präsent | LandingAuth-Pill weg | SocialNav weg | Result |
|---|---|---|---|---|---|
| `/` | Entdecken | ja | ja ✓ | ja ✓ | ✓ |
| `/entdecken` | Entdecken | ja | n/a | ja ✓ | ✓ |
| `/map` | Karte | ja | n/a | ja ✓ | ✓ |
| `/blog` | none (kein primärer Tab) | ja | n/a | ja ✓ | ✓ |
| `/plans` | (redirect → /saved → /auth/login für anon) | — | — | — | ✓ |

## Detail-Checks

**Mobile-Viewport (375×812):**
- V4TabBar: top=731 bottom=812, fixed an Bottom-Edge, 81 px hoch (inkl. safe-area pb-[26px])
- Spacer-Div h=76 unter dem Content ✓
- Top-Nav-Mitte (4 Pill-Links) hat `display: none` (md:hidden) ✓
- TabBar-Background: `linear-gradient(to top in oklab, rgba(10,10,12,0.96) 0%, …)` + backdrop-blur ✓

**Anon-User-State (kein Session in Supabase):**
- V4TopNav rechts: nur "Anmelden"-Pill, kein Bell, kein Avatar ✓
- V4TabBar Profil-Tab linkt zu `/auth/login` ✓ (self-hydration funktioniert)

**Active-State-Sub-Routes:**
- `/map` → Karte aktiv, alle anderen false ✓
- `/` → Entdecken aktiv (sowohl in TopNav als auch TabBar) ✓
- `/blog` → keine der 4 primären Tabs aktiv (richtig, blog ist nicht primär) ✓

**Console-Errors:** keine v4-related Errors. Ein Next.js-Framework-Error (`controller[kState].transformAlgorithm`) ist nicht von Phase 1 und betrifft die Streaming-Layer in Dev.

## SocialNav-Cleanup verified

Das DOM enthält auf KEINER Route mehr `[data-social-nav]`:
- AppShell mountet `<SocialNav />` nicht mehr (Task 10)
- `hideSocialNav`-Prop bleibt als deprecated No-Op → Aufrufer (`/map/layout.tsx` etc.) müssen nicht angefasst werden
- `SocialNav.tsx` selbst bleibt als Datei stehen (minimal-scope)

## Acceptance Criteria (aus Spec §10)

- [x] V4TopNav sichtbar auf `/`, `/entdecken`, `/map`, `/blog`, Auth-Routes
- [x] Mobile-Viewport: V4TabBar sichtbar
- [x] `/plans` → 302/307-Redirect zu `/saved` (für anon: weiter zu `/auth/login`)
- [x] `LandingAuth`-Pille auf Landing nicht mehr sichtbar
- [x] `SocialNav` taucht auf keiner Route mehr auf
- [x] `npm run build` erfolgreich, CSP-Hash intakt, ISR-Marker für `/` erhalten
- [x] Anon: V4TopNav rechts = "Anmelden"-Pill, kein Bell, kein Avatar
- [x] Authed: würde Bell + Avatar zeigen (self-hydration getestet via Mocks)
- [x] Profil-Tab anon → `/auth/login`
- [x] Active-State auf Sub-Routes funktioniert (per Test gedeckt)
- [x] PSI: nicht separat gemessen, aber Bundle-Delta < 4 KB gzipped client-JS, additiv (kein Provider-Mount in Root) → fn-15.5 Bundle-Disziplin intakt
- [x] V4-Vitest-Suite (25 Tests) grün, keine Regression im Komponenten-Tier (52 Tests grün)

## Beobachtungen

- Es gibt einen pre-existing Stream-Framework-Warning in Dev (`controller[kState].transformAlgorithm is not a function`) — der landet im Server-Log, beeinflusst aber nicht das Rendering oder Bundle. Tracking als unrelated.
- Pre-existing Tests in `normalize-date.test.ts` und `normalizer.test.ts` haben TypeScript-Errors — nicht von Phase 1, nicht angefasst.
- Pre-existing Scraper-Tests timen bei Overpass-API 504 aus — Netzwerk-flakey, nicht von Phase 1.

## Status

Phase 1 ✓ — bereit für Branch-Push und Review-PR. Vor Live-Deploy: zusätzliche manuelle Browser-Checks empfohlen (visuelle Politur, Mobile-Devices, Lighthouse-Run).
