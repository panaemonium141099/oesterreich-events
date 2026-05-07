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
Image-quality rework for the scrape→supabase-sync pipeline: extractImageUrl stays sync (no breaking change for ~300 scrapers), additive extractImageCandidate exposes width/height/score, srcset parser handles both Nw widths and Nx density descriptors with a state-machine tokeniser tolerant of comma-bearing Cloudinary URLs, CDN-allowlist provides sync URL upgrades for Cloudinary/Imgix/Cloudflare Images/WordPress with full SSRF protection (literal-IP guard + DNS resolution check + manual-redirect re-validation, IPv6 incl. IPv4-mapped covered) in the async validate-and-upgrade path, supabase-sync prefetch and toSupabaseRow apply UPSERT-Guards for image_url/image_width/image_height/description/price_text (write existing value back when guard says "keep old" so PostgREST batch shape stays uniform), last_seen_at always set, top scrapers (Gem2Go x3, GemeindeRegistry x8 incl. JSON-LD width/height, MeinBezirk, TipsAt, BurgenlandWPEvents x3, UniBaseScraper used by 56 uni scrapers) migrated to populate image_width/image_height. 14 commits, 12 review rounds, SHIP verdict.
## Evidence
- Commits: cd19beac608569f0633ff7a5c0876269b62fa674, 427afd8a75a890f06ebd643747d19a7014abef0e, 6f38f34ef2c89d8ae47eee494c0081de0dc38b30, b9c0ec667faceac89c4342b23982542d2983c09f, 69833daa327e3590cb26f095c6d0cb9287062aec, 2866c3f33555b293c8666d5e8e0a4e5e3c02d002, ab7116adb1cbcd8aedf56544fbaecdbf96121118, 9b24d160cc209f4f0548251e31ff74f63b92aa1a, 240a3e3969fcc60ab6c0d61d65a5488b5fe284b4, 6158d0a5720f5eaaa6376bee2672a1b37ddfe533, 8d241ce9ecf746fd1a7b36ea8f310a94accf70e6, 405ffd2dca4981c373f25e607f50cdb2cf8552f9, 2f6b19a19d6c8f63f6c7140cfc1ae046bcdacb06, 6baf4ee221385e55f8f0e095c0324f5c2f60ad0e
- Tests: npx vitest run src/test/baseScraper.test.ts src/test/event-images.test.ts src/test/validate-upgrade.test.ts src/__tests__/lib/supabase-sync-guards.test.ts (126 task-specific tests passing), npx vitest run (1120 passing tests overall; baseline 12 failing test files / 61 failing tests preserved unchanged), npx tsc --noEmit (4 pre-existing baseline errors; no new errors from fn-14.5 changes)
- PRs: