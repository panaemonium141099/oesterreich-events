# SEO + Content Parity vs wasmachma.at — additiv, non-destructive

## Goal & Context

**Ziel:** organischen Google-Traffic auf lasstreffen.at innerhalb **8 Wochen** auf Parität mit wasmachma.at bringen, innerhalb **3 Monaten** strukturell überholen. Als Nebenprodukt: konkurrenzfähiges Google-Ads-Setup und AI-Search-Sichtbarkeit (ChatGPT, Perplexity, Claude).

**Ausgangslage (April 2026):** Nach der Competitive-Recon von wasmachma.at ist klar: der Konkurrent rankt **nicht** durch besseren Tech-Stack (Vanilla PHP + jQuery + Leaflet auf Shared Hosting) oder bessere strukturierte Daten (null JSON-LD, keine OG-Bilder, keine Meta-Descriptions auf Hub-Seiten). Er rankt durch drei Dinge:

1. **URL-Struktur mit PLZ + Ort** in jeder Event-URL: `/event/4020-linz/spaetsommerfest-2026-5647419`
2. **Massive Hub-Architektur**: ~800 Gemeinde-URLs + ~1.300 Themen-Hub-URLs + 76k Event-URLs = **~78.000 indexierbare Seiten**
3. **Content-Volumen** aus fremder Quelle: Er scraped nicht selbst — er konsumiert `boudicca.events` (Open-Source-Aggregator) plus 3 lizensierte Partner (Basketball Austria, VHS Salzburg, Open Data Portal).

Was er **nicht** hat und wir schon: JSON-LD Event-Schema, dynamische OG-Bilder, Social-Layer (Planer/DM/Memories), Artist-Graph, Semantic Search, Mapbox-interaktive-Karte, Multi-Quelle-Scraping-Pipeline (141 Scraper), AI-Crawler-Freigabe.

**Kernprinzip:** Alles was wir jetzt bauen ist **additiv zu bestehendem Code**. Scraper-Pipeline, Taxonomy v3, Enrichment-Pipeline, Planer-UI, Social-Features — nichts davon wird verändert. Wir bauen **nur neue URLs, neue Quellen, neue Schemas, neue Hubs oben drauf**.

**Erfolgskriterium auf Portfolio-Ebene:**

Referenz-Baseline aus Phase 0 (2026-04-23, `data/seo-baseline/2026-04-23-baseline.json`):
- Sitemap URLs: **42.615** (höher als vorab geschätzt — existingr Sitemap-Generator liefert bereits Event-URLs + Static-Pages + Blog)
- DB future published events: **70.505** (zum Vergleich wasmachma.at: 76.644)
- Enriched v2: **18.817** / 70.505 = 27% (Enrichment läuft weiter, wird Baseline verbessern)
- Embeddings: **0** (build-embeddings muss einmal durchlaufen)
- Interne Analytics 30d: **1 Session** (≈ aktueller production traffic praktisch null)

Ziele nach 8 Wochen:
- **Sitemap URLs**: 42.615 → **120.000+** (durch Gemeinde-Hubs + Themen-Hubs + Erlebnisse + neue Quellen)
- **Google Search Console indexierte URLs**: unbekannt (GSC-Setup in Phase 0 pending) → **≥50.000 indexed**
- **Organic Traffic (GSC + internal analytics)**: 1 Session/30d → **≥1.000 Sessions/30d**
- **Keyword-Coverage**: unbekannt → **500+ Queries auf Top-50** (aus der 50-Query-Liste + via DataForSEO-Discovery zu tracken)
- **AI-Citability**: 0 referrals from chat.openai.com / perplexity.ai / claude.ai → **≥10 Referrals/Woche** nach Phase 7

Ziele nach 12 Wochen: Organic Traffic 3.000+ Sessions/30d, 1.000+ Top-50-Keywords, erste Medien-Erwähnung.

## Architecture & Data Models

### Additive Strategie — nichts bricht

Jede der 10 Phasen folgt demselben Muster:

| Schicht | Was wir tun | Was wir NICHT anfassen |
|---|---|---|
| Scraper | Neue Scraper-Module dazu (boudicca, opendataportal, data.wien, basketball, VHS) | Bestehende 141 Scraper, ihre Trigger, Schedule, Logic |
| DB-Schema | Neue Tabellen (`gemeinden`, `activities`, `seo_hubs`) + optionale nullable Columns | Bestehende `events`-Tabelle Struktur, Enums, Indexes |
| Pipeline | Neue optionale Schritte im Ende des `scrape-pipeline.ts` | Bestehende Steps (normalize, dedup, enrich, embeddings) |
| API | Neue Route-Handler (`/api/gemeinden/...`, `/api/erlebnisse/...`, `/api/seo/sitemap-parts/...`) | Bestehende `/api/events`, `/api/search/semantic`, etc. |
| Frontend | Neue Routes unter `/gemeinde/*`, `/thema/*`, `/erlebnisse/*` | Bestehende Routes `/events/*`, `/groups/*`, `/entdecken`, `/blog/*` |

### Neue DB-Objekte (Phase-agnostisch)

**1. `austrian_gemeinden`** — vollständige Liste aller ~2.100 österreichischen Gemeinden mit Postleitzahl, Name, Bundesland, Bezirk, Zentrums-Koordinaten, Population, slug

**2. `seo_hub_pages`** — Metadaten für jede generierte Hub-Seite (path, type, parent_id, last_rebuilt_at, event_count, indexable). Erlaubt Offline-Bau und Sitemap-Partitionierung

**3. `activities`** — Evergreen "Erlebnisse" (Museen, Escape Rooms, Freizeitparks, Thermen, Wanderwege, Zoos). Separate Tabelle weil zeitloses Konzept, nicht Events mit `is_evergreen: true` weil Query-Profile unterschiedlich

**4. `event_sources_external`** — Log aller externen Einspeisungen (boudicca, opendataportal, etc.) für Attribution und Debugging

### URL-Strategie

| Alt | Neu (additiv, 301-Redirect vom alten) |
|---|---|
| `/events/[shortid]-[slug]` | `/events/[plz]-[ort]/[slug]-[shortid]` |
| — | `/gemeinde/[plz]-[ort]` |
| `/[bundesland]` | bleibt |
| `/[bundesland]/[kategorie]` | bleibt + zusätzlich `/thema/[thema-slug]/[bundesland]` |
| — | `/erlebnisse/[plz]-[ort]` |
| — | `/erlebnisse/[plz]-[ort]/[slug]` |

Alle neuen URLs sind SSR mit statischem HTML (Next.js `generateStaticParams` wo möglich, sonst ISR mit langem revalidate).

## API Contracts

### Neue interne APIs

**`GET /api/gemeinden?plz=X`** — Gemeinde-Lookup für Autocomplete-Komponenten

**`GET /api/gemeinden/[plz-ort]/events?radius=10000`** — Events innerhalb Radius um Gemeinde-Zentrum

**`GET /api/sitemap/gemeinden.xml`** — Sitemap-Partition für alle Gemeinde-Hub-URLs (mit `lastmod`)

**`GET /api/sitemap/themen.xml`** — Sitemap-Partition für Themen-Hubs

**`GET /api/sitemap/erlebnisse.xml`** — Sitemap-Partition für Erlebnisse

**`POST /api/ingest/boudicca`** — Server-Action für Boudicca-Feed-Import (triggerbar aus Pipeline, gated hinter SCRAPE_API_KEY)

### Externe APIs die wir neu konsumieren

- **boudicca.events** — öffentliche REST-API, kein Auth, MIT-License
- **opendataportal.at** — CKAN API, CC-BY 4.0
- **data.wien.gv.at** — SODA/WFS API, CC-BY 3.0 AT
- **Statistik Austria PLZ-Liste** — CSV-Download, offiziell
- **Google Search Console API** — OAuth, für Indexing-Monitoring
- **Google Indexing API** — OAuth, für Instant-Indexing
- **IndexNow** — URL-Push an Bing/Yandex (bereits integriert)

## Edge Cases & Constraints

### Non-Destructive Garantien

- **Keine** Änderungen an existierenden Scrapern oder deren Output-Format
- **Keine** Änderungen an `events`-Tabellen-Spalten mit Semantik-Wechsel (nur neue nullable Spalten)
- **Keine** Änderungen an `enrichment_version`, `category_version`, `geocoding_source`
- **Keine** Breaking Changes an API-Routes (nur neue Routes, oder optionale Query-Parameter)
- **Alle neuen Migrations idempotent** mit `CREATE IF NOT EXISTS`, `DO $$ ... RAISE EXCEPTION IF NOT ...`
- **Jede Phase hat ein Rollback-Script**

### URL-Redirect-Sicherheit

- Alte URLs `/events/[shortid]-[slug]` müssen für **mindestens 12 Monate** als 301 auf neue URL funktionieren (Google-Signal-Erhalt)
- Kein Redirect-Loop durch fehlende Daten (PLZ unbekannt → Fallback auf altes Schema)
- Canonical-URL im `<link>` bleibt stabil (egal welche URL aufgerufen, canonical zeigt auf neue)

### Content-Qualität vs Thin-Content-Risiko

- Gemeinde-Hub mit **< 3 Events** rendert als `noindex` + zeigt Nachbar-Gemeinden (keine leere SEO-Falle)
- Themen-Hub mit **< 5 Events** rendert als `noindex` oder fällt auf Bundesland-Ebene zurück
- Erlebnis-Seiten müssen **Mindestwortzahl 300** haben (aus existingr Description + Venue-Info generiert)

### Scraping-Quellen-Lizenzen

- boudicca.events: MIT-Lizenz, Attribution nötig im Event-Detail ("Datenquelle: boudicca.events")
- opendataportal.at / data.wien.gv.at: CC-BY 4.0 resp. CC-BY 3.0 AT, Attribution nötig
- Pflicht-Felder: `source_name`, `source_url` bei jedem Event aus externer Quelle
- **Deduplication** gegen bestehende Events zwingend (Title-Fingerprint + Date + Location)

### SEO-Testbarkeit

- Jede Phase hat mindestens **3 reale Query-Tests** in Google (Site-Search, Cache, Rich-Results-Test)
- Mindestens **2 Crawler-Tests** (Googlebot simuliert via SEO-Meta SDK, Rendering-Check)
- **Baseline-Screenshot** vor jeder Phase (indexierte URLs, Keyword-Positionen) + Re-Screenshot nach +7 Tagen

## Acceptance Criteria

Die Epic besteht aus **10 Phasen**. Jede Phase hat eigene AC. Gesamt-Epic ist done wenn alle Phase-AC grün UND Traffic-Ziele (siehe Goal) erreicht sind.

### Phase 0 — Baseline Measurement (Woche 0, 2 Tage)

**Ziel:** Aktueller Zustand dokumentiert bevor irgendwas geändert wird. Ohne Baseline kein Erfolgs-Nachweis.

- [ ] Google Search Console Property `lasstreffen.at` verified
- [ ] Search Console API-Zugriff (Service Account) funktioniert, tägliche Exports in `data/seo-baseline/` laufen
- [ ] GA4 Property geprüft, Custom Events definiert: `event_view`, `event_click`, `ticket_click`, `filter_apply`, `plan_created`
- [ ] Screenshot heutige Zahlen: Impressions, Clicks, CTR, avg Position, indexierte URLs (als Baseline-JSON in `data/seo-baseline/2026-04-23.json`)
- [ ] Keyword-Tracking-Liste definiert: 50 relevante Queries (10x "Events [Stadt]", 10x "[Kategorie] [Bundesland]", 10x "Veranstaltungen [Stadt]", 10x "[Stadt] heute", 10x Long-Tail)
- [ ] Aktuelle Sitemap-URL-Count: `curl https://lasstreffen.at/sitemap.xml | grep -c "<loc>"`
- [ ] DataForSEO oder SEMrush Baseline-Report exportiert (wenn verfügbar)

**Testfälle:**
- `T0.1`: `lasstreffen.at/sitemap.xml` gibt ≥1 URL zurück — OK wenn gecrawlt durch den google-search-console Agent
- `T0.2`: `data/seo-baseline/*.json` enthält `impressions`, `clicks`, `ctr`, `position` je Query
- `T0.3`: GA4 DebugView zeigt `event_view` bei Page-Navigation

**Rollback:** nicht anwendbar — rein lesend.

---

### Phase 1 — URL-Struktur-Rework (Woche 1, 3–4 Tage)

**Ziel:** Event-URLs bekommen `[plz]-[ort]` als ersten Pfad-Segment. Das ist der einzelne größte On-Page-Hebel den wasmachma.at hat.

**Neue Struktur:**
```
Alt:   /events/a3f2e1b8-plan-name
Neu:   /events/1010-wien/plan-name-a3f2e1b8
```

- [ ] Route-Refactor: `app/events/[...slug]/page.tsx` mit Fallback-Logic (altes 2-Part-Schema weiterhin → 301 auf neues 3-Part-Schema)
- [ ] `generateEventSlug` erweitert um PLZ+Ort-Prefix (bestehendes Sanitizing + Slugging unverändert)
- [ ] Alle bestehenden Event-Links in Frontend (`EventCard`, `EventPreview`, Blog, Memories, Pinboard, Chat) generieren neue URLs
- [ ] Sitemap (`src/app/sitemap.ts`) generiert ausschließlich neue URLs
- [ ] JSON-LD `url`-Feld zeigt auf neue URL
- [ ] OG-Share-URL zeigt neue URL
- [ ] Canonical-Link auf Detail-Seite zeigt neue URL
- [ ] 301-Redirect-Middleware: alte URL → neue URL (mit DB-Lookup auf PLZ)
- [ ] Event ohne PLZ (legacy Daten, NULL postal_code) → Fallback auf Bundesland-Hauptstadt im URL-Slug (z.B. `1010-wien` default für Wien ohne PLZ)
- [ ] Alle internen Links verweisen auf neue URL (grep-Test)

**Testfälle:**
- `T1.1`: alte URL (z.B. `/events/a3f2e1b8-plan-name`) liefert 301 auf neue URL — Test via `curl -I`
- `T1.2`: neue URL rendert identische Inhalte wie alte (HTML-Diff ≤10 Zeichen) — Test via Playwright
- `T1.3`: Sitemap enthält nur neue URLs, keine alten (grep-Test)
- `T1.4`: Event ohne PLZ → URL hat Bundesland-Hauptstadt als Placeholder (Unit-Test gegen `generateEventUrl`)
- `T1.5`: Google Rich Results Test für 5 Beispiel-URLs → kein Error, Event-Schema valide
- `T1.6`: OG-Share-URL auf Facebook Debugger rendert korrekt
- `T1.7`: Internal Links Grep auf `/events/[^/]+$` liefert 0 Matches nach Phase-Ende

**Metrics nach +7 Tagen:**
- GSC indexierte URLs ±0 (keine Deindexierung durch 301)
- 5 zufällige alte URLs in GSC "Abdeckung"-Report als "redirect" erfasst

**Rollback:** Middleware-Bypass-Flag `USE_LEGACY_URLS=1`, Route-Refactor rückgängig via `git revert` der Phase-1-Commits.

---

### Phase 2 — Österreichische Gemeinden-Datenbank + Hub-Seiten (Woche 2, 5–7 Tage)

**Ziel:** Pro österreichische Gemeinde eine indexierbare Hub-Seite bauen. ~2.100 URLs neu indexierbar gemacht.

**Datenquelle:** Statistik Austria (offizielle Gemeinde-Liste mit PLZ). Alternative: post.at Open Data, oder `postleitzahl.at` HTML-Scrape.

- [ ] Migration `20260430_austrian_gemeinden.sql`: neue Tabelle `austrian_gemeinden` (plz, name, slug, bundesland, bezirk, zentrum_lat, zentrum_lng, population, katastral_gemeinde_von)
- [ ] Seed-Script `src/scripts/seed-gemeinden.ts`: lädt Statistik Austria CSV, populiert Tabelle. Idempotent.
- [ ] Route `app/gemeinde/[slug]/page.tsx` mit SSG + ISR (revalidate 6h)
- [ ] Query: Events innerhalb 10km-Radius um Gemeinde-Zentrum, ODER exakter PLZ-Match
- [ ] Hub-Content: H1 "Events in [Name]", Intro-Paragraph, Event-Grid, Themen-Pills (Musik, Sport, etc.), Nachbar-Gemeinden, Karte mit Radius-Kreis
- [ ] JSON-LD: `ItemList` mit Top-10 Events + `Place` für Gemeinde + `BreadcrumbList`
- [ ] Meta: title "Events in [Name] — heute und diese Woche | Lasst Treffen", Description dynamisch
- [ ] OG-Image: dynamic via `next/og` mit Gemeinde-Name + Event-Count
- [ ] Low-Content-Guard: <3 Events → `noindex` + zeigt "Keine aktuellen Events, siehe Nachbar-Gemeinden"
- [ ] Sitemap-Partition `app/sitemap-gemeinden.xml/route.ts` mit lastmod
- [ ] Sitemap-Index erweitert

**Testfälle:**
- `T2.1`: `/gemeinde/1010-wien-innere-stadt` rendert mit ≥5 Events (Playwright)
- `T2.2`: Strukturierte Daten via Rich-Results-Test: `ItemList` + `BreadcrumbList` valide
- `T2.3`: Gemeinde mit 0 Events (z.B. irgendein Dorf mit 200 Einwohnern) → `noindex` im Head
- `T2.4`: Sitemap-Partition lädt <2s und enthält alle Gemeinden mit Events
- `T2.5`: Lighthouse SEO-Score für 3 Gemeinde-Seiten ≥95
- `T2.6`: Meta-Description unique (kein dupliziertes Content-Risiko) — Grep-Test
- `T2.7`: OG-Image URL rendert via `curl -I` mit 200 + Content-Type image/png

**Metrics nach +14 Tagen:**
- GSC: mindestens 500 der 2100 Gemeinde-URLs crawlbar + indexiert
- Crawl-Stats: Googlebot besucht ≥1000 Gemeinde-URLs innerhalb 14 Tagen
- GA4: organic Traffic auf `/gemeinde/*` > 0

**Rollback:** Migration zurück (DROP TABLE), Route löschen, Sitemap-Partition aus Index entfernen.

---

### Phase 3 — Themen-Hubs (Woche 3, 3–4 Tage)

**Ziel:** Saisonale + Kategorie-Themen als Hub-Seiten × Bundesland (und Top-15-Städte) generieren. Replikation der wasmachma-Themen-Matrix, aber mit besserem underlying Taxonomy-System.

**Themen-Inventar (aus docs/TAXONOMY.md + wasmachma-Inventar):**
- Saisonal: Weihnachtsmärkte, Ostern, Fasching, Halloween, Bälle
- Kategorie: Festivals, Konzerte, Kabarett, Zirkus, Flohmärkte, Heurige, Yoga-Events, Laufen, Radfahren, Kino-Openair
- Zielgruppe: Studenten-Events, Familien-Events, Senioren-Events
- Occasion: Date-Night, Ausgehen, Saufen gehen, Team-Event

**Struktur:**
- `/thema/[thema-slug]` — ganz-Österreich
- `/thema/[thema-slug]/[bundesland-slug]` — Bundesland-Ebene
- `/thema/[thema-slug]/[bundesland-slug]/[stadt-slug]` — Stadt-Ebene (nur Top-15)

- [ ] Migration `20260430_seo_themen.sql`: Tabelle `seo_hub_themen` mit Thema-Definitionen + Query-Filter (occasion_tag, category, audience, vibe)
- [ ] Seed `src/scripts/seed-themen.ts`: populiert ~25 Themen mit Filter-Config
- [ ] Route `app/thema/[thema]/page.tsx` (+ 2 weitere Layer für Bundesland/Stadt)
- [ ] Query-Mapping: Thema → SQL-Filter auf events-Tabelle (Nutzung v3 occasion_tags, category, audience)
- [ ] Hub-Content: H1 dynamisch, Intro-Paragraph, Event-Grid, Bundesland-Pills, SEO-Text am Ende (ca. 150 Wörter Kontext)
- [ ] JSON-LD: `ItemList` + `BreadcrumbList`
- [ ] Meta: title dynamisch "Festivals in der Steiermark 2026 | Lasst Treffen"
- [ ] OG-Image: dynamic
- [ ] Low-Content-Guard: <5 Events → `noindex`
- [ ] Sitemap-Partition

**Testfälle:**
- `T3.1`: 25 Themen × 10 Bundesland-Varianten = 250 URLs generieren, 200 sollten ≥5 Events haben (indexable)
- `T3.2`: Rich-Results-Test für 5 Themen-Seiten → valide
- `T3.3`: Thema "Weihnachtsmärkte" im April → Fallback "Planung für nächste Saison" + archive-Events-Hinweis
- `T3.4`: Keyword-Test: Google-Search `"festivals steiermark 2026"` → URL im Index innerhalb 14 Tagen
- `T3.5`: Sitemap-Partition lädt + ist valide XML

**Metrics nach +14 Tagen:**
- GSC: mindestens 80% der Themen-URLs indexiert
- Ranking-Check: 10 Test-Queries ("[thema] [bundesland]") auf Top-50 Position

**Rollback:** Migration zurück, Route löschen.

---

### Phase 4 — Zusätzliche Datenquellen (Woche 4, 5–7 Tage)

**Ziel:** Event-Volumen um ~20-30k vergrößern durch additive Scraper. Keine bestehenden Scraper angefasst.

**Neue Quellen** (additiv):
1. **boudicca.events** (~50k Events laut deren Dashboard)
2. **data.wien.gv.at** — Wien Open Data (VADB, Kulturveranstaltungen)
3. **opendataportal.at** — offene CKAN API, diverse Veranstaltungsdaten
4. **eventfrog.at** — Ticketing-Plattform API (falls public)
5. (Optional) **Basketball Austria** + **VHS Salzburg** via Scraping wo nicht lizensierbar

- [ ] Neue Scraper-Module in `src/lib/scrapers/external/` (boudicca.ts, data-wien.ts, opendata.ts, eventfrog.ts)
- [ ] Jeder Scraper folgt existingm `BaseScraper`-Interface (keine Pipeline-Änderung nötig)
- [ ] `src/lib/scrapers/index.ts` registriert neue Scraper additiv (bestehende bleiben)
- [ ] Pro neuer Quelle: unique `source_name` ('boudicca', 'data-wien', 'opendata-at', 'eventfrog')
- [ ] Dedup-Regel: Bestehende Events (nach Title+Date+Location-Fingerprint) haben Vorrang → externe Events werden geskippt, NICHT dupliziert
- [ ] Attribution-Feld: `source_attribution_note` mit Lizenz + URL
- [ ] Scraper-Tests in `src/__tests__/scrapers/external/` je Quelle
- [ ] Pipeline-Integration: neue Scraper laufen im normalen `npm run scrape:pipeline`-Flow
- [ ] Rate-Limits respektieren: boudicca.events max 1 req/s

**Testfälle:**
- `T4.1`: `npm run scrape -- --source boudicca` läuft ohne Fehler, importiert ≥1000 Events im Dry-Run
- `T4.2`: Duplikat-Test: bekanntes Event (z.B. Konzert in Stadthalle) aus boudicca-Feed → wird mit existingm gemerged, nicht dupliziert
- `T4.3`: Attribution im UI sichtbar: jedes Event aus externen Quellen zeigt "Quelle: [Name]" im Detail
- `T4.4`: Pipeline-Regression: `npm run scrape:pipeline` läuft komplett ohne Änderung der Step-Count oder Reihenfolge
- `T4.5`: Event-Count-Delta nach 1 Pipeline-Run: +10k bis +30k neue Events

**Metrics nach +7 Tagen:**
- Events-Tabelle hat +10k bis +30k neue Rows (Messung via SQL-Count)
- Keine Regression in existingn Scraper-Zahlen (`scraper_name != 'boudicca' AND ...` Count ≈ Baseline)

**Rollback:** neue Scraper-Module aus `index.ts` entfernen. Neue Events via SQL-Delete mit `scraper_name IN (…)`.

---

### Phase 5 — Evergreen "Erlebnisse" (Woche 5, 5–7 Tage)

**Ziel:** Zeitlose Aktivitäten (Museen, Escape Rooms, Freizeitparks, Thermen, Zoos, Wanderwege) als separater Content-Typ indexieren. Analog wasmachma "Erlebnisse".

- [ ] Migration `20260430_activities.sql`: neue Tabelle `activities` (nicht `events`) mit Feldern name, description, category, venue, location, opening_hours_json, price_info, website, slug, bundesland, plz, ort, tags, image_url
- [ ] Datenquellen: Feratel-Venue-Feeds (bereits da), austria.info API, Wikivoyage, manuelle Kuration via Admin-Interface
- [ ] Scraper `src/lib/scrapers/experiences/` für evergreen content
- [ ] Route `app/erlebnisse/[plz]-[ort]/page.tsx` — Stadt-Index
- [ ] Route `app/erlebnisse/[plz]-[ort]/[slug]/page.tsx` — Detail
- [ ] Route `app/erlebnisse/[kategorie]/page.tsx` — Kategorie (Museen, Thermen, etc.)
- [ ] JSON-LD: `TouristAttraction` oder `LocalBusiness`, `OpeningHoursSpecification`, `AggregateRating` (wenn Bewertungen)
- [ ] Sitemap-Partition
- [ ] Integration auf Landing-Page: neuer Slot "Erlebnisse in deiner Nähe"

**Testfälle:**
- `T5.1`: 500+ Activities seeded, davon 80% mit vollständigen Feldern (description ≥150 Zeichen, Bild vorhanden, Koordinaten gesetzt)
- `T5.2`: Rich-Results-Test: TouristAttraction-Schema valide
- `T5.3`: Detail-Seite hat Mindest-Wortzahl 300 (kein thin content)
- `T5.4`: Gemeinde-Hub aus Phase 2 zeigt Link zu lokalen Erlebnissen (Cross-Linking)
- `T5.5`: Sitemap-Partition `/api/sitemap/erlebnisse.xml` valide

**Metrics nach +14 Tagen:**
- GSC: mindestens 300 Erlebnis-URLs indexiert
- Rich-Result-Impressions für `TouristAttraction` > 0

**Rollback:** Migration zurück, Routes löschen.

---

### Phase 6 — Structured Data + Meta Ausbau (Woche 6, 3–4 Tage)

**Ziel:** Jede existing und neue Seite hat Meta-Description, OG-Tags, vollständige JSON-LD-Hierarchie.

- [ ] `WebSite` + `SearchAction` JSON-LD auf Landing-Page (für Google Sitelinks Search Box)
- [ ] `Organization`-Schema auf Landing + Über-uns (mit logo, social-media, founders)
- [ ] `BreadcrumbList` auf allen Detail-Seiten (Event, Erlebnis, Blog-Artikel)
- [ ] `ItemList` auf allen Hub-Seiten (noch fehlend: `/blog`, `/festivals`, `/studenten/*`)
- [ ] `FAQPage`-Schema für Landing (10 häufige Fragen: "Was ist lasstreffen.at?", "Wie findet man Events in Wien?", etc.)
- [ ] `VideoObject`-Schema wenn Events Video-URLs haben
- [ ] `Event`-Schema `sameAs`-Feld populieren (externe Quellen: Ticket-URL, Veranstalter-Website)
- [ ] Alle Hub-Seiten: dynamische Meta-Descriptions ("Aktuelle Musik-Events in Wien — 247 Veranstaltungen heute und am Wochenende.")
- [ ] OG-Images generiert für alle Hub-Typen (Gemeinde, Thema, Bundesland, Kategorie, Erlebnis)
- [ ] Twitter Cards überall
- [ ] hreflang wenn englische Version später kommt (vorbereitet als Infrastruktur)

**Testfälle:**
- `T6.1`: Rich-Results-Test für 10 Seiten-Typen: alle grün
- `T6.2`: Landing-Page: WebSite + Organization + FAQPage + SearchAction alle validieren
- `T6.3`: Meta-Description-Grep auf alle Hub-Seiten: 100% befüllt, keine Duplikate
- `T6.4`: Facebook Debugger: alle 10 Test-URLs rendern korrekt mit OG-Image
- `T6.5`: LinkedIn Post Inspector: identisch
- `T6.6`: Twitter Card Validator: identisch

**Metrics nach +7 Tagen:**
- GSC "Enhancements" zeigt Rich Results für 5+ Schema-Typen
- Twitter-Share-Rate + Facebook-Share-Rate in GA4 steigt messbar (UTM-Analyse)

**Rollback:** Nur Schema-Erweiterungen entfernen (kein Risiko für existingn Content).

---

### Phase 7 — AI-Search + GEO (Woche 7, 2–3 Tage)

**Ziel:** Lasstreffen.at wird citability-freundlich für ChatGPT, Perplexity, Claude, Google AI Overviews.

- [ ] `/llms.txt` anlegen (MIT-Style lizenziert, beschreibt Plattform + Datenquellen)
- [ ] `/llms-full.txt` erweiterte Version mit Hub-Übersicht
- [ ] Robot-Meta und robots.txt: bestätigen dass GPTBot, ClaudeBot, PerplexityBot, CCBot erlaubt sind (ist schon der Fall — aber verifizieren)
- [ ] Jeder Event-Detail-Absatz: ein **self-contained intro-Sentence** am Anfang, der AI-zitierbar ist: "[Event] findet am [Datum] im/in [Venue] in [Stadt] statt. Der Eintritt kostet [Preis]."
- [ ] Gemeinde-Hub: Intro-Paragraph mit Entity-Disclosure ("In [Gemeinde] finden aktuell [N] Events statt. Typische Orte sind [Top-3 Venues].")
- [ ] FAQ-Block auf wichtigen Hub-Seiten (nutzt FAQPage-Schema aus Phase 6)
- [ ] Branded-Queries prüfen: "lasst treffen österreich", "lasstreffen events wien", etc. — sollten ChatGPT/Perplexity nutzen
- [ ] Brand-Knowledge-Panel via Organization-Schema + Wikipedia-Stub (Aufgabe: prüfen ob Stub sinnvoll)

**Testfälle:**
- `T7.1`: `curl https://lasstreffen.at/llms.txt` → 200 + Valid text/plain
- `T7.2`: Perplexity-Query "was ist heute in wien los" → prüft ob lasstreffen.at zitiert (manuelle Prüfung + Screenshot)
- `T7.3`: ChatGPT-Query mit Browse-Tool "events wochenende burgenland" → lasstreffen.at erscheint in Quellen
- `T7.4`: Google-AI-Overview-Test für "events heute wien" — lasstreffen.at in Quelle-Box
- `T7.5`: Intro-Sentence-Grep: 95% der Event-Detail-Seiten haben einen vollständigen self-contained ersten Satz (Regex-Test)

**Metrics nach +14 Tagen:**
- Referral-Traffic von chat.openai.com, perplexity.ai, claude.ai > 0 (bisher 0)
- AI-Overview-Impressions in GSC > 0

**Rollback:** llms.txt entfernen, FAQ-Blocks entfernen. Nicht-destruktiv.

---

### Phase 8 — Google Ads Setup + Conversion Tracking (Woche 8, 3–5 Tage)

**Ziel:** Bezahlter Traffic neben organic — vor allem für kommerzielle Queries ("tickets [event]", "konzert [artist]"). Messbar über Conversion-Events.

- [ ] GA4 Conversions definiert: `ticket_click`, `plan_created`, `artist_followed`, `signup_complete`, `newsletter_signup` (wenn später kommt)
- [ ] Google Ads Konto erstellt und mit GA4 verknüpft (Import der Conversion-Events)
- [ ] Google-Tag (gtag.js) geprüft (bereits via Next.js installiert? Falls nicht: hinzufügen)
- [ ] Enhanced Conversions aktiviert (für bessere Attribution)
- [ ] Landing-Pages pro Kampagnen-Thema: `/[stadt]/[kategorie]` existieren bereits — sind optimiert
- [ ] Erste Kampagnen: Search-Ads auf 20 Long-Tail-Keywords, Budget €10/Tag, Bid-Strategy "Maximize Clicks"
- [ ] Remarketing-Audience: "Visitors who saw Event Detail" (GA4 → Google Ads)
- [ ] UTM-Konvention definiert und dokumentiert (`?utm_source=google&utm_medium=cpc&utm_campaign=...`)
- [ ] Performance-Max-Kampagne vorbereitet (aber nicht aktiviert — erst in Phase 10 nach Baseline)

**Testfälle:**
- `T8.1`: GA4 DebugView zeigt `ticket_click` bei Klick auf "Jetzt Ticket kaufen"-Button
- `T8.2`: GA4 Conversions-Report listet 5+ Conversion-Events
- `T8.3`: Google Ads "Conversion Actions" zeigt alle GA4-Events importiert
- `T8.4`: Test-Kampagne auf Preview-Query "events wochenende steiermark" läuft, mind. 10 Klicks in 24h
- `T8.5`: Landing-Page hat Ladezeit <2s (Lighthouse) für Ads-Quality-Score

**Metrics nach +14 Tagen:**
- Bezahlter Traffic: ≥500 Klicks in 14 Tagen
- Conversion-Rate (Ticket-Click / Session) > 2%
- Cost-per-Click unter €0,50 für Long-Tail-Queries
- Google Ads Quality-Score ≥7 auf 50% der Keywords

**Rollback:** Kampagnen pausieren (kostenlos), Conversion-Events sind harmlos und bleiben.

---

### Phase 9 — Backlinks + PR (Woche 9–10, fortlaufend)

**Ziel:** Externe Domain-Autorität aufbauen. Ohne Backlinks kein langfristiges Ranking.

- [ ] **boudicca.events contribute**: PR an deren GitHub-Repo mit Verbesserungen (Scraper-Fixes, zusätzliche Quellen) — mindestens 1 Merge → Backlink zurück
- [ ] **Tourismusverband-Outreach**: 9 E-Mails an Bundesland-Tourismus-Verbände + 15 E-Mails an größte Städte (Wien, Graz, Linz, Salzburg, Innsbruck, Klagenfurt, St. Pölten, Eisenstadt, Bregenz). Angebot: Event-Widget für ihre Website (lasstreffen-powered), im Tausch: Link von Footer
- [ ] **Verzeichnisse**: Eintragung bei `firmen.wko.at`, `herold.at`, `gelbeseiten.at`, `stadtbranche.at`, `openstreetmap.org` (als local_business POI)
- [ ] **Student-Outreach**: FH Burgenland, WU, TU Wien, Uni Graz → "Dein Campus-Event-Hub" mit dedizierter Landing-Page `/uni/[kurz-name]`, im Gegenzug Verlinkung von deren Student-Portal
- [ ] **Festival-Veranstalter-Partnerschaften**: Frequency, Nova Rock, Electric Love → "Offizielle Lineup-Darstellung auf Lasstreffen" Partnerschaft, im Tausch: Link zurück
- [ ] **Medien-Pitch**: kurze, persönliche E-Mails an Redaktionen: derStandard Digital-Ressort, Der Brutkasten, Falter, Wiener Zeitung, Tips.at, Kurier. Story-Angle: "24-jähriger Student baut mit AI-Suche Event-Plattform für Österreich"
- [ ] **Podcast-Outreach**: Schnabel.at, Founders-Only Podcast, AustrianStartups-Podcast — pitche als Gast

**Testfälle:**
- `T9.1`: Ahrefs / Majestic Backlink-Report nach 4 Wochen: ≥10 neue referring domains
- `T9.2`: mindestens 1 Medien-Coverage-Artikel (österreichisches Medium)
- `T9.3`: mindestens 3 Tourismus-Verband-Links oder Widget-Embeds live
- `T9.4`: WKO-Eintrag online mit Link
- `T9.5`: boudicca.events PR gemerged

**Metrics nach +30 Tagen:**
- Domain Rating (Ahrefs) von ~0 auf ≥10
- Indexed referring domains ≥20
- 1-2 Medien-Erwähnungen

**Rollback:** Nicht anwendbar — Backlinks nicht zurücknehmbar (gewünscht).

---

### Phase 10 — KPI-Dashboard + Alerting + Iteration (Woche 10+, fortlaufend)

**Ziel:** Dauerhaft überwachen, iterieren, verbessern. Keine "Projekt abgeschlossen und tot"-Falle.

- [ ] Internal SEO-Dashboard: `app/admin/seo/page.tsx` mit:
  - Indexed URLs (GSC API)
  - Impressions / Clicks / CTR / Position je Keyword-Bucket
  - Traffic pro Hub-Typ (Gemeinde, Thema, Event-Detail, Erlebnis)
  - Sitemap-URL-Count vs Indexed
  - Core Web Vitals pro Seiten-Typ
- [ ] Daily-Report als Supabase-Cron: täglich JSON-Snapshot der Kern-Metriken speichern
- [ ] Alerting: Traffic-Drop >30% in 24h → E-Mail an Admin
- [ ] Weekly-Report als E-Mail: Top 10 Keyword-Gainers + Top 10 Losers
- [ ] Monatlich: A/B-Test auf Hub-Seiten-Titeln (2 Varianten, 2 Wochen, statistischer Sieger)
- [ ] Content-Refresh-Rotation: Hub-Seiten mit hohem Traffic bekommen alle 30 Tage Content-Refresh (neue Intro-Paragraphen, neue Featured-Events)
- [ ] Weekly: Keyword-Research via DataForSEO oder SEMrush — neue Hub-Ideen
- [ ] Monthly: Competitive-Recon-Update (sind wasmachma, eventim, oeticket, etc. neu gerankt?)

**Testfälle:**
- `T10.1`: Admin-Dashboard lädt in <3s und zeigt aktuelle Zahlen
- `T10.2`: Alert-Email wurde mindestens einmal im Monat getriggert (auch Testmail)
- `T10.3`: Daily-JSON-Snapshots in `data/seo-snapshots/` vollständig (keine Lücken)
- `T10.4`: A/B-Test-Framework funktioniert: Experiment-Parameter steuert HTML-Varianten

**Metrics laufend:**
- Organic Traffic: kontinuierliches Wachstum (mindestens +5%/Woche für 3 Monate)
- Indexed URLs: Ziel 50k nach 8 Wochen, 80k nach 12 Wochen
- Keyword-Ranking: 500+ Queries auf Top-50 nach 8 Wochen, 1000+ nach 12 Wochen

**Rollback:** Dashboards + Alerts sind rein additiv, kein Risiko.

---

## Boundaries — Explizit OUT of Scope

- **Keine** Änderungen an bestehenden 141 Scrapern und deren Logik
- **Keine** Änderungen an der Taxonomie v3 (docs/TAXONOMY.md bleibt Single-Source-of-Truth)
- **Keine** Änderungen an der Enrichment-Pipeline (`enrich-openai.ts`, `enrichment_version`)
- **Keine** Änderungen am Social-Layer (Planer, DM, Friends, Memories, Pinboard)
- **Keine** neuen Social-Features wie Kommentare, User-Profile etc.
- **Keine** native Mobile-Apps in diesem Epic (später separates Epic)
- **Keine** englische Übersetzung (hreflang-Infrastruktur ja, Content-Übersetzung später)
- **Keine** Paywall / Premium-Membership-Features
- **Keine** Änderungen an der bestehenden Notification-Pipeline (Web-Push, Tab-Badge, Realtime)
- **Keine** Änderung des Map-Stacks (Mapbox GL JS bleibt)

## Decision Context

### Warum additiv statt Rewrite

Die 3 Monate Investment in 141 Scraper, Taxonomy v3, Enrichment-Pipeline, Social-Layer dürfen nicht aufs Spiel gesetzt werden. Jede Phase kann einzeln rollback-werden ohne den Rest zu brechen.

### Warum diese 10 Phasen in dieser Reihenfolge

1. Phase 0 (Baseline) zuerst — sonst keine messbaren Erfolgs-Nachweise
2. Phase 1 (URL-Struktur) ist Voraussetzung für alle späteren SEO-Gewinne
3. Phase 2 (Gemeinde-Hubs) liefert den größten URL-Volumen-Sprung
4. Phase 3 (Themen-Hubs) folgt weil URL-Infrastruktur aus Phase 1-2 steht
5. Phase 4 (Zusätzliche Quellen) erst nach URL-Struktur damit neue Events die neue URL-Form bekommen
6. Phase 5 (Erlebnisse) braucht Infrastruktur aus 1-4 und ist strukturell neu — deshalb nach dem URL-Framework
7. Phase 6 (Schema + Meta) auf der ganzen aufgebauten URL-Fläche — sinnvoll nach 1-5
8. Phase 7 (AI-Search) baut auf Schema aus Phase 6 auf
9. Phase 8 (Google Ads) braucht Conversion-Tracking-Infrastruktur die bei GA4-Setup aus Phase 0 anfängt
10. Phase 9+10 (Backlinks + KPI-Dashboard) sind Dauer-Arbeit und laufen parallel nach Phase 7

### Warum Google Ads erst in Phase 8

Bezahlter Traffic ohne saubere Landing-Pages und Conversion-Tracking verbrennt Budget. Phasen 1-7 bauen die Infrastruktur. Phase 8 schaltet den Hahn auf.

### Warum nicht boudicca ersetzen sondern nur ergänzen

Risiko-Diversifikation. boudicca.events ist ein Solo-Projekt. Wenn es morgen offline geht, fallen wir nicht um. Unsere 141 Scraper bleiben die Basis.

### Warum kein "nur Wien / nur Burgenland zuerst"

Google-Crawl-Budget-Logik: je breiter die URL-Fläche ab Tag 1, desto mehr Crawl-Budget wird allokiert. Gemeinden-ganz-Österreich zuerst ist strategisch besser als schrittweise Regionalisierung.

### Warum keine Paid-Backlink-Strategie

Google bestraft bezahlte Backlinks. Phase 9 fokussiert auf verdiente / partnerschaftliche Links. Tourismusverbände und Medien sind legitim.

### Metriken-Denke

Jede Phase hat sowohl **funktionale Testfälle** (rendert die Seite? sind die Daten da?) als auch **SEO-Metriken** (Indexing-Fortschritt, Traffic-Delta, Ranking-Positionen). Erst wenn beide grün sind, ist eine Phase "done".

---

## Quick commands

- `npm run scrape:pipeline -- --trigger manual` — full E2E pipeline (unchanged, läuft weiter wie bisher)
- `npm run refresh` — Kurzalias des Selben
- `.flow/bin/flowctl tasks --epic fn-13-seo-content-parity-vs-wasmachmaat` — Tasks dieses Epics auflisten (nach `/flow-next:plan`)
- `.flow/bin/flowctl show fn-13-seo-content-parity-vs-wasmachmaat` — dieses Spec-Dokument rendern

## Definition of Done (für die gesamte Epic)

- [ ] Alle 10 Phasen abgeschlossen mit grünen Testfällen
- [ ] Organic Traffic: **≥1.000 Sessions / 30d** (Baseline: 1 Session / 30d) — 1000× Faktor, absolut aber von niedriger Basis
- [ ] Sitemap URLs: **≥120.000** (Baseline: 42.615)
- [ ] Indexed URLs (GSC): **≥50.000**
- [ ] Keyword-Positionen: **500+** Queries auf Top-50
- [ ] AI-Citations: nachweisbare Zitate in ChatGPT + Perplexity für mindestens 5 Test-Queries
- [ ] Google Ads Conversion-Tracking läuft mit **≥5** definierten Conversion-Events und **≥100** gemessenen Conversions pro Woche
- [ ] Backlinks: **≥20** neue referring domains laut Ahrefs
- [ ] KPI-Dashboard live mit täglicher Aktualisierung
- [ ] Kein Regressions-Incident bei bestehenden Scrapern / Pipeline / Social-Features (Monitoring über 8 Wochen bestätigt)

## References

- `docs/TAXONOMY.md` — Taxonomy v3 Single-Source-of-Truth (bleibt unverändert)
- `src/scripts/scrape-pipeline.ts` — bestehende Pipeline-Orchestration (bleibt unverändert)
- `src/app/sitemap.ts` — bestehender Sitemap-Generator (wird erweitert um Partitionen, nicht ersetzt)
- `src/lib/db/supabase-sync.ts` — Event-Write-Pfad (bleibt unverändert)
- `src/lib/pipeline/canonical-upsert.ts` — alternative Event-Write-Pfad (bleibt unverändert)
- Competitive-Recon-Report: dieser Chat-Thread, Antwort mit "TL;DR — Was du über wasmachma.at wissen musst"
