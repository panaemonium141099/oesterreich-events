# Performance-Renovierung Landing: PSI 45 → 95+

## Status

**Started 2026-05-12.** fn-14.4 Bulk-Migration ist pausiert (Anthropic-Wochen-Cap voll,
8.695/63k future events done, Resume Do 2026-05-14 10:59) — Performance-Renovierung
läuft parallel als Frontend-Arbeit ohne Claude-Abhängigkeit.

## Interview Decisions (2026-05-12)

30 Entscheidungen aus Deep-Interview gesammelt. Diese überschreiben/präzisieren wo
sie mit den Pillars unten kollidieren.

### Strategy & Process

- **Score-Ziel**: Hart 95+, aber Logic-Erhalt überrangt Score (kein Feature-Breaking
  für Performance). AdSense fliegt komplett raus (User nicht zugelassen).
- **Rollout**: Gruppen-PRs: **(1+2)** Image+CLS, **(3+4)** Browsertargets+ThirdParty,
  **(5+6)** Bundle+CriticalCSS, **(7+9)** Auth-Middleware+RSC, **(8+10)** Fonts+SW.
- **Risk-Tolerance**: Sehr niedrig — jeder PR muss prod-ready sein.
- **Measurement**: PSI-Re-Run **nach jeder PR-Gruppe** (5×) + 1× finaler Bench.
- **Rollback**: Vercel-native Instant-Rollback via Dashboard (kein Feature-Flag-Setup).

### Performance Budget (HARD = blocks merge, SOFT = warning)

**Measurement Sources (Codex-Round-4 — explizit für Reproduzierbarkeit):**
- **PSI / Lighthouse Metriken** (Performance Score, LCP, CLS, FCP, TBT, INP):
  Lighthouse CI gegen Vercel-Preview-URL der jeweiligen PR, Profile "Mobile",
  Throttling "Simulated Slow 4G". Tool: `@lhci/cli` >= 0.13 mit
  `.lighthouserc.json` config-pinned.
- **Bundle-Size-Metrik** (Initial JS): `npx next-bundle-analyzer` OR
  build-output `.next/analyze/client.html` gzipped-column für die `/` route.
  Authoritative: gzipped-size der Initial-Bundle-Chunks im Production-Build.
  `next build` selbst zeigt nur uncompressed — daher `next-bundle-analyzer` mandatory.
- **Total Network Payload**: Lighthouse-Audit "Avoid enormous network payloads",
  resource-summary-Section. NICHT browser-DevTools (Profile-abhängig).

**HARD (Lighthouse CI fails Build):**
- PSI Performance Score >= 90 (Mobile, Slow 4G, Preview-URL)
- LCP <= 2.5s (Lab, Mobile, Slow 4G)
- CLS <= 0.1 (Lab)

**SOFT (warning, ziel aber nicht blocking):**
- PSI Performance Score >= 95
- LCP <= 2.0s, CLS <= 0.05
- FCP <= 1.5s, TBT <= 100ms, INP <= 100ms
- Initial JS Bundle <= 150KB gzipped (via next-bundle-analyzer Initial-Chunk-Summe)
- Total Network Payload <= 1.5 MB (Lighthouse-Audit auf Slow 4G)

### Pillar-Anpassungen aus Interview

**Pillar 1 (Image Optimization) — REALISTISCH-RESCOPED 2026-05-12 (Codex-Round-2):**
Korrektur der ursprünglichen "eigene Assets only"-Formulierung: Faktisch sind
~95% der Card-Bilder **third-party gescraped** (linztermine.at, wien-ticket.at
etc.) — die zu ignorieren würde Pillar 1 wirkungslos machen. Tatsächlicher Scope:

**IN-SCOPE für fn-15.1:**
- Landing-Card-Komponenten (siehe Pillar 1 Architecture-Section weiter unten)
- **Third-party gescraped Image-URLs werden VIA next/image proxied** (CDN-Optimization
  + Cache durch Vercel). Funktioniert via `images.remotePatterns` Whitelist + Vercel
  Image-Optimization-Pipeline.
- Image-Placeholder: **EINE Strategie, nicht zwei** —
  ein static generic blur `data:` URL für alle remote images
  (z.B. `data:image/svg+xml;base64,...` mit 10×10 gradient). KEIN
  pro-Image plaiceholder/sharp-Generation (das wäre upstream data-pipeline-Arbeit
  und gehört in fn-15.11).
- Fallback nur server-side: wenn `src` null/empty ist (z.B. Event hat kein
  Bild in der DB), rendert EventImage `/category-images/{fallbackCategory}.jpg`.
  KEIN client-side onError — würde EventImage zur Client Component machen
  und Pillar 9 (above-fold = pure RSC) brechen. Broken remote URLs zur
  Laufzeit zeigen nichts / alt-text (akzeptierter Trade-Off; Image-URL-
  Health-Check ist OUT-OF-SCOPE für fn-15 — siehe fn-15.11/12).

**OUT-OF-SCOPE für fn-15.1:**
- Event-Detail-Page-Bilder (`/events/[...slug]`)
- `/blog/[slug]` Bilder
- Map-Marker auf `/entdecken`
- Cloudflare R2 Migration → fn-15.11 (separate, post-fn-15)
- Per-Image LQIP-Generation aus dem Source-Image → fn-15.11

**Pillar 2 (CLS):** meshShift-Animation auf `transform: translate3d` umschreiben
(compositor-only) statt entfernen. Pixel-perfect Skeletons mit animiertem Shimmer für
WeeklyHighlights, RegionExplorer, PopularCategories, FestivalBlog.

**Pillar 3 (Browser Targets) — OBSOLET, ersetzt durch Audit-first-Approach:**

~~Die ursprüngliche Interview-Entscheidung "direkt aggressiv chrome>=90"~~
**verworfen** — wäre älter als Next.js 16 Default (`Chrome/Edge/Firefox 111+,
Safari 16.4+`) und hätte Support **erweitert** statt verengt.

**Authoritative Decision (überlegt diese gesamte Interview-Sektion)**:
Audit-first. Siehe `Pillar 4 in Architecture (Task fn-15.3)` weiter unten —
erst Bundle-Source der 14KB Polyfills identifizieren, dann zielgerichtet
handeln. Browserslist wird NUR gesetzt wenn Audit konkrete Quelle zeigt
UND Polyfills durch Override entfernt werden können. Falls nicht: kein
Override — Task closed mit "nichts zu tun, Verifikation komplett".

**Pillar 4 (Third-Party Audit + Security Headers):** AdSense-Removal IST der Hauptteil.
Plus: GA4 + Vercel-Analytics auditieren (GA4 lazy-load via gtag-pattern, Vercel-
Analytics bleibt). CSP **hash-basiert (sha256)** für inline-Content — NICHT
nonce-basiert wie ursprünglich entschieden, weil Codex-Round-3 verifiziert hat
dass nonce-CSP via `headers()` ISR opt-out triggert und Pillar 7 (Edge-Cache)
brechen würde.

**Pillar 5 (Bundle-Architektur):**
- **framer-motion KOMPLETT raus**, alles auf CSS migrieren (heart-pop, confetti,
  scale-press → CSS animations + Tailwind utilities). View-transition mit
  feature-detect Fallback (Firefox bekommt instant cuts, akzeptabel).
- **Mapbox geht ganz raus aus Landing** → Link/Button zu /entdecken. Kein Mini-Map,
  kein progressive-enhancement, kein Mapbox-JS auf `/`.
- **AuthProvider scope**: NUR auf `/feed`, `/profile`, `/saved`, `/freunde`,
  `/messages`, `/admin/*`, `/groups/[id]/*` (private). Landing, Blog, Event-Detail
  bleiben ohne AuthProvider.

**Pillar 6 (Critical CSS):** Manuell — above-fold CSS als `<style>` im layout.tsx
inline-en (~3KB). Kein Build-Tool, volle Kontrolle, Wartungs-Tax akzeptiert.

**Pillar 7 (ISR + Auth-Middleware):** `revalidate=3600s` wie im Spec. Stats-Counter
sind shared/global (kein Per-User-Caching, kein Geolocation).

**Pillar 8 (Fonts):**
- `next/font/local` mit Geist + Fraunces als woff2 in /public (self-hosted, kein
  Google-Roundtrip, `font-display: optional` eliminiert Layout-Shift)
- Geist Variable (Body) → Latin-1 Subset, ~30KB, **preloaded**
- Fraunces → lazy auf /planer-Route, nicht auf Landing
- **Caveat komplett raus aus root-layout** (vermutlich kaum genutzt, audit nötig)

**Pillar 9 (RSC above-fold):** Hero + Stats + Tagline + Beta-Hinweis als pure RSC.
Search-Input als isoliertes Client-Island (~2KB JS). Auth-Logic vollständig raus aus
page.tsx (siehe Pillar 7).

**Pillar 10 (Service Worker):** Workbox stale-while-revalidate, **30 Tage TTL** für
`/_next/image/*`. Update-Strategie: **Hybrid Banner** ("Update verfügbar — neu laden")
statt skipWaiting. User behält Kontrolle.

### Performance-Budget-CI Setup

Lighthouse CI auf jeder PR gegen Vercel-Preview-URL. Hard-Fail bei PSI<90, Soft-Warn
bei PSI<95. Bundle-Size-Check als zusätzlicher Gate.

### Open Questions resolved → markiert als Decided

1. ~~Browser-Analytics-Check~~: → direkt aggressiv (Decision oben)
2. ~~AdSense-Revenue-Impact~~: → AdSense kommt komplett weg (Decision)
3. ~~Service Worker Update-Strategy~~: → Hybrid Banner (Decision)
4. ~~CSP Nonce in Edge Middleware~~: → Edge-Middleware Next.js 16 (Decision)

## Goal & Context

PageSpeed Insights misst Mobile Performance Score **45/100** (Stand 10.05.2026). Echte User-Erfahrung ist ebenfalls schlecht (FCP p75 = 2.6s, nur 48% gut). Lab-CLS = 0.535 (katastrophal, Schwellwert <0.1). LCP 4.2s im Lab.

User-Wunsch: **kein Aufwand zu groß, keine Kompromisse, keine Quick-Wins** — nachhaltige Big-Wins für ehrliche 95+ Score.

## Echte Befunde aus PSI-Audit (10.05.2026)

| Metrik | Wert | Bewertung |
|---|---|---|
| Performance Score | 45 | Schlecht |
| FCP | 0.6s | OK |
| LCP | **4.2s** | Schlecht (>2.5s) |
| TBT | 220ms | Mid |
| CLS | **0.535** | Katastrophal |
| Speed Index | 2.4s | OK |
| Total Network Payload | 5.598 KiB | Massiv |
| Image-Einsparung möglich | 3.407 KiB | Bestätigt: Bilder unoptimiert |
| Unused JS | 668 KiB | Massiv |
| Main-thread work | 2.1s | Long |

## Pillar-zu-Task Mapping

Die Architecture-Section unten und die `Recommended Task Order` weiter unten nutzen
historisch unterschiedliche Reihenfolgen. **Maßgeblich für die Implementierung sind
die Task-Nummern (fn-15.X)**, nicht die "Pillar N"-Bezeichnungen in Architecture.

| Task | Pillar in Architecture | Inhalt |
|---|---|---|
| fn-15.1 | Pillar 1 | Image Optimization (next/image für Landing-Cards) |
| fn-15.2 | Pillar 2 | CLS-Stabilität (Skeletons, Footer, Mesh-Animation) |
| fn-15.3 | Pillar 4 in Architecture | Browser-Targets Audit |
| fn-15.4 | Pillar 5 in Architecture | Third-Party Cleanup + Security Headers (AdSense raus!) |
| fn-15.5 | Pillar 3 in Architecture | Bundle-Architektur (framer-motion weg, Mapbox raus) |
| fn-15.6 | Pillar 6 | Critical CSS Inline |
| fn-15.7 | Pillar 7 | ISR + Auth-Middleware |
| fn-15.8 | Pillar 8 | next/font/local + Subsetting |
| fn-15.9 | Pillar 9 | RSC above-fold |
| fn-15.10 | Pillar 10 | Service Worker |
| **fn-15.11** | — | **Follow-up, NICHT teil der fn-15-Acceptance** (siehe Out-of-Scope Section unten) |

## Architecture & Big Wins (10 Pillars)

### 🥇 Pillar 1: Vercel Image Optimization für Landing-Cards (fn-15.1)
**Problem:** `linztermine.at` liefert 4156×2790 Pixel-Bilder (2.5 MB) für 254×160 Cards = **15× zu groß**. Native `<img>` ohne `next/image` in WeeklyHighlights, TopEvents-Carousel, FeaturedEvents, EventImage. LCP-Bild "DAS PHANTOM DER OPER" mit `loading="lazy"` (sollte priority haben).

**Scope (eingegrenzt nach Codex-Review — eigene Assets only, Landing-Karten):**
- `src/components/Events/EventImage.tsx` auf `next/image` umschreiben
- Diese Landing-Card-Komponenten migrieren:
  - `src/components/Landing/WeeklyHighlights.tsx`
  - `src/components/Landing/RegionExplorer.tsx`
  - `src/components/Landing/PopularCategories.tsx`
  - `src/components/Landing/FestivalBlogSection.tsx`
  - `src/components/Events/FeaturedEvents.tsx`
  - `src/components/Events/TopEventsCarousel.tsx` (falls auf Landing eingebunden)
- `sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"`
- `placeholder="blur"` + `blurDataURL` (10px LQIP)
- Externe URLs die CORS/rate-limit blocken: graceful fallback auf Placeholder

**Priority-Strategie (Codex-Korrektur, war "erste 3 Cards in jedem Carousel" — falsch):**
- **GENAU 1** primärer LCP-Candidate bekommt `priority + fetchpriority="high"` —
  empirisch zu identifizieren via PSI-Report (aktuell "DAS PHANTOM DER OPER" 
  als WeeklyHighlights[0])
- Max 2 zusätzliche above-the-fold Bilder: `fetchpriority="high"`, KEIN `priority`
- Alles below-fold: default lazy
- Mehrere konkurrierende priority-Bilder verschlechtern LCP, nicht verbessern

**Explizit out-of-scope für fn-15.1:**
- Event-Detail-Page-Bilder (`/events/[...slug]`) — eigener Folge-Task falls nötig
- `/blog/[slug]` Bilder
- Map-Marker-Thumbnails auf `/entdecken`
- Cloudflare R2 + Workers Image-Proxy (siehe fn-15.11 Out-of-Scope)

**Impact:** -3 MB Bytes auf Landing, LCP 4.2s → 1.5s, **+30 Punkte**

### 🥈 Pillar 2: CLS 0.535 → 0 durch Layout-Stabilität
**Problem (PSI-Beweis):** "Element: `<footer mt-auto pb-32>` — Layout-Shift 0.535". Footer pusht via `mt-auto` ans Ende. Async-loading sections (WeeklyHighlights, RegionExplorer, PopularCategories, FestivalBlog) lassen den Container wachsen → Footer rutscht. Plus: meshShift-Animation auf `background-position-x/y` ist nicht-compositor-only.

**Lösung:**
- Stabile aspect-ratios + min-heights für ALLE async sections (Skeleton mit exakter Höhe)
- `<Suspense fallback>` mit pixel-perfect skeletons (nicht null)
- meshShift-Animation auf `transform: translate3d` umschreiben (compositor-only)
- Footer aus `mt-auto`-Flow nehmen — explicit `min-h-screen` auf Container

**Impact:** CLS 0.535 → 0.05, **+15 Punkte**

### 🥉 Pillar 3: Bundle-Architektur Renovierung (459 KB Single Chunk)
**Problem:** 1 Chunk (`16599wq0iu-dt.js`) ist **459 KB**, 370 KB unused, 370ms long task. Alles-in-einem framer-motion + supabase-js + Mapbox-related code in einem mega-chunk.

**Lösung:**
- AnimatedLayout entfernen — framer-motion komplett raus aus root, page-transitions via CSS `view-transition-name`
- AuthProvider nur auf protected routes (`/feed`, `/profile`, `/admin`, `/freunde`), NICHT in root-layout
- Supabase-client lazy-load für Landing
- Mapbox imports raus aus root, KEIN prefetch in HeroSection
- Bundle-analyzer pflicht-check: `ANALYZE=true npm run build`

**Impact:** 459 KB → 100-150 KB initial JS, FCP -800ms, TBT 220ms → 50ms, **+15 Punkte**

### Pillar 4 in Architecture (Task fn-15.3): Browser-Targets Audit
**Codex-Review-Korrektur 2026-05-12:** Next.js 16 defaultet bereits auf
`Chrome/Edge/Firefox 111+` und `Safari 16.4+` (siehe https://nextjs.org/docs/architecture/supported-browsers).
Unsere ursprünglich vorgeschlagenen Targets `chrome>=90, safari>=14` wären
**älter** als der Framework-Default — das würde Support **erweitern**, nicht
verengen, und die Polyfills WIEDER einführen. Der vorgeschlagene `next.config.ts
modern compile target` ist auch keine reale Config-Option.

**Problem (echte Lage):** PSI-Report meldet 14KB Legacy-Polyfills im Bundle. Das
kann an Next.js-Version-Mismatch liegen, an Custom-Babel-Konfigurationen, oder
an einzelnen Dependencies die `core-js` mitbringen.

**Lösung (umformuliert):**
1. **Audit zuerst, dann handeln**: Bundle-Analyzer-Run um zu sehen welche
   Polyfills woher kommen (`core-js`, `regenerator-runtime`, einzelne Pakete)
2. **Falls Polyfills aus Next.js-Default-Output**: Browserslist auf
   `chrome>=120, edge>=120, firefox>=120, safari>=16.4` setzen ODER ganz
   weglassen (Next.js Default ist bereits gut)
3. **Falls Polyfills aus npm-Paket-Bundling**: das spezifische Paket isolieren
   und ggf. ersetzen oder dynamisch laden
4. **next.config.ts compile-target step STREICHEN** (existiert nicht)

**Impact:** -14 KB JS (wenn Audit erfolgreich), -50ms parse-time. Falls Audit
zeigt dass Next.js bereits keine Polyfills shippt, dann ist Pillar 4 ein No-op
und schließt mit "nichts zu tun, Acceptance erfüllt durch Verifikation".

### Pillar 5 in Architecture (Task fn-15.4): Third-Party Cleanup + Security Headers (BP 88 → 100)
**Codex-Korrektur 2026-05-12 + Interview-Decision:** AdSense fliegt KOMPLETT raus
(User nicht zugelassen, kein Lazy-Load mehr notwendig). Pillar wurde von "AdSense
Lazy + Headers" umgebaut zu "Third-Party Cleanup + Headers".

**Problem:** AdSense-Reste laden 232 KB + 163ms main-thread BEFORE first interaction.
Plus PSI flagged: HSTS ohne `includeSubDomains`/`preload`, kein COOP, CSP nutzt
`'unsafe-inline'`.

**Lösung:**
- **AdSense komplett entfernen**: alle Script-Tags, Ad-Slot-Komponenten,
  next.config-Domain-Allows, CSP-AdSense-Sources raus
- **GA4 (Google Analytics) lazy-load**: via `next/script` mit
  `strategy="afterInteractive"`, gtag-Pattern, kein Render-Block
- **Vercel Analytics** (built-in) bleibt: ist eh leichtgewichtig
- Security Headers härten: HSTS preload, COOP same-origin, COEP credentialless
- CSP: `'unsafe-inline'` raus → **hash-basiert (sha256)** für inline `<style>`/`<script>`
  (siehe Pillar 6 CSP-Strategie). Nonce-Variante wurde verworfen weil sie ISR
  brechen würde (verifiziert via Next.js Docs in Codex-Round-3-Review).

**Acceptance:**
- Network-Tab zeigt KEINE Requests zu `pagead2.googlesyndication.com`,
  `googleads.g.doubleclick.net`, `partner.googleadservices.com`
- `next.config.ts` enthält keine AdSense-bezogenen Domain-Allows oder Image-Patterns
- Repo-Grep `grep -r "adsbygoogle\|googlesyndication\|google_ad_client"` zeigt 0 Treffer
- securityheaders.com Score = A+
- mozilla observatory Score >= 90

**Impact:** -232 KB transfer (AdSense weg), **+12 BP-Punkte**

### Pillar 6: Critical CSS Inline + 221 KB Bundle abspecken
**Problem:** 32 KB CSS-chunk blockiert FCP für 260ms. Tailwind v4 sollte <20 KB gzipped sein — der hohe Wert deutet auf nicht-gepurgten Bloat hin.

**Lösung:**
- Lokale CSS-Audit (CMD: siehe Quick Commands unten — PowerShell-Variante)
- Critical CSS extraction — above-the-fold (~3 KB) inline im `<head>`, rest deferred
- Tailwind-classes audit auf @apply-Wildcards in custom CSS

**CSP-Strategie für inline `<style>` — ARCHITEKTUR-DECISION (Codex-Round-3-Block):**

**Problem:** Per-Request-Nonce via `headers()` opt-in't `/` in dynamic rendering
und macht ISR `revalidate=3600` unwirksam. Codex-Round-3 hat das mit Next.js-Docs
verifiziert: nonce-basiertes CSP setzt dynamic rendering voraus.

**Authoritative Decision (2026-05-12):** **Hash-basiertes CSP, NICHT nonce.**
ISR-Cache hat Vorrang weil Pillar 7 explizit auf Edge-Cache abzielt (+5 Punkte).

**Implementation (Codex-Round-4 — Drift-Prevention):**

**Single Source of Truth: `src/lib/critical-css.ts`**
```ts
// Single source of truth — diese const wird sowohl in <style> inlined als
// auch zur Hash-Berechnung verwendet. Kein zweiter Speicherort.
export const CRITICAL_CSS = `
/* above-the-fold styles ~3KB */
:root { --color-bg: #0a0a0c; ... }
body { ... }
/* ... */
`;
```

**Build-Time-Hash-Generation: `scripts/compute-csp-hash.mjs`**
- Importiert `CRITICAL_CSS` aus `src/lib/critical-css.ts`
- Berechnet SHA-256 + base64
- Schreibt zu `.env.production` als `NEXT_PUBLIC_CRITICAL_CSS_HASH=...`
- Wird vor `next build` ausgeführt (`prebuild` npm-script-Hook)

**Build-Verification-Check: `scripts/verify-csp-hash.mjs`**
- App-Router-Build-Artifacts liegen NICHT immer in `.next/server/app/page.html`
  (Pfad variiert nach Next.js-Version + Route-Group-Layout). Stattdessen:
  - Resolver-Strategy: scan `.next/server/app/` rekursiv nach `.html`-Files
    die im Body den `CRITICAL_CSS`-Marker (z.B. `/* lasstreffen-critical-css */`)
    enthalten
  - ODER: Integration-Test-Variante — starte `next start` lokal im postbuild,
    HEAD-fetch `/`, extrahiere `<style>` content aus dem response, hash + compare
- Berechnet sha256 vom extrahierten Inline-CSS
- Vergleicht mit dem in `.env.production.NEXT_PUBLIC_CRITICAL_CSS_HASH` Hash
- Fail-Build mit clear error wenn mismatch
- Wird in `postbuild` npm-script-Hook ausgeführt

**Konsequenz:** Wenn jemand CRITICAL_CSS editiert ohne den Hash zu regenerieren,
fails build. Wenn jemand den Hash ändert ohne CSS-Update, fails build. Drift
ist strukturell unmöglich.
3. Header-Setzung in `next.config.ts` `async headers()` (nicht Middleware,
   weil Middleware = Edge-Function = nicht ISR-friendly):
   ```
   Content-Security-Policy: default-src 'self';
     style-src 'self' 'sha256-<CRITICAL_CSS_HASH>';
     script-src 'self' 'sha256-<GA4_INIT_HASH>' 'sha256-<SW_REGISTER_HASH>';
     img-src 'self' data: https:;
     font-src 'self';
     connect-src 'self' https://*.supabase.co https://*.google-analytics.com;
     ...
   ```
   **KEIN `'unsafe-inline'`** — alle sha256-Hashes decken die exakten Inline-Inhalte ab.

**Script-Inline-Inventar (vollständig, jeder mit eigenem Hash):**
1. **GA4-Init-Script** in `src/app/layout.tsx`:
   ```html
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-XXXXXXX');
   </script>
   ```
   Hash via `scripts/compute-csp-hash.mjs` für `GA4_INIT_HASH`.
2. **Service-Worker-Register-Script** (von fn-15.10):
   ```html
   <script>
     if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
   </script>
   ```
   Hash für `SW_REGISTER_HASH`.
3. **Critical-CSS-`<style>`-Tag** (von fn-15.6):
   Hash für `CRITICAL_CSS_HASH` (style-src).

**Alle anderen Scripts MÜSSEN external sein** (gtag.js, vercel-analytics.js,
SW-code in /public/sw.js) — kein weiteres inline-script erlaubt.
4. Inline `<style>` in `layout.tsx` braucht KEIN nonce-Attribut, der Hash
   matched den Inhalt
5. **Keine Nonce-Propagation nötig**, **keine `headers()`-Aufrufe**, **ISR bleibt
   intakt**
6. Falls später dynamic-server-rendered Scripts dazukommen die nicht-statisch
   sind: deren Hashes auch in die CSP. Falls völlig dynamic Inline-Content:
   für jene EINE Route opt-in dynamic rendering, NICHT für die Landing.

**Trade-off:** Hash-CSP ist weniger flexibel als Nonce (Build-Time-Hash muss zu
Runtime-Content matchen), aber ISR-kompatibel.

**Impact:** FCP -200ms, **+5 Punkte**

### Pillar 7: ISR + Edge-Cache reaktivieren
**Problem:** Vercel sendet `Cache-Control: no-store` auf `/` weil `AuthRedirectGate` cookies liest → Edge-Cache umgangen.

**Lösung:**
- Auth-Logic vollständig aus `page.tsx` raus
- Vercel Routing Middleware sniffe `sb-access-token` cookie via `request.cookies.has()` — kein supabase-call
- Wenn vorhanden → `NextResponse.redirect('/feed')` am Edge
- `page.tsx` wird komplett statisch + ISR `revalidate=3600`
- Anonyme Visitors sehen Landing in <100ms vom CDN-Edge

**Impact:** TTFB -200-500ms cold, <50ms warm, **+5 Punkte**

### Pillar 8: Self-hosted Fonts mit Subsetting
**Problem:** 2 woff2-files je >100 KB (Geist + Fraunces) = 266 KB Font-bytes. Kein Subsetting.

**Lösung:**
- Geist Variable: nur Latin-1 subset → 100 KB → 30 KB
- Fraunces: nur Latin-1, reduzierte Variations-Axes
- Caveat raus aus root-layout — nur in /planer
- `font-display: optional` statt `swap`
- Preload nur 1 Font (LCP-relevant)

**Impact:** -150 KB transfer, FCP -100ms

### Pillar 9: Above-fold = Pure Server Component (0 JS für Hero)
**Problem:** Hero, Stats, Tagline, Beta-Hinweis alle in `'use client'` boundary verheddert. Client-Hydration kostet TBT.

**Lösung:**
- HeroSection, LandingStats, Beta-Hinweis als pure RSCs (kein 'use client')
- NUR Search-Input + Dropdown als isolated Client-Island (`<HeroSearch>` separat, ~2 KB JS)
- **AuthRedirectGate wird in fn-15.7 KOMPLETT entfernt** (Edge-Middleware
  übernimmt den Redirect). Diese Section war ein historischer Plan-Stand
  bevor Pillar 7 fertig durchdacht war — der Gate ist in fn-15.7 weg.
- Below-fold-Sektionen mit `<Suspense>` + Streaming, aber `ssr: true` (nicht `dynamic(ssr:false)`)

**Impact:** TBT -150ms, FCP -200ms, +SEO-Wins (Sections im initial HTML)

### Pillar 10: Service Worker für Image-Cache
**Problem:** Repeat-Visitors zahlen erneut 1-3 MB Image-Bytes.

**Lösung:** Service Worker mit Workbox:
- Stale-while-revalidate für `/_next/image/*`
- Cache-first für `/static/*`
- Offline-fallback Page
- Background-sync für POSTed analytics

**Impact:** Repeat-visit LCP <500ms, Daten-Verbrauch -90%

## Out-of-Scope: fn-15.11 (Follow-up, NICHT blocking für fn-15 Closure)

**fn-15.11** ("Image-Proxy auf Cloudflare R2 + Workers, Pre-Download Top-1000 Events")
ist als Task unter fn-15 angelegt für Tracking-Kontext, **aber explizit NICHT teil der
fn-15 Acceptance-Criteria**. fn-15 darf ohne fn-15.11 done auf "done" gesetzt werden.

**Begründung (Interview-Decision 2026-05-12):** Pillar 1 (fn-15.1) wurde bewusst
auf "next/image für eigene Assets + Landing-Cards" eingegrenzt damit der Task in
realistischer Zeit (2-3 Tage) durchziehbar ist. Die schwergewichtige R2-Migration mit
Scrape-Hook-Änderung, Worker-Setup, Storage-Quota-Management gehört zu einem
eigenen Engineering-Block — sinnvollerweise eigenes Epic fn-16 oder Long-Tail-Task
nach fn-15-Closure.

**fn-15.11 darf parallel laufen falls Bandbreite da ist**, aber:
- fn-15 Closure-Bedingung "PSI >=95" wird mit Vercel Image Optimization auf 25k-Quota
  Pro-Plan gemessen — wenn das passt, ist fn-15 fertig
- R2-Migration ist Quota-Insurance + Cost-Optimierung für Long-Tail (>25k transforms/mo),
  kein Performance-Pre-Requisite

## Planning-Maturity Disclosure (für Codex-Reviewer / Operator)

**Stand 2026-05-12**: Von den 11 angelegten Tasks ist NUR fn-15.1 vollständig
ausgearbeitet (Description, Approach, Acceptance, Evidence). fn-15.2 bis fn-15.11
haben aktuell **nur Titel + Dependencies**, ihre Description/Acceptance/Evidence
sind `TBD`.

**Begründung:** JIT-Spec-Fill — wir füllen jeden Task erst kurz vor seinem Start
(im `/flow-next:work`-Flow), nicht im Voraus, weil:
1. Spec-Details für Pillar 6 (Critical CSS) müssen warten bis Pillar 5
   (Bundle-Architektur) durch ist und der CSS-Bloat-Baseline klar ist
2. Pillar 9 (RSC) hängt von Pillar 7 (Auth-Middleware) Implementation-Details ab
3. Code-Realität bei der Implementation kann den Plan informieren — pre-detailed
   Specs riskieren Wegfegen-Cycles

**Konsequenz für Acceptance des gesamten Epic fn-15:**
- fn-15-Closure setzt fn-15.1 bis fn-15.10 done voraus (jeweils mit eigenem
  Task-Verification-Contract erfüllt)
- fn-15.11 ist explizit out-of-scope (siehe Out-of-Scope Section oben)
- Jeder Task wird vor `flowctl start` durch Vorab-Spec-Fill (durch User oder
  Claude) auf den gleichen Detailgrad wie fn-15.1 gebracht

## Task Verification Contract

Jeder Task fn-15.X muss bei `flowctl done` mindestens diese Evidenzen liefern:

1. **PSI Delta**: Lighthouse-Preview-Score vor/nach (PR-Group-Granularität, nicht
   pro-Task) mit Screenshot oder JSON-Export des Mobile-Reports
2. **Bundle-Diff**: Output von `ANALYZE=true npm run build` bei Tasks mit JS-Impact
   (fn-15.3, fn-15.4, fn-15.5, fn-15.8, fn-15.9, fn-15.10) — Top-3 Chunk-Sizes vorher/nachher
3. **Component-Inventory**: Bei Tasks die Components ändern (fn-15.1, fn-15.2, fn-15.9):
   explizite Liste der geänderten Datei-Pfade mit Vorher/Nachher-Konstrukten
4. **Acceptance-Checkliste**: Alle Checkboxen in der Task-Acceptance-Section
   abgehakt mit kurzem Verifikations-Statement (Befehl + Output oder Datei-Pfad)
5. **Rollback-Plan**: 1-Satz-Statement wie der Task im Notfall rückgängig gemacht
   wird (in der Regel: Vercel-native instant-rollback, ggf. plus Datenbank-Schritte)

Tasks ohne diese Evidenzen können NICHT mit `flowctl done` geschlossen werden.

## API Contracts

### Header-Konfiguration — Codex-Round-4 finalisiert (Scope-Trennung)

**Problem identifiziert:** Global `COOP: same-origin` und `COEP: credentialless`
in `next.config.ts` würden Mapbox-Popups auf `/entdecken`, Auth-Popups auf
`/feed`, third-party Embeds auf `/admin` und ähnliche Cross-Origin-Flows
brechen — alles routes die explizit out-of-scope für fn-15 sind.

**Authoritative Scope-Decision:**

**SITE-WIDE (immer auf):**
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN`

**ROUTE-SPECIFIC (nur auf `/` exakt, keine Regex-Negation):**
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`
- `Content-Security-Policy: ...` mit sha256-Hash für inline-CSS
  (wird in fn-15.6 final gesetzt sobald CRITICAL_CSS exists)

**Andere Routes erben Vercel-Default**: kein COOP, kein COEP, kein
restriktives CSP. Damit bleiben /entdecken (Mapbox), /feed (Auth-Popup),
/auth/* (OAuth-Popup-Closing) intakt ohne Sonderregeln.

**Implementation (Codex-Round-5 — strikte Allowlist):**
In `next.config.ts` `async headers()` mit **exakt-Match auf `/`** statt
Blacklist-Negation (Blacklist würde auch `/blog`, `/events/[...]`, `/planer`
mit einschließen):
```ts
async headers() {
  return [
    {
      // COOP/COEP NUR auf der Landing-Route. Andere Routes erben
      // Vercel-Default (kein COOP/COEP) → Cross-Origin-Flows bleiben intakt.
      source: '/',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
      ],
    },
    {
      // Site-wide headers, alle Routes
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    },
  ];
}
```

**Verifikations-Pflicht in fn-15.4 Acceptance:** Manuelle Smoke-Tests gegen
/entdecken (Mapbox lädt), /feed (Auth funktioniert), /auth/callback (OAuth
Popup-Closing funktioniert) nach Header-Deploy.

### Middleware-basierte Auth-Redirect (Pillar 7) — Codex-Round-3 finalisiert

**Authoritative Cookie-Strategy (Edge-Cases & Constraints sagt "beide", API-Beispiel
sagte vorher nur "access" — jetzt synchron):**

- Supabase setzt mehrere Cookies (`sb-<project-ref>-auth-token` Hauptsache,
  manchmal `sb-access-token` + `sb-refresh-token` je nach Setup-Version)
- **Authoritative Rule**: Redirect erfolgt nur wenn der HAUPT-Auth-Token
  vorhanden ist (`sb-<project-ref>-auth-token` ODER der modernere konsolidierte
  Cookie) — präzise Cookie-Name muss bei Implementation gegen aktuelles
  Supabase-Setup verifiziert werden.
- **Stale-Cookie-Schutz**: Wenn nur `sb-refresh-token` (also Access expired)
  vorhanden ist, KEIN Redirect → User bleibt auf Landing, sieht ggf. Login-CTA.
  Server-Side-Refresh würde Dynamic-Rendering triggern und ISR brechen.

```ts
import { NextRequest, NextResponse } from 'next/server';

// Codex-Round-7-Korrektur: prüft BEIDE Cookie-Namensschemata:
//   - Modern: sb-<project-ref>-auth-token (single consolidated cookie)
//   - Legacy: sb-access-token (split-cookie-setup, älteres @supabase/auth-helpers)
// Pre-Implementation MUSS via Audit (fn-15.7 Phase 1) verifiziert werden welches
// Schema diese Anwendung tatsächlich nutzt; das Pattern hier matched beide für Robustheit.
function hasValidAuthCookie(req: NextRequest): boolean {
  for (const cookie of req.cookies.getAll()) {
    if (!cookie.name.startsWith('sb-')) continue;
    // Match modern consolidated: sb-<ref>-auth-token
    // ODER legacy split: sb-access-token (NICHT refresh-token alone)
    if (cookie.name.endsWith('-auth-token') || cookie.name === 'sb-access-token') {
      if (cookie.value && cookie.value.length > 0) return true;
    }
  }
  return false;
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/' && hasValidAuthCookie(req)) {
    return NextResponse.redirect(new URL('/feed', req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/'] };
```

**Trade-Off-Notiz**: Cookie-existence ≠ valid session. Wenn User sich abmeldet
aber Cookies aus irgendeinem Grund stale bleiben, redirected er trotzdem. Das
ist OK weil `/feed` selbst dann supabase-getUser() macht und bei invalid session
zurück auf `/auth/login` redirected.

### EventImage neue Signatur — Codex-Round-3 finalisiert

```ts
/**
 * Discriminated Union erzwingt rendering-mode-spezifische Props:
 * - fill-Mode braucht keinen width/height aber zwingend ein parent mit
 *   position:relative und fester aspect-ratio
 * - explicit-dimensions braucht width + height
 *
 * fallbackCategory steuert das server-side-Fallback-Bild aus
 * /public/category-images/{slug}.jpg wenn src null/empty ist.
 * KEIN onError — EventImage ist pure Server Component (Pillar 9 RSC-Pflicht).
 */
type EventImageProps = {
  /**
   * Image-URL aus dem Event-Row. Kann null/empty sein wenn das Event kein Bild
   * hat — dann rendert EventImage den fallbackCategory-Placeholder.
   */
  src: string | null;
  alt: string;
  /**
   * GENAU EIN Image pro Page sollte preload=true sein (das LCP-Element).
   * Setzt `<link rel="preload">` im Head.
   * Hinweis: Next.js 16 hat `priority` deprecated zu Gunsten von `preload`
   * (siehe https://nextjs.org/docs/app/api-reference/components/image).
   */
  preload?: boolean;
  /**
   * Für 1-2 weitere above-fold Images: 'high' setzt fetchpriority attribute
   * auf <img>. Per Next.js-Docs: "In most cases, you should use loading=eager
   * or fetchPriority=high instead of preload."
   */
  fetchPriority?: 'high' | 'auto';
  /**
   * Loading-Strategie. Default = 'lazy'. Setze 'eager' für above-fold Images
   * die nicht das LCP-Element sind (LCP nutzt preload).
   */
  loading?: 'eager' | 'lazy';
  /** Responsive sizes string, verpflichtend bei fill und bei dimension-mode. */
  sizes: string;
  className?: string;
  /**
   * Fallback bei 4xx/5xx auf /public/category-images/{fallbackCategory}.jpg.
   * Wird auf Lower-Case + Slug-Style normalisiert ('Märkte & Feste' →
   * 'maerkte-feste'). Default: 'sonstiges' wenn nicht angegeben.
   */
  fallbackCategory?: string;
} & (
  | { fill: true; width?: never; height?: never }
  | { fill?: false; width: number; height: number }
);
```

**Category → Filename Normalization (für Fallback-Lookup):**
- Lowercase
- ä→ae, ö→oe, ü→ue, ß→ss, ' '→'-', '&'→'-'
- Mehrfach-`-` reduzieren auf einfach
- Trim
- Beispiele:
  - "Märkte & Feste" → "maerkte-feste"
  - "Wissen & Karriere" → "wissen-karriere"
  - "Sonstiges" → "sonstiges" (default fallback)
- Falls Datei nicht existiert → `/public/category-images/sonstiges.jpg`

**Default-Fallback-Coverage (Pre-Requisite für Pillar 1):**
Vor dem Component-Rollout MUSS für alle 11 Hauptkategorien (siehe
`enrichment-taxonomy.ts PRIMARY_CATEGORIES`) ein Bild in
`/public/category-images/{slug}.jpg` existieren plus `sonstiges.jpg`.
Audit + ggf. neue Bilder anlegen wird Teil von Phase 1 in fn-15.1.

## Edge Cases & Constraints

- AdSense lazy-load darf revenue nicht beeinträchtigen — IntersectionObserver auf erstem Ad-Slot mit 200px rootMargin
- Vercel Image Optimization Cache: 30 Tage TTL, kann pro account 5000 unique transformations haben — bei vielen scraper images könnte das wichtig werden
- CSP nonce + Next.js 16: muss in middleware generiert werden, nicht in page.tsx
- Service Worker auf Vercel: muss auf eigener Route gehostet werden (`/sw.js`), nicht in `_next/static`
- Auth-cookie sniffing: Authoritative Rule ist in API Contracts → "Middleware-basierte
  Auth-Redirect (Pillar 7)". Kurz: Redirect nur bei Hauptsache-Cookie (`sb-*-auth-token`),
  refresh-only-state triggert KEINEN Redirect (würde Dynamic-Rendering brauchen)
- ISR `revalidate=3600` darf keinen User-spezifischen Content cachen — falls Stats-Counter user-bezogen werden, separate Component
- Browser-targets cuts off: prüfen ob existing user-base wirklich modern browsers nutzt (analytics-check)

## Acceptance Criteria

### Performance Metrics
- [ ] PSI Mobile Performance Score >= 95
- [ ] PSI Mobile Best Practices Score = 100
- [ ] LCP Lab <= 2.0s
- [ ] CLS Lab <= 0.05
- [ ] TBT Lab <= 100ms
- [ ] Total Network Payload < 1.5 MB
- [ ] Initial JS Bundle < 150 KB gzipped

### Architecture
- [ ] Landing-Cards durch `next/image` (kein `<img>` mehr in: WeeklyHighlights,
      RegionExplorer, PopularCategories, FestivalBlogSection, FeaturedEvents,
      EventImage). Event-Detail-, Blog- und Map-Komponenten EXPLIZIT
      out-of-scope für fn-15.1.
- [ ] AnimatedLayout entfernt, framer-motion KOMPLETT raus aus package.json
      (oder bewusst nur auf /planer Route scoped), page-transitions via CSS
      view-transition mit Firefox-Fallback
- [ ] Auth-Logic raus aus root-layout, AuthProvider NUR auf: `/feed`,
      `/profile`, `/saved`, `/freunde`, `/messages`, `/admin/*`,
      `/groups/[id]/*` (private)
- [ ] Mapbox-Code nicht im Landing-bundle (verifiziert via bundle-analyzer),
      Landing hat nur Link/Button zu /entdecken
- [ ] **AdSense komplett entfernt** (kein Lazy-Load, kein Embed) —
      verifiziert via repo-grep + Network-Tab
- [ ] HSTS preload, COOP same-origin, COEP credentialless headers gesetzt
- [ ] CSP hash-basiert (sha256) für inline `<style>`/`<script>` (kein 'unsafe-inline',
      kein nonce — wurde wegen ISR-Inkompatibilität verworfen)
- [ ] Critical CSS inline manuell im layout.tsx `<style>` (~3 KB), rest deferred
- [ ] Auth-Middleware redirected logged-in users am Edge (cookie sniffing,
      kein Supabase-getUser-Call)
- [ ] ISR `revalidate=3600` aktiv (Cache-Control: public, max-age=0, must-revalidate)
- [ ] Geist + Fraunces self-hosted via `next/font/local` (woff2 in /public),
      Geist Latin-1 subset preloaded
- [ ] Caveat-Font komplett raus aus root-layout
- [ ] HeroSection, LandingStats als pure RSC (kein 'use client'),
      Search-Input als isoliertes Client-Island
- [ ] Service Worker mit Workbox installiert + cached `/_next/image/*`
      mit stale-while-revalidate 30d TTL, Hybrid-Banner Update-Flow

### CrUX Field Data (28d nach deployment)
- [ ] LCP p75 <= 2.0s mobile
- [ ] FCP p75 <= 1.5s mobile
- [ ] CLS p75 <= 0.05 mobile
- [ ] INP p75 <= 100ms mobile

## Boundaries

**In Scope:**
- Landing-Page `/` und alle Card-Komponenten die dort eingebunden sind
- next.config.ts Headers + Image-Domains
- Bundle-Architektur Reorganisation
- Service Worker neu
- Browser-targets

**Out of Scope:**
- /entdecken (Mapbox-page wird nie Lighthouse 100, eigener Folge-Task)
- /feed, /profile, /admin (logged-in routes haben andere Performance-Anforderungen)
- Server-side performance (Supabase queries, RPC-calls) — separate fn falls nötig
- Image-CDN-Wechsel zu Cloudinary/Imgix — Vercel Image Optimization reicht erstmal
- /blog/[slug] (eigene Audit, andere Bottlenecks)

## Decision Context

**Warum Vercel Image Optimization statt Cloudinary?**
- Already on Vercel — no extra integration
- AVIF + WebP automatisch
- Aggressive Cache mit Edge-network
- Cloudinary kostet zusätzlich, marginal besser für Volumen-extreme

**Warum AnimatedLayout entfernen statt lazy-loading?**
- Page-transitions sind kein Core-Feature der App
- CSS view-transitions ist browser-native, 0 KB JS, nicht-blocking
- framer-motion in root-bundle ist 80-100 KB der "tax" für 0.25s Animation

**Warum Service Worker?**
- Repeat-visit experience massiv besser
- Background-sync für analytics + offline-page sind nice
- Workbox ist battle-tested

**Warum middleware-basierter Auth-Check statt Server Component?**
- Server Component cookie-read deaktiviert ISR komplett
- Middleware läuft am Edge VOR der page-render → cache-friendly
- 1 cookie-existence-check ist 0.1ms, vs 200ms supabase-getUser-call

**Warum Critical CSS Inline?**
- Render-blocking CSS war 310ms PSI-flagged
- Inline = kein additional request
- Above-fold CSS ist klein (~3 KB) — passt in HTML head

## Open Questions

ALLE 4 Open Questions sind in der ## Interview Decisions (2026-05-12) Section oben
beantwortet. Hier nur historisch belassen für Audit-Trail.

1. ~~Browser-Analytics-Check~~ → **Decided: direkt aggressiv chrome>=90 etc.**
2. ~~AdSense-Revenue-Impact~~ → **Decided: AdSense komplett raus (User nicht zugelassen)**
3. ~~Service Worker Update-Strategy~~ → **Decided: Hybrid Banner mit "Update verfügbar"**
4. ~~CSP Nonce in Edge Middleware~~ → **REVIDIERT 2026-05-12 (Codex-Round-3):
   Hash-basiert (sha256) statt Nonce — Nonce-Variante würde ISR brechen.**

## References

- PSI-Report Mobile (10.05.2026): Performance 45, BP 88, FCP 0.6s, LCP 4.2s, CLS 0.535, TBT 220ms
- CrUX-Felddaten (28d Mobile, real users): LCP p75 2.3s (78% gut), CLS p75 0.00 (100% gut), FCP p75 2.6s (48% gut), INP p75 86ms (97% gut)
- Echte LCP-Element: "DAS PHANTOM DER OPER" image von wien-ticket.at, 1080×726 → 238×238 displayed, lazy-loaded
- Network Payload Top: linztermine.at 2.5 MB, lasstreffen.at internal 1.1 MB, AdSense 230 KB, wien-ticket.at 275 KB

## Quick Commands

**PowerShell-Variante (Windows-Dev-Environment authoritative):**
```powershell
# Bundle-analyzer für Treemap
$env:ANALYZE="true"; npm run build

# Lokal CSS-Audit (Tailwind output minified)
npx tailwindcss -i src/app/globals.css -o $env:TEMP/test.css --minify

# PSI re-run nach changes (mit GOOGLE_API_KEY in env)
$psiUrl = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://lasstreffen.at&strategy=mobile&category=performance&key=$env:GOOGLE_API_KEY"
(Invoke-RestMethod $psiUrl).lighthouseResult.categories.performance.score

# CrUX field data check
$cruxBody = @{
  origin = "https://lasstreffen.at"
  formFactor = "PHONE"
  metrics = @("largest_contentful_paint","cumulative_layout_shift","interaction_to_next_paint")
} | ConvertTo-Json
Invoke-RestMethod -Uri "https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=$env:CRUX_API_KEY" -Method POST -Body $cruxBody -ContentType "application/json"
```

**Bash-Variante (Linux/Mac/CI):**
```bash
# Bundle-analyzer
ANALYZE=true npm run build

# CSS-Audit
npx tailwindcss -i src/app/globals.css -o /tmp/test.css --minify

# PSI re-run
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://lasstreffen.at&strategy=mobile&category=performance&key=$GOOGLE_API_KEY" | jq '.lighthouseResult.categories.performance.score'

# CrUX
curl -s -X POST "https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=$CRUX_API_KEY" \
  -d '{"origin":"https://lasstreffen.at","formFactor":"PHONE","metrics":["largest_contentful_paint","cumulative_layout_shift","interaction_to_next_paint"]}'
```

## Recommended Task Order

Tasks in PR-Gruppen wie in Interview-Decisions festgelegt:

| Gruppe | Tasks | Days | Inhalt |
|---|---|---|---|
| 1 | fn-15.1, fn-15.2 | 3-5 | Image Optimization (Landing-Cards) + CLS-Fix mit Skeletons |
| 2 | fn-15.3, fn-15.4 | 1-1.5 | Browser-Targets Audit + Third-Party-Cleanup (AdSense raus!) + Security-Headers |
| 3 | fn-15.5, fn-15.6 | 5-6 | Bundle-Architektur (framer-motion komplett raus, Mapbox raus aus Landing) + Critical CSS Inline |
| 4 | fn-15.7, fn-15.9 | 5-7 | ISR + Auth-Middleware + RSC-Refactor Above-fold |
| 5 | fn-15.8, fn-15.10 | 2-3 | next/font/local + Subsetting + Service Worker |

**Total: 16-22.5 Arbeitstage** für nachhaltige 95+ Score.

**fn-15.11** (Cloudflare R2 Image-Proxy) läuft parallel oder nachgelagert, NICHT
blocking für fn-15-Closure (siehe Out-of-Scope Section).

Nach jeder Gruppe: PSI-Re-Run + Bundle-Analyzer-Diff dokumentieren.

## Vorgehensweise

Wenn fn-14 Bulk-Migration durch ist + Stichprobe-QA grün:
- `/flow-next:plan fn-15-performance-renovierung-landing-psi-45` zerlegt in Tasks
- Sequenziell durchgehen mit `/flow-next:work fn-15.X` pro Task
- Nach jedem Pillar: PSI re-run, score-tracking
