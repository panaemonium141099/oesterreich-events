# MASTERPLAN — lasstreffen.at

> **Stand: 2026-07-07.** Dieses Dokument ist die gemeinsame Kontext-Basis für alle Sessions
> (lokal, Web, Agents). Es hält fest: Ist-Zustand mit echten Zahlen, getroffene
> Grundsatz-Entscheidungen, kritische Betriebsbefunde und die priorisierte Roadmap.
> Bei größeren Änderungen (Entscheidung revidiert, Meilenstein erledigt, neue Baseline
> gemessen) bitte dieses Dokument mit-aktualisieren — Datum oben anpassen.

---

## 1. Produkt in einem Absatz

Österreichweite Event-Discovery-Plattform (lasstreffen.at). ~140 Scraper + Eventim-PFT-Feed
aggregieren Events in Supabase (~304k Zeilen), ausgespielt über Next.js 16 auf Vercel:
Mapbox-Karte, SEO-Landingpages (Bundesland/Stadt/Gemeinde/Thema/Zeitfilter), Event-Detail
mit Ticket-Box, Blog (64 Posts), Festival-/Artist-Features. Wachstum kommt fast
ausschließlich über Google-SEO. Monetarisierung: Eventim-Affiliate + Veranstalter-Pakete
(Boost/Abo/Live-Anbindung auf `/fuer-firmen`) + B2B-Outreach-Maschine.

## 2. Ist-Zustand in Zahlen (gemessen 2026-07-07, Supabase live)

| Metrik | Wert | Einordnung |
|---|---|---|
| Events gesamt | ~304.000 | Datenbestand = Moat (Long-Tail: Gemeinden, Vereine, Unis) |
| Sessions (30 Tage) | ~9.850 | solide SEO-Basis |
| Pageviews (30 Tage) | ~13.900 | **Ø 1,4 Seiten/Session — Besucher landen & gehen** |
| Traffic-Quellen | 70 % Google, 19 % direkt, 10 % intern | SEO ist der einzige Kanal |
| Registrierte User | 42 | Social-Features (DM/Groups/Feed) laufen ins Leere |
| `ticket_click`-Events (30 d) | 0 | Klick-Tracking existiert nicht (nur totes `data-track`-Attribut) |
| Business-Leads / aktive Boosts | 0 / 0 | B2B-Funnel technisch fertig, aber nicht angelaufen |
| Eventim-Events (Affiliate-Träger) | 21.899, **Stand 16.06.** | Import ist manuell, seit 3 Wochen nicht gelaufen |

## 3. Betriebszustand: kritische Befunde (verifiziert per DB-Query)

### 3.1 Tägliche Scrape-Pipeline ist seit 28.04. kaputt (GitHub Actions, nicht Vercel)

Die Pipeline läuft **nicht auf Vercel**, sondern als GitHub-Actions-Workflow
[.github/workflows/scrape-events.yml](../.github/workflows/scrape-events.yml)
(täglich 03:17, `timeout-minutes: 360`). Befund aus `pipeline_runs`:

- **Letzter erfolgreicher Run: 28.04.2026.** Seitdem stirbt *jeder* tägliche Run nach
  exakt 360 Minuten am GitHub-Job-Limit (Status `failed`, `pipeline_steps = {}`,
  Crash-Note von `finalize-stale-runs.ts`).
- Laufzeit-Trend davor: ~250 min (Mitte April) → 320 → 358 → 470 min. Die Pipeline ist
  organisch über das 6h-Limit gewachsen (mehr Quellen, mehr Events).
- **Die Scraper selbst schreiben noch** (Upserts passieren während der 6h — Feratel,
  Gemeinden, events.at etc. sind aktuell). Aber der Job wird gekillt, bevor die
  Folge-Steps laufen. Step-Reihenfolge in
  [scrape-pipeline.ts](../src/scripts/scrape-pipeline.ts):
  `scrapers → venues → normalize → categorization_backfill → geocoding → master_coords →
  scoring → dedup → artist_matching → enrichment → embeddings → indexing → report`.

**Konsequenz: Seit Ende April sind nie mehr gelaufen:** Location-Normalisierung,
Geocoding, **Scoring** (neue Events bekommen keinen `event_score` → fehlen in
Featured/WeeklyHighlights/`sort=score`), **Dedup**, Artist-Matching, Google-Indexing-Submit,
Scrape-Report. Außerdem: Scraper spät in der Reihenfolge kommen evtl. nie dran.
Die Telemetrie-Tabellen `scrape_runs` und `source_runs` sind komplett leer.

### 3.2 Eventim-Import (= Affiliate-Umsatzquelle) ist nicht automatisiert

`npm run import:eventim` ([import-eventim.ts](../src/scripts/import-eventim.ts)) ist ein
manuelles Script — kein Workflow, kein Cron. Letzter Lauf: **16.06.2026** (einmalig nach
dem Feature-Merge). Der PFT-Feed regeneriert alle 1–6 h; unsere Affiliate-Links veralten
also täglich. **Das ist der umsatzkritischste einzelne Automatisierungs-Gap.**

### 3.3 Vercel-Crons: differenziertes Bild (nicht pauschal kaputt)

| Cron (vercel.json) | Zeitplan | Status (DB-Evidenz) |
|---|---|---|
| `sync-feratel` | stündlich | ✅ läuft (feratel-Events heute aktualisiert) |
| `outreach-discover/enrich/draft/cold/monitor` | täglich/wöchentl. | ✅ läuft (Prospects heute 05:32 aktualisiert) |
| `seo-daily-snapshot` | täglich 06:00 | ❌ **tot seit 29.04.** (letzter Eintrag in `seo_snapshots`) — Ursache in Vercel-Logs prüfen; auffällig: gleiches Datum wie Pipeline-Bruch |
| `warm-cache` | stündlich | ⚠️ nicht verifiziert |
| `send-reminders`, `lifecycle-emails`, `expire-boosts` | täglich/wöchentl. | ⚠️ nicht verifiziert (expire-boosts hat mangels Boosts nichts zu tun) |
| `seo-content-refresh` | — | ⚠️ Route existiert, ist aber in vercel.json **nicht eingeplant** |

### 3.4 Diagnose in einem Satz

Nicht „Vercel-Crons kaputt", sondern: **(a)** der GitHub-Actions-Monolith überschreitet
das 6h-Limit, wodurch das gesamte Post-Processing seit 10 Wochen ausfällt, **(b)** der
Eventim-Import wurde nie automatisiert, **(c)** ein einzelner Vercel-Cron
(seo-daily-snapshot) ist seit 29.04. tot.

### 3.5 Performance-Diagnose (gemessen 2026-07-07, pg_stat_statements + pg_cron live)

**Symptom (User):** Seiten laden mal instant, mal >60 s — besonders eingeloggt;
Landing mal sofort, mal ewig. **Befund: Nichts „überspielt" Änderungen.** Die
Inkonsistenz ist vollständig erklärbar durch Cache-Hit vs. Dynamic-Render multipliziert
mit einer chronisch gesättigten Datenbank:

**A) Die DB ist strukturell überlastet (Supabase Micro: 256 MB shared_buffers, 60 Connections):**

| Messwert | Wert |
|---|---|
| `events`-Tabelle gesamt | **3,75 GB** (Heap nur 449 MB, **Indizes 1,71 GB**, TOAST 1,6 GB) |
| Embedding-Index `idx_events_embedding_ivfflat_future` | **1,22 GB — insgesamt nur 50× benutzt** |
| Top-Query (PostgREST auf events, 14.203 Aufrufe) | **Ø 26,9 s** pro Aufruf |
| Weitere Hot-Queries | Ø 7,1 s (43k Aufrufe), Ø 3,1 s (83k Aufrufe) |
| Artist-Matching-RPCs | Ø 11–12 s (je ~17k Aufrufe) |
| INSERT in events (Scrape-Upserts) | **Ø 1,2 s pro Insert** (44k Aufrufe) — erklärt mit-warum die Pipeline 6 h+ braucht |

Das Working-Set (3,75 GB) übersteigt den RAM um mehr als das Zehnfache → permanenter
Disk-I/O und Buffer-Cache-Thrash. Der 1,2-GB-Embedding-Index (semantische Suche, 50
Scans!) plus die Embedding-Vektoren im TOAST sind der größte einzelne Ballast — die
KI-Altlast bremst wörtlich jede Query und jeden Insert.

**B) DB-interne pg_cron-Jobs erzeugen Dauerlast-Wellen** (in `cron.job`, läuft parallel
zu den Vercel-Crons!):

| Job | Takt | Messung (24 h) |
|---|---|---|
| `refresh-event-stats-cache` (MV) | **alle 5 min** | Ø 17,5 s, max 151 s, **41 Fails/Tag** — ≈ 84 min DB-Zeit/Tag nur dafür |
| `refresh_event_map_points` (MV) | alle 15 min | Ø 18 s, max 130 s, 10 Fails/Tag |
| `match-artists-pipeline` (http_post) | **alle 5 min** | meist 0,2 s, aber 21 Fails/Tag bis 58 s |
| `send-reminders-hourly` (http_post) | stündlich | ⚠️ **redundant zum Vercel-Cron `send-reminders` (täglich 08:00)** — Doppel-Versand-Risiko prüfen |

Dazu kommen: Scrape-Fenster 03:17–09:17 (Inserts à 1,2 s im Dauerfeuer), stündlich
`sync-feratel` + `warm-cache` (zieht `bundesland=X&limit=3000`-Payloads). **Ergebnis:
mehrmals pro Stunde ist die DB minutenlang gesättigt → „nach ner Zeit dauerts wieder ewig".**

**C) Eingeloggt = jeder Seitenaufruf ungecacht gegen genau diese DB:**
Die Middleware schreibt bei Session-Refresh Cookies → Next.js markiert die Antwort
`private, no-store` → **eingeloggte User bekommen NIE einen ISR-/Edge-Cache-Hit**
(anonyme fast immer → „instant"). Der eingeloggte Landing-Render macht dann
8 Roundtrips: 2× `auth.getUser()` (doppelt! `middleware.ts` + `get-landing-context.ts`),
2 personalisierte Queries (davon `artist_event_notifications` **ohne `.limit()`**,
obwohl nur 8 angezeigt werden) + 4 Daten-Queries — jede davon gegen die unter (A)/(B)
beschriebene DB. Cache-Miss trifft anonyme User nach Ablauf der Revalidate-Fenster genauso.

**Fazit:** instant = Cache-Hit; >60 s = Dynamic-Render (eingeloggt oder Cache kalt)
× DB-Lastwelle. Deploys/Code werden nicht überschrieben.

## 4. Getroffene Grundsatz-Entscheidungen (2026-07-07)

1. **Affiliate-ID `J70` ist korrekt** und gehört uns (bestätigt). Eventim-Links im Feed
   (`evoLink`, [src/lib/eventim/types.ts](../src/lib/eventim/types.ts)) sind damit
   unmittelbar umsatzfähig.
2. **Kein KI-Enrichment mehr.** Das Claude-/OpenAI-Enrichment war halbherzig, funktioniert
   nicht zuverlässig und kostet zu viele API-Tokens. Ziel: **überall direkt saubere Daten
   ohne KI-Anreicherung** — Qualität entsteht an der Quelle (strukturierte Feeds,
   deterministische Klassifikation, GeoNames). Details in §6.
3. **Scraping + Feed-Imports (Eventim/Affiliate-Daten) gehören nicht auf Vercel.**
   Vercel bleibt reines Web-Hosting + Mini-Crons; die Daten-Pipeline läuft auf einem
   dedizierten Runner (GitHub Actions kurzfristig, VPS mittelfristig). Details in §5.

## 5. Ziel-Architektur Automatisierung

### Phase A (sofort, 1–2 Tage Aufwand): GitHub-Actions-Monolith zerlegen

Das Repo ist **public** → Actions-Minuten kosten nichts. Das 6h-Limit gilt *pro Job*,
also: einen Workflow mit mehreren parallelen Jobs statt einem seriellen Riesen-Job.

- **Job-Matrix „scrape"**: Quellgruppen parallel (z. B. `uni`, `niche`, `regional`,
  `feratel`, `gemeinden`, `venues`) — jede Gruppe < 60–90 min. `scrape.ts --source`
  unterstützt Selektion bereits.
- **Job „post-processing"** (`needs: scrape`): normalize → geocoding → scoring → dedup →
  artist_matching → indexing → report. Ohne Enrichment/Embeddings (§6) deutlich kürzer.
- **Eigener Workflow „import-eventim"**: alle 6 h (`cron: '0 */6 * * *'`),
  läuft in Minuten. **Umsatzkritisch, zuerst bauen.**
- Jeder Job schreibt seinen Step nach `pipeline_runs`/`source_runs` **inkrementell**
  (nicht erst am Ende), damit ein Kill nie wieder Telemetrie auslöscht.
- Fail-Alerting per Mail (Resend ist angebunden, `ALERT_EMAIL`-Secret existiert).

### Phase B (bei Bedarf/Skalierung): dedizierter Runner (VPS)

Hetzner CX22 (~4–6 €/Monat, EU): systemd-Timer für Scrape-Gruppen, Eventim-Import,
Post-Processing; keine Zeitlimits, Puppeteer ohne Serverless-Verrenkungen, konstante IP
(hilfreich gegen Bot-Blocking). Auch `sync-feratel` kann dann von Vercel dorthin.
Vercel behält nur: `expire-boosts`, `send-reminders`, `lifecycle-emails`, `outreach-*`
(kleine DB-Jobs, dort gut aufgehoben).

### Grundregeln (egal wo)

Jeder Job < 90 min · idempotent (Wiederanlauf gefahrlos) · schreibt Telemetrie
inkrementell · alarmiert bei Fehlschlag · ein Job = eine Verantwortung.

## 6. Weg vom KI-Enrichment — Datenqualität an der Quelle

**Was entfällt** (Code kann nach Übergangsfrist gelöscht werden):
`enrich-claude.ts`, `enrich-claude-cli.ts`, `enrich-openai.ts`, `enrich-batch.ts`,
`agent-enrich.ts`, `backfill-detail-enrich.ts`, der `enrichment`-Step der Pipeline,
der Admin-Enrichment-Review (`/admin/enrichments`) sobald keine neuen Vorschläge mehr
entstehen. **Smart-Suche: bleibt als Feature, Architektur getauscht (revidiert
2026-07-07).** Die alte Implementierung (OpenAI-Embedding pro Event, 1,22-GB-
pgvector-Index bei 50 Nutzungen, Datenbasis seit April stale) ist entsorgt —
Spalte + Index + RPC sind gedroppt. Die neue Architektur ist **KI pro Query
statt KI pro Event**: ein Gemini-2.5-Flash-Call pro Suche (~0,02 Cent)
übersetzt die Anfrage in die Taxonomie (Whitelist-validiert), gematcht wird
live über normale indexierte Queries + trgm-Volltext (`search_event_ids`),
deterministisch gerankt. Nie stale, kein DB-Ballast, Kosten skalieren mit
Suchvolumen statt Datenbestand. Code: `src/lib/search/smart-query.ts` +
`/api/search/semantic`; Concierge (Gemini + Google-Grounding) unverändert.
Das ist vereinbar mit dem Enrichment-Ausstieg: dessen Problem waren Tokens
für 300k Events, nicht KI im Request-Pfad.

**Was die Qualität stattdessen sichert:**

1. **Strukturierte Quellen bevorzugen.** Eventim-PFT liefert Kategorie (locked),
   Genre→Tags-Mapping, Preise, Koordinaten, Bilder — fertig. `dedup_eventim_wins()`
   macht Eventim bereits kanonisch bei Fingerprint-Duplikaten. Gleiches Prinzip für
   Feratel/TourData/Wien-OGD/ICS/JSON-LD-Connectoren: Feld-Mappings pro Quelle
   deterministisch pflegen statt nachträglich per LLM raten.
2. **Deterministischer Classifier** ([src/lib/category-classifier](../src/lib/category-classifier))
   bleibt der einzige Kategorien-Pfad (`categorization_backfill`-Step bleibt).
3. **GeoNames-Location-Normalizer** + Koordinaten-Confidence-Ranking bleiben.
4. **Quality-Gates statt KI:** `publish_status`-Mechanik (low-confidence) existiert —
   lieber ein Event konservativ ausspielen als falsch anreichern.

**Konsequenz, bewusst akzeptiert:** Facetten wie `vibes`/`audiences`/`occasions` werden
für Nicht-Feed-Quellen dünn. Filter-UI auf Kern-Facetten konzentrieren (Kategorie,
Region, Datum, Preis-Flags soweit aus Quelldaten parsebar). Bestehende
Enrichment-Spalten **nicht droppen** (kein destruktiver Schritt), nur keine neuen
Schreibpfade. `docs/TAXONOMY.md`-Governance (§3 aus Code regeneriert) bleibt unberührt.

## 7. Monetarisierung

### 7.1 Affiliate (Eventim, ID J70 ✅) — Kette schließen

1. **Eventim-Import automatisieren** (§5) — ohne frische Events keine frischen
   Affiliate-Links. *Umsatzkritischster Fix überhaupt.*
2. **Klick-Tracking bauen:** `data-track="ticket_click"`
   ([V4TicketBox.tsx](../src/components/Events/v4/V4TicketBox.tsx)) hat keinen Listener;
   `analytics_events` enthält 0 Ticket-Klicks. Lösung: globaler delegierter
   `data-track`-Click-Listener (repariert ~20 weitere tote Marker) **oder**
   `/api/out?event=<id>`-Redirect mit Logging. Ohne das: kein Reporting, keine
   Optimierung, kein Verkaufsargument gegenüber Veranstaltern.
3. **Blog monetarisieren:** 64 Posts, 0 Affiliate-Links. „Tickets & Anreise"-Box pro
   Post (Eventim-Deeplink + Booking.com).
4. Weitere Programme: Booking.com (Plan-Wizard hat den Accommodation-Step schon!),
   ÖBB/Omio, GetYourGuide, Ticketmaster (Impact), ntry.at (Direktdeal anfragen).
5. **Erwartung:** 1–5 % Provision; bei 10k Sessions anfangs ~50–200 €/Monat.
   Affiliate skaliert linear mit Traffic → §8 ist die eigentliche Affiliate-Strategie.

### 7.2 Veranstalter-Pakete (technisch fertig, nicht verkäuflich)

Boost 29 € / Business-Abo 49 €/M / Live-Anbindung ab 199 € auf
[/fuer-firmen](../src/app/fuer-firmen/page.tsx); Boost-Mechanik komplett (Karte,
„Anzeige"-Badge, Expiry-Cron). **Fehlt: Stripe-Checkout** — aktuell nur Lead-Formular
(0 Leads). Die Outreach-Maschine (Discovery→Enrich→Draft→Send, läuft täglich) ist der
Vertriebskanal; ihr Verkaufsargument sind die Klickzahlen aus 7.1.2
(„dein Event hatte X Aufrufe — für 29 € heben wir es hervor").

### 7.3 Weitere Quellen (Reihenfolge nach Realismus)

1. **B2B-Daten-Syndication:** einbettbares Event-Widget für Gemeinden/Hotels/
   Tourismusverbände (49–199 €/M) — unser Long-Tail-Datenbestand ist einzigartig,
   jedes Widget ist zugleich ein Backlink.
2. **Sponsored Content** im Blog (Tourismusverbände haben Budgets; Kennzeichnung
   gemäß /ueber-uns-Versprechen).
3. **AdSense/Display:** erst ab ~100k Sessions sinnvoll (~10–30 €/M bei heutigem
   Traffic, verschlechtert UX). Vorbereitung existiert (Cookie-Banner an AdSense
   delegiert).
4. User-Premium: für diesen Produkttyp schwach — nicht priorisieren.

## 8. Wachstum: viele monatliche Nutzer

Hebel in Reihenfolge der Wirkung:

1. **Session-Tiefe 1,4 → 3+:** „Ähnliche Events"/„Am selben Tag in der Nähe" prominent
   auf jeder Detailseite (API `/api/events/related` existiert), Breadcrumbs zu
   Gemeinde-/Bundesland-Hubs, Blog↔Event-Verlinkung in beide Richtungen (aktuell 0).
2. **Retention ohne Account-Zwang:** Wochen-Newsletter pro Region — Opt-in-Feld,
   Brevo/Resend und Lifecycle-Mails existieren, es fehlt nur der Newsletter selbst;
   auch ohne Registrierung abonnierbar machen (nur E-Mail + Region). Web-Push ist
   installiert. ICS-Kalender-Feeds pro Region/Kategorie als Abo-Kanal.
3. **Programmatic SEO ausbauen:** Zeitfilter-Seiten („heute/morgen/Wochenende in X"),
   „kostenlose Events in X" (price_flags), Saison-Hubs (Christkindlmärkte, Silvester,
   Ballsaison, Festivalsommer — Blog-Content existiert).
4. **Brand konsolidieren** (§9.3 Punkt 1) — vier Namen fragmentieren jedes Signal.
5. **LLM-SEO:** AI-Crawler sind in robots.txt bereits erlaubt; als *die* Datenquelle
   für „Events in Österreich"-Antworten positionieren (llms.txt, sauberes JSON-LD).
6. **Social-Features einfrieren** (DM/Groups/Feed/Memories bei 42 Usern): nicht
   ausbauen, nicht bewerben, nur nicht kaputt gehen lassen. Die echte soziale Geste
   ist „Event teilen/gemeinsam planen" — das Plan-Feature mit Share-Links
   (`/join/[code]`) ohne Account-Zwang ist der richtige Träger; perspektivisch
   WhatsApp-Kanäle pro Region statt eigenem Social Network.

Realistischer Pfad: 10k → 30–50k Sessions/Monat in 6–12 Monaten (SEO-Compounding +
Newsletter-Retention) — vorausgesetzt §3 ist repariert (Indexing-Submit & Scoring!).

## 9. Technische Schulden

### 9.1 Architektur (Fundament ist solide: Supabase Single-SoT, ISR, Edge-Cache, CRON_SECRET überall)

- **Schema-Migrationen unversioniert** (manueller `/api/admin/migrate`-Endpoint) →
  Supabase-CLI-Migrationen + RLS-Policies ins Repo. Größtes strukturelles Risiko.
- **DB-Performance kippt:** `count(*)` auf `events` läuft bereits in Statement-Timeouts;
  304k Zeilen wachsen unbegrenzt → Archivierung vergangener Events + Index-Review.
  Die 881-Zeilen-Route [/api/events](../src/app/api/events/route.ts) (3–5 s warm) hängt
  am selben Problem.
- **In-Memory-State in Serverless:** Rate-Limiting (middleware) und `setInterval`
  in [/api/analytics](../src/app/api/analytics/route.ts) sind pro Instanz wirkungslos →
  bei Wachstum Upstash Redis.
- **`analytics_events` wächst ohne Rollups/Retention** → tägliche Aggregat-Tabelle +
  90-Tage-Purge, solange es billig ist.

### 9.2 Tote Funktionen (Aufräumliste)

- [OeticketScraper.ts](../src/lib/scrapers/OeticketScraper.ts) — durch Eventim-Feed
  ersetzt, nicht mehr registriert → löschen. (Alt-Zeilen `source_name='oeticket'`
  in der DB sind seit 16.06. stale — bei Eventim-Automatisierung mit abräumen.)
- Enrichment-Scripts (§6) nach Übergangsfrist.
- ~77 nicht importierte Komponenten (V3→V4-Reste: `Layout/Header`, `Layout/Sidebar`,
  `Landing/HeroSection`, `Events/EventCard`, Feed-Teile wie `StoriesViewer` …) —
  vor Löschung mit `npx knip` verifizieren.
- 80+ npm-lose Ad-hoc-Scripts in `src/scripts/` (`debug-*`, `probe-*`, `test-*`) →
  archivieren oder löschen.
- `data-track`-Attribute ohne Listener (→ reparieren, nicht löschen; §7.1.2).
- CLAUDE.md beschreibt ein Phantom-Repo (SQLite aktiv, kein fuer-firmen/Boost/Outreach/
  Analytics/Eventim) → aktualisieren, sonst arbeiten künftige Sessions gegen falschen Kontext.

### 9.3 Logische Inkonsistenzen

1. **Vier Markennamen:** `burgenland-events-v5` (package.json), „Österreich Events"
   (Titles/Impressum), `LassTreffen.at` (og:site_name/JSON-LD), **`oesterreich-events.at`
   in den AGB** ([agb/page.tsx](../src/app/agb/page.tsx)) — letzteres auch rechtlich
   unsauber. → Ein Name überall: **LassTreffen.at**.
2. **`eveningOnly` ist zeitzonenfragil:** String-Match auf `T17:`–`T23:` gegen
   `timestamptz` ([events/route.ts](../src/app/api/events/route.ts)) — je nach
   UTC-Serialisierung um 1–2 h verschoben. Schreibpfad prüfen, auf echten
   Europe/Vienna-Zeitvergleich umstellen.
3. `SEARCH_SYNONYMS` deckt nur 10 von 12 Kategorien ('Community & Freizeit',
   'Sonstiges' fehlen).
4. Bundesland-Normalisierung dreifach implementiert (stats/counts-Aliases,
   `normalizeBundesland()`, hardcoded REGIONS im RegionExplorer).
5. Doppelte Slug-/URL-Logik (`buildEventUrl` legacy vs. `buildEventUrlV2`);
   hardcodierter `.gt('event_score', 30)`-Threshold im Featured-API.

## 10. Performance-Plan (Ziel: „lädt wie YouTube")

Leitprinzip: **Die Seite darf im Normalfall gar nicht auf die DB warten.** Statisch
ausliefern, Personalisierung nachladen, die DB nur noch von Hintergrund-Jobs und
kleinen APIs treffen lassen.

### 10.1 DB entlasten (größter Hebel, reine Ops — kein Feature-Risiko)

1. **Embedding-Spalte + `idx_events_embedding_ivfflat_future` droppen** (§6):
   ~2,5 GB weg, Inserts und alle Queries profitieren sofort.
2. **Unbenutzte Indizes droppen** (idx_scan-Werte aus §3.5 vorher nochmal prüfen):
   `idx_events_location_trgm` (10 Scans), `idx_events_address_trgm` (3),
   `idx_events_created_by` (3), `idx_events_category_version` (18),
   `idx_events_detail_fetch_at` (21), `idx_events_country` (46),
   `idx_events_backfill_eligible` (44). Ziel: <15 Indizes auf `events`.
3. **pg_cron entschärfen:** `refresh-event-stats-cache` von 5 min → 30–60 min (Stats
   ändern sich fast nur durchs Scrapen); `refresh_event_map_points` 15 → 60 min oder
   in den Post-Processing-Step verlagern; `match-artists-pipeline` 5 min → 1×/h oder
   nach Scrape-Lauf. **`send-reminders-hourly` (pg_cron) vs. `send-reminders`
   (Vercel, täglich) klären — eines abschalten.**
4. **Alt-Events archivieren:** vergangene Events in `events_archive` verschieben
   (Detailseiten können daraus lesen); aktive Tabelle klein halten.
5. Danach messen; reicht Micro nicht, **Compute-Upgrade auf Small** (~15 $/M) —
   aber erst nach Ballast-Abwurf, sonst kauft man RAM für einen 50-Scans-Index.

### 10.2 Landing instant (YouTube-Muster: statische Shell + Client-Personalisierung)

1. **Personalisierung raus aus dem Server-Render:** `getLandingContext()` (Auth +
   saved_events + notifications) nicht mehr im RSC — die Landing rendert für ALLE
   identisch aus dem ISR-Cache; Gespeichert-Status/Matches lädt der Client nach
   First Paint über eine kleine API. Damit bekommen auch eingeloggte User Cache-Hits.
2. **Doppeltes `auth.getUser()` eliminieren** (middleware.ts + get-landing-context.ts
   — ein Roundtrip statt zwei).
3. **`artist_event_notifications`-Query `.limit(8)` geben** (angezeigt werden eh nur 8).
4. Middleware-Session-Refresh auf die Routen beschränken, die ihn wirklich brauchen
   (auth-gated Seiten), statt auf jede Seite.

### 10.3 Filter & Karte: Queries eliminieren statt beschleunigen

1. **Karten-Daten als statische Snapshots:** Nach jedem Scrape-/Post-Processing-Lauf
   vorgerechnete GeoJSON-/Punkt-Snapshots (pro Bundesland bzw. Kategorie) in
   Storage/CDN legen — die `event_map_points`-MV existiert schon als Quelle. Die
   Karte lädt dann Dateien vom CDN (instant, DB-unabhängig); nur Detail-Popups
   treffen die API. *(In Arbeit: fn-16 Slice 1 — `/api/events/map-points`
   liefert seit PR #75 alle Punkte als columnar Snapshot aus der MV.)*
2. **Filter-Zählungen/Listen aus `event_stats_cache`** bzw. vorgerechneten
   JSON-Snapshots bedienen statt Live-Aggregaten.
3. `/api/events` bleibt für Listen — aber mit kleinen Limits, kurzem Timeout und
   dem bestehenden Edge-Cache; Ziel p95 < 300 ms nach 10.1.
4. `warm-cache`-Cron danach neu bewerten — wenn Landing + Karte statisch sind,
   braucht es ihn kaum noch (heute zieht er stündlich `limit=3000`-Payloads).

### 10.4 DB sauber & überall gleich (Datenhygiene)

1. Bundesland-Werte einmalig normalisieren (eine kanonische Schreibweise) +
   CHECK-Constraint; die dreifache Normalisierungslogik im Code (§9.3) auf eine
   Funktion eindampfen.
2. Alt-Quellen bereinigen: `oeticket`/`oeticket.com`-Zeilen (stale seit 16.06.,
   Scraper gelöscht) den Eventim-Zeilen zuordnen oder entfernen.
3. `venues` prüfen: 313k Zeilen (mehr Venues als Events, OSM-Massenimport) —
   ungenutzte Einträge archivieren.
4. Vergangenheits-Events archivieren (siehe 10.1.4), `analytics_events` mit
   Rollup + 90-Tage-Retention.
5. Jede dieser Änderungen als **versionierte Migration** (Supabase CLI) — nie wieder
   über den Admin-Endpoint.

## 11. Roadmap (priorisiert)

### P0 — Betrieb & Kasse (diese Woche)

1. ✅ **DB-Notentlastung** *(erledigt 2026-07-07)*: Embedding-Index (1,22 GB) +
   Spalten + 8 tote Indizes gedroppt (Migrationen `perf_drop_unused_indexes`,
   `perf_drop_semantic_search_embeddings`; Indizes 1.707→408 MB, Tabelle
   3,75→2,45 GB). pg_cron: stats-Cache 5→30 min, map-points 15→60 min,
   match-artists 5→60 min, `send-reminders-hourly` (Duplikat) abgeschaltet.
2. ✅ **Eventim-Import automatisiert** *(abgeschlossen 2026-07-08)*:
   `.github/workflows/import-eventim.yml` läuft alle 6 h (erster grüner Lauf
   08.07. 06:49 UTC, Secrets in GitHub gesetzt). Der parallel entstandene
   Vercel-Cron `/api/cron/eventim` (PR #72) wurde aus vercel.json
   ausgeplant — die Route bleibt als manueller Fallback bestehen
   (mit CRON_SECRET aufrufbar). Feed-Import damit gemäß §4.3 komplett
   weg von Vercel. ⚠️ Merker: Feed-Passwort stand bis 08.07. im Klartext
   in der Repo-History (public!) — bei Eventim rotieren lassen, neuen Wert
   in Vercel-Env + GitHub-Secrets eintragen.
3. ✅ **Pipeline zerlegt** *(erledigt 2026-07-07)*: `scrape-events.yml` → 6
   parallele Shards (`scrape.ts --shard i/6`, deterministisch alphabetisch) +
   Venues-Job + ein Post-Processing-Job (`--skip-scrapers --skip-venues`) mit
   `if: always()`. Semantic-Search/Embeddings-Step aus der Pipeline entfernt.
4. ✅ **Klick-Tracking** *(erledigt 2026-07-07)*: globaler `ClickTracker`
   (delegierter `data-track`-Listener im Root-Layout); Ticket-CTA sendet
   Event-ID + Provider mit.
5. ✅ **Brand-Fix** *(erledigt 2026-07-07)*: „Österreich Events" +
   `oesterreich-events.at` → LassTreffen.at in AGB, Impressum, Datenschutz,
   Quellen, Footer, Auth-Layout, Blog-JSON-LD, /fuer-firmen, package.json.
6. ⏳ `seo-daily-snapshot`-Leiche in Vercel-Logs diagnostizieren (tot seit
   29.04.) — braucht Zugriff auf Vercel-Dashboard/-Logs.
7. Smart-Suche: Embedding-Architektur entsorgt, Feature **neu gebaut** als
   Query-Zeit-Intent (§6, revidiert nach User-Feedback) — Smart-Tab +
   Concierge sind wieder live; nur `build-embeddings` + pgvector sind weg.

### P1 — Monetarisierung, Retention & Instant-Loading (Monat 1)

Landing auf statische Shell + Client-Personalisierung umbauen (§10.2) ·
Karten-Snapshots aufs CDN (§10.3) · Stripe-Checkout für Boost · Wochen-Newsletter pro
Region (ohne Account abonnierbar) · Affiliate-Boxen in den 64 Blog-Posts ·
„Ähnliche Events" + Breadcrumbs auf Detailseiten · Enrichment-Codepfade stilllegen (§6) ·
CLAUDE.md aktualisieren.

### P2 — Fundament (Monat 2–3)

Outreach mit Klickzahlen-Argument hochfahren · Migrationen auf Supabase CLI ·
`eveningOnly`-Timezone-Fix · Analytics-Rollups + Retention · Dead-Code-Sweep (knip) ·
ggf. VPS-Umzug (§5 Phase B).

### P3 — Skalierung (Quartal)

B2B-Widget/Syndication · Hotel-/Anreise-Affiliate im Event-Detail · Event-Archivierung +
DB-Performance · Saison-Kampagnen-Kalender · WhatsApp-/Push-Kanäle pro Region.

---

## Anhang: Baseline-Queries (für Re-Messung)

```sql
-- Traffic & Engagement (30 Tage)
SELECT count(DISTINCT session_id) AS sessions,
       count(*) FILTER (WHERE event_type='page_view') AS pageviews,
       count(*) FILTER (WHERE event_type='ticket_click') AS ticket_clicks
FROM analytics_events WHERE created_at >= now() - interval '30 days';

-- Pipeline-Gesundheit
SELECT started_at::date, status,
       round(extract(epoch FROM (finished_at-started_at))/60) AS dur_min
FROM pipeline_runs ORDER BY started_at DESC LIMIT 14;

-- Eventim-Frische (Affiliate)
SELECT count(*), max(updated_at) FROM events WHERE source_name = 'Eventim';

-- SEO-Snapshot-Cron lebendig?
SELECT max(snapshot_date) FROM seo_snapshots;
```
