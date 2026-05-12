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
<!-- Updated by plan-sync: fn-14.3 enrich-claude.ts uses allowlist `publish_status IN ('published','published_low_confidence','needs_review')` (SELECTION_PUBLISH_STATUSES), not denylist `NOT IN (...)`. Reset must match selection contract or rows will be reset but never re-enriched. -->
```sql
UPDATE events
SET enrichment_version = NULL
WHERE (enrichment_version IS NULL OR enrichment_version != 'claude-v1')
  AND publish_status IN ('published','published_low_confidence','needs_review');
```

Alternativ nur die OpenAI-vergifteten:
```sql
UPDATE events
SET enrichment_version = NULL
WHERE enrichment_version = 'enrich-v2-prompt1'
  AND publish_status IN ('published','published_low_confidence','needs_review');
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
<!-- Updated by plan-sync: filter aligned with fn-14.3 SELECTION_PUBLISH_STATUSES allowlist so QA samples match what enrich-claude.ts actually processes. -->
```sql
SELECT id, title, description, category, price_text, enrichment_version, category_locked
FROM events
WHERE publish_status IN ('published','published_low_confidence','needs_review')
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

## Pause-Status (2026-05-11)

**Status**: pausiert, NICHT abgebrochen. Re-Run nimmt automatisch weiter — `enrich-claude.ts` filtert
auf `enrichment_version != 'claude-v1'`, der DB-State ist die einzige Resume-Cursor-Quelle.

**Stand:**
- ✅ **8.695 future Events bereits enriched** (`enrichment_version='claude-v1'`)
  - davon 748 via Haiku (2026-04-27/28), Rest via Sonnet (frühere Runs)
  - 29 poison-pilled (`enrichment_failed=TRUE`)
- ⏳ **54.896 future Events pending** (von ~63k future events total)
- ⏳ Score-Recalc, Sitemap-Regen, Stichprobe-QA: noch offen, machen wir nach Abschluss

**Blocker:**
1. **Anthropic Max-Subscription Wochen-Cap 91%/100%** (Stand 2026-05-11). "Nur Sonnet" ist bei
   100%, was anscheinend alle Modelle blockt (auch Haiku) trotz 9% Headroom im Combined-Pool.
   CLI exited 1 mit "Credit balance is too low".
2. **Anthropic API direkt**: $0 Credit-Balance auf console.anthropic.com (separates Billing!).
   API-Zugang wurde deshalb deaktiviert (Email 2026-05-11).
3. **"Zusatznutzung" Toggle aktiviert** in claude.ai → Settings → Billing, aber das aktiviert
   nur "Automatisches Aufladen", nicht den Overflow-Mechanismus. Die €185 in "Aktuelles Guthaben"
   sind für Subscription-Overflow gedacht aber scheinen ohne weiteren Schritt nicht zu greifen.

**Resume-Pfade nach Blocker-Ende:**
- **A (kostenlos)**: Donnerstag 2026-05-14 10:59 → Wochen-Cap resettet → CLI-Pfad läuft wieder.
  Command: `npm run enrich:claude -- --future-only --concurrency 2 --model haiku --cli`
- **B (paid)**: $20-50 API-Credits auf console.anthropic.com kaufen → API-Pfad fertig & getestet,
  Command: `npm run enrich:claude -- --future-only --concurrency 8 --batch-size 50 --model haiku`
  (--api ist Default wenn ANTHROPIC_API_KEY gesetzt). Cost-Cap default $150 als Sicherheit.
  Ohne Page-Fetch (`--no-fetch`) ~$80 für komplett alle 80k.

**Bombsafe-Status des Scripts (alles validiert):**
- ✅ DB-Migration `'48-stunden'` zu duration_type-Constraint added (20260511000000)
- ✅ Constraint-Violations werden als SchemaMismatchError klassifiziert → clean bail mit Migration-Hinweis
- ✅ Stdout bei exit≠0 mitgeloggt (deshalb sehen wir jetzt "Credit balance is too low" statt leerem stderr)
- ✅ API-Pfad mit Tool-Use Mode implementiert: strikte Enum-Schema-Validierung, ungültige
  Enum-Werte wie `48-stunden` können physisch nicht von der API zurückkommen.
- ✅ Per-call Cost-Cap halt + prompt caching (Anthropic ephemeral, 5min TTL)
- ✅ Typed error handling (AuthenticationError, RateLimitError, retry-after Header etc.)

**Bekannte Quality-Issues für Cleanup (in Stichprobe der 748 Haiku-Events):**
1. **Tag-Leaks aus alten Scraper-Kategorien**: Töpfermarkt bekam tag `wochenmarkt` (falsch),
   Rechtsberatung bekam tag `Gesundheit` (komplett falsch). Prompt-Tweak nötig: "ignoriere
   bestehende source_tags_raw als Klassifikations-Hint, nur als Kontext".
2. **Bool-Inkonsistenz**: `audience: ['familien-mit-kindern']` aber `is_family_friendly=false`.
   Prompt-Tweak: "is_*_friendly muss konsistent zu audience sein".
3. **Scraper-Boilerplate im description**: claude strippt nicht "Programm\nAlles Neu Musik
   Tanz Theater..." oder "Wichtige Information zur Ticketkategorie...". Prompt-Tweak: "strippe
   typische Scraper-Header-Phrasen vor der Erzählung".

Diese sind NICHT blocking für fn-14.4 done, aber als Polish-Sub-Tasks nach Abschluss in fn-14
zu erledigen — oder direkt im Prompt vor dem Resume-Run einarbeiten (eine Code-Änderung in
`buildSystemPrompt()` bevor wir Donnerstag weiterlaufen lassen).

**Resume-Reminder**: re-anchor (re-read spec + status) + Stichprobe-Check der zwischenzeitlich
neuen Haiku-Events sobald Migration weiterläuft.

## Done summary
TBD

## Evidence
- Commits:
- Migration logs:
- Stichproben (vor/nach):
