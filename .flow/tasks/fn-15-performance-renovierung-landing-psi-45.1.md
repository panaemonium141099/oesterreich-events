# fn-15-performance-renovierung-landing-psi-45.1 Image Optimization: next/image für Landing-Cards (LCP 4.2s → 1.5s)

## Description

PSI Mobile Lab-LCP ist 4.2s, primärer Treiber sind unoptimierte 3rd-Party-Images
(`linztermine.at` liefert 4156×2790 = 2.5MB für 254×160 Card-Slots, das ist 15×
zu groß). PSI flagged das LCP-Element als `loading="lazy"` obwohl es above-fold
ist — sollte preload haben.

**Diese Task konvertiert Landing-spezifische Card-Komponenten auf `next/image`,**
inklusive der dominierenden third-party gescraped URLs (~95% der Card-Bilder).
Diese werden via Vercel Image-Optimization proxied (`images.remotePatterns`
Whitelist). Event-Detail-Page, Blog, Map und R2-Migration sind out-of-scope.

PSI/LCP-Metriken werden auf **Gruppen-Ebene (1+2)** validiert, nicht
task-level — fn-15.1 alleine darf knappere oder fehlende Score-Wins haben
solange die Migration korrekt ist (siehe Acceptance).

**Files (Landing-scope):**
- `src/components/Events/EventImage.tsx` (zentrale Image-Component)
- `src/components/Landing/WeeklyHighlights.tsx`
- `src/components/Landing/RegionExplorer.tsx`
- `src/components/Landing/PopularCategories.tsx`
- `src/components/Landing/FestivalBlogSection.tsx`
- `src/components/Events/FeaturedEvents.tsx`
- `src/components/Events/TopEventsCarousel.tsx` (falls auf Landing eingebunden)
- `next.config.ts` — `images.remotePatterns` für ~20+ Scraper-Hosts erweitern

**Size:** M (~2-3 Tage)

## Approach

### Phase 0: LHCI + Bundle-Analyzer Infrastructure (Codex-Round-7 vorgezogen, 2h)

**Wird in fn-15.1 etabliert weil fn-15.1 selbst LHCI für Group-1-Acceptance braucht:**
- `.lighthouserc.json` mit thresholds aus Epic `Performance Budget` eingecheckt:
  ```json
  {
    "ci": {
      "collect": { "numberOfRuns": 3, "settings": { "preset": "mobile" } },
      "assert": {
        "assertions": {
          "categories:performance": ["error", { "minScore": 0.90 }],
          "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
          "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
          "categories:performance.95": ["warn", { "minScore": 0.95 }]
        }
      }
    }
  }
  ```
- GitHub Action (`.github/workflows/lhci.yml`) triggert auf jeder PR, läuft
  gegen Vercel-Preview-URL, uploaded Artifact, fail-merge bei Hard-Threshold
- `next.config.ts` `@next/bundle-analyzer` aktiviert via `ANALYZE=true`-Flag
- `package.json` script: `"analyze": "ANALYZE=true next build"` existiert
  (oder analog für PowerShell-Dev)

### Phase 1: Audit (2-3h)
1. Bundle-analyzer-Baseline: `$env:ANALYZE="true"; npm run build` → Treemap
   speichern für Diff
2. `<img>`-Inventar:
   ```powershell
   rg -n "<img\s" src/components/Landing src/components/Events
   ```
3. PSI-Baseline-Snapshot der Production-URL (für Group-Level-Vergleich später)

### Phase 2: EventImage-Rewrite mit EINEM Placeholder-Design (4-6h)
1. EventImage als next/image-Wrapper umschreiben:
   ```ts
   interface EventImageProps {
     src: string;
     alt: string;
     preload?: boolean;       // genau 1 LCP-Image pro Page (Next.js 16 preload-prop, ersetzt deprecated priority)
     fetchPriority?: 'high' | 'auto';
     loading?: 'eager' | 'lazy';
     sizes?: string;
     className?: string;
     fill?: boolean;
   }
   ```
2. **EINE einheitliche Placeholder-Strategy** (Codex-Round-2-Korrektur):
   - Generic SVG-Gradient als `data:` URL (10×10 base64, ~200 bytes)
     hardcoded als CONST in EventImage → konsistent für ALLE remote images
   - KEINE pro-Image plaiceholder/sharp-Generation (das ist fn-15.11)
3. **Graceful Fallback-Contract — Codex-Round-6 finalisiert (kein onError, RSC-pure):**

   **Authoritative Design:** EventImage ist Server Component. Caller liefert
   `src` als string (URL aus Event-Row) oder `null` (wenn Event keinen Image-URL
   hat). EventImage rendert dann statisches Fallback aus category-images.
   **KEIN Runtime-onError, KEIN useState, KEINE Client-Component.**

   ```tsx
   // EventImage = pure Server Component
   export function EventImage({ src, fallbackCategory, ...props }: EventImageProps) {
     const safeSrc = src && src.trim().length > 0
       ? src
       : `/category-images/${normalizeCategory(fallbackCategory)}.jpg`;
     return <Image
       src={safeSrc}
       placeholder="blur"
       blurDataURL={GENERIC_BLUR_DATA_URL}
       {...props}
     />;
   }
   ```

   **Konsequenz für broken-remote-URLs (4xx/5xx zur Laufzeit):**
   - Bei kaputten URLs zeigt next/image standardmäßig nichts / das alt-Text.
     Das ist akzeptabler Trade-Off für RSC-pure.
   - **Health-Check der image_url-DB-Spalte ist EXPLIZIT OUT-OF-SCOPE für
     fn-15.1** (würde Scope sprengen, Backend-Pipeline-Arbeit).
   - Falls später nötig: separater Task fn-15.12 oder Teil von fn-15.11
     (R2-Migration sowieso health-check-fähig).

4. Local Fallback-Images in `/public/category-images/` müssen für alle 11
   Hauptkategorien existieren — Audit + ggf. fehlende anlegen.
   **Coverage-Audit-Skript** (PowerShell):
   ```powershell
   $cats = @('musik','nightlife-party','kultur-buehne','maerkte-feste',
             'wellness-spiritualitaet','sport-bewegung','natur-abenteuer',
             'wissen-karriere','familie-kinder','community-freizeit',
             'essen-trinken','sonstiges')
   foreach ($c in $cats) {
     if (-not (Test-Path "public/category-images/$c.jpg")) {
       Write-Warning "MISSING: public/category-images/$c.jpg"
     }
   }
   ```

### Phase 3: Card-Components migrieren (6-8h)
Pro Komponente:
1. `<img>` → `<EventImage>`
2. `sizes` setzen:
   - Card-Grid 4-cols: `"(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"`
   - Hero-Card single: `"(max-width: 768px) 100vw, 50vw"`
3. **Priority-Strategie nach Layout-Rule (kein Hardcode)** —
   Codex-Round-2-Korrektur:
   - Die **erste Card der obersten sichtbaren Landing-Section** bekommt
     `preload + fetchPriority="high"` — das ist der LCP-Candidate
   - Die nächsten 1-2 Cards in derselben Section: `fetchPriority="high"`,
     KEIN preload
   - Alle Cards in below-fold Sections: default lazy
   - Implementation via index-prop oder Section-internal `isLcpCandidate`-Flag

### Phase 4: External-URL-Patterns whitelist (1.5h)
**Codex-Round-3-Korrektur:** Host-only allowlist reicht NICHT — Next.js
`images.remotePatterns` matched auf protocol + hostname + port + pathname +
optional search. Wir brauchen **URL-Shape-Inventar pro Source**, nicht
nur Hostnamen.

URL-Shapes-Audit via Postgres — **narrow auf Landing-Card-Queries**
(Codex-Round-6-Korrektur, war "alle Events"):

```sql
-- WHERE-Filter matched die SELECT-Logic der Landing-Card-Komponenten:
-- WeeklyHighlights/FeaturedEvents nutzen ORDER BY event_score DESC, future,
-- published. Wir whitelisten nur Hosts die TATSÄCHLICH auf Landing erscheinen.
SELECT
  substring(image_url FROM '^(https?)://') AS protocol,
  substring(image_url FROM '^https?://([^/]+)') AS host,
  substring(image_url FROM '^https?://[^/]+(/[^?]*)') AS path_pattern,
  CASE WHEN image_url LIKE '%?%' THEN 'yes' ELSE 'no' END AS has_query,
  count(*) AS occurrences,
  min(image_url) AS sample_url
FROM events
WHERE image_url IS NOT NULL
  AND start_date >= NOW()
  AND publish_status = 'published'
  AND event_score IS NOT NULL
  -- Top 500 Events nach Score reichen für Landing-Coverage
  -- (WeeklyHighlights ~12, FeaturedEvents ~20, etc.)
GROUP BY 1, 2, 3, 4
ORDER BY occurrences DESC
LIMIT 50;  -- Top-50 Host-Patterns reicht für Landing
```

Pro Source-Host entscheiden:
- **Strict pattern** (z.B. `/uploads/**` only): wenn Source nur ein Pfad-Schema nutzt
- **Permissive** (`/**`): wenn Source viele Pfade nutzt und unkritisch
- **Query strings (Codex-Round-4-präzisiert):** `search` field NUR setzen wenn
  Production-URLs tatsächlich Query-Strings nutzen UND exact-matching gebraucht
  wird. **Default-Verhalten**: `search` weglassen — Next.js matched dann nur
  Pfade ohne Query-String, was für die meisten Image-CDNs richtig ist.
  - Falls Image-URLs Query-Cache-Buster nutzen (`?v=12345`): trotzdem
    `search` weglassen — Next.js Image-Optimizer normalisiert Query-Strings weg
  - Konkretes Setzen von `search` nur bei dokumentiertem Bedarf
- **Redirects (Codex-Round-4):** Falls Host A nach Host B redirected
  (z.B. CDN-Roundabouts), BEIDE whitelisten weil Next/Image die ursprüngliche
  URL fetched, dann dem Redirect folgt — Pattern auf beiden Hosts nötig.

Beispiel-Entry in `next.config.ts`:
```ts
{
  protocol: 'https',
  hostname: 'linztermine.at',
  pathname: '/**',
  // `search` intentionally omitted — exact behavior is "match all paths,
  // ignore query strings". Confirmed against Next.js 16 docs.
}
```

**Smoke-Test-Procedure (replaced "all hosts present" Acceptance):**
Für jeden whitelisted Host: 3 zufällige Production-Image-URLs (aus DB-Query
mit `LIMIT 3 PER host`) durch lokale `next dev` rendern. Erwartetes Ergebnis:
- HTTP 200 vom `/_next/image?url=...` Endpoint
- Returned content-type `image/webp` oder `image/avif`
- Kein 400 "url parameter is not allowed"

Fail → Pattern fixen (pathname zu permissiv/restriktiv) oder ggf. `search`
field hinzufügen falls Query-Strings tatsächlich nötig sind.

### Phase 5: Verifikation (2-3h)
- `$env:ANALYZE="true"; npm run build` → Bundle-Diff dokumentieren (kein neuer
  Chunk erwartet, next/image ist built-in)
- Visual-Regression manuell: Landing scrollen auf Desktop + Mobile, keine
  broken images, blur-Placeholder kurz sichtbar während Load

## Key context

- Vercel Image Optimization Pro-Plan: 5000-25000 unique transforms/Monat. Bei
  ~10k Events × Sizes könnte das knapp werden. Long-Tail-Optimierung in fn-15.11.
- next/image `placeholder="blur"` braucht `blurDataURL` als `data:` URI ODER
  static-imported image. Wir nutzen die Static-Variante als globalen Default.
- Externe URLs OHNE `images.remotePatterns`-Whitelist werfen Build-Time-Errors —
  Whitelist ist mandatory.
- `onError`-Handler bei next/image-`fill`-Mode bekannt brüchig — testen.

## Acceptance (task-level, NO PSI-Metriken hier — die gehören zu Group (1+2))

- [ ] Alle 6+ Landing-Card-Komponenten nutzen `next/image` via `EventImage`-Wrapper.
      PowerShell-Verifikations-Befehl (keine bash brace expansion):
      ```powershell
      rg -n "<img\s" src/components/Landing/ src/components/Events/EventImage.tsx src/components/Events/FeaturedEvents.tsx src/components/Events/TopEventsCarousel.tsx
      ```
      → zeigt 0 Matches.
- [ ] EventImage exportiert exakt die Props-Signatur aus Epic `API Contracts →
      EventImage neue Signatur`:
  - Discriminated Union: entweder `fill: true` ODER `width: number + height: number`
    (TypeScript-Compiler erzwingt das)
  - `preload?: boolean` (Next.js 16 preload-prop, ersetzt deprecated `priority`)
  - `fetchPriority?: 'high' | 'auto'`
  - `loading?: 'eager' | 'lazy'`
  - `sizes: string` (verpflichtend)
  - `fallbackCategory?: string` mit Slug-Normalization gemäß Epic-Spec
  - Default-Fallback `sonstiges.jpg` wenn fallbackCategory missing
- [ ] Slug-Normalization-Helper implementiert: `normalizeCategory("Märkte & Feste")`
      → `"maerkte-feste"`, gemäß Epic-Rules (ä→ae, ö→oe, ü→ue, ß→ss, '&'→'-')
- [ ] **ALLE 11 Hauptkategorien + sonstiges.jpg** existieren in
      `/public/category-images/` — verifiziert via PowerShell-Audit-Skript
      aus Phase 1b. Fehlende Bilder müssen angelegt sein BEFORE Component-Rollout.
- [ ] **GENAU 1** Image-Element pro Landing-Page hat `preload + fetchPriority="high"`
      (verifizierbar via View-Source: nur 1 `<link rel="preload" as="image">` mit
      `fetchpreload="high"`)
- [ ] Max 2 zusätzliche above-fold Images haben `fetchPriority="high"` (kein preload)
- [ ] `next.config.ts` `images.remotePatterns` ist gegen die Postgres-Query
      verifiziert via **Path-Level-Smoke-Test (Codex-Round-7-Pflicht):**
      Für jeden Host aus dem Audit-Output:
  - Mindestens 3 zufällige Production-URLs durch `/_next/image?url=...&w=640&q=75`
    rendern (lokales `next dev` oder Vercel-Preview)
  - Erwartetes Resultat: HTTP 200 + content-type `image/webp` oder `image/avif`
  - Wenn 400 "url not allowed": pathname-Pattern in remotePatterns zu restriktiv
    → erweitern oder `/**` setzen
  - Wenn 502/500: Source-Host blockt Vercel-Optimizer → fallback acceptance:
    in Audit-Output dokumentieren, ggf. via `unoptimized={true}` für jenen Host
  - Resultate als Tabelle in `.flow/evidence/fn-15.1-image-hosts.txt` speichern
- [ ] EINE einheitliche generic Placeholder-Strategy für alle remote images
      (kein per-image plaiceholder)
- [ ] Server-side null/empty Fallback funktioniert: wenn `src` null/leer ist,
      rendert EventImage `/public/category-images/{fallbackCategory}.jpg`
      (verifiziert via Unit-Test mit `src={null}`)
- [ ] EventImage hat KEIN `'use client'` directive — bleibt Server Component
- [ ] Build erfolgreich ohne next/image-Errors: `npm run build` ohne Error-Output
- [ ] Bundle-Analyzer-Diff zeigt keine unerwarteten neuen Chunks
- [ ] Keine visuell-broken Images auf Landing (Desktop + Mobile manuelle Sichtung)

## Group-Level Acceptance (fn-15.1 + fn-15.2 zusammen)
*(Wird im finalen Group-PR validiert, NICHT in dieser Task)*

- [ ] PSI Mobile LCP Lab <= 2.0s (von 4.2s baseline)
- [ ] PSI Mobile Performance Score >= 65 nach Group (1+2) (von 45 baseline,
      d.h. +20 Punkte als Zwischenstand auf dem Weg zu 95+)
- [ ] CLS <= 0.1 (Verifikation aus Group, hauptsächlich fn-15.2 driven)

## Evidence (mandatory bei flowctl done)

- **Commits**: Hash + Message für die Card-Component-Migrations
- **Component-Inventory**: Liste der geänderten Dateien mit
  Vorher/Nachher-Snippets (Title-Card-Image + Hero-Card-Image als
  Repräsentanten) → `.flow/evidence/fn-15.1-components.md`
- **Bundle-Diff**: Treemap vor/nach Build → `.flow/evidence/fn-15.1-bundle-diff.md`
- **External-Domain-List**: Postgres-Query-Resultat mit allen whitelisted hosts
  → `.flow/evidence/fn-15.1-image-hosts.txt`
- **PSI-Delta für Gruppe (1+2)**: nach fn-15.2 Closure, NICHT hier
- **Rollback-Plan**: "Vercel-Dashboard → instant rollback zu vorherigem
  Production-Deploy. Kein DB-Schritt nötig."

## Done summary
Rewrote EventImage as a pure Server Component wrapping next/image with a generic SVG blur placeholder; migrated all Landing-card components (WeeklyHighlights, RegionExplorer, PopularCategories, FestivalBlogSection) plus 14 out-of-scope EventImage callers to the new required `sizes` API, marked WeeklyHighlights[0] as the LCP candidate (preload + fetchPriority=high), and added Lighthouse CI infrastructure (`.lighthouserc.json` + `.github/workflows/lhci.yml`). 23/23 EventImage tests passing, build green, codex impl-review SHIP after 2 fix rounds.
## Evidence
- Commits: 449346c, 5d5baea, 7b3c754
- Tests: npx vitest run src/__tests__/components/EventImage.test.tsx (23/23 passing), npx tsc --noEmit (clean for fn-15.1 code), npm run build (production build green)
- PRs: