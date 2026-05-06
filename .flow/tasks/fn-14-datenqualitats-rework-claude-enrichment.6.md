# fn-14-datenqualitats-rework-claude-enrichment.6 Source-Disziplinierung: Auto-Disable + Trust-Enforcement + Soft-Delete

## Description

`compute-source-trust.ts` schreibt aktuell nur stdout. Diese Task macht aus dem Read-Only-Tool eine Disziplinierungs-Schleife: schreibt Trust-Scores zurück, deaktiviert kaputte Quellen via Sliding-Window-Rule (basierend auf neuem `source_runs` table + `source_metrics` view aus fn-14.2), enforced `needs_review` für Low-Trust-Sources via prefetched map (NICHT per-row DB-lookup), und marked alte Events als expired (Soft-Delete).

**WICHTIG (aus Codex-Review):**
- Trust-Lookup MUSS via prefetched-batch-map laufen (Pattern wie `existingMap`), KEINE per-row DB-lookups in toSupabaseRow.
- Auto-Disable Rule basiert auf `source_metrics` view (events_7d, events_30d_median) — diese existiert nach fn-14.2.

**Size:** M (4-5 files, 9 acceptance criteria)

**Files:**
- `src/scripts/compute-source-trust.ts` (extend: writeback statt nur stdout)
- `src/lib/pipeline/source-disciplinarian.ts` (NEU — Auto-Disable Logik)
- `src/lib/pipeline/trust-enforcement.ts` (NEU — prefetch trust map für sync-Batch)
- `src/scripts/soft-delete-stale-events.ts` (NEU — nightly cron)
- `src/scripts/scrape.ts` ODER `src/scripts/scrape-pipeline.ts` (skip disabled sources, populate source_runs)
- `src/lib/db/supabase-sync.ts` (trust-prefetch hookup)
- `src/lib/scrapers/index.ts` (verify source-skipping)

## Approach

### A. compute-source-trust.ts -> writeback
Aktuell pure read-only. Ändern:
- Nach `aggregateMetrics()` + `computeTrustScoreFromMetrics()` für jede Source:
  - UPSERT in `sources` Tabelle:
    ```sql
    INSERT INTO sources (source_name, last_trust_score, last_run_at)
    VALUES (?, ?, NOW())
    ON CONFLICT (source_name) DO UPDATE SET
      last_trust_score = EXCLUDED.last_trust_score,
      last_run_at = NOW(),
      updated_at = NOW();
    ```
- Auto-Disable wird hier **nicht** triggered (das macht der Disciplinarian nach jedem Scraper-Run)

### B. source_runs Population (FK-safe)
**Codex-Finding:** `source_runs.source_name` hat FK auf `sources(source_name)`. Insert würde fehlschlagen wenn source noch nicht in `sources` existiert (z.B. neue Sport-Scraper aus fn-14.7).

**Lösung — UPSERT sources first, dann source_runs:**
```sql
-- Schritt 1: source-row sicherstellen
INSERT INTO sources (source_name) VALUES (?)
  ON CONFLICT (source_name) DO NOTHING;

-- Schritt 2: dann source_runs INSERT
INSERT INTO source_runs (source_name, events_found, events_upserted, duration_ms, status)
VALUES (?, ?, ?, ?, ?);

-- Schritt 3: aggregierte Spalten in sources updaten
UPDATE sources 
SET last_run_at = NOW(), 
    last_run_events = ?, 
    consecutive_failures = ...,
    updated_at = NOW()
WHERE source_name = ?;
```

In `scrape-pipeline.ts` ODER `scrape.ts`: nach jedem `runScraper()` diese 3 Schritte (idealerweise als transaction). Das gilt explizit auch für neue Sport-Scraper aus fn-14.7.

### C. source-disciplinarian.ts (NEU)
```pseudo
async function evaluateSource(sourceName, runResult):
  // Read aktuellen state
  const metrics = await getSourceMetrics(sourceName)  // join sources + source_metrics view
  
  // Update consecutive_failures
  const isFailing = runResult.events_found < (metrics.events_30d_median * 0.2)
  if isFailing:
    consecutive_failures += 1
  else if runResult.events_found >= (metrics.events_30d_median * 0.5):
    consecutive_failures = 0
  
  // Sliding-Window Auto-Disable
  if consecutive_failures >= 5 AND metrics.events_7d < (metrics.events_30d_median * 0.2):
    UPDATE sources SET 
      enabled = FALSE,
      disabled_at = NOW(),
      disabled_reason = 'sliding_window_failure',
      cooldown_until = NOW() + INTERVAL '14 days';
    
    // Send alert (Slack via webhook ODER Email via Resend)
    await alertSourceDisabled(sourceName, metrics, runResult)
```

Karenz: Erst nach 14 Tagen seit `sources` table population (von fn-14.2 bootstrap) ist Auto-Disable aktiviert. Davor: nur scoring/logging, kein disable. Implementierung: check `source_runs` count >= 14 (mind. 14 historic runs erforderlich).

### D. Skip disabled sources
In `scrape.ts` runAllScrapers (vor `runScraper()`):
```pseudo
const sourceState = await getSourceEnabled(scraper.name)
if !sourceState.enabled:
  if sourceState.cooldown_until > NOW():
    log(`SKIPPED (disabled until ${cooldown_until}): ${scraper.name}`)
    continue
  else:
    // Cooldown passed -> auto re-enable for test run
    UPDATE sources SET enabled = TRUE, consecutive_failures = 0;
    log(`AUTO-RE-ENABLED after cooldown: ${scraper.name}`)
```

### E. trust-enforcement.ts (NEU — Prefetch Pattern)
```pseudo
async function prefetchSourceTrustMap(sourceNames: string[]): Promise<Map<string, number>>:
  // ein DB query, keine N-queries
  const { data } = await supabase
    .from('sources')
    .select('source_name, last_trust_score')
    .in('source_name', sourceNames);
  return new Map(data.map(r => [r.source_name, r.last_trust_score]));
```

In `syncEventsToSupabase()` (analog zu existing `existingMap`):
```pseudo
const sourceNames = [...new Set(events.map(e => e.source_name))]
const existingMap = await prefetchExistingRows(supabase, ...)
const trustMap = await prefetchSourceTrustMap(sourceNames)  // NEU

for batch:
  toSupabaseRow(event, existingMap, trustMap)  // pass trustMap as new param
```

In `toSupabaseRow()` — KEIN async, KEIN db call, nur map-lookup. **NUR FÜR NEUE EVENTS** (Codex-Finding: kein retroactive demotion existing rows):
```pseudo
const trustScore = trustMap.get(event.source_name) ?? 100  // default high if unknown
const isNewEvent = !existingMap.has(`${event.source_name}::${event.source_id}`)
if (isNewEvent && trustScore < 30 
    && (row.publish_status === 'published' || row.publish_status === 'published_low_confidence')) {
  row.publish_status = 'needs_review'
}
```
Existing already-published events bleiben published auch wenn source-trust später fällt — das ist absichtlich, sonst würden re-upserts UI-state der User flackern lassen.

### F. soft-delete-stale-events.ts (NEU)
```sql
UPDATE events
SET publish_status = 'expired'
WHERE last_seen_at < NOW() - INTERVAL '30 days'
  AND start_date < NOW()
  AND publish_status IN ('published','published_low_confidence','needs_review');
```
- Indizierter Pfad via `events_stale_idx` (von fn-14.2)
- Logging: COUNT betroffener rows
- Idempotent — nur status update

Wird via GitHub Actions oder lokaler cron getriggert (nicht automatisch in scrape:pipeline; separater command `npm run soft-delete:stale`).

### G. Pipeline-Integration (Per-Source Result Contract)
**Codex-Finding:** `scrape-pipeline.ts` ruft `scrape.ts` als subprocess auf — hat keine strukturierten per-source results. `results.scraper_results: []` bleibt aktuell leer.

**Lösung — JSON-Report-File Contract:**
1. **`scrape.ts` erweitern**: schreibt nach jedem `runScraper()` ein per-source JSON-line in `data/scrape-progress/<run_id>.jsonl`:
   ```json
   {"source_name":"burgenland.info","events_found":42,"events_upserted":40,"duration_ms":5320,"status":"success","run_at":"..."}
   ```
2. **Source_runs INSERT inline in `scrape.ts`**: vor jedem JSON-write auch direkt `INSERT INTO sources ON CONFLICT DO NOTHING` + `INSERT INTO source_runs` (FK-safe, siehe B). Vorteil: keine deferred Pipeline-Hop nötig.
3. **`scrape-pipeline.ts` source_discipline Stufe**: liest die JSONL-Datei oder query auf source_runs WHERE run_at >= started_at, ruft `evaluateSource()` für jede source. Logs disabled sources.

Empfehlung: Variante 2 (inline in scrape.ts). Pipeline-Stufe ist dann nur "evaluate + disable check" auf bereits geschriebene `source_runs` Daten — kein Datenfluss-Trick.

## Key context

- Existing `source_trust.ts` aggregiert per-source metrics — gute Vorlage
- `STUDENT_ORG_SOURCES` Pattern in scoring.ts zeigt source-set lookups
- Slack webhook vermutlich nicht konfiguriert -> Email via Resend nutzen ODER nur log
- `publish_status='needs_review'` ist ein bestehender Wert (von events-types)
- Re-Enable nach cooldown_until ist automatisch (vs. previous manual)
- `source_metrics` view existiert nach fn-14.2

## Acceptance

- [ ] `compute-source-trust.ts` schreibt jetzt UPSERT auf `sources.last_trust_score`
- [ ] `source_runs` wird nach jedem Scraper-Run befüllt (mit `INSERT ON CONFLICT DO NOTHING` auf sources VOR INSERT auf source_runs — FK-safe für neue scraper)
- [ ] Auto-Disable Sliding-Window: triggert `sources.enabled=FALSE` + `cooldown_until=NOW()+14d` bei `consecutive_failures >= 5 AND events_7d < 0.2 × events_30d_median`
- [ ] Karenz nach Migration: erst aktiviert wenn min. 14 source_runs records vorhanden
- [ ] Disabled sources werden in scrape.ts übersprungen (mit log message)
- [ ] **Trust-Lookup via prefetched batch-map** in syncEventsToSupabase (NEU: prefetchSourceTrustMap), KEINE per-row DB-lookups
- [ ] `publish_status='needs_review'` für **NEUE events** (existingMap absent) bei `source.last_trust_score < 30` UND computed status `published`/`published_low_confidence`. Existing rows werden NICHT retroactively demoted
- [ ] `soft-delete-stale-events.ts` markiert events korrekt (Stichprobe COUNT vorher/nachher)
- [ ] **Per-Source Result Contract**: `scrape.ts` schreibt nach jedem `runScraper()` direkt `INSERT INTO sources ON CONFLICT DO NOTHING` + `INSERT INTO source_runs` (inline, FK-safe)
- [ ] Pipeline-Integration: source_discipline Stufe in `scrape-pipeline.ts` nach scoring liest aus `source_runs` WHERE `run_at >= started_at`, ruft `evaluateSource()`
- [ ] Auto-Re-Enable nach `cooldown_until` Ablauf (vs. permanent disable)

## Done summary
TBD

## Evidence
- Commits:
- DB queries (sources state):
- Disable logs:
