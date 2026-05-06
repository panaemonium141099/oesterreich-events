# fn-14-datenqualitats-rework-claude-enrichment.1 Pipeline-Aufspaltung + Scoring-Fix (ticket_url HOST-basiert)

## Description

Pipeline läuft default ohne Enrichment-Stufe; OpenAI bleibt als Fallback. Scoring entfernt den universellen ticket_url-Bonus und ersetzt ihn durch **host-basierten** Bonus auf `ticket_url` (NICHT source_name) für Trusted Ticket-Hosts.

**WICHTIG (aus Codex-Review):** Es existieren ZWEI Scoring-Pfade — beide müssen aktualisiert werden:
1. `src/lib/quality/score-event.ts` (`scoreEvent`) — ingest-time, aufgerufen von `supabase-sync.ts:39`
2. `src/lib/utils/scoring.ts` (`calculateScore`) — backfill, aufgerufen von `calculate-scores.ts`

**Size:** M (3-4 files, 7-8 acceptance criteria)

**Files:**
- `src/scripts/scrape-pipeline.ts` (Enrichment default-skipped, --with-enrichment opt-in)
- `src/lib/pipeline/scrape-pipeline-types.ts` (`PipelineOptions` erweitern um `withEnrichment?: boolean`)
- `package.json` (neue Scripts: `enrich:claude`, `enrich:openai` als Fallback)
- `src/lib/quality/score-event.ts` (TRUSTED_TICKET_HOSTS + getTrustedTicketBonus + replace ticket_url unconditional bonus)
- `src/lib/utils/scoring.ts` (gleicher fix, dieselbe Konstante)
- `CLAUDE.md` (Build & Test Sektion)
- KEINE Änderung an `supabase-sync.ts` und KEIN `source_name` Feld zu ScoreableEvent (ticket_url ist bereits da, reicht)

## Approach

### Pipeline-Aufspaltung (Verhaltens-basiert, nicht Step-Count)
- In `scrape-pipeline.ts`: ergänze `--with-enrichment` Flag. Default-Verhalten: **Enrichment-Stufe wird nicht ausgeführt** (kein "Enrich new events with OpenAI" Block im Output).
- `--with-enrichment` opt-in für legacy/manual triggering von OpenAI-Pfad
- `package.json`: `"enrich:claude"` und `"enrich:openai"` als separate Scripts

### Scoring-Fix in BEIDEN Files (HOST-basiert auf ticket_url)
**Codex-Finding korrigiert:** Bonus basiert auf ticket_url-host (nicht source_name) — sonst würden trusted-source events ohne ticket_url unverdient +10 bekommen.

**Schritt 1**: Konstante in BEIDEN Files identisch:
```typescript
const TRUSTED_TICKET_HOSTS = new Set([
  'oeticket.com', 'oeticket.at',
  'eventim.de', 'eventim.at',
  'ticketmaster.at', 'ticketmaster.com',
  'wien-ticket.at', 'ntry.at', 'feverup.com',
]);
function getTrustedTicketBonus(ticketUrl: string | null | undefined): number {
  if (!ticketUrl) return 0;
  try {
    const host = new URL(ticketUrl).hostname.toLowerCase().replace(/^www\./, '');
    return TRUSTED_TICKET_HOSTS.has(host) ? 5 : 1;
  } catch { return 0; }
}
```

**Schritt 2 — `score-event.ts` `computeLinkScore` ersetzen** (max bleibt 10):
- ALT: `if (e.ticket_url) s += 3` (unconditional)
- NEU: `s += getTrustedTicketBonus(e.ticket_url)` (0/1/5)
- "any link" +4 bonus bleibt; Math.min(10, s) am Ende

**Schritt 3 — `utils/scoring.ts` `calculateScore`**:
- ALT: `+15 unconditional ticket_url`
- NEU: `score += getTrustedTicketBonus(event.ticket_url) * 2` (0/2/10)

**Schritt 4**: ScoreableEvent / ScoringEventRow haben `ticket_url` BEREITS als Feld (verifiziert: `score-event.ts:45`). KEIN `source_name` Feld nötig (Regel ist host-basiert).

**Schritt 5**: Supabase Select-Listen für ScoringEventRow nicht ändern (ticket_url ist schon drin).

### Score-Recalculation
`npm run score` läuft idempotent, schreibt event_score zurück basierend auf neuem `calculateScore`. Beachte: ingest-time `scoreEvent` läuft beim nächsten UPSERT pro event automatisch.

## Key context

- HOST-basierte Lookup wie URL-Parsing-Pattern: `new URL(ticket_url).hostname.toLowerCase().replace(/^www\./, '')`
- `getTrustedTicketBonus()` returns 0 (no ticket_url), 1 (untrusted host), oder 5 (trusted host)
- Existing `STUDENT_ORG_SOURCES` (source-basiert) und `LOCAL_VENUE_TYPES` (type-basiert) bleiben unverändert
- Defensiver try/catch um `new URL()` weil ticket_url malformed sein kann

## Acceptance

- [ ] `npm run scrape:pipeline` (default) führt Enrichment-Stufe NICHT aus (Pipeline-Output zeigt keinen "Enrich new events" Block)
- [ ] `npm run scrape:pipeline -- --with-enrichment` führt es opt-in aus
- [ ] **`PipelineOptions` Type-Definition erweitert** um `withEnrichment?: boolean` (in `src/lib/pipeline/scrape-pipeline-types.ts`); TypeScript-Build grün
- [ ] `npm run enrich:openai` Command verfügbar (delegiert an enrich-openai.ts)
- [ ] `npm run enrich:claude` Command verfügbar (Stub für fn-14.3, ODER existing enrich-claude-cli.ts linked)
- [ ] **Beide Scoring-Pfade aktualisiert**: `score-event.ts` UND `utils/scoring.ts` haben identische `TRUSTED_TICKET_HOSTS` Konstante + `getTrustedTicketBonus()` Helper
- [ ] `score-event.ts computeLinkScore`: ALT `+3 ticket_url unconditional` -> NEU `getTrustedTicketBonus(ticket_url)` (0/1/5), Math.min(10, s) max
- [ ] `utils/scoring.ts calculateScore`: ALT `+15 ticket_url unconditional` -> NEU `getTrustedTicketBonus * 2` (0/2/10)
- [ ] **Bonus basiert auf ticket_url-HOST** (nicht source_name) — verifiziert mit Test: trusted source ohne ticket_url -> +0 Bonus
- [ ] TypeScript-Build grün (KEIN source_name field nötig — ticket_url ist schon in ScoreableEvent)
- [ ] `npm run score` läuft erfolgreich, schreibt event_score zurück
- [ ] WeeklyHighlights/RegionExplorer-Output manuell verifiziert (Stichprobe 10 Top-Events qualitativ sinnvoll)
- [ ] CLAUDE.md "Build & Test" Sektion aktualisiert

## Done summary
Decoupled scrape:pipeline from enrichment (opt-in --with-enrichment) and replaced the unconditional ticket_url score bonus with a host-based bonus (TRUSTED_TICKET_HOSTS) in both ingest (score-event.ts) and backfill (utils/scoring.ts) scoring paths; added enrich:claude/enrich:openai npm scripts and 15 new tests covering the host-based logic.
## Evidence
- Commits: e2c6f8ddf5bd0e454ac1b8e9501864b17ee037cd
- Tests: npx vitest run src/__tests__/calculate-scores.test.ts src/__tests__/quality/, npx tsc --noEmit (no new errors vs baseline)
- PRs: