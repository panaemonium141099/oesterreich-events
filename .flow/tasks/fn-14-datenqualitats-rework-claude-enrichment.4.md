# fn-14-datenqualitats-rework-claude-enrichment.4 Bulk-Migration ~80k Events nach claude-v1 (staged 2-3 Tage)

## Description

Einmaliger Bulk-Re-Run von `enrich-claude.ts` über alle target-population events, gestaffelt über 2-3 Tage um MAX-Plan Quota nicht zu sprengen.

**WICHTIG (aus Codex-Review):** Reset basiert auf `enrichment_version`, NICHT auf `category_source='enrichment'`. Letzteres würde Events mit `category_locked=true` (deren category_source nicht durch enrichment gesetzt wurde, aber andere enrichment-Felder schon) verfehlen.

**Size:** M (1-2 helper scripts, monitoring, Stichprobe-QA, 7 acceptance criteria)

**Files:**
- `src/scripts/migrate-to-claude-v1.ts` (Helper für staged execution + monitoring)
- ad-hoc SQL queries via Supabase MCP für Stichproben-QA

## Approach

### Vor dem Bulk-Run: Reset enrichment_version (KORRIGIERT)
**ALT (Codex-Review-Befund: falsch):**
```sql
UPDATE events SET enrichment_version = NULL
WHERE category_source = 'enrichment'  -- MISSED locked rows with stale other fields!
```

**NEU (richtig):**
```sql
UPDATE events
SET enrichment_version = NULL
WHERE (enrichment_version IS NULL OR enrichment_version != 'claude-v1')
  AND publish_status NOT IN ('expired','duplicate','suppressed','draft');
```

Alternativ nur die OpenAI-vergifteten:
```sql
UPDATE events
SET enrichment_version = NULL
WHERE enrichment_version = 'enrich-v2-prompt1'
  AND publish_status NOT IN ('expired','duplicate','suppressed','draft');
```

Erwarteter Hit: ~80k Rows.

### Staged Execution (2-3 Tage)
**Tag 1**:
```bash
npm run enrich:claude -- --limit 25000 --batch-size 20 --concurrency 4 \
  --log-file logs/migrate-day1.jsonl
```

**Tag 2 + 3**: gleicher Befehl. Filter holt automatisch die restlichen NULL-version events.

### Monitoring
- Log-File per Day im JSONL Format
- Token-burn checkpoint nach jedem 10%-Schritt (basierend auf Spike-Ergebnis aus fn-14.3)
- Halt bei 80% wöchentlich-cap (Token-basiert wenn cost_usd unverified)
- Pause/Resume sicher: `enrich-claude.ts` ist via `enrichment_version IS NULL AND enrichment_failed != TRUE` filter idempotent

### Stichprobe-QA (vor + nach Migration)
**Vor Migration:**
```sql
SELECT id, title, description, category, price_text, enrichment_version, category_locked
FROM events
WHERE publish_status NOT IN ('expired','duplicate','suppressed','draft')
ORDER BY RANDOM()
LIMIT 50;
```

**Nach Migration:** gleiche query, vergleiche:
- description: keine Kategorie-Erwähnung mehr (manueller Scan)
- description: 400-1000 Zeichen (zähl längen-distribution; per fn-14.3 Interview)
- price_text: gefüllt wenn raw text Preis nennt
- category: `category_locked=true` Events haben unverändertes category
- `category_locked=false` Events: AI-gewählte Kategorie (Stichprobe sinnvoll)

### Score-Recalculation nach Migration
```bash
npm run score
```
Wegen ticket_url bonus removal aus fn-14.1 zusätzlich nötig (auch beide Scoring-Pfade — fn-14.1 acceptance).

### Sitemap regenerate
```bash
npm run build  # next.js sitemap regenerated im build-step
```

### Embeddings Re-Build (out-of-scope, aber Notiz)
Beschreibungen ändern sich massiv -> pgvector embeddings teilweise stale.
**Folge-Task in flowctl anlegen**: `npm run build-embeddings -- --since=<bulk-migration-start-iso>`.

## Key context

- MAX-Plan teilt Quota mit claude.ai chat — User soll während Bulk-Run keine parallele Chat-Session machen
- Anthropic publiziert keine exakten Token-Limits für MAX -> empirisch auf 240M Tokens schätzen, 2-3× wöchentlich-cap
- `cost_usd` aus claude -p möglicherweise nicht verfügbar -> token-count als Hauptsignal (siehe fn-14.3 Spike)
- `enrichment_failed` flag wird bei poison-pills gesetzt (3 retries fail) -> diese werden in Folge-Runs übersprungen
- Bulk-Migration während aktivem Scrape-Pipeline okay: race-safe via NULL filter

## Acceptance

- [ ] Reset query nutzt `enrichment_version` (NICHT category_source) — verifiziert via COUNT(*) WHERE enrichment_version IS NULL ~ erwartete Rows
- [ ] `category_locked=true` Events sind ebenfalls in der reset selection (waren mit category_source='manual' tagged, nicht 'enrichment')
- [ ] Bulk-Run abgeschlossen: COUNT(*) WHERE enrichment_version='claude-v1' = ursprüngliche NULL-Anzahl (minus poison-pills)
- [ ] Stichprobe `category_locked=true` Events: category unverändert nach migration; description/price/etc. aktualisiert
- [ ] Token-Limits NICHT erreicht (max 80% wöchentlich, log zeigt tokens_total)
- [ ] Stichprobe-QA 50 Events: keine Kategorie-Erwähnung in description, length 400-1000 char, price_text gefüllt wo Quelltext Preis nennt
- [ ] `npm run score` läuft erfolgreich nach Migration (beide Scoring-Pfade)
- [ ] Sitemap regeneriert
- [ ] Embeddings-Refresh als Folge-Task in flowctl angelegt (separater Epic oder fn-14 Folgetask)

## Done summary
TBD

## Evidence
- Commits:
- Migration logs:
- Stichproben (vor/nach):
