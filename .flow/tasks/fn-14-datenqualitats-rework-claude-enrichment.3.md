# fn-14-datenqualitats-rework-claude-enrichment.3 enrich-claude.ts: NEU-DESIGN Batch + v2 + anti-bleed prompt

## Description

**Achtung — NEU-DESIGN, nicht reiner Refactor.** `src/scripts/enrich-claude-cli.ts` (805 Zeilen) ist per-event subprocess + single-row UPDATE. Diese Task baut eine neue Batch-Architektur (~20 events/call konservativ per Interview, BulkUpdater). Wiederverwendet werden nur Helpers (`resolveClaudeBinary`, `extractJson`, retry-pattern).

**Pre-Work (Critical):** Vocabulary Reconciliation zwischen `docs/TAXONOMY.md` und `enrichment-taxonomy.ts`. Code ist runtime-SoT, doc wird aus code regeneriert (`tsx src/scripts/regen-taxonomy-doc.ts`). Prompt wird aus Code-Konstanten gebaut (kein Hardcoded-Drift).

**Size:** M-L (1 main file new + 1 generator script + zod validators + spike, 12 acceptance criteria)

**Files:**
- `src/scripts/enrich-claude.ts` (NEU)
- `src/scripts/regen-taxonomy-doc.ts` (NEU — generator für docs/TAXONOMY.md aus code)
- `docs/TAXONOMY.md` (regeneriert)
- `src/lib/category-classifier/enrichment-zod.ts` (NEU — Zod schemas aus enrichment-taxonomy.ts)
- `src/lib/category-classifier/enrichment-taxonomy.ts` (Modell-IDs update wenn dort referenziert)
- `src/scripts/enrich-claude-cli.ts` (bleibt als legacy reference, wird NICHT gelöscht)

## Interview Decisions (2026-05-06)

**Prompt-Stil & Description:**
- **Stil: Erzählend** ("Bei diesem Tamburica-Abend tritt X auf, der bekannt ist für ...")
- **Hintergrund-Wissen erlaubt für verifizierbare Fakten** (Venues, historische Gebäude, Städte/Regionen). NICHT für Personen/Bands/Künstler — dort nur was im Quelltext steht
- **Description-Länge: 400-1000 Zeichen** (bumped from 300-700) — mehr Detail für SEO + Detail-Pages
- Existing Anti-Bleed-Regel ("nicht Kategorie/Tags erwähnen") bleibt

**Price-Extraction (3 explizite Edge-Cases):**
- `"ab 25€"` → `price_min=25` (Untergrenze)
- `"Spende erbeten" / "Auf Spendenbasis"` → `price_min=0`, `price_tier='gratis'`, **NEU: `price_flags=['spende-erbeten']`** — Vokabular muss erweitert werden
- Mehrfach-Preise (Erwachsene/Student/Kinder) → `price_min = Erwachsenen-Preis` (Standard-Marktpreis), nicht Kinder-Discount. Originaler `price_text` behält den vollen Text

**Performance (User-Wahl: konservativ):**
- `--batch-size 20` (statt 30)
- `--concurrency 4` (statt 8)
- Erwartete Bulk-Run Dauer: ~10h+ statt 2.5h, sicherer/weniger Crash-Risiko
- MAX-OAuth ohne `--bare` fügt ~3s startup/call hinzu

**Failure Recovery:**
- Bei subprocess-hang/timeout: **Re-queue Batch als Retry mit `failure_count++`**. Erst nach 3 Failures pro event → poison-pill (`enrichment_failed=TRUE`). Ein einzelner Hang ist meist transient (Network-Glitch).

**Quota-Alerts:**
- Bei 80% wöchentlich-cap: **Email-Warning via Resend** (existing infra)
- Bei 95%: clean exit (kein crash); Re-Run mit demselben Command setzt automatisch fort (idempotent via `enrichment_version IS NULL` filter — kein extra `--resume` Flag nötig)

**HTML-Stripping (raw page text):**
- cheerio: alles strippen außer `body`, max **8000 Zeichen** (cap auf prompt-input)
- Bei >8000: tail-truncate mit `... [truncated]` marker

**category_locked Behaviour:**
- Wenn `category_locked=true`: NUR `category` Feld geschützt
- Andere Felder (description, tags, audience, vibe, occasion, price, flags) werden normal enriched
- Das gilt auch wenn andere Felder NULL/leer sind — AI darf füllen

**Boolean Flags Erweiterung (3 NEU):**
- `is_dog_friendly` (für Outdoor-Events relevant)
- `is_wheelchair_accessible` (Inklusion)
- `is_outdoor` (klar drinnen/draußen — User-Wahl trotz redundanz mit `setting`-Achse, weil bool einfacher im UI-Filter)

Alle 5 boolean flags (is_student_friendly, is_family_friendly + 3 neu) folgen dem gleichen Prompt-Pattern: TRUE nur bei expliziter Evidenz, im Zweifel FALSE.

## Approach

### Step 0: Vocabulary Reconciliation (Pre-Work)
- Audit aller Werte in `enrichment-taxonomy.ts` (TAGS, AUDIENCES, VIBES, OCCASIONS, SETTINGS, PRICE_TIERS, PRICE_FLAGS, DURATION_TYPES, LANGUAGES, PRIMARY_CATEGORIES)
- Vergleiche mit `docs/TAXONOMY.md` §3
- Schreibe `regen-taxonomy-doc.ts`: liest die exports aus enrichment-taxonomy.ts, erzeugt markdown-Sektion §3 mit dengleichen Werten
- Run `tsx src/scripts/regen-taxonomy-doc.ts` -> `docs/TAXONOMY.md` ist dann konsistent

### Step 1: Spike — Verify claude -p Output Schema (Auth-Mode-conditional!)
**Bevor** der Hauptcode geschrieben wird, ein 30-min Spike:
- **Conditional command** (Codex-Finding: `--bare` funktioniert nicht mit MAX OAuth):
  ```bash
  if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo '{"test":1}' | claude -p --output-format json --bare "Sag hallo"
  else
    # MAX OAuth Mode (CLI-Login)
    echo '{"test":1}' | claude -p --output-format json "Sag hallo"
  fi
  ```
- Dokumentiere PER AUTH-MODE: enthält Output `total_cost_usd`? `tokens_in`/`tokens_out`? Welche Felder genau?
- Ergebnis bestimmt ob `cost_usd` als hard-requirement geht oder ob token-count als Hauptsignal genutzt wird
- Output-Schema in einem Comment am Top von `enrich-claude.ts` dokumentieren — beide Auth-Modi sollten sich gleich verhalten, falls nicht: dokumentieren

### Step 2: Reuse von enrich-claude-cli.ts
Aus dem 805-Zeilen-Wrapper übernehmen (copy + adapt):
- `resolveClaudeBinary()` (L55-79) — Win .exe Direct-Spawn
- `extractJson()` brace-counting parser (L409-437)
- spawn-Pattern: `windowsHide: true`, NO_COLOR/CLAUDE_CODE_SUPPRESS_UPDATE_CHECK envs
- 5-attempt retry/backoff Logik
- Reverted-Flags-Annotation (L324-335) als historischer Comment

### Step 3: Batch-Architektur (NEU)
Per Event in single call ist zu langsam. Stattdessen:
- Sammle 20 Events pro Batch (User-Interview-Default; override via `--batch-size`)
- Build Prompt: System-Prompt (anchored to enrichment-taxonomy.ts via `PRIMARY_CATEGORIES.join(' | ')`) + User-Message als JSON-Array von Events
- **`--bare` Flag conditional** (Codex-Finding):
  ```pseudo
  const useBare = !!process.env.ANTHROPIC_API_KEY;  // NUR mit API-Key, NICHT mit MAX-OAuth
  const args = ['-p', '--output-format', 'json', '--no-session-persistence', '--max-turns', '1'];
  if (useBare) args.push('--bare');
  ```
- Spawn `claude -p --output-format json [--bare] --append-system-prompt-file ...`
- Parse Response als JSON-Array von ~20 Output-Objekten (entspricht batch-size Default)
- Per-Event Zod-Validation
- Partial-Failure: gute Items committen, schlechte zurück in retry-queue (mit error-feedback prompt nach 1. Fail). Pro Event-Failure inkrementiert `enrichment_failure_count` +1. Erst nach **3 per-event Failures** wird `enrichment_failed=TRUE` gesetzt (poison-pill). 2 Fails bedeutet bail-batch + retry-queue, nicht permanenten Skip.

### Step 4: Validation Layer (Zod) + Numeric Price
`src/lib/category-classifier/enrichment-zod.ts`:
- Imports `PRIMARY_CATEGORIES`, `TAGS`, etc. aus enrichment-taxonomy.ts
- Build `z.enum([...PRIMARY_CATEGORIES] as const)` etc.
- `suggested_description: z.string().min(400).max(1000).nullable()` — wenn AI eine Description liefert, MUSS sie 400-1000 chars haben; sonst `null` (= "alte description gut, lasse in Ruhe"). Validator erlaubt damit explizit "skip" als gültiges Output.
- **Neu: `suggested_price_min: z.number().min(0).max(10000).nullable()`** — numeric EUR
- `suggested_price_text: z.string().nullable()` (existing)
- Top-level: `z.array(z.object({...}))` für batch-response

**DB Write Rule für price_min:**
```pseudo
if (oldRow.price_min === null && validated.suggested_price_min !== null) {
  update.price_min = validated.suggested_price_min;
}
// non-null bleibt — manueller Wert gewinnt
```

### Step 5: BulkUpdater Integration
Pattern aus `enrich-openai.ts:780-799`:
- `updater = makeBulkUpdater(supabase, 'bulk_update_event_enrichment')`
- `await updater.add({ id: row.id, ...update })`
- SchemaMismatchError-Wrapping (`Could not find column` / `schema cache` / `does not exist`)
- 500-row auto-flush, 3-attempt retry für transiente Fehler

### Step 6: Selection Contract (explizit)
```sql
SELECT id, title, description, category, tags, ... 
FROM events
WHERE publish_status NOT IN ('expired','duplicate','suppressed','draft')
  AND (enrichment_version IS NULL OR enrichment_version != 'claude-v1')
  AND (enrichment_failed IS NULL OR enrichment_failed = FALSE)
ORDER BY id  -- stable for resume
LIMIT batch_fetch_size;
```
**Kein** `start_date >= today` Filter, **kein** `quality_score >= 40` Filter (das waren `enrich-openai.ts` defaults — werden HIER explizit nicht übernommen, weil "alle Events auf der Karte" auch vergangene/low-quality umfasst).

`--retry-failed` Flag setzt `enrichment_failed=FALSE` per UPDATE vor selection.

### Step 7: category_locked Handling
Pattern aus `enrich-openai.ts:756-760`:
```pseudo
const notLocked = !row.category_locked;
if (validated.primary_category && notLocked) {
  update.category = validated.primary_category;
  update.category_source = 'enrichment';
}
// Andere Felder (description, tags, audience, vibe, etc.) werden IMMER aktualisiert
```

### Step 8: Per-Event Retry Counter
Bei validation-fail oder API-fail:
```pseudo
update.enrichment_failure_count = (row.enrichment_failure_count || 0) + 1;
if (update.enrichment_failure_count >= 3) {
  update.enrichment_failed = TRUE;
  log("poison-pill: " + row.id);
}
```

### Step 9: Modell-IDs
- `sonnet -> claude-sonnet-4-6`
- `opus -> claude-opus-4-7`
- `haiku -> claude-haiku-4-5-20251001`
- ENV-Override: `ENRICH_MODEL=opus npm run enrich:claude` schaltet auf Opus

### Step 10: OS-level Timeout + SIGKILL
Wrap spawn:
```pseudo
const proc = spawn(...)
const timer = setTimeout(() => proc.kill('SIGKILL'), 180_000);
proc.on('exit', () => clearTimeout(timer));
```

### Step 11: Telemetry (Mode abhängig vom Spike)
Aus dem CLI Output sammeln (Mode festgelegt von Step 1 Spike):
- `tokens_in`, `tokens_out` — entweder aus `--output-format json` usage-Felder ODER `--output-format stream-json` usage-events
- `cost_usd` — best-effort, abhängig von Spike-Ergebnis (möglicherweise nicht in allen Modi verfügbar)

Log accumuliert in `stats.tokens_total`, alert/halt bei 80%/95% einer geschätzten Token-Schwelle.

Acceptance ist "token telemetry from verified CLI output mode" — der Spike entscheidet welche Mode genutzt wird.

### CLI Args
```
--batch-size 20        # Events pro batch claude -p call (User: konservativ)
--concurrency 4        # parallele subprocesses (User: konservativ, weniger Crash-Risiko)
--limit N              # max events to process; ALIAS: --max-events N
--force                # ignore enrichment_version + enrichment_failed filters
--retry-failed         # reset enrichment_failed=FALSE before run
                       # (kein --resume flag nötig — Re-Run desselben Commands ist automatisch idempotent)
--dry-run              # no DB writes
--model {sonnet|opus}  # default sonnet
--log-file path        # JSON-per-event log
--since=<duration>     # für Daily-Refresh: nur events mit updated_at > now - duration (z.B. 24h, 7d)
```
**Hinweis:** `--limit` und `--max-events` sind Aliase für die gleiche Option (Codex-Finding: fn-14.8 workflow nutzte --max-events, fn-14.3 spec definierte nur --limit -> Konflikt).

## Key context

- Anthropic Claude Code CLI: `--bare` skips MCP/skills/hooks/CLAUDE.md auto-discovery -> faster startup
- Stdin cap is 10MB
- `--exclude-dynamic-system-prompt-sections` maximiert prompt-cache-reuse
- `--no-session-persistence` keine Transcript-Files
- `--json-schema` flag: nochmal testen mit aktueller Claude Code Version (war reverted in cli)
- `category_locked=true` check: pattern aus `enrich-openai.ts:756-760` (NUR Kategorie-Schutz, andere Felder updaten)

## Acceptance

- [ ] **Vocabulary Reconciliation abgeschlossen**: `docs/TAXONOMY.md` regeneriert via `regen-taxonomy-doc.ts`, identisch zu enrichment-taxonomy.ts
- [ ] **Spike-Subtask abgeschlossen**: `claude -p --output-format json` Output-Schema dokumentiert (cost_usd verfügbar? tokens?)
- [ ] `enrich-claude.ts` neu geschrieben mit Batch-Architektur (Default ~20 events/call, konservativ)
- [ ] Helpers (resolveClaudeBinary, extractJson) aus enrich-claude-cli.ts wiederverwendet
- [ ] BulkUpdater integration (`bulk_update_event_enrichment` RPC)
- [ ] Output-Schema enthält v2-Felder: primary_category, occasion_tags, price_flags, setting
- [ ] Output-Schema enthält **`suggested_price_min: number | null`** (numeric EUR), Zod-validated
- [ ] DB-Write-Rule: `price_min` nur wenn old NULL UND new ≠ null
- [ ] **`--bare` Flag conditional**: nur mit ANTHROPIC_API_KEY, nicht mit MAX-OAuth
- [ ] **`--limit` und `--max-events` als Aliase** funktionieren beide gleich
- [ ] Modell-IDs: claude-sonnet-4-6 default, claude-opus-4-7 fallback
- [ ] `enrichment_version='claude-v1'` wird gesetzt
- [ ] **Selection contract explizit**: filtert publish_status NOT IN ('expired','duplicate','suppressed','draft'), enrichment_failed != TRUE; KEIN start_date/quality_score filter
- [ ] **`--retry-failed` Flag funktioniert** (resets enrichment_failed=FALSE before selection)
- [ ] `category_locked=true`: nur category geschützt, andere Felder werden geupdated (Stichprobe)
- [ ] Per-event retry-counter inkrementiert bei validation/api fail; nach 3 fails -> enrichment_failed=TRUE
- [ ] Prompt wird AUS code-konstanten gebaut (PRIMARY_CATEGORIES.join etc.) — kein hardcoded duplicate
- [ ] Prompt enthält explizite Negativ-Regel "Erwähne NICHT die Kategorie/Tags in der Beschreibung"
- [ ] Description-Logik: poliere `[40, 400)`, fülle `< 40`, lasse `>= 400 AND no HTML` in Ruhe (Zod `suggested_description: z.string().min(400).max(1000).nullable()` — null = "alte description gut, lasse in Ruhe")
- [ ] Zod-Validation greift; partial-failure-handling pro batch (gute Items committen)
- [ ] OS-timeout + SIGKILL nach 180s bei hängendem subprocess
- [ ] Token-Burn-Logging im Output (cost_usd best-effort, tokens als Hauptsignal)
- [ ] **Description-Stil erzählend, Länge 400-1000 chars** — Stichprobe 20 Events: keine trockenen 1-Satz-Outputs
- [ ] **Hintergrund-Wissen-Regel im Prompt**: erlaubt für Venues/Gebäude/Städte; verboten für Personen/Bands. Stichprobe: keine Halluzinationen über Künstler
- [ ] **Price-Edge-Cases dokumentiert + getestet**: "ab 25€"=25, "Spende erbeten"=0 + flag, Mehrfach=Erwachsenen-Preis
- [ ] **`price_flags` erweitert** um `'spende-erbeten'` Wert in `enrichment-taxonomy.ts`
- [ ] **Default args**: batch-size=20, concurrency=4 (konservativ)
- [ ] **Hang-Recovery**: Subprocess-timeout markiert Batch als retry mit failure_count++; nach 3 fails per event → poison-pill
- [ ] **Quota-Alerts**: 80% Email-Warning via Resend (existing infra), 95% clean halt; Re-Run desselben Commands setzt automatisch fort (kein --resume Flag, idempotent via enrichment_version filter)
- [ ] **HTML-Stripping**: cheerio body, max 8000 chars mit tail-truncate-marker
- [ ] **3 neue Boolean-Flags** im Output-Schema: `is_dog_friendly`, `is_wheelchair_accessible`, `is_outdoor` — alle TRUE nur bei expliziter Evidenz
- [ ] 100-Events Test-Run erfolgreich (`--limit 100 --dry-run`), Stichprobe-QA grün

## Done summary
TBD

## Evidence
- Commits:
- Spike-Output:
- Test runs:
- Sample outputs:
