# Phase 0 — Review-Report

**Datum:** 2026-04-23
**Phase:** 0 — Baseline Measurement
**Epic:** fn-13-seo-content-parity-vs-wasmachmaat
**Status:** ✅ Abgeschlossen (mit 2 dokumentierten Pending-Items)

---

## Was wurde gebaut

| Artefakt | Pfad | Zweck |
|----------|------|-------|
| Keyword-Tracking-Liste | `data/seo-baseline/keywords-tracking.json` | 50 Queries in 5 Buckets — Referenzbasis für Ranking-Monitoring |
| Snapshot-Script | `src/scripts/seo-baseline-snapshot.ts` | Read-only Snapshot-Generator, idempotent, wiederholbar |
| Baseline-Snapshot | `data/seo-baseline/2026-04-23-baseline.json` | Der initiale State — alle zukünftigen Phasen messen Deltas dagegen |
| Historie-Ordner | `data/seo-baseline/snapshots/` | Append-only Historie, beim ersten Lauf mit 1 Eintrag |
| README + Setup-Doku | `data/seo-baseline/README.md` | Erklärt was es gibt + wie GSC + GA4 nachinstalliert werden |

---

## Testfall-Verifikation

### T0.1 — sitemap.xml liefert ≥1 URL

**Ergebnis:** ✅ **BESTANDEN**
**Nachweis:**
```
$ curl -sL https://www.lasstreffen.at/sitemap.xml | grep -c "<loc>"
42615
```
Die Sitemap liefert 42.615 `<loc>`-Einträge. Deutlich mehr als die Mindestanforderung.

### T0.2 — Baseline-JSON enthält Metrics

**Ergebnis:** ✅ **BESTANDEN** (für internal analytics + DB stats)
⚠️ Search Console (GSC) Teil ist explizit auf `configured: false` gesetzt bis OAuth-Credentials verfügbar sind.

**Nachweis:** `data/seo-baseline/2026-04-23-baseline.json` enthält:
- `sitemap.url_count`: 42.615
- `database.events_total`: 157.347
- `database.events_future_published`: 70.505
- `database.events_with_embeddings`: 0
- `database.events_enriched_v2`: 18.817
- `internal_analytics.events_last_30d`: 1.568
- `internal_analytics.unique_sessions_last_30d`: 1
- `indexable_url_inventory.estimated_total`: 70.720
- `search_console.configured`: false (Blocker, siehe Pending)

### T0.3 — GA4 DebugView zeigt event_view

**Ergebnis:** ⚠️ **ALTERNATIVE LÖSUNG**
GA4 ist nicht eingerichtet. Stattdessen ist unser **internes Analytics-Tracking** (via `/api/analytics` → `analytics_events` Tabelle) aktiv. Der Snapshot zeigt 1.568 Events in den letzten 30 Tagen, also das Tracking funktioniert.

Entscheidung: GA4 erst in Phase 8 einbauen. Für SEO-Messung genügen unsere eigene Analytics-Tabelle + GSC (sobald freigeschaltet).

---

## Regression-Check — was wurde NICHT berührt

Alle folgenden Systeme wurden **nicht angerührt**:
- [x] 141 Scraper in `src/lib/scrapers/` — keine Änderung
- [x] Scrape-Pipeline (`src/scripts/scrape-pipeline.ts`) — keine Änderung
- [x] Enrichment-Pipeline (`src/scripts/enrich-openai.ts`) — keine Änderung
- [x] Taxonomie v3 (`docs/TAXONOMY.md`) — keine Änderung
- [x] Social-Layer (Planer, DM, Friends, Memories, Pinboard) — keine Änderung
- [x] Event-API (`/api/events`) — keine Änderung
- [x] Notification-Pipeline (Push, Realtime) — keine Änderung
- [x] DB-Schema — keine Migration, keine neuen Spalten

Die gesamte Phase-0-Arbeit war **rein additiv + read-only**. Commits: neue Dateien in `data/seo-baseline/` und `src/scripts/seo-baseline-snapshot.ts`. Kein bestehender Code wurde modifiziert.

---

## Wichtige Baseline-Zahlen (für Deltas)

### Content-Inventar
- **Events gesamt:** 157.347 (inkl. vergangene)
- **Events in Zukunft, published:** 70.505
- **Events mit Koordinaten:** 156.081 / 157.347 = 99%
- **Events ohne Koordinaten:** 1.266
- **Events enriched v2:** 18.817 / 70.505 = **27%** (Rest läuft noch)
- **Events mit Embeddings:** 0 / 70.505 = **0%** (`npm run build-embeddings` noch nicht ausgeführt)

### URL-Inventar
- **Sitemap-URLs (live):** 42.615
- **Geschätzte indexierbare URLs:** ~70.720 (Events + 9 Bundesländer + 110 Kategorie-Hubs + 13 Städte + 6 Student-Hubs + 52 Blog-Posts + 12 Static-Pages)
- **Sitemap deckt ab:** ~60% des geschätzten Inventars — Gap weil die Sitemap vermutlich nur published-Events zeigt, nicht alle Hub-Seiten

### Traffic (letzte 30 Tage, internal)
- **Analytics Events gesamt:** 1.568
- **Unique Sessions:** 1 (!!)
- **Top Referrer:** localhost (aka fast alles ist Dev-Traffic)

### Konkurrenz-Vergleich (wasmachma.at, Referenz)
- Events: 76.644 (wir: 70.505 — fast Parität)
- Indexierbare URLs: ~78.000 (wir: ~70.720 — fast Parität)
- Echte Google-Indexierung: vermutlich 10-15k bei ihnen, ~unknown bei uns

---

## Wichtige Funde (neu, nicht im Plan vorgesehen)

### 1. Bundesland-Daten sind inkonsistent geschrieben (Tech-Debt)
Die `events`-Tabelle enthält Bundesland-Namen in **unterschiedlichen Schreibweisen parallel**:

| Schreibweise | Count (future published) |
|---|---|
| `Niederösterreich` | 11.046 |
| `niederoesterreich` | 7.297 |
| `Oberösterreich` | 9.319 |
| `oberoesterreich` | 6.608 |
| `Tirol` | 5.196 |
| `tirol` | 3.196 |
| `Salzburg` | 3.495 |
| `salzburg` | 2.895 |
| `kaernten` | 3.866 |
| `steiermark` | 3.606 |

Effekt: Hub-Seiten wie `/[bundesland]` werden **doppelt indexiert** mit `niederoesterreich` vs `niederösterreich`-URLs, oder verlieren Events wenn der Filter auf eine Variante gated.

**Empfehlung:** In Phase 1 (URL-Rework) einen einzeiligen Normalizer-Run mitmachen, der alle Bundesländer kanonisiert. Additiv, non-destructive — überschreibt nur die Column.

### 2. Sitemap hat nur einen `<urlset>`, kein `<sitemapindex>`
Aktuell ist die Sitemap **eine einzige Datei** mit 42.615 URLs. Google mag Sitemaps <50k URLs und <50MB. Wir sind noch drunter, aber Phase 2 (+2100 Gemeinde-URLs) + Phase 3 (+250 Themen) + Phase 5 (+1000 Erlebnisse) bringt uns auf ~46k → immer noch OK, aber Phase 4 (neue Scraper) könnte uns drüber pushen.

**Empfehlung:** In Phase 2 den existingn Sitemap-Generator (`src/app/sitemap.ts`) auf Sitemap-Index-Pattern umstellen (nutzt bereits `generateSitemaps()`). Dabei bleibt die bestehende single-urlset-URL als Backward-Compat bestehen.

### 3. Production Traffic praktisch null
Nur 1 unique Session in 30 Tagen. Das bedeutet: jeder Traffic-Gewinn ist messbar. Die Baseline ist fast "frisches Blatt Papier". Deltas werden ultra-sichtbar sein.

### 4. Enrichment läuft noch
18.817/70.505 (27%) sind enriched. Der Rest läuft weiter im Hintergrund. Phase 1 kann starten während Enrichment im Hintergrund weiterläuft — die beiden kollidieren nicht.

---

## Pending / Blocker (erfordern User-Action)

### BLOCKER-1: Google Search Console Verifikation

**Was du tun musst:**
1. https://search.google.com/search-console öffnen
2. "Property hinzufügen" → "URL-Präfix" → `https://lasstreffen.at`
3. Verifizierung via DNS-TXT-Record (bevorzugt) oder HTML-Meta-Tag
4. Sobald verifiziert: screenshot oder „Done"-Signal an mich

**Warum wichtig:** Ohne GSC wissen wir **nicht wie viele URLs Google überhaupt indexiert** und können Rankings nicht messen. Ist aber nicht blockierend für Phase 1 — wir können parallel arbeiten.

### BLOCKER-2: GSC API Service Account (nach Verifikation)

Nach GSC-Verifikation:
1. Google Cloud Console → IAM → Service Accounts → Create `lasstreffen-seo-reader`
2. JSON-Key downloaden, base64 encoden, als Env-Variable in `.env.local` + Vercel speichern:
   - `GSC_SERVICE_ACCOUNT_EMAIL`
   - `GSC_SERVICE_ACCOUNT_KEY_BASE64`
3. Service-Account-E-Mail zur GSC-Property als Reader hinzufügen

Danach aktualisiere ich das Snapshot-Script um GSC-Daten automatisch zu ziehen.

---

## Metrics nach +7 Tagen — zu messen am 2026-04-30

Phase-0-Baseline einfrieren, dann nach 1 Woche erneut Snapshot ziehen:

```bash
npx tsx src/scripts/seo-baseline-snapshot.ts
```

Was wir sehen sollten (ohne dass wir Phase 1 gestartet haben):
- Sitemap URLs: ±0 (Enrichment ändert nicht die URL-Liste)
- Events future published: ±10.000 (neue Scraper-Runs + Archivierung vergangener Events)
- Events enriched v2: 18.817 → ca. 30.000+ (Enrichment läuft weiter)
- Sessions 30d: ≈ 1 (kein organischer Traffic zu erwarten)

Deviation > 20% → Anomalie, Untersuchung nötig.

---

## Phase 0.5 — Critical Pre-Phase-1 Fix (added 2026-04-23 nach GSC-Check)

**Trigger:** User öffnete Google Search Console und berichtete:
- **Indexiert: 9**
- **Nicht indexiert: 45.656**

Das ist eine Indexing-Rate von **0,02%** — ein grundsätzliches Crawling-Problem, nicht ein "Hubs fehlen"-Problem. Phase 1 (URL-Rework) bringt keinen Traffic wenn Google die Seiten grundsätzlich nicht indexiert.

### Root-Cause-Analyse

Per curl-Response-Header-Check auf live Production gefunden:

| Route | Cache-Control (vorher) | Problem |
|-------|-----------------------|---------|
| `/events/[slug]` (42k URLs!) | `private, no-cache, no-store` | Google liest das als „personalisierter Content, skip indexing" |
| `/blog` | `private, no-cache, no-store` | dito |
| `/` (Landing) | `private, no-cache, no-store` | dito (user-aware, komplex — später) |
| `/blog/[slug]` | `public, max-age=86400, s-w-r=604800` | OK — next.config.ts Rule `/blog/:path*` wirkt |
| `/[bundesland]` | `public, max-age=0, must-revalidate` + `X-Nextjs-Prerender: 1` | OK — ISR aktiv |

Grund: die vier kritischen Routes haben kein `export const revalidate = ...` in ihren page.tsx. Next.js 16 rendert sie deshalb default als **dynamic on every request** und setzt `private, no-store` Header.

**Zusätzlicher Fund:** `www.lasstreffen.at` → `lasstreffen.at` ist eine `307 Temporary Redirect` statt `301 Permanent Redirect`. 307 sagt Google „die www-Version könnte vielleicht zurückkommen", Google behält beide Varianten in Erinnerung und konsolidiert Signal nicht sauber.

### Fix in diesem Commit

- ✅ `src/app/events/[slug]/page.tsx` → `export const revalidate = 3600`
- ✅ `src/app/blog/page.tsx` → `export const revalidate = 3600`
- ⏳ `src/app/page.tsx` (Landing) → **verschoben auf Phase 2**, zu komplex (user-aware redirect)
- ⏳ `www` → `root` Redirect von 307 → 301 → **zu prüfen**, läuft wahrscheinlich auf Vercel-Config-Ebene

### Erwartung nach Deploy

Nach dem Deploy (Vercel triggert automatisch auf git push master):
- `/events/[slug]` Response-Header: `public, max-age=0, must-revalidate` + `X-Nextjs-Prerender: 1` + `X-Nextjs-Stale-Time: 300` (analog zu `/[bundesland]`)
- Google sollte die Event-Seiten innerhalb 2-4 Wochen re-crawlen und indexieren
- GSC-Indexing-Count sollte von 9 auf mindestens einige Tausend steigen

### Regression-Check

- TypeScript compile: ✅ sauber (keine neuen errors)
- Layout-Änderungen: ✅ keine (nur `export const` hinzugefügt)
- DB-Queries: ✅ unverändert
- Scrape-Pipeline: ✅ unverändert
- Der einzige Unterschied ist: Next.js baut die Event-Seiten jetzt als ISR statt dynamic — identischer Output HTML, aber cacheable

### Testfälle Phase 0.5

- `T0.5.1`: `curl -sIL https://lasstreffen.at/events/<any-slug>` nach Deploy → Response enthält `X-Nextjs-Prerender: 1`
- `T0.5.2`: `curl -sIL https://lasstreffen.at/events/<any-slug>` nach Deploy → Cache-Control enthält `public` statt `private`
- `T0.5.3`: `curl -sIL https://lasstreffen.at/blog` nach Deploy → analog
- `T0.5.4`: GSC "Seitenindexierung" nach +14 Tagen → Indexiert ≥ 1.000 (von aktuell 9)

---

## Entscheidung für nächste Phase

**Phase 1 kann starten nach Phase-0.5-Deploy** (den Cache-Control-Fix erst live sehen bevor URL-Rework).

Empfehlung: 48-72h nach diesem Commit GSC-Check wiederholen, Test T0.5.1-T0.5.3 verifizieren, dann Phase 1.

**Empfehlung für Phase 1 erste Task:** URL-Rework auf `/events/[plz]-[ort]/[slug]-[shortid]`. Pipeline:

1. Route-Dateistruktur umbauen
2. Slug-Generator erweitern
3. 301-Redirect-Middleware
4. Sitemap aktualisieren
5. Alle internen Links umhängen
6. Full-site QA via Playwright
7. Phase-1-Review gegen Testfälle T1.1-T1.7

Geschätzte Dauer: 1 Arbeitstag, wenn nichts unerwartet kollidiert.

---

## User-Sign-Off erforderlich

Bevor wir Phase 1 starten, bitte bestätigen:

- [ ] Baseline-Zahlen plausibel (nix unerwartet niedrig/hoch)
- [ ] Bundesland-Duplikate-Finding akzeptiert — wir fixen sie in Phase 1
- [ ] GSC-Setup-Task akzeptiert — du machst es parallel, nicht blockierend
- [ ] OK für Phase 1 Start

Wenn alle 4 grün, gebe ich Phase 1 an.
