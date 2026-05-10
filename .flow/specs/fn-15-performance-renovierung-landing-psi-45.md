# Performance-Renovierung Landing: PSI 45 → 95+

## Status

**WAITS for fn-14 completion.** Don't start until fn-14 Bulk-Migration ist durch.

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

## Architecture & Big Wins (10 Pillars)

### 🥇 Pillar 1: Vercel Image Optimization für ALLE Event-Bilder
**Problem:** `linztermine.at` liefert 4156×2790 Pixel-Bilder (2.5 MB) für 254×160 Cards = **15× zu groß**. Native `<img>` ohne `next/image` in WeeklyHighlights, TopEvents-Carousel, FeaturedEvents, EventImage. LCP-Bild "DAS PHANTOM DER OPER" mit `loading="lazy"` (sollte priority haben).

**Lösung:**
- `EventImage.tsx` komplett auf `next/image` umschreiben
- ALLE Card-Komponenten auditieren (WeeklyHighlights, TopEvents, FeaturedEvents, BlogPreview, RegionExplorer, PopularCategories)
- `sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"` overall
- Erste 3 Cards in jedem Carousel: `priority` + `fetchpriority="high"`
- Vercel liefert AVIF+WebP, responsive widths, aggressive cache automatisch

**Impact:** -3 MB Bytes, LCP 4.2s → 1.5s, **+30 Punkte**

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

### Pillar 4: Modern Browser Targets (Polyfills entfernen)
**Problem:** 14 KB Polyfills für `Array.prototype.at`, `.flat`, `.flatMap`, `Object.fromEntries`, `Object.hasOwn`, `String.prototype.trimEnd/Start`. Alle in modern Browsers seit 2020 verfügbar.

**Lösung:** `package.json` browserslist:
```json
"browserslist": [
  "chrome >= 90",
  "edge >= 90",
  "firefox >= 88",
  "safari >= 14"
]
```
Plus `next.config.ts` modern compile target.

**Impact:** -14 KB JS, -50ms parse-time

### Pillar 5: AdSense Lazy + Security Headers (BP 88 → 100)
**Problem:** AdSense lädt 232 KB + 163ms main-thread BEFORE first interaction. Plus PSI flagged: HSTS ohne `includeSubDomains`/`preload`, kein COOP, CSP nutzt `'unsafe-inline'`.

**Lösung:**
- AdSense: `next/script` mit `strategy="lazyOnload"`
- AdSense erst nach `IntersectionObserver` auf erstem Ad-Slot
- Headers härten: HSTS preload, COOP same-origin, COEP credentialless
- CSP: `'unsafe-inline'` raus → nonce-basiert (Next.js 16 native support)

**Impact:** -200 KB transfer, **+12 BP-Punkte**

### Pillar 6: Critical CSS Inline + 221 KB Bundle abspecken
**Problem:** 32 KB CSS-chunk blockiert FCP für 260ms. Tailwind v4 sollte <20 KB gzipped sein — der hohe Wert deutet auf nicht-gepurgten Bloat hin.

**Lösung:**
- `npx tailwindcss -i src/app/globals.css -o /tmp/test.css --minify` lokaler Bare-Run
- Critical CSS extraction — above-the-fold (~3 KB) inline im `<head>`, rest deferred
- Tailwind-classes audit auf @apply-Wildcards in custom CSS

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
- AuthRedirectGate in dedicated Suspense, nicht im critical path
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

## API Contracts

### Header-Konfiguration (next.config.ts)
```ts
{
  key: 'Strict-Transport-Security',
  value: 'max-age=31536000; includeSubDomains; preload'
},
{
  key: 'Cross-Origin-Opener-Policy',
  value: 'same-origin'
},
{
  key: 'Cross-Origin-Embedder-Policy',
  value: 'credentialless'
}
```

### Middleware-basierte Auth-Redirect (Pillar 7)
```ts
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/' && req.cookies.has('sb-access-token')) {
    return NextResponse.redirect(new URL('/feed', req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/'] };
```

### EventImage neue Signatur
```ts
interface EventImageProps {
  src: string;
  alt: string;
  priority?: boolean;       // erste 3 carousel cards
  sizes?: string;           // explicit responsive
  className?: string;
  fill?: boolean;
}
```

## Edge Cases & Constraints

- AdSense lazy-load darf revenue nicht beeinträchtigen — IntersectionObserver auf erstem Ad-Slot mit 200px rootMargin
- Vercel Image Optimization Cache: 30 Tage TTL, kann pro account 5000 unique transformations haben — bei vielen scraper images könnte das wichtig werden
- CSP nonce + Next.js 16: muss in middleware generiert werden, nicht in page.tsx
- Service Worker auf Vercel: muss auf eigener Route gehostet werden (`/sw.js`), nicht in `_next/static`
- Auth-cookie sniffing: Supabase nutzt mehrere cookies (`sb-access-token`, `sb-refresh-token`) — middleware muss beide checken
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
- [ ] Alle Event-Bilder durch `next/image` (kein `<img>` mehr in `EventImage` und Card-Komponenten)
- [ ] AnimatedLayout entfernt, page-transitions via CSS view-transition
- [ ] Auth-Logic raus aus root-layout, nur in protected routes
- [ ] Mapbox-Code nicht im root-bundle (verifiziert via bundle-analyzer)
- [ ] AdSense lazy-loaded via IntersectionObserver
- [ ] HSTS preload, COOP, COEP headers gesetzt
- [ ] CSP nonce-basiert (kein 'unsafe-inline')
- [ ] Critical CSS inline (~3 KB), rest deferred
- [ ] Auth-Middleware redirected logged-in users am Edge
- [ ] ISR `revalidate=3600` aktiv (Cache-Control: public, ...)
- [ ] Geist-Font Latin-1 subset (<= 35 KB)
- [ ] Caveat-Font NUR in /planer-layout
- [ ] HeroSection, LandingStats als pure RSC (kein 'use client')
- [ ] Service Worker mit Workbox installiert + cached `/_next/image/*`

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

1. **Browser-Analytics-Check**: welche Browser-Versionen nutzen aktuelle Visitors? GA4 zeigen → entscheidet ob browserslist `chrome >= 90` zu aggressiv ist
2. **AdSense-Revenue-Impact**: lazy-load könnte impressions reduzieren — A/B-Test sinnvoll oder direkter Switch?
3. **Service Worker Update-Strategy**: skipWaiting+clientsClaim oder traditioneller Update-Flow?
4. **CSP Nonce in Edge Middleware**: Next.js 16 native support oder via headers-Function?

## References

- PSI-Report Mobile (10.05.2026): Performance 45, BP 88, FCP 0.6s, LCP 4.2s, CLS 0.535, TBT 220ms
- CrUX-Felddaten (28d Mobile, real users): LCP p75 2.3s (78% gut), CLS p75 0.00 (100% gut), FCP p75 2.6s (48% gut), INP p75 86ms (97% gut)
- Echte LCP-Element: "DAS PHANTOM DER OPER" image von wien-ticket.at, 1080×726 → 238×238 displayed, lazy-loaded
- Network Payload Top: linztermine.at 2.5 MB, lasstreffen.at internal 1.1 MB, AdSense 230 KB, wien-ticket.at 275 KB

## Quick Commands

```bash
# Bundle-analyzer für treemap
ANALYZE=true npm run build

# Lokal CSS-Audit
npx tailwindcss -i src/app/globals.css -o /tmp/test.css --minify

# PSI re-run nach changes (mit GOOGLE_API_KEY in env)
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://lasstreffen.at&strategy=mobile&category=performance&key=$GOOGLE_API_KEY" | jq '.lighthouseResult.categories.performance.score'

# CrUX field data check
curl -s -X POST "https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=$CRUX_API_KEY" \
  -d '{"origin":"https://lasstreffen.at","formFactor":"PHONE","metrics":["largest_contentful_paint","cumulative_layout_shift","interaction_to_next_paint"]}'
```

## Recommended Task Order

1. fn-15.1 Image Optimization (biggest win, 2-3 days)
2. fn-15.2 CLS Stabilisierung (1-2 days, trivial)
3. fn-15.3 Browser-Targets + Polyfills weg (0.5 day)
4. fn-15.4 AdSense Lazy + Security Headers (1 day)
5. fn-15.5 Bundle Architektur (3-4 days, größte Investition)
6. fn-15.6 Critical CSS (2 days)
7. fn-15.7 ISR + Auth-Middleware (2-3 days)
8. fn-15.8 Fonts Subsetting (1 day)
9. fn-15.9 RSC-Refactor Above-fold (3-4 days)
10. fn-15.10 Service Worker (1-2 days)

**Total: 16-22 Arbeitstage** für nachhaltige 95+ Score.

## Vorgehensweise

Wenn fn-14 Bulk-Migration durch ist + Stichprobe-QA grün:
- `/flow-next:plan fn-15-performance-renovierung-landing-psi-45` zerlegt in Tasks
- Sequenziell durchgehen mit `/flow-next:work fn-15.X` pro Task
- Nach jedem Pillar: PSI re-run, score-tracking
