# fn-14-datenqualitats-rework-claude-enrichment.5 Bildqualitaet: srcset density + best-of-source + UPSERT-Guard + last_seen_at

## Description

Bildqualität fixen: srcset density-Descriptors korrekt parsen, best-of-source statt og-only Priority, CDN-Allowlist für URL-Upgrade, image_width/height beim Scrape persistieren, UPSERT-Guard "nur upgraden statt clobbern". **Plus**: `last_seen_at` write-path explizit in supabase-sync.

**WICHTIG (aus Codex-Review):**
- `extractImageUrl()` BLEIBT sync (würde sonst alle ~302 Scraper brechen). Async-Validation läuft separat im supabase-sync Schritt.
- Return-Type unverändert (`string | undefined`) — neue Methode `extractImageCandidate()` ist additiv.
- Prefetch in supabase-sync muss erweitert werden um die guard-relevanten Felder.

**Size:** M (4-5 files, 10 acceptance criteria)

**Files:**
- `src/lib/scrapers/BaseScraper.ts` (extractImageUrl bleibt sync, neue extractImageCandidate, srcset density fix)
- `src/lib/db/supabase-sync.ts` (prefetch erweitern, UPSERT-Guards, last_seen_at write, async validate-and-upgrade)
- `src/lib/scrapers/types.ts` ODER `src/types/events.ts` (ScrapedEvent additiv extend)
- `src/lib/event-images/cdn-allowlist.ts` (NEU)
- `src/lib/event-images/validate-upgrade.ts` (NEU — async helper für sync-Schritt)

## Approach

### A. Sync-Boundary respektieren
`extractImageUrl(): string | undefined` BLEIBT unverändert. Existing 302 Scraper rufen es synchron — kein Breaking Change.

**Neu, additiv**: `extractImageCandidate(): { url: string; width?: number; height?: number; score: number } | undefined`
- Sammelt alle Kandidaten (og:image, twitter:image, JSON-LD image, content `<img>`, srcset)
- Scored sie wie heute, plus density-Bonus für Retina sources
- Return type ist NEW interface, kein change zu bestehender method

Existing scrapers können freiwillig migrieren auf `extractImageCandidate()` wenn sie width/height bevorzugen wollen.

### B. srcset density-Descriptor (`2x`/`3x`)
Aktuell `BaseScraper.ts:251-267`: nimmt nur `Nw`. Erweitern:
- Parse `Nx` Descriptors auch
- Wenn nur density vorhanden: pick highest density, mark width as unknown
- Wenn `w` vorhanden: bevorzuge `w` (echter Pixel-Wert)

### C. Best-of-Source Picker (in extractImageCandidate)
- Sammelt alle Kandidaten
- og:image: base-score 4
- JSON-LD image: base-score 3
- content `<img>` size>=300w: base-score 5 wenn >800w sonst 3
- srcset largest: base-score 5
- + content-area bonus +4
- + alt-text bonus +1
- - header/footer penalty -3
- + CDN-upgradeable bonus +2 (wird in fn-14.5-validate Schritt aktiviert)

### D. CDN-Allowlist + tryUpgradeImageUrl
Neuer File `src/lib/event-images/cdn-allowlist.ts`:
- Cloudinary: regex `/res\.cloudinary\.com/` -> replace `/w_\d+/` mit `/w_2000/`
- Imgix: `imgix.net` -> set `?w=2000`
- Cloudflare Images: `imagedelivery.net` -> append `/w=2000`
- WordPress: `\.wp\.com|wp-content` -> drop `-NxN.ext` suffix

`tryUpgradeImageUrl(url): string | null` — Match -> Upgrade, sonst null (no-op für unknown CDNs).

### E. validate-upgrade.ts (async, in supabase-sync Schritt)
Neuer File `src/lib/event-images/validate-upgrade.ts`:
```pseudo
async function validateAndUpgradeImageUrl(originalUrl, originalWidth):
  upgraded = tryUpgradeImageUrl(originalUrl)
  if !upgraded: return { url: originalUrl, width: originalWidth }
  
  isValid = await validateImageUrl(upgraded, 5000)  // HEAD-check
  if !isValid: return { url: originalUrl, width: originalWidth }
  
  return { url: upgraded, width: ?? }  // dimension extract from URL pattern
```
Wird ein Mal pro UPSERT-Batch aufgerufen (mit p-limit concurrency 5 wegen HEAD requests).

### F. ScrapedEvent Interface additiv
```typescript
interface ScrapedEvent {
  // ... existing fields
  image_url?: string;          // existing
  image_width?: number;         // NEW additive
  image_height?: number;        // NEW additive
}
```

### F2. Width/Height Population — Strategie (Codex-Finding)
Damit `image_width`/`image_height` tatsächlich befüllt werden trotz sync-`extractImageUrl()`:

**1. URL-Pattern-Extraktion in `supabase-sync.ts` (sync, kostenlos):**
```pseudo
function extractDimsFromUrl(url): {width?:number, height?:number} {
  // Cloudinary: /w_1200,h_800/
  m = url.match(/\/w_(\d+),h_(\d+)\//) -> {width:+m[1], height:+m[2]}
  // Imgix: ?w=1200&h=800
  m = url.match(/[?&]w=(\d+).*[?&]h=(\d+)/) -> dito
  // WordPress: -1200x800.jpg
  m = url.match(/-(\d+)x(\d+)\.(jpg|png|webp)/) -> dito
  // Fallback: undefined dims
}
```

**2. Top-10 Scraper Migration auf `extractImageCandidate()`:**
- gem2go (46k events), gemeinden-generic (37k), feratel-deskline (26k), gemeinde-registry (30k), meinbezirk (9k), uni-Scraper, etc.
- Diese liefern HTML mit `<img width="..." height="...">` -> direkt aus Attributen extrahieren

**3. HEAD-Validation (async helper):** content-length-Heuristik kann grobe size-estimates geben aber nicht exakte Pixel.

Acceptance ist daher: "befüllt wenn aus URL-Pattern ODER HTML extrahierbar", nicht "100% für alle".

### G. supabase-sync prefetch erweitern
In `prefetchExistingRows()`: erweitere die SELECT-Liste:
```sql
SELECT id, source_name, source_id,
       image_url, image_width, image_height,
       description, enrichment_version,
       price_text,
       publish_status, ...  -- existing
FROM events WHERE (source_name, source_id) IN (...)
```

### H. UPSERT-Guards in toSupabaseRow
```pseudo
function shouldUpgradeImage(newUrl, newWidth, oldUrl, oldWidth):
  if !oldUrl: return true
  if newUrl === oldUrl: return false  // no change
  if oldWidth === null: return true   // we now know dims
  if newWidth !== null && newWidth >= oldWidth: return true
  return false

function shouldOverwriteDescription(newDesc, oldDesc, newVersion, oldVersion):
  if !oldDesc: return true
  if newDesc.length > oldDesc.length * 1.2: return true
  if oldVersion !== newVersion && newVersion === 'claude-v1': return true  // upgrade path
  return false

function shouldOverwritePrice(newPrice, oldPrice):
  return !oldPrice || oldPrice.trim().length === 0
```

Falls guard sagt "keep old": OMIT field aus upsert payload (nicht "schreibe denselben Wert zurück").

### I. last_seen_at Write Path (CRITICAL)
In `toSupabaseRow()`: füge IMMER `last_seen_at: new Date().toISOString()` zum payload hinzu. Egal ob INSERT oder UPDATE. Das ist der Anker für Soft-Delete in fn-14.6.

### J. async validate-and-upgrade aufgehängt im sync flow
In `syncEventsToSupabase()` (nach prefetch, vor toSupabaseRow):
- p-limit pool (5 concurrent)
- für jedes event: validateAndUpgradeImageUrl(scraper.image_url, scraper.image_width)
- collect upgraded urls + dims
- pass to toSupabaseRow als zusätzlicher Parameter

## Key context

- HTML srcset spec: w und x descriptors NICHT mischen
- og:image ist primär für Social Sharing (1200×630 typisch) — nicht für Hero-Sections optimal
- 30% der Scraper liefern nur og:image, kein srcset -> Fallback wichtig
- HEAD-timeout 5s ist im existing code (`validateImageUrl` in BaseScraper.ts:282-304)
- supabase-sync ist bereits async (nutzt Promise.all an mehreren Stellen) -> async helper sicher

## Acceptance

- [ ] **`extractImageUrl()` BLEIBT sync, return type unverändert** (string|undefined) — kein Breaking
- [ ] **Neue additive Methode `extractImageCandidate()`** mit return type `{url, width?, height?, score}`
- [ ] srcset Parser unterstützt density-Descriptors (1x/2x/3x), bevorzugt `w` wenn vorhanden
- [ ] CDN-Allowlist mit mind. 4 Handlern (Cloudinary, Imgix, Cloudflare Images, WordPress)
- [ ] `tryUpgradeImageUrl()` bei unbekanntem CDN -> null
- [ ] **`validateAndUpgradeImageUrl()` läuft im supabase-sync** Schritt (nicht im BaseScraper) mit p-limit 5
- [ ] HEAD-Validate vor Upgrade: bei 404/non-image -> fallback zu original
- [ ] ScrapedEvent Interface ADDITIV erweitert um `image_width?, image_height?` (kein Breaking)
- [ ] **BaseScraper exposes width/height via neue `extractImageCandidate()`** Methode; Top-10 selected scrapers assignen die Werte zu ScrapedEvent; supabase-sync persistiert sie in image_width/image_height Spalten
- [ ] **`extractDimsFromUrl()` Helper** in supabase-sync extrahiert Cloudinary/Imgix/WordPress Pattern (sync)
- [ ] **Top-10 Scraper migriert** auf `extractImageCandidate()` (gem2go, gemeinden-generic, feratel-deskline, etc.)
- [ ] **supabase-sync prefetch erweitert** um image_url, image_width, image_height, description, enrichment_version, price_text
- [ ] **UPSERT-Guard** für image_url, description, price_text — guarded fields werden OMITTED aus payload wenn guard sagt "keep old"
- [ ] **`last_seen_at = NOW()` wird bei jedem UPSERT in toSupabaseRow gesetzt** — keine Ausnahme
- [ ] Stichprobe 20 Events: Card vs. Detail-Hero qualitativ scharf (visual QA, manuell)
- [ ] Pipeline-Run: image_width/height bei Events mit URL-Pattern (Cloudinary/Imgix/WordPress) ODER HTML width/height attributes befüllt; og-only Quellen regressionfrei (kein false-NULL für ihre Bestandsdaten)

## Done summary
TBD

## Evidence
- Commits:
- Visual QA screenshots:
- Test scrape logs:
