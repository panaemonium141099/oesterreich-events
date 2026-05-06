# Datenqualitäts-Rework: Claude-Enrichment + Pipeline-Aufspaltung + Bildqualität

## Goal & Context

OpenAI-API-Kosten beenden, Datenqualität signifikant erhöhen. Beobachtete Probleme:
- AI-vergiftete Beschreibungen (Kategorie-Bleed in description, Threshold `<40 chars` führt zu unnötigen Overrides)
- Bildqualität schwankt stark (`og:image` als Priority 1 ohne Größencheck, srcset density-Descriptors `2x/3x` ignoriert)
- Preise stehen oft als "nicht bekannt" obwohl Quelltext sie hergibt
- Scoring belohnt `ticket_url` universell (+15) — User hat aber feste Trusted Ticket-Quellen
- `compute-source-trust.ts` druckt nur stdout — kein Writeback, keine Enforcement
- Kaputte Quellen werden nicht auto-deaktiviert; alte Events werden nie gelöscht (nur UPSERT)

Ziel: Claude (Sonnet 4.6 mit Opus-Fallback, MAX-Plan) übernimmt Enrichment lokal via `claude -p`. Pipeline läuft ohne Enrichment-Stufe; Enrichment ist separater Command + optional Daily-Refresh.

## Architecture & Data Models

### Pipeline-Aufspaltung
```
ALT: scrape:pipeline -> 12 Steps inkl. enrich-openai (Step 10)
NEU: scrape:pipeline -> 11 Steps OHNE enrichment (default)
     enrich:claude   -> Standalone-Command, ruft claude -p in Batches
     daily-refresh   -> GitHub Actions schedule (gewählter Runner, siehe fn-14.8)
```

### Vocabulary Reconciliation (Pre-Work — CRITICAL)
**Problem:** `docs/TAXONOMY.md` enthält ASCII-slugs (`fuer-paare`, `guenstig`, `ganztaegig`). `src/lib/category-classifier/enrichment-taxonomy.ts` enthält Umlaute (`paare`, `günstig`, `ganztägig`). Beide divergieren -> Prompt aus docs würde Outputs erzeugen die der Validator silently dropt.

**Lösung:** Code ist Runtime-SoT für Validation. Daher:
- `enrichment-taxonomy.ts` bleibt authoritative
- `docs/TAXONOMY.md` wird aus den Code-Konstanten regeneriert (script: `tsx src/scripts/regen-taxonomy-doc.ts`)
- Prompt wird IM CODE aus `PRIMARY_CATEGORIES.join(' | ')` etc. gebaut (bestehender Pattern in `enrich-openai.ts:148`)

Diese Reconciliation läuft als allererster Schritt in fn-14.3 (vor Code-Änderungen).

### Reuse-Strategie für Claude-Skript
**`src/scripts/enrich-claude-cli.ts` existiert (~805 Zeilen)** — aber:
- per-event subprocess (nicht batch)
- single-row UPDATE (nicht BulkUpdater)
- v1-Schema (fehlen primary_category, occasion_tags, price_flags, setting)
- Modell-IDs alt

**Diese Aufgabe ist daher NEU-DESIGN**, nicht "Refactor". Wir behalten was nutzbar ist:
- `resolveClaudeBinary()` (Win .exe Direct-Spawn): unverändert
- `extractJson()` brace-counting parser: unverändert
- 5-attempt retry/backoff Pattern: weiterverwenden
- Reverted-Flags-Annotation L324-335: behalten als historische Doku

Aber komplett neu:
- Batch-Aufruf-Architektur (default ~20 events/call, konservativ — Operator-Override via --batch-size)
- Response-Parsing für JSON-Array
- Per-Event Partial-Failure-Handling
- Schema/JSON-Validation-Loop

### Idempotenz & Selection Contract
- Spalte `enrichment_version`: bump auf `'claude-v1'`
- **Target Population (explizit definiert)**:
  ```sql
  WHERE publish_status NOT IN ('expired','duplicate','suppressed','draft')
    AND (enrichment_version IS NULL OR enrichment_version != 'claude-v1')
    AND (enrichment_failed IS NULL OR enrichment_failed = FALSE)
  ```
  Das deckt: published, published_low_confidence, needs_review. Schließt aus: expired, duplicate, suppressed, draft, poison-pills.
  Anmerkung: heutige `enrich-openai.ts` filtert zusätzlich auf `start_date >= today` und `quality_score >= 40`. Diese Filter werden ENTFERNT, weil "alle Events auf der Karte" auch vergangene/low-quality umfasst.
- `category_locked=true` schützt nur das `category` Feld — andere Felder (description, price, etc.) werden trotzdem aktualisiert
- Per-Event Retry-Counter `enrichment_failure_count`: nach 3 Failures -> `enrichment_failed=TRUE`, skip in future runs
- `--retry-failed` Flag: setzt `enrichment_failed=FALSE` für manuell-recovery, dann re-run

### DB-Migration
**MANDATORY** Spalten + Tabellen + RPC-Update (nicht optional):
- `events.image_width INT`
- `events.image_height INT`
- `events.last_seen_at TIMESTAMPTZ DEFAULT NOW()`
- `events.enrichment_failed BOOLEAN DEFAULT FALSE`
- `events.enrichment_failure_count INT DEFAULT 0`
- **`events.is_dog_friendly BOOLEAN DEFAULT FALSE`** (fn-14.3 Interview-Decision)
- **`events.is_wheelchair_accessible BOOLEAN DEFAULT FALSE`** (fn-14.3 Interview-Decision)
- **`events.is_outdoor BOOLEAN DEFAULT FALSE`** (fn-14.3 Interview-Decision)
- Partial Index `events_stale_idx` auf `last_seen_at`
- `sources` Tabelle (mandatory, nicht optional — wird von fn-14.6 enforce-Logik gebraucht)
- `source_runs` Tabelle (NEU, ersetzt `events_30d_median` Spalte) — auditable run-history pro source
- **`bulk_update_event_enrichment` RPC** Update: erweitern um 6 neue Felder (`enrichment_failed`, `enrichment_failure_count`, `price_min`, `is_dog_friendly`, `is_wheelchair_accessible`, `is_outdoor`). Ohne diese Erweiterung werden die neuen Felder vom RPC silently ignoriert. Bestehende Migration: `supabase/migrations/20260501130000_bulk_update_enrichment_add_struct_fields.sql` zeigt das Pattern für Schema-Erweiterung.

#### sources Tabelle (10 Spalten)
```sql
CREATE TABLE IF NOT EXISTS sources (
  source_name TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  consecutive_failures INT DEFAULT 0,
  last_trust_score NUMERIC,
  last_run_at TIMESTAMPTZ,
  last_run_events INT DEFAULT 0,
  disabled_at TIMESTAMPTZ,
  disabled_reason TEXT,
  cooldown_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sources_trust_idx ON sources(last_trust_score) WHERE enabled = TRUE;
```

#### source_runs Tabelle (NEU, audit-history)
```sql
CREATE TABLE IF NOT EXISTS source_runs (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL REFERENCES sources(source_name) ON DELETE CASCADE,
  run_at TIMESTAMPTZ DEFAULT NOW(),
  events_found INT NOT NULL DEFAULT 0,
  events_upserted INT NOT NULL DEFAULT 0,
  duration_ms INT,
  status TEXT CHECK (status IN ('success','failed','partial')) DEFAULT 'success',
  error_message TEXT
);
CREATE INDEX source_runs_source_time_idx ON source_runs(source_name, run_at DESC);
```

**Aggregierte Views** (für Auto-Disable Rule):
```sql
CREATE OR REPLACE VIEW source_metrics AS
SELECT
  source_name,
  COUNT(*) FILTER (WHERE run_at > NOW() - INTERVAL '7 days') AS runs_7d,
  COUNT(*) FILTER (WHERE run_at > NOW() - INTERVAL '30 days') AS runs_30d,
  COALESCE(SUM(events_found) FILTER (WHERE run_at > NOW() - INTERVAL '7 days'), 0) AS events_7d,
  COALESCE(
    PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY events_found)
      FILTER (WHERE run_at > NOW() - INTERVAL '30 days'),
    0
  ) AS events_30d_median
FROM source_runs
GROUP BY source_name;
```

**NULL-Handling in Auto-Disable Rule** (explizit):
- `runs_30d < 14` -> NICHT auswerten (nicht genug history) -> kein disable
- `events_30d_median = 0` -> NICHT auswerten (sonst würde jede Failure-Zahl `< 0.2 * 0` = false sein, aber Edge-Cases vermeiden)
- Erst wenn `runs_30d >= 14 AND events_30d_median > 0` greift die Sliding-Window-Rule

### Trusted Ticket Sources (Scoring)
**Beide Scoring-Pfade müssen aktualisiert werden** (Codex-Review-Findings):
- `src/lib/quality/score-event.ts` — `scoreEvent()` ist ingest-time scoring (in `supabase-sync.ts:39`). Hat `computeLinkScore()` mit `+3 (source_url) + 3 (ticket_url) + 4 (any link) = max 10`.
- `src/lib/utils/scoring.ts` — `calculateScore()` ist backfill-scoring (in `calculate-scores.ts`). Hat `+15 unconditional ticket_url`.

**Scoring Regel ist HOST-basiert auf ticket_url, nicht nur source_name** (Codex-Finding: source_name allein vergibt +10 auch ohne ticket_url; missesst events von anderen Quellen die zu trusted hosts linken):

```typescript
// Konstanten in BEIDEN Files identisch:
const TRUSTED_TICKET_HOSTS = new Set([
  'oeticket.com', 'oeticket.at',
  'eventim.de', 'eventim.at',
  'ticketmaster.at', 'ticketmaster.com',
  'wien-ticket.at',
  'ntry.at',
  'feverup.com',
]);

function getTrustedTicketBonus(ticketUrl: string | null | undefined): number {
  if (!ticketUrl) return 0;
  try {
    const host = new URL(ticketUrl).hostname.toLowerCase().replace(/^www\./, '');
    return TRUSTED_TICKET_HOSTS.has(host) ? 5 : 1;
  } catch { return 0; }
}
```

#### score-event.ts — neue computeLinkScore (max 10):
```typescript
export function computeLinkScore(e: ScoreableEvent): number {
  let s = 0;
  if (e.source_url) s += 3;
  s += getTrustedTicketBonus(e.ticket_url);  // 0 / 1 / 5
  if (e.source_url || e.ticket_url) s += 2;
  return Math.min(10, s);
}
```

#### utils/scoring.ts — `calculateScore`:
- ALTEN unconditional `ticket_url +15` Bonus entfernen
- ERSETZEN durch: `score += getTrustedTicketBonus(event.ticket_url) * 2` (skaliert auf scoring-Skala der utils-Variante: max +10)

**ScoringEventRow / ScoreableEvent Contract**: `ticket_url` ist bereits Feld (verifiziert in `score-event.ts:45`). `source_name` muss NICHT hinzugefügt werden (Regel basiert auf ticket_url-host, nicht source_name).

### Image-Quality
**Sync-Boundary respektieren**: `BaseScraper.extractImageUrl()` bleibt sync und retourniert `string | undefined` (kein Breaking Change für die ~302 Scraper).
- Neu hinzufügen: `BaseScraper.extractImageCandidate(): { url: string; width?: number; height?: number; score: number } | undefined` (additiv)
- Neu hinzufügen: separate async helper `validateAndUpgradeImageUrl(originalUrl, originalWidth)` die im supabase-sync Pfad aufgerufen wird (nicht im BaseScraper)
- HEAD-Validate + CDN-Upgrade läuft im supabase-sync Schritt, nicht im sync extract

**srcset-Parser** (in `extractImageUrl`): erweitert um density-Descriptors (`2x`/`3x`) — bevorzugt `w` wenn vorhanden, sonst pickt highest density.

**ScrapedEvent Interface**: erweitert additiv um `image_width?: number`, `image_height?: number` (optional, kein Breaking).

**CDN-Allowlist** in neuer `src/lib/event-images/cdn-allowlist.ts`: Cloudinary, Imgix, Cloudflare Images, WordPress Patterns. `tryUpgradeImageUrl(url)` mit HEAD-Validate.

**Async helper Signature** (in `src/lib/event-images/validate-upgrade.ts`):
```typescript
async function validateAndUpgradeImageUrl(
  originalUrl: string,
  originalWidth: number | null | undefined
): Promise<{ url: string; width?: number; height?: number }>
```
Wird im supabase-sync per-event-batch (p-limit 5) aufgerufen. Gibt original zurück wenn upgrade fehlschlägt.

### UPSERT-Guard (supabase-sync)
Erweitert die `prefetchExistingRows()` Select-Liste um die guard-relevanten Felder:
- `image_url`, `image_width`, `image_height`
- `description`, `enrichment_version`
- `price_text`

In `toSupabaseRow()`:
- `image_url`: nur überschreiben wenn (a) Quelle gewechselt UND (b) `new_width >= old_width` ODER `old_width IS NULL`
- `description`: nur überschreiben wenn (a) `new.length > old.length × 1.2` ODER (b) `enrichment_version` älter ODER (c) old leer
- `price_text`: nur überschreiben wenn old leer ist
- **`last_seen_at`**: bei JEDEM UPSERT auf `NOW()` setzen (gehört explizit zur write-path Pflicht in supabase-sync, nicht in Soft-Delete)

Gegard fields werden aus dem upsert payload OMITTED wenn der existing-value gewinnt (statt mit gleichem Wert zu re-schreiben).

### Source Disziplinierung
- **Auto-Disable Rule** (basiert auf `source_metrics` view):
  ```
  consecutive_failures >= 5 AND events_7d < 0.2 × events_30d_median
  ```
  Disable schreibt `sources.enabled = FALSE`, `disabled_at = NOW()`, `cooldown_until = NOW() + INTERVAL '14 days'`.
- **Trust-Score Enforcement**: trust < 30 -> setzt `publish_status='needs_review'` **nur für NEUE Events** dieser Source (kein retroactive demotion existing rows). Logik: `if (!existingMap.has(sourceKey) && trustScore < 30 && computedStatus IN ('published','published_low_confidence'))`. Implementation NICHT in `toSupabaseRow()` direkt (würde N-queries machen), sondern: prefetch source-trust map einmal pro Batch in `syncEventsToSupabase()`, pass an mapping fn (gleiches Pattern wie `existingMap`).
- **Soft-Delete**: nightly job marks `publish_status='expired'` für Events mit `last_seen_at < now() - 30d AND start_date < now() AND publish_status IN ('published','published_low_confidence','needs_review')`.

### Pipeline-Integration
**Ownership-Trennung (klar):**
- **`scrape.ts` owns**: nach jedem `runScraper()` inline UPSERT in `sources` (FK-safe via ON CONFLICT DO NOTHING) + INSERT in `source_runs`. Skip disabled sources vor `runScraper()`.
- **`scrape-pipeline.ts` source_discipline Stufe** (nach scoring): liest `source_runs WHERE run_at >= started_at`, ruft `evaluateSource()` für jede source, evaluiert Auto-Disable Rule, sendet Alerts. KEIN Doppel-Insert.

So entsteht keine Ambiguität: scrape schreibt run-data sofort, pipeline liest + evaluiert.

### Daily Refresh — gewählte Runtime
**GitHub Actions schedule** als gewählte Runtime (begründet, nicht "optional"):
- `.github/workflows/daily-enrich.yml`
- Cron `0 3 * * *` UTC = 04:00/05:00 Vienna
- Runner installiert `@anthropic-ai/claude-code`, ruft `npm run enrich:claude -- --since=24h --max-events=500`
- Auth: GitHub Secrets (`ANTHROPIC_API_KEY` ODER `CLAUDE_OAUTH_TOKEN` für Max-Plan) + Supabase Secrets

Variante "Vercel Cron + Endpoint" und "Anthropic Routine" werden als Future-Options dokumentiert, **nicht implementiert in fn-14.8**.

### claude -p Auth-Modus (`--bare` conditional)
**Existing `enrich-claude-cli.ts` doku** (L324-335): `--bare` funktioniert NUR mit `ANTHROPIC_API_KEY`. Max-OAuth (CLI-Login) überlebt `--bare` NICHT. Daher conditional logic:
```pseudo
const useBare = !!process.env.ANTHROPIC_API_KEY;
const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--max-turns', '1'];
if (useBare) args.push('--bare');
// CLI-Login (MAX-Plan): no --bare, alle hooks/skills/CLAUDE.md sind aktiv (langsamer startup)
// API-key: --bare aktiv, schneller startup
```
Trade-off: lokales Bulk-Run (MAX OAuth, kein --bare) ist langsamer aber kostenlos. GitHub Actions (API-Key, --bare) ist schneller aber kostet tokens.

### Image Width/Height Population Strategie
**Codex-Finding:** Wenn `extractImageUrl()` sync bleibt (return `string|undefined`), werden width/height-Spalten leer.

**Strategie (im supabase-sync-Schritt, nicht im BaseScraper):**
1. **Aus URL-Pattern extrahieren** (synchron, kostenlos):
   - Cloudinary `/w_1200,h_800/` -> width=1200, height=800
   - Imgix `?w=1200&h=800` -> dito
   - WordPress `-1200x800.jpg` -> dito
2. **Top-10 Scraper migrieren** (gem2go, gemeinden-generic, feratel-deskline, etc.) auf `extractImageCandidate()` wenn HTML width/height attribute vorhanden
3. **Async helper `validateAndUpgradeImageUrl(url, knownWidth)`** kann optional HEAD-content-length-heuristik machen (size in KB → grobe estimate für Filter "klein vs groß")

Acceptance: nicht "100% width/height für ALLE neuen Events", sondern "befüllt wenn aus URL/HTML extrahierbar".

## API Contracts

### src/scripts/enrich-claude.ts (NEU-DESIGN, nicht reiner Refactor)

```
Input args:  --batch-size 20 (default, konservativ), --concurrency 4 (default, konservativ), --limit N (max events to process; aliased --max-events),
             --since=24h (timedelta filter on updated_at), --force, --dry-run, --model {sonnet|opus}, --retry-failed
Process:     fetch event batch via Supabase
             -> build batch prompt (multi-event JSON-Array Input)
             -> spawn claude -p (stdin) mit OS-timeout 180s + SIGKILL
             -> --bare conditional: nur wenn ANTHROPIC_API_KEY gesetzt (siehe Auth-Modus)
             -> parse JSON-Array Response
             -> per-event Zod validation (incl. numeric suggested_price_min)
             -> partial-failure handling (gute Items committen, schlechte zurückqueuen)
             -> BulkUpdater (RPC erweitert in fn-14.2 um enrichment_failed, enrichment_failure_count, price_min)
Output:      stats {processed, enriched, failed, descFilled, priceFilled, tokensIn, tokensOut}
Concurrency: p-limit Pool, default 4 parallel subprocesses (User-Interview konservativ; Operator kann via --concurrency höher setzen)
Retry:       3-attempt exponential backoff, 401/quota = bail immediately
Telemetry:   tokens_in/out + cost_usd aus claude -p output (Mode abhängig vom Spike-Ergebnis,
             siehe fn-14.3 Step 1: entweder --output-format json mit usage-Felder ODER stream-json
             mit usage-events). Acceptance: "token telemetry from verified CLI output mode".
Quota guard: monitor cumulative tokens (verifizierter Signal), alert/halt bei wöchentlichen Token-Schwellwerten
```

### Erweitertes Output-Schema (Numeric Price)
Zusätzlich zu `suggested_price_text` und `price_tier`:
- `suggested_price_min: number | null` — Numeric, in EUR. Beispiel: "ab 25€" -> `25`, "Eintritt frei" -> `0`, ambig -> `null`.
- Zod: `z.number().min(0).max(10000).nullable()`
- DB Write Rule: schreibe `price_min` NUR wenn `oldRow.price_min IS NULL AND validated.suggested_price_min !== null`. Old non-null bleibt.

### Cost-Telemetry (NICHT als Hard-Requirement)
`claude -p --output-format json` `total_cost_usd` ist **unverifiziert** für die aktuelle CLI-Version. Daher:
- **Spike-Subtask** in fn-14.3: 1 Test-Call mit `--output-format json` ausführen, Schema des Output dokumentieren
- Wenn `total_cost_usd` verfügbar: nutzen
- Wenn nicht: ersetze durch token-counts (sind im stream-json events enthalten)
- Acceptance-Kriterien werden auf "tokens" formuliert (verfügbar) statt "cost_usd" (möglicherweise nicht)

### Validation Layers (Belt-and-Suspenders)
1. claude -p `--output-format json` -> structural JSON parse
2. Zod schema (closed-vocabulary `z.enum` gegen `enrichment-taxonomy.ts`)
3. DB CHECK constraints (price_min >= 0, etc.)
4. On validation fail -> 1 retry mit error-feedback-prompt; bei nochmal-Fail: batch wird abgebrochen UND `enrichment_failure_count` pro betroffenem Event +1. Erst wenn dieser Counter `>= 3` erreicht → `enrichment_failed=TRUE` (poison-pill). Damit ist die Standardregel: 3 per-event Failures bevor permanenter Skip.

### Prompt Design (German, anchored on enrichment-taxonomy.ts)
- Reuse 90% von `enrich-openai.ts:142-300` (taxonomy + decision rules + boolean flags)
- **Generierung**: Prompt-Body baut sich aus `PRIMARY_CATEGORIES.join(' | ')` etc. — keine Hardcoded-Liste, kein Drift-Risiko
- ÄNDERUNGEN (per fn-14.3 Interview):
  - **Description-Spec: 400-1000 Zeichen, erzählend** mit Hintergrund für verifizierbare Fakten (Venues, Gebäude, Städte) — NICHT für Personen/Bands
  - **Negativ-Regel**: "Erwähne NICHT die Kategorie oder Tags in der Beschreibung"
  - **Description-Override-Logik**: poliere wenn `len in [40, 400)`, schreibe neu wenn `< 40`, in Ruhe lassen wenn `>= 400 AND keine HTML-Tags`
  - **Price-Extraction** mit expliziten Edge-Cases:
    - `"ab 25€"` → `price_min=25`
    - `"Spende erbeten"` → `price_min=0`, `price_flags=['spende-erbeten']` (NEU)
    - Mehrfach-Preise → `price_min=Erwachsenen-Preis`

## Edge Cases & Constraints

- MAX-Plan Quota ist undokumentiert (5h-rolling + weekly cap). Bulk-Run staged über 2-3 Tage; token-burn-Log nach jedem 10%-Schritt; halt bei 95% wöchentlich.
- Subprocess hang (claude-code#28482): OS timeout + SIGKILL nach 180s; mark batch failed, retry next iteration.
- Stdin >10MB cap: bei batch-size=20 events × ~5KB = 100KB, weit unter cap. Dynamisches Reduzieren wenn payload >5MB.
- Subprocess invalid JSON: Zod fail -> 1 retry mit error-feedback-prompt -> bei nochmal-Fail: bail batch UND `enrichment_failure_count` pro betroffenem Event +1. Erst wenn counter `>= 3` → `enrichment_failed=TRUE` (poison-pill, permanenter Skip).
- `category_locked=true`: kein primary_category-Override, andere Felder werden geupdated.
- Image upgrade 404: HEAD-Check fails -> keep old URL, log warning.
- Image upgrade smaller: reject upgrade.
- CDN nicht in Allowlist: keep original URL, kein Transformation-Versuch.
- Bulk-Migration crash mid-run: idempotent via `enrichment_version != 'claude-v1' AND enrichment_failed = FALSE` filter — re-run pickt up.
- Concurrent scrape + enrichment: race-safe via NULL filter (scrape UPSERT setzt `enrichment_version = NULL` für content-changed rows).
- `last_seen_at` write: gesetzt bei jedem UPSERT durch supabase-sync (explizite Pflicht in fn-14.5).
- Quota burn von claude.ai chat: User wird gewarnt vor Bulk-Run.
- Score recalculation: nach `ticket_url`-Bonus-Removal sowohl `scoreEvent` (ingest) als auch `calculateScore` (backfill) -> alle event_scores neu (`npm run score`).
- Embeddings refresh: descriptions ändern sich massiv -> pgvector embeddings teilweise stale. Out-of-scope, separater Folge-Task.
- Sitemap: nach Bulk-Migration `publish_status` shifts -> sitemap regenerate.
- fn-1.6 / fn-4.1 / fn-4.6 Konflikt: fn-14 owns Phase 4+5; redundante fn-1.6/fn-4.6 mit User abklären.
- fn-13 Konflikt: fn-13 setzt explizit auf stable `enrich-openai.ts` + `supabase-sync.ts`. fn-14 zuerst, fn-13 danach re-anchored.

## Acceptance Criteria

### Phase 1 (Pipeline + Scoring)
- [ ] `npm run scrape:pipeline` (default) führt Enrichment-Stufe NICHT aus (verifizierbar via Pipeline-Output: kein "Enrich new events" Block)
- [ ] `npm run scrape:pipeline -- --with-enrichment` führt es opt-in aus
- [ ] `npm run enrich:claude` Command verfügbar (delegiert an enrich-claude.ts)
- [ ] `npm run enrich:openai` Command verfügbar als Fallback
- [ ] Beide Scoring-Pfade aktualisiert: `scoreEvent` (in src/lib/quality/score-event.ts) UND `calculateScore` (in src/lib/utils/scoring.ts)
- [ ] **`TRUSTED_TICKET_HOSTS` Set + `getTrustedTicketBonus()` Helper** in beiden Files identisch definiert
- [ ] `score-event.ts computeLinkScore`: ALT `+3 ticket_url unconditional` -> NEU `getTrustedTicketBonus(ticket_url)` (0/1/5), max 10
- [ ] `utils/scoring.ts calculateScore`: ALT `+15 ticket_url unconditional` -> NEU `getTrustedTicketBonus(ticket_url) * 2` (0/2/10)
- [ ] **Bonus ist HOST-basiert auf ticket_url** (NICHT source_name) — verifiziert: trusted source ohne ticket_url -> +0
- [ ] **KEIN source_name Feld** zu ScoreableEvent/ScoringEventRow hinzugefügt (ticket_url ist bereits da, reicht)
- [ ] TypeScript-Build grün (kein Type-Refactor nötig)
- [ ] `npm run score` läuft erfolgreich, recalculiert event_score
- [ ] WeeklyHighlights/RegionExplorer-Output qualitativ sinnvoll (manuelle UAT)

### Phase 2 (DB-Migration)
- [ ] events Spalten existieren: image_width, image_height, last_seen_at, enrichment_failed, enrichment_failure_count, **is_dog_friendly, is_wheelchair_accessible, is_outdoor** (alle BOOLEAN DEFAULT FALSE)
- [ ] Partial Index `events_stale_idx` mit korrekter WHERE-Clause
- [ ] `last_seen_at` für existing rows mit `updated_at` Wert backfilled
- [ ] `sources` Tabelle existiert (10 Spalten) + index
- [ ] `source_runs` Tabelle existiert + composite index
- [ ] `source_metrics` view aggregiert events_7d und events_30d_median korrekt (mit COALESCE für NULL-handling)
- [ ] **`bulk_update_event_enrichment` RPC erweitert** um `enrichment_failed`, `enrichment_failure_count`, `price_min`, `is_dog_friendly`, `is_wheelchair_accessible`, `is_outdoor` — Test-Call schreibt alle 6 Felder erfolgreich
- [ ] Migration ist idempotent

### Phase 3 (enrich-claude.ts NEU-DESIGN)
- [ ] Vocabulary Reconciliation abgeschlossen: `docs/TAXONOMY.md` regeneriert aus enrichment-taxonomy.ts
- [ ] `enrich-claude.ts` neu geschrieben mit Batch-Architektur
- [ ] Spike-Subtask: `claude -p --output-format json` Output-Schema dokumentiert (mit conditional --bare!)
- [ ] Nutzt BulkUpdater (`bulk_update_event_enrichment` RPC)
- [ ] Output-Schema enthält v2-Felder: primary_category, occasion_tags, price_flags, setting
- [ ] **Output-Schema enthält `suggested_price_min: number | null`** (numeric EUR), Zod-validated
- [ ] **DB-Write-Rule für `price_min`**: nur wenn old NULL UND new ≠ null
- [ ] **3 neue Boolean-Flags im Output-Schema**: `is_dog_friendly`, `is_wheelchair_accessible`, `is_outdoor` — alle TRUE nur bei expliziter Evidenz, im Zweifel FALSE
- [ ] **Description-Länge 400-1000 Zeichen** (Zod, Prompt, Override-Logik)
- [ ] **Defaults: --batch-size 20, --concurrency 4** (User: konservativ)
- [ ] **`spende-erbeten` Wert** im `PRICE_FLAGS` Vokabular von enrichment-taxonomy.ts ergänzt
- [ ] Modell-IDs aktualisiert auf claude-sonnet-4-6 (default), claude-opus-4-7 (fallback)
- [ ] `enrichment_version='claude-v1'` wird gesetzt
- [ ] Selection contract excluded `enrichment_failed=true` events; `--retry-failed` flag implementiert
- [ ] Selection enthält published, published_low_confidence, needs_review (NICHT expired/duplicate/suppressed/draft); KEIN start_date/quality_score Filter
- [ ] `category_locked=true` Events: nur category geschützt, andere Felder werden geupdated
- [ ] Prompt enthält Anti-Kategorie-Bleed-Regel
- [ ] Description-Logik: poliere mid-length, fülle leer, lasse gut in Ruhe
- [ ] Zod-Validation greift; partial-failure-handling pro batch
- [ ] OS-timeout + SIGKILL bei hängendem subprocess
- [ ] **`--bare` Flag conditional**: nur mit ANTHROPIC_API_KEY gesetzt, nicht mit MAX-OAuth
- [ ] **`--limit` und `--max-events` als Aliase** für gleiches Argument; beide funktionieren
- [ ] Token-Burn-Logging im Output (cost_usd best-effort, tokens als Hauptsignal)
- [ ] 100-Events Test-Run erfolgreich, Stichprobe-QA grün

### Phase 4 (Bulk-Migration)
- [ ] Reset basiert auf `enrichment_version` (NICHT category_source): `UPDATE events SET enrichment_version=NULL WHERE enrichment_version != 'claude-v1' OR enrichment_version IS NULL` (effektiv: alle nicht-claude-v1)
- [ ] Bulk-Run abgeschlossen: alle target-population events haben enrichment_version = 'claude-v1' (minus poison-pills)
- [ ] `category_locked=true` Events: category unverändert (Stichprobe), andere Felder geupdated
- [ ] Token/Quota-Limits NICHT erreicht (max 80% wöchentlich)
- [ ] Stichprobe-QA 50 Events: keine Kategorie-Erwähnung in description, length 400-1000 char, price_text gefüllt wenn Quelltext Preis nennt
- [ ] `npm run score` läuft erfolgreich nach Migration (beide Scoring-Pfade)
- [ ] Sitemap regeneriert
- [ ] Embeddings-Refresh als Folge-Task in flowctl angelegt

### Phase 5a (Bildqualität)
- [ ] srcset Parser unterstützt `Nx` density descriptors (1x/2x/3x), bevorzugt `Nw` width descriptors
- [ ] `extractImageUrl()` BLEIBT sync, return type unverändert (string|undefined)
- [ ] Neue additive Methode `extractImageCandidate(): {url, width?, height?, score}`
- [ ] CDN-Allowlist mit mind. 4 Handlern (Cloudinary, Imgix, Cloudflare Images, WordPress)
- [ ] `tryUpgradeImageUrl()` bei unbekanntem CDN gibt null zurück
- [ ] Async `validateAndUpgradeImageUrl()` läuft im supabase-sync Schritt (nicht im BaseScraper)
- [ ] HEAD-Validate vor Upgrade: bei 404/non-image -> fallback zu original URL
- [ ] ScrapedEvent Interface erweitert additiv um `image_width?, image_height?`
- [ ] **width/height werden befüllt wenn aus URL-Pattern (Cloudinary/Imgix/WordPress) ODER HTML width/height-Attributen extrahierbar** — nicht "100% für alle Events"
- [ ] **Top-10 Scraper migriert** auf `extractImageCandidate()` für HTML-Attribute-Extraktion
- [ ] `extractDimsFromUrl()` Helper extrahiert sync aus CDN-URL-Patterns
- [ ] supabase-sync prefetch erweitert um image_url, image_width, image_height, description, enrichment_version, price_text
- [ ] UPSERT-Guard: image_url/description/price_text nur überschreiben wenn upgrade-condition erfüllt
- [ ] **`last_seen_at = NOW()` wird bei jedem UPSERT in supabase-sync gesetzt**
- [ ] Stichprobe 20 Events: Card vs. Detail-Hero qualitativ scharf
- [ ] Pipeline-Run: kein Regression bei og-only Quellen; bei Top-10-Scrapern mit HTML-dims werden width/height befüllt

### Phase 5b (Source-Disziplinierung)
- [ ] `compute-source-trust.ts` schreibt jetzt `sources.last_trust_score` zurück (UPSERT)
- [ ] `source_runs` wird nach jedem Scraper-Run befüllt
- [ ] Auto-Disable: `consecutive_failures >= 5 AND events_7d < 0.2 × events_30d_median` triggert `enabled=false` + `cooldown_until=NOW()+14d`
- [ ] Disabled sources werden in scrape.ts übersprungen (mit log message)
- [ ] Trust-Enforcement via prefetched map in `syncEventsToSupabase` (KEINE per-row DB-lookups in toSupabaseRow)
- [ ] `publish_status='needs_review'` für neue events bei `source.last_trust_score < 30`
- [ ] `soft-delete-stale-events.ts` markiert Events korrekt (Stichprobe vorher/nachher)
- [ ] Pipeline-Integration: source_discipline Stufe läuft nach scoring
- [ ] Re-Enable nach 14d Cooldown via cooldown_until check (automatisch)

### Phase 5c (Neue Sport/Outdoor-Scraper)
- [ ] **Research-Subtask abgeschlossen**: bergwelten.com API/RSS verifiziert, Wintersport-Pick recherchiert, Wassersport-Pick recherchiert, URLs + ToS dokumentiert (per fn-14.7 Interview: Alpenverein-Sektionen DEPRIORITIZED, out of scope)
- [ ] 5-7 neue Scraper-Klassen implementiert (nur verified sources)
- [ ] Alle in `src/lib/scrapers/index.ts` registriert
- [ ] Pipeline-Run pro Source: events korrekt geparst — KEIN Hard-Cap auf Mindest-Output (per fn-14.7 Interview); Reporter zeigt nur Warning, Auto-Disable kommt aus fn-14.6 Sliding-Window
- [ ] Tags korrekt gesetzt
- [ ] Coverage-Report zeigt neue Sources im Top-130
- [ ] CLAUDE.md aktualisiert
- [ ] Erste Events kriegen primary_category richtig (Sport/Natur/Wellness)

### Phase 5d (Daily-Refresh)
- [ ] **GitHub Actions Workflow** `.github/workflows/daily-enrich.yml` installiert
- [ ] Cron `0 3 * * *` UTC
- [ ] Auth via GitHub Secrets (`ANTHROPIC_API_KEY` ODER OAuth-Token für MAX)
- [ ] Erster Test-Run erfolgreich (manuell trigger via workflow_dispatch)
- [ ] Logs zeigen `events_processed >= 0` mit klarer Status-Message ("processed N" ODER "no eligible events"); 0 ist akzeptabel wenn kein 24h-delta
- [ ] Failure-Mode dokumentiert (quota / network / timeout)
- [ ] (NICHT in scope: Vercel Cron, Anthropic Routine — als future-option dokumentiert)

### Cross-Cutting
- [ ] CLAUDE.md aktualisiert (Pfade, Build & Test, Env Vars)
- [ ] CHANGELOG.md neuer Phase-Eintrag
- [ ] docs/TAXONOMY.md regeneriert (gleicht enrichment-taxonomy.ts)
- [ ] Embeddings-Refresh-Task als Folge-Task in flowctl

## Quick Commands

```bash
npm run scrape:pipeline -- --source burgenland.info --skip-scrapers      # smoke pipeline ohne enrichment
npm run scrape:pipeline -- --with-enrichment                              # opt-in enrichment
npm run enrich:claude -- --limit 10 --dry-run                             # smoke claude enrichment
npm run enrich:openai -- --limit 10 --dry-run                             # fallback openai
npm run score                                                             # backfill recalc
tsx src/scripts/regen-taxonomy-doc.ts                                     # regen docs/TAXONOMY.md
```

## Boundaries

**In Scope:**
- Vocabulary reconciliation (code authoritative, doc derived)
- enrich-claude.ts NEU-DESIGN (Batch-Mode mit BulkUpdater)
- Pipeline-Aufspaltung
- Beide Scoring-Pfade fixen
- DB-Migration mandatory (sources + source_runs + view)
- Bildqualität (sync-extract + async-upgrade trennen, persistierte Dimensionen)
- supabase-sync UPSERT-Guard inkl. last_seen_at
- Bulk-Migration der ~80k Events (staged)
- Sport/Outdoor: research subtask + 5-7 verified scrapers
- Source-Disziplinierung (Auto-Disable + Trust + Soft-Delete)
- Daily-Refresh: GitHub Actions
- Doc-Updates

**Out of Scope:**
- OpenAI-Skript löschen (bleibt Fallback)
- Embeddings-Migration (separater Folge-Task)
- Frontend-Änderungen über Bilder hinaus
- Image-Proxy/CDN-Layer
- Großer Taxonomie-Inhalts-Rework
- Admin-UI für needs_review-Triage
- Vercel Cron / Anthropic Routine als Daily-Refresh-Variante (future)

## Decision Context

**Warum claude -p Subprocess statt Direct-API?**
User wünscht "keine API-Kosten". MAX-Plan deckt CLI-Nutzung. Trade-off: weniger transparente Quota.

**Warum Code-Konstanten als SoT, nicht docs/TAXONOMY.md?**
Code ist Runtime-Validator. Doc ist menschen-lesbar. Drift zwischen beiden produziert silent-drop. Auto-Regenerate aus Code löst das Problem ohne mapping-layer.

**Warum NEU-DESIGN, nicht Refactor?**
Per-Event -> Batch ist eine fundamentale Architektur-Änderung. Response-parsing, partial-failure, retry-semantics sind komplett neu. Nur Helpers (resolveClaudeBinary, extractJson) werden wiederverwendet.

**Warum source_runs Tabelle statt Spalten?**
Auto-Disable braucht 7d-events und 30d-median. Aggregierte Spalten würden bei jedem Run aktualisiert (hot-write contention) und wären nicht auditable. Audit-history ist günstig (~100 rows/source/Monat).

**Warum extractImageUrl sync lassen?**
~302 Scraper rufen es. Async-conversion = 302 file-Änderungen + Promise-Propagation. Sync-Boundary respektieren, async-validation in supabase-sync wo es ohnehin async ist.

**Warum trust-prefetch im sync-Batch?**
toSupabaseRow ist pure mapping. DB-lookup pro row = N-queries pro Batch (z.B. 500 events = 500 DB calls). Pattern: existing `existingMap` zeigt wie batch-prefetch geht.

**Warum GitHub Actions als Daily-Refresh-Runtime?**
Vercel-Functions können kein claude binary spawnen (nicht installiert in runtime). GitHub Actions Runner kann. Anthropic-Routines sind eine MCP-Möglichkeit aber Setup-Komplexität höher; bleibt als future-option.

**Warum sources Tabelle mandatory?**
fn-14.6 enforce-Logik braucht sie. Optional war Fehler in v1 der Spec.

**Warum Auto-Disable Sliding-Window 5-of-10 statt 3-Strikes?**
3-Strikes killt gesunden Scraper bei Website-Redesign + CDN-Hiccup + DNS-Blip. 5-of-10 + median-comparison hält wackeligen Scraper am Leben.

**Warum category_locked nur Kategorie-Schutz?**
Wenn ein Maintainer manuell die Kategorie korrigiert, will er die Kategorie behalten — nicht aber andere Felder von 6 Monaten zurück einfrieren.

## Open Questions for Implementation

Diese werden in den entsprechenden Tasks aufgelöst:
1. **bergwelten.com** API/RSS verfügbar? (fn-14.7 Research-Subtask)
2. ~~Alpenverein-Sektionen Liste kuratieren~~ (per fn-14.7 Interview DEPRIORITIZED — out of scope für fn-14, future-only Folge-Task)
3. **Slack-Webhook** vorhanden? (fn-14.6 — Fallback Email via Resend wenn nicht)
4. **MAX-Plan OAuth Token für GitHub Actions** verfügbar? (fn-14.8 — sonst ANTHROPIC_API_KEY)
5. **needs_review Triage-UI** kommt als separater Folge-Task

## References

- Conflict-Analyse: epic-scout (fn-1.6, fn-4.1, fn-4.6, fn-13)
- Reference impl: `src/scripts/enrich-openai.ts` (1060 lines, taxonomy validation pattern)
- Reuse-Quelle: `src/scripts/enrich-claude-cli.ts` (805 lines — nur Helpers wiederverwendet)
- BulkUpdater: `src/lib/db/bulk-update.ts`
- **Echte Scoring-Pfade**:
  - `src/lib/quality/score-event.ts` (ingest-time, in supabase-sync.ts:39)
  - `src/lib/utils/scoring.ts` (backfill, in calculate-scores.ts)
- Closed vocab: `src/lib/category-classifier/enrichment-taxonomy.ts` (validateEnrichment fn)
- Doc-SoT (regeneriert): `docs/TAXONOMY.md`
- Image extraction: `src/lib/scrapers/BaseScraper.ts:144-276`
- Sync clobber-Stelle: `src/lib/db/supabase-sync.ts:393-471`
- Source trust (read-only): `src/lib/pipeline/source-trust.ts` + `src/scripts/compute-source-trust.ts`
- Sport templates: `src/lib/scrapers/niche/OutdoorSportScrapers.ts` + `SportScrapers.ts`
- Anthropic docs: https://code.claude.com/docs/en/headless, https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- HTML srcset spec: https://html.spec.whatwg.org/multipage/images.html
