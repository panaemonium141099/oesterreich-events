# Quality System Phase 1: Fundament

## Goal & Context

Event-Qualitat ist das Kernsystem der Plattform. Phase 1 schafft Transparenz uber Quelldaten, fuhrt eine vollstandige Normalisierungspipeline ein, ermoglicht Qualitatsbewertung und baut das Admin Panel komplett neu.

**Referenz:** Bericht 1 — Abschnitte 1-8, 12-14 (Phase 1: Fundament)

**Approach:** Full Pipeline Rebuild (Approach A). Scrapers schreiben in `raw_events`, Normalisierung erzeugt `normalized_event_candidates`, Matching + Upsert schreibt in die bestehende `events`-Tabelle (Canonical Layer). Quality Scoring setzt `publish_status` und erzeugt Quality Flags.

**Backup:** Git-Tag `backup-before-quality-system` auf Commit `bd0bf48`.

---

## 1. Datenmodell (Supabase)

### 1.1 `scrape_runs` (erweitert, Supabase)

Ersetzt die bestehende SQLite-Version. Alle Metriken aus Bericht Abschnitt 12.1.

```sql
CREATE TABLE scrape_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name   text NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','success','error','partial')),
  duration_ms   int,

  -- Intake metrics
  items_found           int DEFAULT 0,
  items_parsed          int DEFAULT 0,

  -- Pipeline metrics
  raw_written           int DEFAULT 0,
  normalized_count      int DEFAULT 0,
  matched_count         int DEFAULT 0,
  items_inserted        int DEFAULT 0,
  items_updated         int DEFAULT 0,
  items_skipped         int DEFAULT 0,
  suppressed_count      int DEFAULT 0,
  needs_review_count    int DEFAULT 0,
  successful_batches    int DEFAULT 0,

  -- Error metrics
  parser_errors         int DEFAULT 0,
  http_errors           int DEFAULT 0,
  batch_errors          int DEFAULT 0,

  -- Quality metrics
  duplicate_candidates  int DEFAULT 0,
  events_without_date   int DEFAULT 0,
  events_without_location int DEFAULT 0,
  events_without_coords int DEFAULT 0,
  avg_quality_score     float,

  -- Meta
  notes_json            jsonb,
  error_message         text
);

CREATE INDEX idx_scrape_runs_source ON scrape_runs (source_name);
CREATE INDEX idx_scrape_runs_started ON scrape_runs (started_at DESC);
CREATE INDEX idx_scrape_runs_status ON scrape_runs (status);
```

### 1.2 `raw_events` (NEU)

Rohdaten. Werden nie uberschrieben. Jeder Scrape-Run schreibt neue Eintrage.

```sql
CREATE TABLE raw_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrape_run_id   uuid NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
  source_name     text NOT NULL,
  source_event_id text,
  source_url      text,
  raw_title       text,
  raw_description text,
  raw_start_text  text,
  raw_end_text    text,
  raw_location_name text,
  raw_address     text,
  raw_image_url   text,
  raw_ticket_url  text,
  raw_payload_json jsonb,
  content_hash    text NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now(),

  -- Unique identity: resolved in order of preference
  -- 1. source_event_id (if provided by scraper)
  -- 2. source_url (fallback if source_event_id is NULL)
  -- 3. content_hash (fallback if both are NULL)
  -- Partial unique indexes enforce this hierarchy:
  UNIQUE (source_name, source_event_id, scrape_run_id)
);

-- Fallback uniqueness when source_event_id is NULL but source_url exists
CREATE UNIQUE INDEX idx_raw_events_url_unique
  ON raw_events (source_name, source_url, scrape_run_id)
  WHERE source_event_id IS NULL AND source_url IS NOT NULL;

-- Fallback uniqueness when both source_event_id and source_url are NULL
CREATE UNIQUE INDEX idx_raw_events_hash_unique
  ON raw_events (source_name, content_hash, scrape_run_id)
  WHERE source_event_id IS NULL AND source_url IS NULL;

CREATE INDEX idx_raw_events_run ON raw_events (scrape_run_id);
CREATE INDEX idx_raw_events_source ON raw_events (source_name, source_event_id);
CREATE INDEX idx_raw_events_hash ON raw_events (content_hash);
```

### 1.3 `normalized_event_candidates` (NEU)

Bereinigtes Zwischenprodukt aus Raw Events.

```sql
CREATE TABLE normalized_event_candidates (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_event_id            uuid NOT NULL REFERENCES raw_events(id) ON DELETE CASCADE,

  -- Normalized fields
  normalized_title         text,
  normalized_title_compact text,
  normalized_start_at      timestamptz,
  normalized_end_at        timestamptz,
  start_precision          text CHECK (start_precision IN ('exact','day_only','inferred')),
  end_precision            text CHECK (end_precision IN ('exact','day_only','inferred','missing')),
  normalized_location_name text,
  normalized_address       text,
  normalized_city          text,
  normalized_postal_code   text,
  normalized_bundesland    text,
  normalized_category      text,
  normalized_organizer     text,
  normalized_ticket_url    text,
  normalized_source_url    text,
  normalized_image_url     text,

  -- Meta
  language_code            text DEFAULT 'de',
  parse_confidence         float,
  normalization_version    int NOT NULL DEFAULT 1,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_norm_candidates_raw ON normalized_event_candidates (raw_event_id);
CREATE INDEX idx_norm_candidates_title ON normalized_event_candidates (normalized_title_compact);
CREATE INDEX idx_norm_candidates_start ON normalized_event_candidates (normalized_start_at);
```

### 1.4 `event_quality_scores` (NEU)

Quality Score pro kanonischem Event. 7 Dimensionen.

```sql
CREATE TABLE event_quality_scores (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Score dimensions (each 0.0-1.0)
  completeness_score      float NOT NULL DEFAULT 0,
  date_score              float NOT NULL DEFAULT 0,
  location_score          float NOT NULL DEFAULT 0,
  image_score             float NOT NULL DEFAULT 0,
  link_score              float NOT NULL DEFAULT 0,
  dedup_confidence_score  float NOT NULL DEFAULT 0,
  source_trust_score      float NOT NULL DEFAULT 0,

  -- Weighted total (0-100)
  final_quality_score     float NOT NULL DEFAULT 0,

  scoring_version         int NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (event_id, scoring_version)
);

CREATE INDEX idx_quality_scores_event ON event_quality_scores (event_id);
CREATE INDEX idx_quality_scores_final ON event_quality_scores (final_quality_score);
```

### 1.5 `quality_flags` (NEU)

Problemmarkierungen pro Event.

```sql
CREATE TABLE quality_flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  flag_type       text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  details_json    jsonb,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quality_flags_event ON quality_flags (event_id);
CREATE INDEX idx_quality_flags_type ON quality_flags (flag_type);
CREATE INDEX idx_quality_flags_severity ON quality_flags (severity);
CREATE INDEX idx_quality_flags_open ON quality_flags (resolved_at) WHERE resolved_at IS NULL;
```

**Flag Types (Phase 1):**

| Flag Type | Severity | Trigger |
|-----------|----------|---------|
| `missing_time` | medium | `start_precision = day_only` |
| `missing_location` | high | Kein location_name und keine Koordinaten |
| `missing_description` | low | Beschreibung < 20 Zeichen |
| `description_too_short` | low | Beschreibung 20-50 Zeichen |
| `missing_image` | low | Kein image_url |
| `outside_austria` | critical | Koordinaten ausserhalb AT Bounding Box — **harte Blocking Rule, Event wird suppressed** |
| `location_ambiguous` | medium | Normalisierung confidence = fuzzy/none ODER widerspruechliche Ortsdaten (Bundesland vs. Koordinate, Stadt vs. PLZ, Venue vs. Adresse) |
| `dead_source_url` | medium | Source URL nicht erreichbar (Batch-Job) |
| `dead_ticket_url` | medium | Ticket URL nicht erreichbar (Batch-Job) |
| `date_in_past` | high | start_date < now() bei neuem Scrape |
| `date_implausible` | high | start_date > now() + 2 Jahre |
| ~~`venue_unmatched`~~ | — | **Entfernt aus Phase 1.** Venue Matching Engine ist Phase 2. Ohne Venue-Matching-Logik in Phase 1 waere dieses Flag auf fast allen Events gesetzt und damit wertlos. Wird in Phase 2 eingefuehrt. |
| `duplicate_uncertain` | medium | Dedup-Score 0.55-0.74 |
| `missing_date_context` | high | Relative Zeitangabe ohne belastbaren Datums-Kontext |

### 1.6 Erweiterungen an bestehender `events`-Tabelle

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS
  publish_status text DEFAULT 'published'
  CHECK (publish_status IN ('draft','published','published_low_confidence','suppressed','needs_review','expired'));

ALTER TABLE events ADD COLUMN IF NOT EXISTS
  quality_score float;

ALTER TABLE events ADD COLUMN IF NOT EXISTS
  raw_event_id uuid REFERENCES raw_events(id);

CREATE INDEX idx_events_publish_status ON events (publish_status);
CREATE INDEX idx_events_quality_score ON events (quality_score);
CREATE INDEX idx_events_raw_event ON events (raw_event_id);
```

**Hinweis:** Das bestehende Feld `event_score` bleibt als Ranking-Score (Engagement + Relevanz). Das neue `quality_score` misst Datenqualitat.

**WICHTIG: `raw_event_id` ist eine temporaere 1:1-Bruecke fuer Phase 1.** In Phase 1 zeigt jedes kanonische Event auf genau ein Raw Event (die letzte gescrapte Version). In Phase 3 (Multi-Source Merge / Event Cluster) wird dieses Feld durch eine dedizierte Membership-Tabelle (`event_cluster_members`) ersetzt, die N:1-Beziehungen (mehrere Quellen pro kanonischem Event) abbildet. `raw_event_id` wird dann entfernt. Nicht als dauerhaftes Datenmodell betrachten.

**Bewusster Trade-off:** Die vollstaendige Multi-Source-Provenienz geht in Phase 1 nicht verloren — sie bleibt ueber `raw_events` erhalten (jeder Scrape-Run schreibt neue Raw-Eintraege). Was fehlt, ist die kanonische N:1-Zuordnung: welche Raw Events zu welchem kanonischen Event gehoeren. Diese Zuordnung wird erst in Phase 3 mit der Cluster-Logik eingefuehrt. Bis dahin zeigt `raw_event_id` nur auf den juengsten Raw-Eintrag. Das ist ein akzeptierter Zwischenzustand, kein Versehen.

---

## 2. Pipeline-Architektur

### 2.1 Datenfluss

```
Scraper.scrape()
  -> ScrapedEvent[]
    |
    v
+----------------------------------+
| 1. RAW LAYER                     |
| - scrape_run erstellen           |
| - raw_events schreiben (batched) |
| - content_hash berechnen         |
| - Keine Uberschreibung           |
+----------------------------------+
    |
    v
+----------------------------------+
| 2. NORMALIZATION (batched)       |
| - Titel (full + compact)        |
| - Datum mit Precision-Tracking   |
| - URL-Bereinigung (Whitelist)    |
| - Location-Normalisierung        |
| - Kategorie-Mapping              |
| -> normalized_event_candidates   |
+----------------------------------+
    |
    v
+----------------------------------+
| 3. MATCHING + CANONICAL UPSERT   |
|    (batched)                     |
|    a) Candidate Search:          |
|       Bestehende Events als      |
|       Match-Kandidaten finden    |
|    b) Merge-Entscheidung:        |
|       Fingerprint + Fuzzy Score  |
|       auf mehreren Signalen:     |
|       Titel + Datum + Geo + URL  |
|       (Venue ab Phase 2)        |
|    c) Canonical Upsert:          |
|       In events-Tabelle, setzt   |
|       publish_status = 'draft'   |
|       (kein finaler Status)      |
+----------------------------------+
    |
    v
+----------------------------------+
| 4. QUALITY SCORING (batched)     |
|    a) Harte Blocking Rules:      |
|       outside_austria -> suppress |
|    b) Quality Flags erzeugen     |
|    c) Scores berechnen           |
|       (7 Dimensionen)           |
|    d) publish_status setzen      |
|       (Score-basiert, final)     |
+----------------------------------+
```

### 2.2 Module

| Modul | Pfad | Verantwortung |
|-------|------|---------------|
| Raw Layer | `src/lib/pipeline/raw-layer.ts` | scrape_run + raw_events schreiben, content_hash |
| Normalizer | `src/lib/pipeline/normalizer.ts` | Titel/Datum/URL/Location-Normalisierung |
| Title Normalizer | `src/lib/pipeline/normalize-title.ts` | full + compact Titel-Versionen |
| Date Parser | `src/lib/pipeline/normalize-date.ts` | Datum-Parsing mit Precision |
| URL Normalizer | `src/lib/pipeline/normalize-url.ts` | Tracking-Param-Whitelist, Hash |
| Matcher | `src/lib/pipeline/matcher.ts` | Candidate Search + Merge-Entscheidung |
| Canonical Upsert | `src/lib/pipeline/canonical-upsert.ts` | Events-Tabelle Upsert |
| Quality Scorer | `src/lib/pipeline/quality-scorer.ts` | Flags + Scores + publish_status |
| Orchestrator | `src/lib/pipeline/orchestrator.ts` | Ersetzt runScraper(), batched |

### 2.3 Batch-Verarbeitung

Alle Pipeline-Schritte arbeiten in Chunks:

```
BATCH_SIZE = 100

for each batch of ScrapedEvents (100):
  1. writeRawEvents(batch)
  2. normalizeEvents(batch)
  3. matchAndUpsert(batch)
  4. scoreAndPublish(batch)
  5. Update scrape_run metrics (incremental)
```

Vorteile: stabiler bei grossen Quellen, weniger Memory-Spikes, bessere Fehlerisolierung, granulare Metriken.

**Fehlerklassifizierung:**

| Fehlerklasse | Wann | Metrik | Verhalten |
|--------------|------|--------|-----------|
| Scraper-Fehler | `scraper.scrape()` wirft | `status = 'error'`, `error_message` | Run abbrechen, kein Batch-Processing |
| HTTP/Fetch-Fehler | Scraper meldet HTTP-Probleme (in `ScrapedEvent` Metadaten oder Scraper-Logs) | `http_errors` | Vom Scraper selbst gezaehlt, in Run uebernommen |
| Parser/Normalizer-Fehler | Einzelnes Event nicht parsebar (Datum, Titel, etc.) | `parser_errors` | Event ueberspringen, naechstes Event im Batch weiterverarbeiten |
| DB/Upsert/Scoring-Fehler | Supabase-Write oder Score-Berechnung schlaegt fehl | `batch_errors` | Gesamten Batch loggen, naechsten Batch fortsetzen |

**Status-Bestimmung:**
- Alle Batches fehlgeschlagen → `error`
- Mindestens ein Batch erfolgreich + mindestens einer fehlgeschlagen → `partial`
- Kein Batch fehlgeschlagen → `success`

**Metrik-Verdrahtung:**
- `items_parsed`: Wird in writeRawEvents hochgezaehlt (Events, die als Raw gespeichert werden konnten)
- `parser_errors`: Wird in normalizeEvents hochgezaehlt (Events, die nicht normalisiert werden konnten — Datum unparsebar, Titel leer, etc.)
- `http_errors`: Vom Scraper selbst gemeldet (fehlgeschlagene Seitenaufrufe). Der Orchestrator liest den Wert nach scrape() aus.
- `batch_errors`: Gesamter Batch schlaegt fehl (DB-Fehler, Timeout, etc.)
- `items_skipped`: Events, die **vor dem Canonical Upsert** bewusst nicht weiterverarbeitet werden. Konkret: (a) Raw-Duplikate innerhalb desselben Runs (gleicher content_hash bereits geschrieben), (b) Events ohne belastbaren Datums-Kontext (kein start_date ableitbar). Nicht: parser_errors (das sind Fehler, keine bewussten Skips).
- `suppressed_count`: Events, die den Canonical Upsert durchlaufen haben, aber **nach dem Quality Scoring** den Status `suppressed` erhalten. Konkret: (a) outside_austria Blocking Rule, (b) final_quality_score < 20.

**Abgrenzung items_skipped vs. suppressed_count:** Kein Overlap. `items_skipped` zaehlt Events, die die Pipeline vor dem Upsert verlassen (technisch/fachlich nicht verarbeitbar). `suppressed_count` zaehlt Events, die den Upsert durchlaufen, aber durch Scoring/Blocking nicht veroeffentlicht werden. Ein Event ist entweder skipped ODER suppressed, nie beides.
- `successful_batches`: Persistiert in scrape_runs. Wird fuer Status-Bestimmung (success/partial/error) benoetigt und fuer Dashboard-Auswertung (Batch-Erfolgsquote pro Source).

### 2.4 Orchestrator

```typescript
// src/lib/pipeline/orchestrator.ts

async function runPipeline(scraper: BaseScraper): Promise<PipelineResult> {
  const run = await createScrapeRun(scraper.sourceName);
  const metrics = createMetricsAccumulator();

  try {
    const scrapedEvents = await scraper.scrape();
    metrics.items_found = scrapedEvents.length;

    for (const batch of chunk(scrapedEvents, BATCH_SIZE)) {
      try {
        // Raw Layer: items_parsed = events that could be written as raw
        const rawEvents = await writeRawEvents(run.id, batch);
        metrics.raw_written += rawEvents.length;
        metrics.items_parsed += rawEvents.length;

        // Normalization: parser_errors for events that fail parsing
        const { candidates, errors: parseErrors } = await normalizeEvents(rawEvents);
        metrics.normalized_count += candidates.length;
        metrics.parser_errors += parseErrors.length;

        // Matching + Upsert
        const upsertResults = await matchAndUpsert(candidates);
        metrics.matched_count += upsertResults.matched;
        metrics.items_inserted += upsertResults.inserted;
        metrics.items_updated += upsertResults.updated;

        // Quality Scoring
        const qualityResults = await scoreAndPublish(upsertResults.eventIds);
        metrics.suppressed_count += qualityResults.suppressed;
        metrics.needs_review_count += qualityResults.needsReview;

        metrics.successful_batches++;
      } catch (batchError) {
        metrics.batch_errors++;
        log.error(`Batch error in ${scraper.sourceName}:`, batchError);
      }
    }

    // http_errors: reported by scraper itself (e.g. failed page fetches)
    metrics.http_errors = scraper.httpErrorCount ?? 0;

    // Status determination:
    // - ALL batches failed → error
    // - At least one success + at least one failure → partial
    // - No failures → success
    const totalBatches = metrics.successful_batches + metrics.batch_errors;
    const status = metrics.successful_batches === 0 && totalBatches > 0
      ? 'error'
      : metrics.batch_errors > 0
        ? 'partial'
        : 'success';
    await finalizeScrapeRun(run.id, { status, ...metrics });
    return { run, metrics };

  } catch (error) {
    await finalizeScrapeRun(run.id, {
      status: 'error',
      error_message: error.message,
      ...metrics
    });
    throw error;
  }
}
```

### 2.5 Scraper-Kompatibilitaet

Scraper geben weiterhin `ScrapedEvent[]` zurueck. Kein Scraper muss umgeschrieben werden. Die Pipeline arbeitet ausschliesslich nachgelagert. Keine neuen Pflichtfelder fuer Scraper.

**Kompatibilitaetsannahme `httpErrorCount`:** Der Orchestrator liest optional `scraper.httpErrorCount` aus, um HTTP-Fehler in die Run-Metriken zu uebernehmen. Falls ein Scraper dieses Property nicht hat, wird 0 angenommen. Das ist keine neue Pflicht fuer bestehende Scraper — nur ein optionaler Kanal. In einem spaeteren Schritt kann `BaseScraper` um ein standardisiertes Error-Reporting erweitert werden, aber das ist nicht Teil von Phase 1.

### 2.6 SQLite Dual-Write

SQLite bleibt als sekundaerer Cache fuer lokales Development. Wird nach dem Canonical Upsert geschrieben. Supabase/Postgres ist immer Source of Truth.

---

## 3. Normalisierung (Detail)

### 3.1 Titel-Normalisierung

Zwei Versionen:

**`normalized_title` (full):**
1. Lowercase + trim
2. Mehrfache Leerzeichen -> eins
3. Unicode NFC
4. Emojis entfernen
5. Dekorative Separatoren entfernen (`|`, `-`, `--`, `---`, `>>>`)

**`normalized_title_compact` (fuer Dedup Candidate Search):**
Alles von full, plus:
6. Klammerzusaetze entfernen: `(Official Event)`, `[LIVE]`
7. Wochentage entfernen (Montag-Sonntag, Monday-Sunday)
8. Datumsfragmente entfernen (14. Juni, 14.06., etc.)
9. Marketing-Woerter entfernen (official, presents, live, special, tour)

**Wichtig:** `normalized_title_compact` wird nur fuer Candidate Search verwendet, nicht als alleiniges Merge-Kriterium. Die finale Merge-Entscheidung basiert auf mehreren Signalen (Titel + Datum + Geo + URL). Venue-basiertes Matching kommt in Phase 2.

### 3.2 Datum-Normalisierung

**Input-Formate:**
- ISO 8601: `2026-06-14T20:00:00`
- Deutsch: `Freitag, 14. Juni 2026, 20 Uhr`
- Kurzformat: `14.06.2026`
- Nur Datum: `14. Juni 2026`
- Zeitraeume: `14.–16. Juni 2026`
- Relative: `ab 19:30` (nur mit belastbarem Kontext)

**Output:**
- `normalized_start_at`: UTC timestamptz
- `normalized_end_at`: UTC timestamptz (oder NULL)
- `start_precision`: `exact` | `day_only` | `inferred`
- `end_precision`: `exact` | `day_only` | `inferred` | `missing`

**Regeln:**
- **Zeitzone:** Immer `Europe/Vienna` annehmen, dann nach UTC konvertieren
- **`day_only`:** Datum bekannt, Uhrzeit nicht. Mitternacht `Europe/Vienna` -> UTC (NICHT 00:00 UTC)
- **`inferred`:** Nur mit belastbarem Kontext (URL-Datum, Seitentitel, Kalender-Kontext). Ohne Kontext -> Quality Flag `missing_date_context`, Event bekommt kein Datum
- **`missing`:** Nur fuer `end_precision`, nie fuer `start_precision`
- **Mehrtagesevent:** Start + End mit jeweiliger Precision

### 3.3 URL-Normalisierung

**Schritte:**
1. `http` -> `https`
2. Trailing Slash entfernen
3. Fragment (`#...`) entfernen
4. Tracking-Parameter entfernen (Whitelist-basiert):
   - `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
   - `fbclid`, `gclid`, `mc_cid`, `mc_eid`
   - `ref`, `_ga`, `_gl`
5. `www.` beibehalten (manche Sites unterscheiden)
6. Funktionale Parameter bleiben erhalten
7. URL-Hash (SHA256 der bereinigten URL) speichern

### 3.4 Quality Flags — Blocking Rules vs. Scoring Flags

**Harte Blocking Rules (vor Score-Berechnung):**
- `outside_austria` -> Event wird `suppressed`, kein Score noetig

**Scoring Flags (nach Score-Berechnung, beeinflussen publish_status):**
- Alle anderen Flags aus der Liste in Abschnitt 1.5

---

## 4. Quality Score

### 4.1 Gewichtung

| Dimension | Gewicht | Max Punkte | Beschreibung |
|-----------|---------|------------|--------------|
| Completeness | 25% | 25 | Titel, Datum, Ort, Kategorie, Beschreibung |
| Date | 15% | 15 | Parsebar, Uhrzeit vorhanden, plausibel |
| Location | 25% | 25 | Adresse, Koordinaten, AT-Check, Konsistenz (Venue-Match ab Phase 2) |
| Image | 10% | 10 | Vorhanden, erreichbar |
| Links | 10% | 10 | Source-URL, Ticket-URL vorhanden |
| Dedup Confidence | 10% | 10 | Sauber geclustert, kein unsicherer Konflikt |
| Source Trust | 5% | 5 | Snapshot von Source-Metriken |
| **Total** | **100%** | **100** | |

### 4.2 Completeness Score (0-25)

- Titel vorhanden und > 5 Zeichen: +5
- Startdatum vorhanden: +5
- Ort vorhanden (location_name oder Koordinaten): +5
- Kategorie vorhanden: +3
- Beschreibung > 50 Zeichen: +4
- Beschreibung > 200 Zeichen: +3 (zusaetzlich)

### 4.3 Date Score (0-15)

- Datum parsebar: +5
- Uhrzeit vorhanden (`start_precision = exact`): +5
- Datum plausibel (nicht in Vergangenheit, nicht > 2 Jahre): +3
- Endzeit vorhanden: +2

### 4.4 Location Score (0-25)

- Koordinaten vorhanden: +7
- Adresse vorhanden: +5
- Location-Name vorhanden: +3
- Oesterreich-Check bestanden: +5
- Bundesland/PLZ/Stadt konsistent: +5

**Hinweis:** In Phase 1 gibt es kein Venue-Matching. `venue_id` wird nicht als Score-Kriterium verwendet. Die 8 Punkte fuer Venue-Match werden in Phase 2 eingefuehrt, wenn die Venue Matching Engine existiert. Bis dahin basiert der Location Score rein auf vorhandenen Geo-/Adressdaten und Konsistenzpruefungen.

### 4.5 Image Score (0-10)

- image_url vorhanden: +5
- image_url erreichbar (bei Batch-Check): +5
- Hinweis: Erreichbarkeits-Check nicht beim Scrapen, sondern als Batch-Job

### 4.6 Link Score (0-10)

- source_url vorhanden: +3
- ticket_url vorhanden: +3
- URLs erreichbar (bei Batch-Check): +4

### 4.7 Dedup Confidence Score (0-10)

- Event ist einzigartig (kein Duplikat-Kandidat): +10
- Event sauber gemerged (Score >= 0.90): +8
- Event gemerged mit mittlerer Sicherheit (0.75-0.89): +5
- Event unsicher (0.55-0.74): +2
- Hinweis: In Phase 1 ohne Cluster-System basiert dies auf dem besten Dedup-Score

### 4.8 Source Trust Score (0-5)

- Quelle hat Success Rate > 95%: +2
- Quelle hat Avg Quality > 60: +2
- Quelle hat < 5% Parser Errors: +1
- Hinweis: In Phase 1 basiert dies auf den letzten 10 Scrape Runs der Quelle

### 4.9 publish_status Schwellen

| Score | Status |
|-------|--------|
| >= 60 | `published` |
| 40-59 | `published_low_confidence` |
| 20-39 | `needs_review` |
| < 20 | `suppressed` |

**Sonderregel — `outside_austria` als harte Pipeline-Blocking-Rule:**
- Event wird `suppressed`, unabhaengig vom Score
- Event bekommt einen Eintrag in `event_quality_scores` mit `final_quality_score = 0`. Kein Score-Algorithmus laeuft, aber der Row existiert. Grund: Dashboards, Durchschnitte und Admin-Tabellen erwarten konsistent einen Score-Eintrag pro Event. Ein fehlender Eintrag wuerde zu NULL-Behandlungs-Sonderfaellen fuehren.
- Event erscheint nie in oeffentlicher API, SEO, Featured-Listen oder Ranking
- `outside_austria`-Suppress ist **permanent**: eine spaetere Score-Neuberechnung darf den Status nicht auf `published` zuruecksetzen. Nur ein expliziter Admin-Override (Publish Anyway) kann das aufheben.
- Implementierung: Blocking Rules werden VOR der Score-Berechnung geprueft. Wenn eine greift, wird der Score-Schritt uebersprungen.

---

## 5. Admin Panel Rebuild

### 5.0 Scope-Entscheidung

Das Admin Panel wird in Phase 1 **nicht** komplett neu gebaut. Der technische Kern ist die Pipeline, nicht das perfekte Admin-Frontend. Zwei grosse Projekte gleichzeitig = Scope-Risiko.

**Pflicht in Phase 1 (neues Design-System):**
- Layout + Sidebar (Grundlage fuer alle Seiten)
- Overview (Dashboard mit Quality-Metriken)
- Scraper Runs (History, Live-Status, Controls)
- Quality (Flag-Review + einfache Statusentscheidungen)
- Sources (Aggregierte Quell-Metriken)

**Kann warten (spaetere Phase, bestehendes Design vorerst behalten):**
- Users (funktioniert, nur Design-Refresh noetig)
- Analytics (funktioniert gut, AnalyticsPanel bleibt)
- Moderation (funktioniert, minimaler Aenderungsbedarf)

**Events-Seite: minimal ergaenzen, nicht komplett neu:**
- Quality Score + publish_status Spalten hinzufuegen
- Filter nach publish_status
- Kein kompletter Redesign in Phase 1

### 5.1 Routing-Struktur

```
src/app/admin/
  layout.tsx              -- Shared Layout mit Sidebar-Navigation (NEU)
  page.tsx                -- Redirect zu /admin/overview
  overview/page.tsx       -- Dashboard-Uebersicht (NEU)
  scraper-runs/page.tsx   -- Scrape Run History + Live-Status (NEU)
  quality/page.tsx        -- Quality Flags + einfache Review (NEU)
  sources/page.tsx        -- Source Trust Scores + Metriken (NEU)
  events/page.tsx         -- Event-Verwaltung (ERWEITERT, nicht komplett neu)
  users/page.tsx          -- User-Verwaltung (VERSCHOBEN, bestehende Logik)
  analytics/page.tsx      -- Analytics (VERSCHOBEN, bestehendes AnalyticsPanel)
  moderation/page.tsx     -- Moderation (VERSCHOBEN, bestehende Logik)
```

### 5.2 Design Language

- Dark Theme (konsistent mit restlicher App)
- Keine Emojis — nur Lucide Icons
- Glass Cards: `bg-white/[0.03]`, `border border-white/[0.06]`
- Typografie: `text-white/90` Titel, `text-white/60` Sekundaertext
- Farben: Amber Akzent, Rot Fehler/Critical, Gruen Success, Blau Info
- Sidebar: Feste Navigation links, Content rechts. Collapsed auf Mobile.

### 5.3 Shared Components

```
src/components/Admin/
  AdminSidebar.tsx        -- Navigation mit Lucide Icons
  StatCard.tsx            -- Wiederverwendbare Stat-Karte
  DataTable.tsx           -- Sortierbare, filterbare Tabelle
  StatusBadge.tsx         -- Einheitliche Status-Badges
  SeverityBadge.tsx       -- Flag-Severity Badges
  ScoreBar.tsx            -- Quality Score Visualisierung (0-100)
  SparklineChart.tsx      -- Mini-Trend-Charts
  EmptyState.tsx          -- Einheitliche leere Zustaende
  ScraperControls.tsx     -- Start/Stop/Progress fuer Scraper
```

### 5.4 Seiten im Detail

**Overview (Dashboard):**
- 6 Stat Cards: Total Events, Active Sources, Avg Quality Score, Events needing Review, Scraper Errors (24h), New Events (7d)
- Mini-Charts: Quality Score Distribution (Histogram), Events pro Tag (7d Sparkline)
- Letzte 5 Scrape Runs (kompakt, mit Status-Badge)
- Top 5 Quality Flags (critical/high severity)

**Scraper Runs:**
- Tabelle aller Runs (sortierbar, filterbar nach Source, Status, Datum)
- Pro Run: Source, Status-Badge, Duration, Items Found/Parsed/Inserted, Errors, Avg Quality
- Klick auf Run -> Detail-Ansicht mit allen Metriken und zugehoerigen Raw Events
- Live-Status Panel fuer laufende Scraper mit Progress
- Start/Stop Controls
- GitHub Actions Integration bleibt

**Quality (einfache Flag-Review — Phase 1):**
- Filterbare Liste von Quality Flags (flag_type, severity, resolved/open)
- Pro Flag: Event-Titel, Flag-Typ, Severity-Badge, Details
- Klick -> Event-Detail mit Raw-Daten, Normalized-Daten, Scores
- Aktionen: Resolve Flag, Suppress Event, Publish Anyway
- Score-Distribution Chart
- **Abgrenzung Phase 4:** Erweiterte Review Queue mit merge/split/assign-venue Aktionen kommt erst mit Venue Matching Engine und Event Cluster. Phase 1 beschraenkt sich auf Flag-Review und einfache Statusentscheidungen (resolve/suppress/publish).

**Sources:**
- Liste aller Quellen mit aggregierten Metriken
- Pro Quelle: Name, Last Run, Success Rate, Avg Quality, Event Count, Error Rate
- Sortierbar nach jeder Metrik
- Trend-Sparklines (Quality ueber Zeit)

**Events:**
- Bestehende Funktionalitaet plus Quality Score und publish_status Anzeige
- Filter nach publish_status
- Keine Emojis

**Users, Analytics, Moderation:**
- Bestehende Funktionalitaet im neuen Design-System
- Keine Emojis

### 5.5 Admin API Routes (neu/erweitert)

| Route | Methode | Beschreibung |
|-------|---------|--------------|
| `/api/admin/scrape-runs` | GET | Scrape Runs mit Filtern + Pagination |
| `/api/admin/scrape-runs/[id]` | GET | Einzelner Run mit Raw Events |
| `/api/admin/quality-flags` | GET | Quality Flags mit Filtern |
| `/api/admin/quality-flags/[id]/resolve` | POST | Flag als resolved markieren |
| `/api/admin/events/[id]/publish-status` | PATCH | publish_status aendern |
| `/api/admin/sources` | GET | Source-Metriken aggregiert |

Bestehende Admin-Routes (`/api/admin/scrapers`, `/api/admin/analytics`) bleiben.

---

## 6. Events API Aenderungen

### 6.1 Oeffentliche API

`GET /api/events` zeigt nur Events mit:
- `publish_status IN ('published', 'published_low_confidence')`

Default-Verhalten. Kein Breaking Change fuer Konsumenten.

**Ranking-Regel fuer `published_low_confidence`:**
Events mit `published_low_confidence` sind bewusst oeffentlich sichtbar (besser als unsichtbar), duerfen aber **nicht** prominente Flaechen dominieren:
- **SEO:** Nur `published` Events werden in Sitemap und JSON-LD aufgenommen
- **Featured/Weekly Highlights:** Nur `published` Events (quality_score >= 60)
- **Student-/Empfehlungslisten:** Nur `published` Events
- **Normale Suche/Map:** Beide Status sichtbar, aber `published_low_confidence` wird im Ranking durch niedrigeren quality_score natuerlich abgewertet
- **Reminder:** Nur fuer `published` Events aktivierbar
- **Alle externen Trigger (Push, Email, Digests, Alerts):** Nur fuer `published` Events

**Zusammenfassung der Grenze:** `published_low_confidence` = in der App sichtbar (Suche, Map, Direktlink). Aber **nie aktiv promotet**: kein SEO, keine Featured-Listen, keine Student-Listen, keine Reminder, keine Push-Benachrichtigungen, keine Email-Digests, keine externen Alerts. Die Grenze ist: passiv auffindbar ja, aktiv beworben nein.

**Event-Detail-Seiten (`/events/[id]`):**
- `published`: Normal indexierbar, volles SEO (JSON-LD, meta tags)
- `published_low_confidence`: Seite erreichbar per Direktlink, aber `<meta name="robots" content="noindex">` gesetzt. Kein JSON-LD Event Schema. Grund: Diese Events sollen in der App sichtbar sein, aber nicht ueber Suchmaschinen gefunden werden.
- `needs_review` / `suppressed`: HTTP 404 fuer nicht-Admin-Nutzer. Nur ueber Admin-Panel einsehbar.

### 6.2 Admin API

Admin-Nutzer (role = god/admin) koennen alle Status sehen:
- Query-Parameter `includeAll=true` zeigt auch `needs_review`, `suppressed`, `draft`

---

## 7. Migration bestehender Events

### 7.1 Schema-Migration

Alle bestehenden Events in der `events`-Tabelle bekommen:
- `publish_status = 'published'` (da sie bereits live sind)
- `quality_score = NULL` (wird beim Backfill-Run gefuellt)
- `raw_event_id = NULL` (da kein Raw Layer existierte)

### 7.2 Backfill-Scoring-Run (Pflicht)

**Unmittelbar nach Schema-Migration** muss ein einmaliger Backfill-Job laufen. Der Backfill laeuft in zwei Schritten:

**Schritt 1: Dry Run (Pflicht vor Live-Rollout)**
1. Quality Flags erzeugen (basierend auf vorhandenen Daten)
2. Quality Score berechnen (7 Dimensionen, soweit Daten vorhanden)
3. `publish_status` simulieren (Score-basiert)
4. `outside_austria`-Check durchfuehren
5. **Verteilung/Histogramm ausgeben:**
   - Anzahl Events pro Score-Bereich (0-19, 20-39, 40-59, 60-100)
   - Anzahl Events pro simuliertem publish_status (published / low_confidence / needs_review / suppressed)
   - Anzahl outside_austria-Treffer
   - Top-10 Quellen mit niedrigstem Durchschnitts-Score
6. **Keine Schreiboperationen** — nur Analyse und Ausgabe

**Schritt 2: Live-Rollout (nach Review der Dry-Run-Ergebnisse)**
1. Quality Flags schreiben
2. event_quality_scores schreiben
3. quality_score und publish_status auf Events setzen
4. outside_austria Events suppressed

**Grund:** Die Schwellen >= 60 / 40-59 / 20-39 / < 20 koennen beim Altbestand unerwartet viele Events nach unten ziehen (fehlende Bilder, kurze Beschreibungen, alte Links). Ohne Dry Run riskiert man, dass beim ersten Rollout zu viele Events aus dem oeffentlichen Feed verschwinden.

**Ohne Backfill entsteht ein Mischsystem:** neue Events mit Qualitaetssystem, alte Events ohne Score. Das macht Sortierung, Filterung und Admin-Dashboard unbrauchbar. Der Backfill ist daher Teil der Phase-1-Lieferung, nicht optional.

**Hinweis:** Bestehende Events haben kein `raw_event_id`. Der Quality Score wird direkt aus den Event-Feldern berechnet (Completeness, Date, Location, Image, Links). Dedup Confidence und Source Trust basieren auf dem letzten bekannten Zustand.

### 7.3 Scrape-Run-Migration

Beim naechsten Scrape-Lauf werden Raw Events fuer neue/aktualisierte Events erstellt. Bestehende Events ohne Raw-Daten bleiben mit `raw_event_id = NULL` bis sie erneut gescrapt werden.

---

## 8. Acceptance Criteria

**Pipeline:**
- [ ] Supabase-Migrationen fuer alle 5 neuen/erweiterten Tabellen ausgefuehrt
- [ ] Pipeline-Orchestrator ersetzt bestehenden `runScraper()` vollstaendig
- [ ] Raw Events werden bei jedem Scrape gespeichert und nie ueberschrieben
- [ ] Raw Event Identity-Fallback funktioniert (source_event_id -> source_url -> content_hash)
- [ ] Normalized Candidates werden mit Precision-Tracking erzeugt
- [ ] Matching verwendet Fingerprint + Fuzzy auf mehreren Signalen
- [ ] Quality Score (0-100) wird fuer jedes Event berechnet
- [ ] Quality Flags werden automatisch erzeugt
- [ ] `publish_status` wird Score-basiert gesetzt (nur in scoreAndPublish, nicht frueher)
- [ ] `outside_austria` ist harte Blocking Rule — permanent suppress, keine Rueckkehr durch Rescore
- [ ] Fehlerklassifizierung korrekt verdrahtet (parser_errors, batch_errors, http_errors, items_parsed)
- [ ] Status-Bestimmung: alle Batches fehlgeschlagen = error, gemischt = partial, keine Fehler = success
- [ ] Batch-Verarbeitung funktioniert (kein Full-Array-Processing)

**API:**
- [ ] Oeffentliche Events-API filtert nach publish_status (nur published + published_low_confidence)
- [ ] `published_low_confidence` Events nicht in Sitemap, Featured, Student-Listen
- [ ] `published_low_confidence` Detail-Seiten haben `noindex` Meta-Tag, kein JSON-LD
- [ ] `needs_review`/`suppressed` Detail-Seiten geben 404 fuer nicht-Admin-Nutzer
- [ ] Admin-API kann alle Status sehen (includeAll=true)

**Backfill:**
- [ ] Backfill Dry Run zeigt Score-Verteilung und simulierte Status-Aenderungen
- [ ] Backfill Live-Rollout erst nach Review der Dry-Run-Ergebnisse
- [ ] Alle bestehenden Events haben quality_score und publish_status nach Backfill
- [ ] outside_austria Events haben Score-Row mit final_quality_score = 0

**Admin Panel (Phase 1 Scope):**
- [ ] Neues Layout + Sidebar fuer alle Admin-Seiten
- [ ] Overview Dashboard mit Quality-Metriken (NEU)
- [ ] Scraper Runs Seite mit History + Live-Status (NEU)
- [ ] Quality Flag-Review mit Resolve/Suppress/Publish (NEU)
- [ ] Sources Seite mit aggregierten Metriken (NEU)
- [ ] Events-Seite erweitert um quality_score + publish_status
- [ ] Keine Emojis im Admin Panel
- [ ] Users/Analytics/Moderation in neues Layout integriert (bestehende Logik)

**Kompatibilitaet:**
- [ ] Alle bestehenden Scraper funktionieren ohne Aenderung
- [ ] Tests fuer Pipeline-Module (Normalizer, Matcher, Scorer)
- [ ] Bestehende Tests bleiben gruen

---

## 9. Boundaries (Out of Scope Phase 1)

- **Venue Aliases / Venue Matching Engine (Phase 2)** — Keine venue_id-basierte Score-Logik, kein `venue_unmatched` Flag. Location Score basiert rein auf Geo/Adresse/Konsistenz.
- **Event Cluster / Multi-Source Merge (Phase 3)** — `raw_event_id` ist temporaere 1:1-Bruecke, wird durch Membership-Tabelle ersetzt.
- **Source Trust Score als eigenstaendiges Modell (Phase 4)** — Nur Snapshot aus letzten 10 Runs in Phase 1.
- **Erweiterte Review Queue mit merge/split/assign Aktionen (Phase 4)** — Phase 1 hat nur einfache Flag-Review (resolve/suppress/publish).
- Nutzerfeedback als Qualitaetssignal (Phase 5)
- Link-Erreichbarkeits-Checks (dead_source_url, dead_ticket_url) sind Batch-Jobs, nicht Teil der Live-Pipeline
- Alerts/Benachrichtigungen bei Qualitaetseinbruechen (Phase 4)
- **Admin Panel: Users, Analytics, Moderation Redesign** — Bestehende Logik bleibt, nur in neues Layout integriert. Redesign ist kein Phase-1-Ziel.

---

## 10. Decision Context

**Warum Full Pipeline Rebuild statt Shadow Pipeline?**
Der Bericht ist eindeutig: ohne Raw Layer kein Debugging, ohne Normalisierung kein sauberes Dedup. Eine Shadow Pipeline verdoppelt Komplexitaet ohne Mehrwert, da der Umstieg ohnehin kommen muss.

**Warum Supabase statt SQLite fuer neue Tabellen?**
Production-System laeuft auf Supabase. Neue Tabellen muessen dort leben, um von der API aus abfragbar zu sein. SQLite bleibt nur als Dev-Cache.

**Warum batch-basiert?**
Grosse Quellen (Feratel: 71 Regionen) koennen tausende Events liefern. Ohne Batching: Memory-Spikes, keine Fehlerisolierung, unbrauchbare Metriken bei Teilfehlern.

**Warum zwei Quality-Score-Felder (event_score + quality_score)?**
`event_score` = Ranking (Engagement + Relevanz + Temporal). `quality_score` = Datenqualitaet (Vollstaendigkeit + Korrektheit). Verschiedene Zwecke, verschiedene Scores.
