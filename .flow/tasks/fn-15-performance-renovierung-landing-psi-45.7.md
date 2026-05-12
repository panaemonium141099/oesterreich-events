# fn-15-performance-renovierung-landing-psi-45.7 ISR + Auth-Middleware: no-store killen, Edge-Cache reaktivieren (TTFB -300ms)

## Description

Vercel sendet aktuell `Cache-Control: no-store` auf `/` weil AuthRedirectGate
in `page.tsx` Cookies via Server-Component liest → Dynamic-Rendering →
Edge-Cache umgangen. Lösung: Auth-Logic raus aus page.tsx, Edge-Middleware
sniffed Cookies (existence-check, kein Supabase-Call), redirected logged-in
User direkt am Edge. `/` wird statisch + ISR `revalidate=3600`.

**Cookie-Strategy (Codex-Round-3 finalisiert):** Redirect nur bei
`sb-*-auth-token` (Hauptsache-Cookie), refresh-only-state triggert KEINEN
Redirect (würde Dynamic-Rendering brauchen).

**Size:** M-L (~2-3 Tage)

## Files

- `src/middleware.ts` — neue Edge-Middleware mit Auth-Cookie-Sniff
- `src/app/page.tsx` — AuthRedirectGate entfernen, `revalidate=3600` setzen
- `src/components/Auth/AuthRedirectGate.tsx` — KOMPLETT GELÖSCHT (Edge-Middleware
  übernimmt). Falls Component noch in anderen Routes referenziert: refactor.

## Approach

### Phase 1: Auth-Cookie-Audit (Codex-Round-5-Pflicht, 1h)
**KRITISCH** vor Implementation: tatsächlichen Cookie-Namen für unsere
Supabase-Konfiguration identifizieren. Cookies hängen von:
- Supabase-Project-Ref (`booljdtrktpotsenbnut`)
- Supabase-Client-Version
- Auth-Helpers vs SSR-Setup

**Audit-Methode:**
1. Login auf lasstreffen.at als Test-User
2. DevTools → Application → Cookies → `lasstreffen.at` Domain
3. Alle Cookies mit `sb-`-Prefix dokumentieren (exact name + format)
4. Resultat in `.flow/evidence/fn-15.7-auth-cookies.md` speichern

**Erwartete Patterns** (Codex-Verifikation):
- `sb-<project-ref>-auth-token` (single consolidated cookie, modern Supabase)
- ODER: `sb-access-token` + `sb-refresh-token` (split, älterer Setup)

Authoritative Pattern erst nach Audit fix.

### Phase 2: Middleware-Implementation (siehe API Contracts in Epic)

## Acceptance

- [ ] **Phase 1 Auth-Cookie-Audit komplett**: `.flow/evidence/fn-15.7-auth-cookies.md`
      existiert mit identifizierten Cookie-Namen + Format
- [ ] `src/middleware.ts` existiert mit Auth-Cookie-Sniff für `/`, Cookie-Pattern
      matched die im Audit identifizierten Namen
- [ ] Redirect erfolgt am Edge wenn auth-cookie vorhanden ist
      (verifiziert: `Invoke-WebRequest` mit cookie-header → 307 Redirect zu /feed)
- [ ] **Full landing-route-tree audit (Codex-Round-6-Pflicht):**
      `src/app/page.tsx` UND ALLE genested Server-Components UND `src/app/layout.tsx`
      haben KEINE der folgenden Dynamic-APIs:
  - `cookies()` aus `next/headers`
  - `headers()` aus `next/headers` (außer im Build-Hash-Lookup, der ist sync)
  - `useAuth()` oder andere Auth-Hooks (only client-island HeroSearch darf)
  - Uncached `fetch()` ohne `revalidate` option
  - `dynamic = 'force-dynamic'` exports
  Verifikation: `rg -n "cookies\(\)|headers\(\)|useAuth|force-dynamic" src/app/page.tsx src/app/layout.tsx src/components/Landing/`
- [ ] `src/app/page.tsx` exportiert `export const revalidate = 3600`
- [ ] **Build-Time-Beweis**: `npm run build` Output zeigt `/` als
      `○ (Static)` oder `● (ISR)` — NICHT `ƒ (Dynamic)`. Screenshot/Output
      in `.flow/evidence/fn-15.7-build-route-table.txt` speichern.
- [ ] **Runtime-Beweis**: `Invoke-WebRequest -Method Head https://lasstreffen.at/`
      zeigt `Cache-Control` header mit `s-maxage` oder `must-revalidate`
      (NICHT `no-store, no-cache`)
- [ ] Response-Header zeigt `Cache-Control: public, s-maxage=3600,
      stale-while-revalidate` ODER `Cache-Control: public, max-age=0,
      must-revalidate` mit ISR-Indikatoren
- [ ] PSI Mobile TTFB Lab <= 800ms gegen Vercel-Preview-URL

### Post-Deploy Validation (Follow-Up Evidence)

- [ ] Anonyme Visitors sehen production Landing in <100ms vom CDN-Edge (warm
      visit, gemessen via curl-Loop oder WebPageTest)
- [ ] Logged-in Visitors werden auf /feed redirected ohne Landing-Render
      (manueller Test: Login + Browser-back zu / → direkt /feed)

## Group-Level Acceptance (mit fn-15.9)

- [ ] PSI Mobile Performance Score >= 90 nach Group (7+9)

## Evidence

- curl -I Output auf Production zeigt korrekte Cache-Header
- Manueller Test: Login + Aufruf von `/` → Redirect zu /feed am Edge
  (DevTools-Network zeigt 307 ohne page-render)
- Rollback: Vercel-instant; Notfall: middleware.ts entfernen

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
