# MASTERPLAN — lasstreffen.at

> **Stand: 2026-07-20.** Dieses Dokument ist die gemeinsame Kontext-Basis für alle Sessions
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

### 3.6 Alle GitHub-Actions-Crons tot 19.–20.07. (npm-Versions-Drift) — behoben 2026-07-20

Zwei unabhängige Bugs legten sämtliche geplanten Workflows lahm:

**(a) `npm ci` failte sofort (≈1 s) in import-eventim, scrape-events (alle
Shards + venues + post).** Ursache: Der fn-17-i18n-Merge (next-intl) am 19.07.
regenerierte `package-lock.json` mit **npm 11 (Node 24)**; die Runner liefen
Node 20 = **npm 10**, das den Lock ablehnte (`EUSAGE … Missing:
@swc/helpers@0.5.23 from lock file`). Lokal + Vercel unauffällig, weil Vercel
`npm install` (lenient) nutzt, nicht das strikte `npm ci`. Reproduziert mit
`npx npm@10 ci`. **Fix (`a473b2d`):** Lock mit npm 10 regeneriert; alle
Workflows Node 20→22 (passt zu `engines.node=22.x`); `.nvmrc=22` gegen den
Drift über mehrere Dev-Maschinen. ⚠️ **Stehender Merker:** wer auf Node 24
(npm 11) `npm install` macht und den Lock pusht, bricht CI sofort wieder —
alle Maschinen müssen Node 22 nutzen (jetzt via `.nvmrc`).

**(b) saison-guide.yml war ein Startup-Failure** (0 Jobs, event=push, seit
15.07.): der `gh pr create --body`-Text stand auf Spalte 0 und beendete den
YAML-`run: |`-Block-Scalar → „Invalid workflow file" (`expected ':' … 78:7`).
**Fix (`bba7e88`):** Body-Zeilen auf Block-Einrückung gezogen; mit
`npx js-yaml` gegen alle vier Workflows als valide verifiziert. Lehre: neue/
geänderte Workflow-YAML immer mit einem echten Parser prüfen, nicht nur
visuell. Details als Auto-Memory `project-ci-npm-lockfile-drift`.

### 3.7 Sitemap ohne Event-URLs seit 25.07. — behoben 2026-08-26

`/sitemap-events.xml` lieferte seit dem Sitemap-Split (fn-18, `543e79b`,
25.07.) durchgehend **HTTP 500** („sitemap temporarily unavailable", live
gemessen: 500 nach 119 s, zweiter Versuch Timeout bei 120 s). Damit stand
**keine einzige Event-Detailseite in der Sitemap**; Google kannte nur
`sitemap-core` (2.469 URLs) + `sitemap-activities` (7.605) — passend zu den
10.058 „submitted URLs" im GSC-Snapshot.

**Ursache:** OFFSET-Pagination (`.range(offset, offset+999)`) über bis zu
45.000 Zeilen, sortiert nach `quality_score DESC, id`, ohne passenden Index.
`EXPLAIN ANALYZE` auf Prod bei OFFSET 40000: Incremental Sort über
`idx_events_quality_score`, **29.138 ms für EINE von 45 Seiten**. Die Route
fängt Query-Fehler bewusst ab und gibt 500 statt einer truncierten Datei
zurück (Review-Finding R3) — sie tat also genau das Richtige, nur nie
erfolgreich.

**Fix (deployed 2026-08-26):** Keyset-Pagination über den Cursor
`(quality_score, id)` plus Teilindex `idx_events_sitemap_keyset_v2`
(Migration `20260826140000_sitemap_events_keyset_index.sql`).

Der Index trägt ein **statisches** `start_date >= 2026-08-01`, weil sonst
~57.000 längst vergangene Events bei jedem Lauf sinnlos vom Heap geholt
wurden. `CURRENT_DATE` taugt weder als Index-Prädikat (nicht immutable) noch
als Query-Bedingung — der Planner kann die Implikation dann nicht beweisen
und verwirft den Index. Die Route schickt deshalb ein Datums-**Literal**.

Dazu wurde **MAX_URLS von 45.000 auf 15.000 gesenkt** (`SITEMAP_EVENTS_MAX_URLS`
in `src/lib/seo/sitemap-xml.ts`, geteilt mit dem Regressionstest). Grund sind
gemessene Laufzeiten auf der Micro-Instanz:

| Zeilen | Floor | Laufzeit | verworfene Zeilen |
|---|---|---|---|
| 45.000 | ohne | 30.451 ms | 57.030 |
| 45.000 | mit | 21.517 ms | 16.675 |
| 15.000 | mit | **5.973 ms** | 3.215 |

45.000 Zeilen liefen zuverlässig in den 500er-Zweig, d. h. es kam **gar nichts**
an. 15.000 URLs nach `quality_score DESC` sind gegenüber null ein echter Gewinn
und liegen weit über dem, was Google bei ~6.400 Klicks/Monat crawlt. Wenn die
Instanz wächst: Wert erhöhen, aber **vorher neu messen**.

**Nachtrag (2026-08-26, Shard-Split):** Der 15k-Cap ist wieder weg — statt
einer großen Datei liefern jetzt **8 Shard-Dateien alle ~82.600
sitemap-fähigen Events** (25.074 → ~87.500 URLs inkl. /en-Paare). Gesharded
wird über den uuid-Raum der Event-`id` (random uuids verteilen sich
gleichmäßig: gemessen 10.195–10.611 Zeilen pro Achtel), jeder Shard ist ein
eigener Request mit eigenem CDN-Cache und liest sein Fenster per Keyset über
`id ASC` auf dem Teilindex `idx_events_sitemap_shard` (Migration
`20260826160000_sitemap_shard_index.sql`; `keyset_v2` danach gedroppt, die
quality-Sortierung diente nur der Auswahl unter dem Cap). Gemessen: 426 ms
je 1000er-Seite, ~11 Seiten pro Shard. Shard 0 bleibt unter
`/sitemap-events.xml` (GSC-Pfad bleibt gültig), Rest unter
`/sitemap-events-2.xml` … `-8.xml`, alle im Index `/sitemap.xml` gelistet.
Logik: `src/lib/seo/sitemap-events-shard.ts`. Überschreitet ein Shard je
49.000 URLs (bei ~200k future events), failt er laut — dann
`SITEMAP_EVENTS_SHARD_COUNT` erhöhen.

**Wartung:** Der `start_date`-Floor im Index ist statisch. Er verrottet nicht
gefährlich — der Index wird über die Jahre nur breiter und damit langsamer.
Etwa jährlich mit höherem Floor neu anlegen und den alten droppen, sobald die
Sitemap-Laufzeit wieder steigt.

**Warum das teuer war:** 19.913 kommende Events tragen einen J70-Ticketlink,
aber nur 1.094 dieser Seiten wurden in 50 Tagen überhaupt aufgerufen (5,6 %).
Nur 8,0 % aller Event-Seitenaufrufe (1.901 von 23.622) landeten auf einer
monetarisierbaren Seite. Die Klickrate dort ist mit 4,7 % (90 ticket_clicks)
gesund — der Engpass war Auffindbarkeit, nicht die TicketBox.

### 3.8 Fremde Affiliate-ID in oeticket-Links — behoben 2026-08-26

520 kommende Events (1.552 insgesamt) trugen einen oeticket.com-Deeplink mit
`?affiliate=H51`, der Partner-ID von eventfinder.at, deren Scraper den Link
samt ID durchreichte. Da `V4SideBox` die TicketBox für **jeden** gesetzten
`ticketUrl` rendert (nicht nur `source_name='Eventim'`), stand damit ein
echter Ticket-Button auf unseren Seiten, dessen Provision an einen
Mitbewerber ging — 231 Aufrufe in 50 Tagen.

**Fix:** `normalizeTicketUrl()` in `src/lib/db/supabase-sync.ts` biegt jeden
oeticket.com-Deeplink im einzigen Write-Pfad auf J70 um (7 Vitest-Fälle);
Bestand per Backfill bereinigt, Kontrollabfrage zeigt nur noch J70.

### 3.9 Falsche Veranstaltungsorte durch den Location-Normalizer — saniert (fn-25, 2026-09-14)

**Stand 2026-09-14:** Epic fn-25 umgesetzt (PRs #196–#216). Namensabgleich,
Nachtlauf-Normalisierung und Master-Coords-Trigger sind abgeschaltet; jeder
Schreibpfad läuft über den Resolver mit Belegen und den Freigabevertrag,
Rohwerte liegen in `raw_events` und `*_raw`-Spalten. Bestand bereinigt
(Backfill, Un-Merge von 149 Paaren, nicht mehr gelieferte Events als
ungeklärt erfasst), DB-Checks validiert, Ausspielung gestuft
(`NEXT_PUBLIC_LOCATION_GATING=1`: Pin, Anreise, Distanz und JSON-LD-`geo`
nur mit Beleg; Gemeinde-Ebene als Sammelmarker). Kennzahlen: 38,6 % der
künftigen Events präzise belegt, 34,3 % Gemeinde-Ebene, 2.198 Konflikte
zurückgehalten, 9.186 ohne Entscheidung bis zum nächsten sauberen Nachtlauf.
Nebenbefunde des Tages (Feed-Platzhalter, Deskline-Ländernamen, geteilte
Stadt-PLZ, Detailseiten-Heuristik) sind behoben. Betrieb und Werkzeuge:
[docs/ops/ortsdaten-prod-stand-2026-09-13.md](ops/ortsdaten-prod-stand-2026-09-13.md)
§13/§14, Prüfansicht `/admin/ortsdaten`.

*Ursprüngliche Analyse (2026-09-13):*

Der GeoNames-Normalizer ersetzt Veranstaltungsorte durch gleichnamige Dörfer
("Haus der Frau" → "Haus im Ennstal", "Martin-Luther-Kirche" → "Hirschegg",
"Theater in der Innenstadt" → "Theater an der Wien"); das GeoNames-Verzeichnis
trägt für 59 % der Einträge das falsche Bundesland (ADMIN1-Mapping vertauscht
OÖ↔Stmk, Sbg↔Tirol); PLZ/Bundesland/Bezirk werden aus der falschen Koordinate
zurückgerechnet; ein nächtlicher Lauf normalisiert alle Events erneut und der
Master-Coords-Trigger zementiert das Ergebnis. Gemessen: 57 % der Live-Events
tragen einen nackten Ortsnamen, ~5.500 messbare Widersprüche, Eventim AT zu
49 % betroffen (695× "Theater an der Wien"). Rohwerte sind nicht gespeichert,
kommen aber per Nacht-Scrape zurück. Analyse, Belege und Sanierungsplan:
[docs/ORTSDATEN-ANALYSE-2026-09-13.md](ORTSDATEN-ANALYSE-2026-09-13.md).
Revidiert damit §6 Punkt 3.

### 3.10 Dubletten trotz Dedup — Dedup auf Belege umgebaut (2026-10-07)

**Befund:** Dasselbe Konzert („Fehringer´s Kalte Küche", Sargfabrik, 7.10.)
war 4× sichtbar (Eventim, Wien-Ticket, Falter, ntry.at). Prod-Messung:
2.097 quellenübergreifende Paare mit identischem Titel, gleichem Wiener Tag,
< 200 m, beide sichtbar; 10.441 nie aufgelöste „uncertain"-Paare im Log.
Wurzeln: (1) gewichtete Punktsumme bestrafte fehlende Daten — URL und
Venue-Id stimmen quellenübergreifend fast nie überein, Ortsnamen sind
verschieden geschrieben → gleicher Titel + gleiche Uhrzeit + gleicher Pin =
0,775 „uncertain"; (2) Untertitel/Tournamen und „(A)" nicht erkannt;
(3) Platzhalter-Uhrzeiten als echte Zeit, UTC- statt Wiener Tage; (4) kein
Schutz gegen Ketten-Fusion, deshalb waren die Regeln nicht lockerbar;
(5) einmalige, klebrige Markierung (frühere Fehl-Fusionen und Altzeilen
blieben für immer); (6) keine Nachkontrolle.

**Umbau** (`src/lib/pipeline/dedup-*.ts`, CLAUDE.md „Event-Dedup"):
Entscheidung aus Belegen je Dimension (Titel gleich/Tippfehler/enthalten,
Ort gleich/Gemeinde/Widerspruch, Zeit gleich/unbekannt/Widerspruch), fehlende
Daten sind kein Gegenbeweis; Wiener Kalendertag; Mehrdeutigkeitsschutz
(ein Eintrag, der zu zwei verschiedenen Events passt, wird keinem
zugeordnet) und Widerspruchsprüfung im ganzen Cluster; jeder Lauf rechnet
alles neu, schreibt nur Abweichungen, löst Verbindungen nur mit Gegenbeleg;
verwaiste Altzeilen (Quelle liefert sie > 21 Tage nicht mehr) sind nie
Gegenbeleg und werden nie wieder sichtbar; Sicherheitsventil gegen
Massenänderungen; Pipeline-Schritt `dedup_audit` wird rot, wenn sichtbare
offensichtliche Dubletten übrig bleiben (Grenze 100). Keine
Quellen-Sonderregeln — neue Fehlerfälle gehören ins Golden-Set
(`src/__tests__/pipeline/dedup-golden.test.ts`).

**Ergebnis auf Prod (2026-10-07, PRs #283/#284, drei Läufe):** künftige
Duplikate 11.499 → ~19.000; sichtbare offensichtliche Restdubletten
837 → 22 (Rest: echte Unklarheiten wie zwei Christmetten im Ort);
Sargfabrik-Konzert 1× sichtbar (Eventim, J70) mit vier „Auch gelistet bei".
Nebenbei freigegeben: ~200 künftige Termine, die seit Monaten als Duplikat
versteckt waren (wiederkehrende Zeile wechselte per Upsert das Datum und
behielt die Markierung auf einen Apriltermin), echte Eventim-Vorstellungen
(Cirque du Soleil, „Tal des Unheils") und Events hinter als Müll
unterdrückten Primaries. Altfehler in `rewire_saved_events_to_primaries`
(Unique-Verletzung bei mehreren Duplikaten) behoben, Migration
`20261007150000_…` auf Prod angewendet.

**Nebenbefunde (eigene Tasks):** Ticketmaster speichert Wandzeit als UTC
(+1/+2 h); gem2go klebt Kategorie-Text an 1.928 Titel; 279 Events mit PLZ
1140 tragen Bezirk „tulln"; ntry.at liefert „Österreich" als Ort; einzelne
Quellen liefern Termine im Jahr 1 bzw. 2919.

**Abschlussprüfung (2026-10-08):** 68 Prüfagenten (Code, Zusammenspiel,
Betrieb, Prod-Daten, Szenarien, je Befund gegengeprüft) fanden:
- **Sicherheit (kritisch):** anon konnte zehn schreibende SECURITY-DEFINER-
  RPCs aufrufen, darunter `bulk_update_event_publish`. Damit konnte jeder
  Events verstecken oder freischalten. Ursache: Default-Privilegien in
  `public`; der Hetzner-Restore wich von den Migrationen ab. Gesperrt
  (Migration `20261008120000_…`), dazu ein Live-Wächter im Pipeline-Schritt
  `security_audit`.
- **Erster Nachtlauf vom Ventil gestoppt:** 1.623 neue Duplikate, 517
  Freigaben. Der Stopp hielt sich selbst, 303 der Freigaben betrafen nur
  vergangene Tage. Jetzt wird erst ab dem Wiener Vortag geplant, die Grenzen
  lassen sich per workflow_dispatch freigeben, der Plan liegt als Artefakt
  vor und die Alarm-Mail nennt den Grund.
- **Verklemmung:** 433 frische Termine hingen hinter verwaisten Altzeilen.
  Feratel-Serien-Basiszeilen ohne Datum wanderten jede Nacht weiter und
  übernahmen kurz vor jedem Termin die URL. „ABGESAGT: X" war unter „X"
  verborgen. Der Müll-Filter versteckte Ufo361 samt Eventim, und der Upsert
  machte Müll jede Nacht wieder sichtbar.
- **Weitere Lücken:** Alte Fehlverbindungen mit Gegenbeleg wurden nie gelöst
  (gleiche Quelle mit anderem Titel, Nachbarpfarren). Eventim-Zeitfenster im
  10-Minuten-Takt wurden verschmolzen.

Alle Punkte sind als Regeln mit Tests behoben (Golden-Set
`dedup-golden-2026-10-08`). Danach (2026-10-09) prüften vier Runden
Stichproben jeder geplanten Änderungsart gegen Prod (je 170 bis 230 Fälle,
Seiten der Quellen mit abgerufen). Falsch versteckte Events fielen von
3 auf 1 je 50. Weitere Ursachen sind behoben:
- „Gleiche Quelle" bei Aggregatoren wie gem2go (Grinzens unter Kematen).
- Feratel-Terminzeilen, die einfroren.
- Altzeilen mit +1/+2 h neben der frischen Zeile.
- Adresse als Ortsname.
- Titel ohne Namen auf der eigenen Event-Seite (bleibt sichtbar).
- Blätterseiten.
- Erfundene „heute"-Termine aus dem Gemeinde-Scraper.

Runde 4 (Freigaben 66 von 85 richtig, Umhängen 18 von 20, neue Duplikate
48 von 50, Müll 10 von 20) fand drei weitere Muster, alle behoben: Gemeinde-Kalender setzen ihre
eigene PLZ und ihren Ortsnamen auch für Events der Nachbargemeinde (6 von 8
Etiketten-Freigaben falsch, „NÖ-Demenztag" steht in 25 Kalendern); ein
mitten im Wort abgeschnittener Titel verdrängte die Eventim-Zeile; der
Müll-Filter verband über die Platzhalter-Mitternacht fremde Events derselben
Website und hielt Listen-Beschriftungen auf ICS- und Listen-Links für
eigene Event-Seiten.

Probelauf ab Vortag: einmaliger Nachholplan mit rund 4.850 neuen
Duplikaten, 2.050 Freigaben (davon rund 1.560 Rollentausch) und knapp 700
Müllzeilen in 275 s (vorher 400 s über alle Tage).

Betreuter Nachholplan 2026-10-09 (8.269 neue Duplikate, 2.172 umgehängt,
1.890 Freigaben, 696 Müll; zweiter Lauf danach 0/0/0/0). Die Nachtläufe
am 10. und 11.10. stoppten trotzdem am Ventil (5.084 / 5.810 neue
Duplikate, Restdubletten bis 4.553). Ursachen: (1) Der stündliche
Feratel-Sync legte eine Stunde nach dem Nachholplan in einer zweiten Welle
4.326 Terminzeilen an, rund 3.900 Basiszeilen standen danach sichtbar
neben ihrer eigenen Terminzeile. (2) Das Ventil zählte den normalen
Zulauf mit (rund 940 neue Duplikate je Nacht); nach einem Stopp summierte
sich der Zulauf zweier Nächte über die Grenze, das Ventil blockierte sich
selbst. Seit 2026-10-11 zählt es nur neue Duplikate am Bestand: Zeilen,
die vor dem Beginn des letzten geschriebenen Laufs angelegt wurden
(Tabelle `dedup_runs`), und nicht Basis-/Terminzeile derselben Serie.

Offen und an der Quelle zu beheben (keine Dedup-Fehler):
- Gutschein-Produkte mit Platzhalterdatum 31.12.2030 (veranstaltungskalender.net).
- Müllabfuhr-Termine (entschieden 2026-10-14, siehe unten).
- gem2go-Titel mit angeklebter Kategorie.
- Falsch konfigurierte Gemeinde-Kalender: 70905 liest Buch in Vorarlberg,
  30701 liest Au im Bregenzerwald.
- Ticketmaster-Zeitzone.
- Der Eventim-Affiliate-Link geht verloren, wenn die Eventim-Zeile einen
  Ortskonflikt hat (3 bis 5 Events, Anzeige-Frage).
- Titel-Parser, die statt des Namens eine Beschriftung oder das Datum lesen:
  gemeinde-registry „mehr" (Niederleis), gemeinden-generic
  „Veranstaltungsdetails"/„Termin" (Neuberg), „mehr Information"
  (Rettenschöss), Treibhaus, The Loft, BettelAlm, Gänserndorf. Diese Zeilen
  bleiben auf ihrer eigenen Seite sichtbar, tragen aber keinen Namen.
- Eventim führt Ticketprodukte desselben Abends als eigene Events
  („Eintagesticket" / „Kombiticket", Jazz, Wine & More).
- Kommunale Dienste als Termine (Klimaticket, Dorfservice, Müllabfuhr,
  Sprechtage): entschieden 2026-10-14, nicht zeigen (§4 Punkt 4). Gesunde
  Gemeinde sind echte Kurse und bleiben.

### 3.11 Platzhalter-Termine weit in der Zukunft: Horizont im Freigabevertrag (2026-10-14)

**Befund (Prod-SQL):** veranstaltungskalender.net führt Gutscheine und
Dauerangebote („Bungee Jumping - T - Europabrücke", „Vinarium
Wertgutschein") mit dem Datum 31.12.2030 (102 sichtbar, täglich neu
geliefert) und 31.12.2037 (69 sichtbar), dazu Tippfehler-Jahre (2029, 2202,
2919, 3017). Die Quelle druckt das Datum selbst. `admission.ts` kannte nur
die Untergrenze, die Detailseiten antworten 200, also blieb alles sichtbar.
Jenseits von drei Jahren stand im ganzen Bestand nur so etwas; Eventim hatte
dort 0 Termine, zwischen zwei und drei Jahren 7.

**Regel:** Quarantäne `start_too_far_ahead`, wenn der Beginn mehr als drei
Jahre nach heute liegt (Wiener Kalendertag). Quarantäne statt Verwerfen,
damit der nächste Upsert schon veröffentlichte Zeilen auf `needs_review`
setzt. Der Grund ändert die Ortsentscheidung nicht (`NON_LOCATION_REASONS`),
steht aber als `admission:start_too_far_ahead` im Protokoll; daran hält
auch die erneute Entscheidung im Bestand (`re-resolve.ts`) die Zeile.

**Listenende (2026-10-17):** Der Scraper erreichte die 2037er Zeilen nicht
mehr: Wien hatte 330 Listenseiten (Gutscheine auf Seite ~290 bis 325), OÖ
447, der Scraper brach je Bundesland bei `MAX_PAGES = 200` ab. Von 273
sichtbaren AT-Zeilen jenseits des Horizonts lieferten 170 ihre Quellen
nicht mehr (vknet 119, gemeinden-generic 43). Jetzt liest der Scraper jede
Liste bis zur letzten Seite laut Pager, die Bundesländer im Wechsel, mit
38 min Zeitbudget unter einem eigenen harten Timeout von 45 min
(Standard 25). Probelauf 2026-10-17: alle 1.578 Seiten in 29 min (lokal,
in Actions ~1 s je Seite), 790 Termine statt bisher ~525, darunter 75
Wiener 2037er. Reicht das Budget einmal nicht, fehlen nur die fernsten
Termine jeder Liste. Eine Seite zählt als leer nur ohne gelisteten
Eintrag: Wien Seite 228 bis 231 zeigte nur einen Titel über 200 Zeichen,
den der Parser verwirft, und hätte die Liste sonst dort beendet. Die
source_ids bleiben `vknet-<id>`.

Prod-Lauf 2026-10-17 (Actions, 27,5 min): 789 Termine, 204 per
`start_too_far_ahead` zurückgehalten, sichtbare vknet-Zeilen jenseits des
Horizonts 71 → 38. Die 38 sind Altzeilen mit source_id ohne Präfix („9220",
angelegt 2026-03-29, zuletzt 05./06.05., ohne Admission-Protokoll): Dedup-
Primary vor ihrem frisch gelieferten Zwilling `vknet-…` derselben URL. Der
Dedup stellt das nicht um, weil er Tage mehr als fünf Jahre voraus
überspringt (`isPlausibleEventDay`); sie hält `admission_recheck`.

**Grenzen:**
- gemeinden-generic (43 Zeilen) liefert seine Zeilen jenseits des
  Horizonts weiterhin nicht; der nächtliche Adress-Geocoder entscheidet
  nur einen Teil neu. Seit 2026-10-17 hält sie der Pipeline-Schritt
  `admission_recheck` (siehe unten).
- Ein Platzhalter 31.12.2030 rückt am 31.12.2027 in den Horizont und wäre
  dann wieder sichtbar.
- Eventim-Gutscheine (GrazTourismus „Gutschein für einen …-Rundgang",
  31.12.2026/2027): im Feed `eventType 1` und `productType 1` wie jedes
  Ticket, nur `priceCategoryName: "Gutschein"` unterscheidet sie
  (Feed-Probe 2026-10-14). Kein Filter, solange kein strukturiertes Feld
  trennt.

**Nachprüfung im Bestand (2026-10-17):** Sync und re-resolve entscheiden
`publish_status` nur beim Schreiben; Zeilen, die keine Quelle mehr liefert,
erreichen sie nicht. Drei Tage nach den Regeln waren noch 127 Gemeinde-Dienste
(alle verwaist, ohne Quellenstand) und 124 Termine jenseits des Horizonts
sichtbar. Der nächtliche Schritt `admission_recheck` (nach `withdrawal`, vor
dem Dedup) rechnet die Regeln, die nur an Titel und Termin hängen
(`titleTimeQuarantineReasons`), für alle künftigen sichtbaren und
zurückgehaltenen Zeilen neu: halten mit Grund im Protokoll, freigeben, wenn
der Grund entfällt und nichts anderes hält. Ventil 500 Haltungen / 300
Freigaben. Der Dedup (`underlyingStatus`) rechnet dieselben Regeln, damit
kein Duplikat als Ersatz für ein so gehaltenes Primary sichtbar wird.
Dry-Run gegen Prod: 251 Haltungen (127 Dienste, 124 Horizont), 0 Freigaben,
23 nur Protokoll.

### 3.12 Veranstalterbüro als Veranstaltungsort (Feratel, 2026-10-14)

**Befund (Prod-SQL):** Die Deskline-Detailseite führt unter addressType 32
(Veranstaltungsort) teils dieselbe Büroadresse wie unter 31 (Veranstalter).
„The Magic of Elvis" (Konzerthaus Klagenfurt) und „Impulso Tenors" (KUZ
Eisenstadt) bekamen so „Hollergasse 32/6, 1150 Wien", standen auf dem
Wiener Mittelpunkt mit Bundesland Wien, die Klagenfurter Eventim-Zeile hing
als Dublette dahinter. Kette: `mergeFeratelDetail` übernahm Straße und PLZ,
der Resolver nahm die eindeutige PLZ ohne Blick auf den genannten Ort, der
Freigabevertrag las die PLZ als Bestätigung ihres eigenen Mittelpunkts
(`use_coordinate_region`). Rund 1.440 künftige Feratel-Zeilen trugen eine
Venue-Adresse aus einer anderen Gemeinde als dem Listen-Ort.

**Regeln:** Die Venue-Adresse zählt nur in der Gemeinde des Listen-Orts
(`place-match.ts`, Abgleich über `gemeindenNamedByPlaceText`: Teile,
Post-Orte, Abkürzungen), ohne Listen-Ort, oder wenn die Quellkoordinate im
Bundesland der Venue liegt (Grenzregionen Dachstein West, Katschberg);
sonst `address_rejected: venue_other_town`. Der Resolver verwirft eine PLZ,
die weder im genannten Ort noch im genannten Bundesland liegt und von
keiner Quellkoordinate gestützt wird (`plz_contradicts_city`). Ein reiner
PLZ-Mittelpunkt bestätigt die PLZ im Vertrag nicht (`coords_from_plz`). Eine
vom Resolver abgeleitete Position folgt der neuen Entscheidung
(`derived_position_superseded`), statt per Rang festzuhängen.

**Wirkung (Simulation alter gegen neuen Code über alle 26.557 künftigen
Feratel-Zeilen):** Adresse/PLZ ändern sich bei rund 1.440, Positionen bei
241, 99 zurückgehaltene Zeilen werden frei (API-Pin gegen Veranstalter-PLZ
war ein Konflikt), 8 veröffentlichte werden zurückgehalten (Rußbach ohne
API-Koordinate, Position stammte nur aus der Gosauer Veranstalter-PLZ).

### 3.13 502-Bursts im Minutenraster: ISR-Guard in der Schleife (2026-10-17)

**Befund (Caddy-Log, isr-guard-Log, systemd-Timer):** In 48 Stunden
1.918 Antworten mit Status 502 an Besucher, Googlebot, OAI-SearchBot,
in Minuten-Bursts (17.10. 05:00 UTC: 184 in einer Minute). Fehlertext der
Zeilen: 1.409 × „dial tcp 172.18.0.5:3000: connect: connection refused",
467 × „lookup nextjs-app on 127.0.0.11:53: server misbehaving" — der
Container war in diesen Sekunden nicht da. 96 % der 502 (1.844) fielen in
die 40 s nach einem Eintrag „raeume ISR-Cache ab" in
`/var/log/lt-isr-guard.log`; der Rest sind Deploys. `nextjs-app` hatte
RestartCount 0, weil Compose den Container jeweils neu *erzeugt*
(StartedAt = Guard-Zeitstempel). Der Guard lief seit dem 06.10. bei jedem
Takt (95/Tag, vorher 2–4/Tag): Platte 77 % → Recreate → 76 % → 15 min
später wieder 77 %. Der Writable-Layer, den ein Recreate freigibt, war
dabei nur 180–380 MB groß. Die Platte hielt das Envoy-Access-Log
(`supabase-envoy`, json-file ohne Rotation, 14,2 GB, ~360 MB/Tag mit
kompletten PostgREST-Query-Strings) plus 18,8 GB Images (davon 3,1 GB
`lasstreffen-app:isrtest` und 2,96 GB beatshyft) über der 70-%-Schwelle.
Der lt-watchdog meldet erst ab 80 % und sah die Schleife nicht.

**Behebung (live 17.10. 09:25 UTC, Backups mit Suffix `.bak-2026-10-17`):**
`isr-guard.sh` misst den Writable-Layer (`docker inspect -s`, SizeRw) und
erzeugt nur ab 8 GB neu (Notbremse: ab 90 % Platte reichen 2 GB); liegt die
Platte über 70 %, der Layer aber darunter, schreibt er höchstens alle 6 h
eine Warnung statt zu recreaten. Envoy mit `logging: max-size 100m ×
max-file 5` in `docker-compose.override.yml` neu erzeugt (letztes GB des
Logs gzip in `/var/backups/envoy-access-tail-2026-10-17.log.gz`), dieselbe
Rotation in `/opt/app/docker-compose.yml` für nextjs-app (greift beim
nächsten Deploy). Platte 77 % → 58 %. Kein `/etc/docker/daemon.json`:
Log-Optionen gelten nur für neue Container und brauchen einen Docker-
Neustart, der ohne live-restore alle Container (Postgres!) mitnimmt.

**Offen:** `lasstreffen-app:isrtest` + Container `nextjs-isrtest` und
`crazy_hawking` (node:22-slim, seit 5 Wochen) belegen ~3,5 GB ohne
erkennbare Aufgabe; der Watchdog kennt die Recreate-Frequenz nicht
(sinnvoll: Alarm ab 4 Recreates/24 h). Wurzel-Fix für den ISR-Cache
bleibt ein `cacheHandler` mit Größenlimit.

### 3.14 Cloudflare als Proxy vor der Website (2026-10-21)

**Anlass:** AdSense-Einschränkung seit 16.09. durch Bot-Farmen mit
Browser-UA (AWS-Headless, Tencent, Baidu-Render-Crawler Chrome/99 aus
116.179.33.x). Jede Welle wurde einzeln in Caddy gesperrt (§3-Memos,
`Caddyfile` Bot-Sperre I bis III). Seit 21.10. läuft `lasstreffen.at` und
`www` hinter Cloudflare Free (Zone `962399ba2ed7d14167caf40733fdee2d`,
Nameserver cortney/jacob.ns.cloudflare.com, Registrar Internex). Bot Fight
Mode, drei WAF-Regeln (Block Chrome/99-UA, Managed Challenge für
Chrome-Builds unter 140 und für nicht verifizierte Clients aus China, je ohne
`cf.client.bot` und robots.txt), IP-Allow für den eigenen Server, TLS Full
(strict), Email-Obfuscation aus, Cache nur für `/_next/static`, `/_next/image`,
`/icons`, `/images`, `/favicon` (Rest Bypass). `api.lasstreffen.at`, `neu`,
`flights`, MX/TXT/DKIM bleiben DNS-only. Caddy bleibt zweite Schicht:
`trusted_proxies` aus den Cloudflare-Netzen (`lt-cf-ranges.timer`, täglich),
`client_ip_headers CF-Connecting-IP`, alle Sperrlisten als `client_ip`-Matcher,
Rate-Limit-Key `{client_ip}`. Plan, Rückwege und Skripte:
`docs/ops/cloudflare-proxy-2026-10.md`, `docs/ops/cloudflare/`.

**Belege nach dem Cutover (21.10., 13:05 bis 13:20 UTC):** `cf-ray` und
`server: cloudflare` auf jeder Antwort; Caddy-Log zeigt `remote_ip` aus dem
Cloudflare-Netz und `client_ip` = echte Client-IP (82.218.41.127 über
172.68.50.203); `/api/health` 200 über den Edge auch mit curl-UA (IP-Allow);
Chrome/99-UA 403 schon am Edge, Chrome/124 Managed Challenge
(`cf-mitigated: challenge`), Headless-Signatur weiterhin 403 von Caddy;
statische Assets `cf-cache-status` MISS dann HIT, HTML DYNAMIC; Rate-Limit
120/min greift pro Client über Cloudflare (429 mit `retry-after: 15`); Let's
Encrypt HTTP-01 durch den Proxy funktioniert (Wegwerf-Host `cf-test`
bekam um 13:07 ein Zertifikat); AdSense-Script lädt auf Event-Seiten ohne
CSP-Fehler; im zehnminütigen Caddy-Volllog kamen 7 Googlebot- und 22
bingbot-Abrufe über Cloudflare mit 200 an (`client_ip` aus den
verifizierten Netzen, keine Challenge).

**Fallen:** (1) Cloudflares Universal-SSL-Zertifikat war nach der
Aktivierung rund acht Minuten `pending_validation`; solange scheitert jeder
HTTPS-Handshake am Edge für Resolver, die schon die Cloudflare-IPs kennen.
Richtig ist: Zone mit DNS-only-Records anlegen, Nameserver umstellen, erst
nach `certificate_packs status=active` die Records proxien. (2) nic.at
veröffentlicht die Zone stündlich, die Delegation war 55 Minuten nach dem
Internex-Eintrag draußen; Resolver halten NS-Einträge bis 3 h. (3) Der
Server geht per IPv6 raus; der IP-gefilterte API-Token verlangt `curl -4`.
(4) Bot Fight Mode ist nicht per WAF-Regel umgehbar, nur eine
IP-Access-Allow-Regel greift vorher. (5) `cf.threat_score` ist dauerhaft 0,
Challenges brauchen eigene Signale (UA-Build, Land, `cf.client.bot`).

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
4. **Gemeinde-Dienste sind keine Events (2026-10-14).** Müllabfuhr und Sammelstellen,
   Sprechtage und Sprechstunden, Klimaticket-Verleih und Dorfservice werden nirgends
   gezeigt (Liste, Karte, Hubs, Suche, Sitemap, Event-Seiten). Die Zeilen bleiben in der
   DB, die Entscheidung ist umkehrbar. Umsetzung als Quarantäne-Grund `municipal_service`
   im Freigabevertrag (`src/lib/quality/admission.ts`), Erkennung in
   `src/lib/category-classifier/municipal-service.ts` (auch von der Smart-Suche genutzt).
   Bestand kippt beim nächsten Upsert oder per Neu-Entscheidung
   (`location-backfill.ts --with-raw --ids`), kein Fix-Skript. Der Ort bleibt
   unverändert, die Admin-Prüfliste blendet den Grund aus, der Dedup gibt keine alte
   Dublette als Ersatz frei. Echte Gemeinschafts-Events (Flurreinigung,
   Müllsammelaktion, Repair Café, Gesunde-Gemeinde-Kurse, Tag der offenen Tür im ASZ)
   bleiben; neue Dienst-Arten gehören in dieselbe Erkennung, nicht in Quellen-Sonderregeln.
   Vorher sichtbar: Müll 505, Sprechtage 370, Klimaticket 29, Dorfservice 13.

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
**Oberfläche neu seit 2026-10-23** (Befund `docs/design/smart-suche-analyse-
2026-10-23.md`, Mockups `docs/design/smart-planer/`): der Concierge-Chat im
Smart-Tab brachte in 30 Tagen 35 Suchen und einen Klick auf ein Ergebnis
(10 bis 17 s Prosa, Treffer als Mini-Zeilen). Jetzt Freitext-Feld →
`/api/search/semantic` → Verstanden-Chips, ein deterministischer
Concierge-Satz, Poster-Regale nach Tag oder Tagesphase, Plan-Leiste
(`V4SmartPlanner`). Stufe 0 dazu: Intent-Fehler werden in Prod geloggt,
Intent läuft über `CONCIERGE_PROVIDER` (Prod OpenAI) mit dem anderen
Anbieter als Reserve, Wort-Fallback ohne Stoppwörter wie „von", konkrete
Tage/Monate im Parser, Serien auf eine Karte, `parsed.unmatched_terms` für
ehrliche Leere. `/api/search/chat` bleibt als API, kein UI mehr. Offen:
AdSense-Auto-Anzeigen (Anchor über dem Eingabefeld, Intent-Links im Text)
im AdSense-Konto für /entdecken ausschließen; Venues (312 k OSM-Lokale,
79 k mit Öffnungszeiten) sind nicht an die Suche angebunden, Specials
(Happy Hour) gibt es in keiner Quelle.

**Was die Qualität stattdessen sichert:**

1. **Strukturierte Quellen bevorzugen.** Eventim-PFT liefert Kategorie (locked),
   Genre→Tags-Mapping, Preise, Koordinaten, Bilder — fertig. `dedup_eventim_wins()`
   macht Eventim bereits kanonisch bei Fingerprint-Duplikaten. Gleiches Prinzip für
   Feratel/TourData/Wien-OGD/ICS/JSON-LD-Connectoren: Feld-Mappings pro Quelle
   deterministisch pflegen statt nachträglich per LLM raten.
2. **Deterministischer Classifier** ([src/lib/category-classifier](../src/lib/category-classifier))
   bleibt der einzige Kategorien-Pfad (`categorization_backfill`-Step bleibt).
3. ~~**GeoNames-Location-Normalizer** + Koordinaten-Confidence-Ranking bleiben.~~
   **Revidiert 2026-09-13:** Der Normalizer ist die Hauptursache falscher
   Veranstaltungsorte (§3.9). Name kommt künftig unverändert von der Quelle,
   Koordinaten aus Adresse/PLZ/Venue-Register; GeoNames nur noch für
   Stadtname → Gemeinde mit PLZ-/Bundesland-Sperre.
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
Seit fn-30 (2026-10-29) gibt es dazu den **Tipp des Tages** auf der Startseite:
ein buchbarer Platz je Wiener Kalendertag (`landing_features.kind =
'sponsored'`, Buchung über `/admin/boost`, Pflicht-Label „Anzeige“ plus
Sponsorname nach § 26 MedienG / § 6 ECG, Klicks als `landing_tip_click`);
Abrechnung weiterhin manuell, kein Checkout (§10.2 Punkt 5).

### 7.3 Weitere Quellen (Reihenfolge nach Realismus)

0. **Aktivitäten-Affiliate (Viator/GetYourGuide, fn-18.5 — offen):** die
   /aktivitaet-Detailseiten aus dem fn-18-POI-Bestand sind Buchungs-Intent pur
   (Therme, Sommerrodelbahn, Führung) und haben — anders als Event-Seiten —
   keine Saison-Klippe. Fehlt noch: Affiliate-Client, Produkt-Matching,
   BookingBox, Preis-Refresh. Der OSM-Bestand (`osm_pois`) ist davon
   ausgenommen: ODbL-getrennt, keine Detailseiten, keine Affiliate-Fläche.
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

1. ✅ **Personalisierung raus aus dem Server-Render** *(erledigt 2026-07-08)*:
   `page.tsx` ruft kein `getLandingContext()` mehr; `getLandingData()` nutzt
   einen cookie-freien Anon-Client → `/` ist wieder echte ISR-Route
   (verifiziert: `.next/prerender-manifest.json` enthält `/` mit
   `initialRevalidateSeconds: 3600`). Route `GET /api/me/landing`: seit
   fn-30 (2026-10-29) ist die Kachel „Diese Woche live“ (`ArtistsLive`,
   Client) ihr einziger Leser und ruft sie nur bei sichtbarem
   `sb-*`-Cookie (anonyme Besucher feuern keinen Request). Die Route
   liefert `followedLive` (gefolgte Künstler mit Eventim-Termin in den
   nächsten 7 Tagen aus `event_artists`, Abgleich in JS über
   `normalizeArtistName`) und `followedNames`; die Kachel zeigt gefolgte
   Künstler zuerst und füllt aus der stündlichen Rotation auf drei auf.
   `matches` und die ID-Sets (`savedEventIds`, `artistMatchEventIds`,
   `lineupMatchEventIds`) liefert sie weiter, ohne Leser.
2. ✅ **Doppeltes `auth.getUser()`** — durch (1) miterledigt: die Landing
   ruft gar kein getUser mehr; nur die Middleware macht den einen Refresh.
3. ~~`.limit(8)`~~ — obsolet: die unbegrenzte notifications-Query läuft
   nicht mehr pro Landing-Render, sondern nur noch im seltenen
   /api/me/landing-Call (60-Tage-Fenster begrenzt sie inhaltlich).
4. Middleware-Session-Refresh auf die Routen beschränken, die ihn wirklich brauchen
   (auth-gated Seiten), statt auf jede Seite. *(offen)*
5. **Tagesausgabe (fn-30, 2026-10-29): Mitternacht und Buchungen.** Die
   Startseite rechnet in Wiener Kalendertagen (Datumszeile, Tipp des Tages,
   Programm „Heute Abend“), bleibt aber eine ISR-Shell mit `revalidate = 3600`.
   Zwei Wege halten sie frisch: `/api/admin/landing-feature` ruft nach jeder
   Buchung `revalidateLanding()` (`src/lib/landing/revalidate-landing.ts`:
   `/[locale]` als Seitenmuster plus `/` und `/en`), und
   `GET /api/cron/revalidate-landing` (Bearer `CRON_SECRET` Pflicht, fail
   closed) macht dasselbe um **00:05 Europe/Vienna**. *Ops, noch einzurichten:*
   Timer `lt-cron@revalidate-landing.timer` auf Hetzner nach dem Muster der
   anderen `lt-cron@`-Timer (curl auf `127.0.0.1:3000/api/cron/revalidate-landing`
   mit Bearer), `OnCalendar=*-*-* 00:05:00 Europe/Vienna` (die übrigen Timer
   laufen in UTC; hier zählt die Wiener Mitternacht, sonst springt der Tag bei
   Sommer-/Winterzeit eine Stunde zu früh oder zu spät). `vercel.json` hat
   keine Crons mehr. Buchungen: `landing_features.kind` (`sponsored` = Tipp
   des Tages, ein Platz je Wiener Tag, Pflicht `sponsor_name`, Überschneidung
   → 409; `editorial` = Saison-Karte wie bisher), Admin-UI `/admin/boost`
   (Art, Sponsor, Tag, Status aktiv/geplant/abgelaufen/nicht sichtbar).
   Voraussetzung in Prod: Migration `20261029200100_landing_features_kind.sql`
   plus `NOTIFY pgrst, 'reload schema'`, sonst antwortet PostgREST auf
   `kind`/`sponsor_name` mit 400 und die Route mit 500.

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
3. ✅ **Pipeline zerlegt** *(erledigt 2026-07-07)*: `scrape-events.yml` → N
   parallele Shards (`scrape.ts --shard i/N`, deterministisch alphabetisch) +
   Venues-Job + ein Post-Processing-Job (`--skip-scrapers --skip-venues`) mit
   `if: always()`. Semantic-Search/Embeddings-Step aus der Pipeline entfernt.
   **Nachjustiert 2026-07-08 nach erstem Lauf** (6 Shards à 150 min: 2 fertig
   in 35/85 min, 4 am Timeout gekillt): (a) auf 10 Shards à 300 min erhöht
   (`4f09e4b`); (b) **eigentliche Root-Cause gefixt** (`27b3eaf`) — `scraper.
   scrape()` lief ohne Deadline, ein hängender Upstream-Request blockierte
   den Worker-Slot dauerhaft und damit den ganzen Shard bis zum GitHub-Kill
   (Beleg: letzte DB-Writes ~60 min vor dem Kill). Jetzt Per-Scraper-Timeout
   25 min (`SCRAPER_TIMEOUT_MIN`). **Offen (P2):** per-Scraper-Laufzeit nach
   `source_runs` schreiben → lastbalanciertes Sharding statt round-robin
   (die Mega-Kommunal-Aggregatoren gem2go/gemeinde-registry/gemeinden-generic/
   boudicca sind die Zeitfresser).
4. ✅ **Klick-Tracking** *(erledigt 2026-07-07)*: globaler `ClickTracker`
   (delegierter `data-track`-Listener im Root-Layout); Ticket-CTA sendet
   Event-ID + Provider mit.
5. ✅ **Brand-Fix** *(erledigt 2026-07-07)*: „Österreich Events" +
   `oesterreich-events.at` → LassTreffen.at in AGB, Impressum, Datenschutz,
   Quellen, Footer, Auth-Layout, Blog-JSON-LD, /fuer-firmen, package.json.
6. ✅ **`seo-daily-snapshot` Root-Cause gefunden + gefixt** *(2026-07-08)*.
   **Zweistufige Diagnose — erste Hypothese war falsch, per Vercel-Logs
   korrigiert:** Aus Code+DB allein (letzter Row 29.04. vollständig, saubere
   Kante, Schema trivial, keine Git-Änderung, Cron-Eintrag durchgehend)
   schloss ich zunächst auf hängende GSC/CrUX-Fetches ohne Timeout. Die
   Vercel-Function-Logs (vom User) widerlegten das: der Cron **läuft** täglich,
   und die 504-Timeouts liegen bei **Supabase**, nicht Google — 4× `HEAD
   /rest/v1/events` (die `count exact`-Queries) à **10–30s** + die GROUP-BY-RPC
   `seo_count_indexable_gemeinde_hubs`. `collectInternalMetrics` läuft in
   buildSnapshot als Erstes und frisst mit Full-Scans auf 304k Zeilen die
   kompletten 60s auf, **bevor** GSC/CrUX oder `writeSnapshot()` drankommen
   (daher „No outgoing requests" zu Google). Gleiche Wurzel wie §3.5
   (count(*) auf events zu langsam). Die Route gab still 200 → 10 Wochen
   unbemerkt. **Fix (`b789a68` + Folgecommit):**
   - `collectInternalMetrics`: `count: 'exact'` → **`count: 'planned'`**
     (Planner-Schätzung statt Scan; per EXPLAIN gegen Prod verifiziert:
     instant + Schätzung ~69,7k ≈ MV-Wert). Näherung für Trend-Telemetrie ok.
   - `buildSnapshot`: externe Daten zuerst, jeder Collector **hart
     deadline-begrenzt** (`withDeadline`: gsc/traffic/cwv 12s, internal 8s,
     Gemeinde-RPC 4s) → Summe < 60s, `writeSnapshot` läuft garantiert; CrUX
     parallelisiert.
   - Route: **500 statt still 200** bei Snapshot-Fehler → künftige Ausfälle
     im Cron-Dashboard rot sichtbar.
   - Defensiv beibehalten: `fetchWithTimeout` (10s) auf GSC/CrUX (richtige
     Härtung, nur nicht die eigentliche Ursache).
   ⚠️ **Verifikation:** nach Deploy im Vercel-Cron-Dashboard „Run" auf
   `seo-daily-snapshot` → muss 200 + frischen `seo_snapshots`-Row erzeugen
   (Trace zeigt dann Supabase-Calls im ms-Bereich statt 26–30s).
7. Smart-Suche: Embedding-Architektur entsorgt, Feature **neu gebaut** als
   Query-Zeit-Intent (§6, revidiert nach User-Feedback) — Smart-Tab +
   Concierge sind wieder live; nur `build-embeddings` + pgvector sind weg.

### P1 — Monetarisierung, Retention & Instant-Loading (Monat 1)

✅ Landing statische Shell + Client-Personalisierung (§10.2, 2026-07-08) ·
✅ **Affiliate-Boxen im Blog** *(2026-07-08)*: `BlogTicketBox` zieht live
buchbare Eventim-Termine per Titel-Match (validiert: Frequency 10, Nova Rock 5,
Electric Love 1 Treffer), Titel verlinkt intern auf die Event-Seite, CTA mit
`rel="sponsored"` + `ticket_click`-Tracking, „Anzeige"-Label + Disclosure;
Blog-Detailseiten jetzt ISR (6 h); /ueber-uns-Finanzierungstext auf
„Eventim-Affiliate aktiv" aktualisiert ·
✅ Enrichment-Codepfade entfernt (§6, 2026-07-08: enrich-*-Scripts,
Pipeline-Flags, npm-Einträge, Test; Admin-Review-UI bleibt vorerst) ·
✅ CLAUDE.md neu geschrieben (beschrieb Phantom-Repo mit SQLite/ohne Eventim) ·
✅ **„Ähnliche Events" + Hub-Links + BreadcrumbList** auf Event-Detailseiten
*(2026-07-08)*: `V4RelatedEvents` (ISR-sicher, Anon-Client, Composite-Index-
Query 352 ms) + „Mehr entdecken"-Zeile mit existenz-geprüften Gemeinde-/
Bundesland-Hub-Links + BreadcrumbList-JSON-LD ·
✅ **Stripe-Boost-Checkout** *(2026-07-10, Test-Modus)*: Self-Service auf
/fuer-firmen (#boost): Event-Link einfügen → `POST /api/checkout/boost`
(Session 29 €, metadata bindet event_id) → Stripe → `/fuer-firmen/boost/erfolg`
verifiziert die Zahlung SERVERSEITIG gegen Stripe (kein Webhook nötig,
nichts fälschbar) und setzt is_boosted/boost_tier/boost_until
(bis 1 Tag nach Event, Cap 28 Tage; expire-boosts-Cron räumt ab).
Verifiziert gegen die echte Stripe-Test-API (Session 29,00 €, unbezahlt →
verweigert). ⚠️ Vor Live-Gang: `STRIPE_SECRET_KEY` in Vercel-Env (aktuell
Test-Key), USt-Handling klären (Seite sagt „zzgl. USt" — Stripe Tax oder
Preis brutto), Live-Keys NIE in Chat/Repo ·
✅ **Wochen-Newsletter pro Region** *(2026-07-14, User-Go für Double-Opt-in)*:
`newsletter_subscribers` (RLS, service-role-only) · Subscribe/Confirm/
Unsubscribe-APIs mit HMAC-Tokens (UNSUBSCRIBE_SECRET-Kette wie
Artist-Alerts, kein Token-Storage) · `NewsletterSignup` auf der Landing
(ohne Account, Region wählbar inkl. „ganz Österreich") · Vercel-Cron
freitags 06:00 UTC rendert den city-digest pro Region (Events-Query 1×
pro Region, Eventim-Affiliate-Links im Digest, Regionen mit <3 Events
werden übersprungen) · Datenschutz-Sektion (Double-Opt-in, Brevo als
Auftragsverarbeiter). ⚠️ Brevo-Free = 300 Mails/Tag — bei >250
Abonnenten Plan upgraden oder Versand splitten (last_sent_at existiert) ·
✅ **Karten-Snapshot-Konsum** *(2026-07-15, fn-16 Client-Teil)*: /map lädt
den kompakten Points-Snapshot (EIN Request, ~1,5 MB brotli, 65k Punkte)
statt ~30 sequenzieller limit=3000-Batches (~45 MB); Filterwechsel
(Kategorie/Datum/Bundesland/Bezirk/Tier/Flags) laufen client-seitig ohne
Netzwerk (Modul-Cache 15 min). Punkte haben keinen Titel — Hover-Popup
lädt das volle Event lazy via /api/events/[id] (CDN 1 h), Marker nutzen
Kategorie-Fallback-Bilder bis zum Nachladen. Volltext/Tags/bbox/
eveningOnly/DE-CH bleiben auf dem Server-Batch-Pfad; /entdecken (Liste
braucht Titel+Bilder) unverändert ·
✅ **Freizeitaktivitäten-/POI-Bestand (fn-18)** *(2026-07-27)*: zweite
Inhaltssäule neben Events — dauerhaft verfügbare Ausflugsziele, damit
Gemeinde-Hubs ohne Event-Kalender nicht leer sind. Quelle 1: Feratel-
Deskline `infrastructures` → `poi_activities` (eigener Bestand, Detailseiten
/aktivitaet/[slug], Übersicht /aktivitaeten, API /api/activities, wöchentliche
GH-Action `ingest-activities.yml`, Smart-Suche-Integration). Quelle 2:
OpenStreetMap → `osm_pois` (kuratierte Freizeit-Whitelist, ~10⁵ benannte
AT-Objekte). **ODbL-Regel:** `osm_pois` bleibt strikt getrennt — kein Merge-/
Dedup-/Join-Schreibpfad gegen poi_activities/venues, keine eigenen
OSM-Detailseiten, Anzeige nur als separat gekennzeichnete Gemeinde-Hub-Sektion
mit „© OpenStreetMap contributors"/ODbL-Attribution (auch auf /quellen).
Damit sind die eigenen Bestände keine abgeleitete Datenbank im Sinne der
Share-Alike-Klausel ·
Offen: **fn-18.5 — Viator/GetYourGuide-Monetarisierung** der
Aktivitäts-Detailseiten (Affiliate-Client, Produkt-Matching, BookingBox,
Preis-Refresh). Das ist der einzige noch offene Teil von fn-18 und der
eigentliche Umsatz-Hebel des Bestands (siehe §7.3.1) ·
Middleware-Refresh-Scope (§10.2.4, bewusst zurückgestellt —
Regressionsrisiko auf Auth-Flächen).

### P2 — Fundament (Monat 2–3)

✅ **Bundesland-Backfill** *(2026-07-13)*: 24.566 Events per PLZ-Mapping
befüllt (0 Rest-Kandidaten; Rest ohne BL = ohne PLZ bzw. DE/CH) + Trigger
`trg_bundesland_from_plz` als dauerhafte Selbstheilung ·
✅ **Pipeline-Telemetrie + LPT-Sharding** *(2026-07-13, große Nachbesserung
2026-07-14)*: runScraper schreibt Dauer/Status nach `source_runs`; Shards
lastbalanciert (Gemeinde-Riesen in eigenen Shards). Post-Job-Timeout
180→300 min. **Befunde aus Run 29305622984 (Log-forensisch belegt):**
(a) *Zombie-Prozesse* — getimeoutete Scraper liefen ohne AbortSignal
weiter und hielten Node am Leben: Shard 1 fertig 04:43, Job-Ende 08:06;
Shards 0/2/8 bis zum 300-min-Kill → Fix: explizites `process.exit(0)` in
scrape.ts. (b) *Alles-oder-Nichts-Verlust* — gem2go stand nach dem harten
25-min-Timeout bei 135/2094 Gemeinden und lieferte **0 Events** (Sync
passiert erst nach scrape()-Return): die drei Gemeinde-Aggregatoren
lieferten seit Einführung des Timeouts nichts mehr → Fix: Soft-Budget
(`SCRAPER_SOFT_BUDGET_MIN`, default 240 min) mit Teilergebnis-Rückgabe +
Tagesrotation des Startpunkts (gem2go bräuchte ~388 min für alles;
*Korrektur 2026-10-17:* die Tagesrotation rückte nur einen Eintrag pro Tag
weiter, gemeinde-registry erreichte so fast immer dieselben ~800 von 1.881
Gemeinden, Salzburg/Steiermark seit Mai nicht; jetzt Fortsetzungs-Cursor in
`source_runs.rotation_cursor`), harte Timeouts nur noch als Backstop
(280 min für die Riesen, 45 für meinbezirk mit gemessenen 24,7).
(c) *Stille Telemetrie-Verluste* — der CHECK-Constraint von source_runs
kannte 'error'/'timeout' nicht und supabase-js wirft nicht → alle
Fehler-Zeilen wurden verworfen; zusätzlich FK auf sources →
Migration 20260714092047 (CHECK erweitert, FK weg) + Insert-Error wird
geloggt. (d) *Gewichte* aus 81 gemessenen Quellen nachgezogen
(feratel 80→6, marxhalle 3→20, veranstaltungskalender.net 20→25 …);
neue Verteilung: Riesen allein in Shards 0/1/2, Rest 18–22 pro Shard ·
✅ **Analytics-Rollups** *(2026-07-13)*: `analytics_daily` + tägliche
pg_cron-Aggregation + 90-Tage-Retention der Rohdaten; 35 Tage backfilled ·
✅ **Outreach-Social-Proof** *(2026-07-13)*: Drafts nennen echte
Detailseiten-Aufrufe (30 Tage, nur ≥20) — Reichweiten-Kooperations-Winkel
aus PR #66 bewusst beibehalten ·
✅ **eveningOnly-Fix** *(2026-07-13, datenbasiert)*: Stunden-Histogramm zeigt
echte UTC-Speicherung (Peak 17–18 UTC = 19–20 Wien) → Fenster T15–T23
statt T17–T23; vorher fielen ~1.700 17:00–18:59-Lokal-Starts aus dem Filter ·
✅ **Dead-Code-Sweep** *(2026-07-13)*: 80 Dateien entfernt (30 Ad-hoc-Scripts
+ 50 V3-Komponenten inkl. totem Cluster Sidebar→EventList→EventCard),
jede Löschung referenz-geprüft (execSync-False-Positives wie
normalize-locations/fix-geocoding und Supabase-Edge-Functions verschont) ·
📌 **venues-Befund**: 312.983 Zeilen, nur **164** je mit Event verknüpft
(204 MB OSM-Massenimport). NICHT gelöscht — die Tabelle ist Kandidaten-Pool
fürs Venue-Matching. Entscheidung nötig: Pool auf relevante Venues
eindampfen (z. B. nur mit Events im Umkreis) oder behalten ·
Offen: Migrationen-Altbestand konsolidieren · ggf. VPS-Umzug (§5 Phase B).

### P3 — Skalierung (Quartal)

✅ **Event-Archivierung** *(2026-07-14)*: `events_archive` (RLS ohne Policies,
service-role-only) + `archive_old_events(max_rows, batch_size)` mit
Schema-Drift-Selbstheilung (neue events-Spalten werden automatisch
nachgezogen). Archiviert nur Events >90 Tage OHNE Referenzen aus User-/
Feature-Tabellen (saved/plan_items/reminders/invites/groups/memories/DMs/
notifications/activities/festivals) und ohne lebende duplicate_of-/
parent-Verweise — Dupes zuerst, deren Kanonische werden im Folgelauf frei.
pg_cron `archive-old-events` 02:50 (5.000/Nacht); initial 10.500 von
~33.300 Backlog-Zeilen manuell abgeräumt. Nebenbefund: Events mit
Datum `0001-01-01` existieren (Datenmüll, wandert mit ins Archiv) ·
✅ **llms.txt/LLM-SEO**: war bereits vollständig (public/llms.txt +
/llms-full.txt-Route, AI-Crawler explizit in robots.ts erlaubt) ·
✅ **B2B-Widget/Syndication (MVP)** *(2026-07-14)*: `/widget/[region]`
(iframe-embeddbar — einzige Fläche mit `frame-ancestors *`, Rest bleibt
SAMEORIGIN; ISR 30 min, 10 Regionen, Query per EXPLAIN belegt) +
Code-Generator auf `/fuer-firmen#widget` mit Backlink-Snippet (der
`<a>` unter dem iframe ist der SEO-Gegenwert der Gratis-Nutzung) +
Live-Vorschau. Klicks tracken als `widget_*` via ClickTracker;
Widget-Pageviews landen als page_group `/widget` in analytics_daily.
Einsatz: Outreach-Pitch an Gemeinden/Tourismusverbände (Backlinks!) ·
✅ **Saison-Kampagnen-Kalender** *(2026-07-14, s. u.)* ·
Offen: **Anonyme Event-Reminder** *(User-Auftrag 2026-07-15)*: Events ohne
Login merken — auf der Event-Detailseite optional E-Mail eingeben und
rechtzeitig erinnert werden (Double-Opt-in + HMAC-Kette wie Newsletter,
Tabelle event_email_reminders, Versand über den bestehenden
send-reminders-Cron, Datenschutz-Abschnitt ergänzen) ·
Saison-Autopilot (Go 2026-07-15: monatliche GH-Action → GSC-Daten +
Event-DB → Gemini-Draft → PR zum Review; wartet auf GEMINI_API_KEY in
den GitHub-Actions-Secrets — Vercel-Env ist ein getrennter Speicher) ·
Hotel-/Anreise-Affiliate im Event-Detail (braucht
Partnerprogramm-Entscheidung + Affiliate-ID vom Betreiber; Impact-Site-
Verification für booking.com liegt schon im Layout-Head) ·
WhatsApp-/Push-Kanäle pro Region (WhatsApp braucht Business-Account;
Web-Push erst ab nennenswerter Abonnenten-Basis) · Widget-Ausbau auf
Gemeinde-Slugs, wenn Outreach es nachfragt (`dynamicParams` wieder öffnen).

#### Saison-Kampagnen-Kalender (Content + Newsletter + Outreach)

Befund 2026-07: alle 64 Blog-Posts sind Einzel-Event-Guides — es gibt
KEINEN saisonalen Sammel-Guide, obwohl dort die großen Suchvolumina
liegen („Adventmärkte Österreich", „Silvester Wien"). Faustregel:
**Publish 6–10 Wochen vor Such-Peak** (Google-Indexierungs-Vorlauf).

| Publish | Such-Peak | Asset (Neu = Sammel-Guide) | Bestand als interne Links |
|---|---|---|---|
| **Aug** | Sep–Okt | „Herbstfeste & Erntedank in Ö" (Neu) | kaiser-wiesn, aufsteirern, retz-weinlesefest, martinimarkt |
| **Sep** | Nov–Dez | „Adventmärkte Österreich — der große Guide" (Neu, Top-Priorität) | 5 Christkindlmarkt-Posts (Wien/Graz/Linz/Innsbruck/Salzburg) |
| **Okt** | Dez | „Silvester in Österreich" (Neu) | silvesterpfad, neujahrskonzert |
| **Dez** | Jän–Feb | „Ball- & Faschingssaison" (Neu) | opernball, villacher-fasching |
| **Feb** | März–Apr | „Ostermärkte & Frühlingsfeste" (Neu) | bregenzer-fruehling, narzissenfest |
| **Apr** | Mai–Aug | „Festival-Sommer Österreich" (Neu) | ~20 Festival-Posts (stärkster Bestand) |
| **Mai** | Jun–Aug | „Open-Air-Kinos & Sommernächte" (Neu) | klangwolke, sommernachtskonzert |

Flankierend pro Kampagne: Newsletter-Digest übernimmt das Saison-Thema
als Aufmacher (newsletter-weekly hat die Events schon) · Outreach-Angle
für Gemeinden im Saison-Einzug (Widget + Boost) · Saison-Guide verlinkt
auf thema-/gemeinde-Hubs. KEIN neues Hub-System bauen — Sammel-Guides
sind normale Blog-Posts (BlogTicketBox = Affiliate-Fläche inklusive).

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
