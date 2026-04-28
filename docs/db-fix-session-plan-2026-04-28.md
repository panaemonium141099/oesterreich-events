# Session-Plan: Pipeline-aware DB-Cleanup (2026-04-28, Mach D Implementation)

## Ziel

Die in `docs/db-audit-2026-04-28.md` identifizierten Probleme **nachhaltig**
fixen, so dass `npm run scrape:pipeline` die DB **nie wieder mit ~30k+
Single-Row UPDATEs vollmüllt**. Pipeline-Code wird Teil des Fixes — keine
isolierten Einmal-Patches.

## Definition of Done

Nach Abschluss aller Phasen muss gelten:

1. **Pipeline-Run produziert ≤ 50 UPDATE-Statements** (statt ~30k+) gegen
   `events` pro Lauf — verifizierbar via `pg_stat_statements_reset()` →
   pipeline → Top-Queries.
2. Alle 4 pipeline-wired Backfill-Scripts nutzen Bulk-RPCs.
3. Beide One-Off-Backfill-Scripts nutzen Bulk-RPCs (damit manuelles
   Triggern keine Regression mehr ist).
4. SQL-Cleanup-Migration ist applied und im migrations-tracker.
5. Realtime-WAL-Verbrauch ist um >50% gesunken (Provider-Konsolidierung).
6. Build grün, Tests grün, ein voller Pipeline-Lauf clean durch.

## Out of Scope (für später, in Backlog gelistet)

- venue-matching seq_scan-Audit (Befund 8 im Audit)
- Storage-Bucket-Policy-Härtung
- HaveIBeenPwned-Auth-Setting
- Embedding-/Tag-Index-Cleanup (warten bis Features wirklich tot sind)

---

## Phase 0 — SQL-Cleanup (~30 min, alles in einer Migration)

**Risiko:** sehr gering (idempotent, kein Code-Change). Free-Tier-DDL-Lessons
aus gestern beachtet: kleine Migration, kein massiver Index-Rebuild, kein
non-CONCURRENT auf großen Tabellen.

**File:** `supabase/migrations/20260428220000_pipeline_cleanup_part1.sql`

**Inhalt:**

1. **Migration-Tracker syncen** (gestern fehlten 5 Einträge)
2. **`visibility`** auf NOT NULL DEFAULT 'public' setzen + Index droppen
3. **Duplikat-Indexes droppen** (echte Subset-Duplikate, kein Risiko):
   - `idx_events_source` (19 MB), `idx_events_derived_fingerprint`,
     `idx_dedup_log_event_a`, `idx_quality_scores_event`,
     `idx_saved_events_user`, `idx_followed_cities_user`,
     `idx_followed_venues_user`, `idx_group_members_group`,
     `push_subscriptions_user_id_idx`,
     `idx_notifications_reminder_1d_dedup`, `_7d_dedup`,
     `idx_activity_likes_user`, `idx_activity_comments_activity`,
     `idx_event_reminders_user`, `idx_direct_messages_receiver`
4. **`work_mem` Bump** für anon/auth/service_role (3.4 MB → 16/32 MB)
5. **REVOKE EXECUTE** auf gefährliche RPCs (`user_group_ids`,
   `is_group_member`, `is_group_creator`, `handle_new_*`,
   `bulk_update_event_*` für anon/authenticated)
6. **`search_path`** für 9 Funktionen setzen
7. **Doppelte permissive Policies** konsolidieren (`group_pinboard_notes`
   DELETE, `groups` UPDATE)

**Verifizierung:** Nach Apply die 30 SQL-Audit-Queries aus dem Bericht
nochmal — alle "FIXED"-Befunde müssen weg sein.

---

## Phase 1 — Bulk-RPC Foundation (~45 min)

### 1a. SQL-Migration mit 4 neuen Bulk-RPCs

**File:** `supabase/migrations/20260428230000_bulk_update_events_rpcs.sql`

Funktionen (alle SECURITY DEFINER, search_path=public, GRANT nur
service_role):

- `bulk_update_event_geocoding(p_updates jsonb)` — id, lat, lng,
  geocoding_confidence, geocoding_source
- `bulk_update_event_enrichment(p_updates jsonb)` — id + jsonb-payload für
  alle Enrichment-Spalten (category, audience, vibe, occasion_tags,
  setting, price_tier, price_flags, duration_type, language, description,
  enrichment_version, etc.) mit COALESCE-Pattern
- `bulk_update_event_slugs(p_updates jsonb)` — id, slug
- `bulk_update_event_publish(p_updates jsonb)` — id, publish_status,
  quality_score

Pattern: alle nutzen `WITH src AS (SELECT … FROM jsonb_array_elements(...))
UPDATE events e SET … FROM src WHERE e.id = src.id`. Eine `UPDATE`-Statement,
ein parse von JSON, ein Round-Trip.

### 1b. Shared Helper: `src/lib/db/bulk-update.ts`

Wiederverwendbare Queue+Flush-Klasse so dass alle Scripts das gleiche
Pattern haben:

```typescript
// src/lib/db/bulk-update.ts (NEU)
export class BulkUpdater<T extends { id: string }> {
  private queue: T[] = [];
  constructor(
    private rpc: 'bulk_update_event_geocoding' | 'bulk_update_event_enrichment'
              | 'bulk_update_event_slugs' | 'bulk_update_event_publish',
    private flushSize = 500,
    private supabase = createServiceClient(),
  ) {}

  async queueRow(row: T): Promise<void> {
    this.queue.push(row);
    if (this.queue.length >= this.flushSize) await this.flush();
  }

  async flush(): Promise<number> {
    if (!this.queue.length) return 0;
    const batch = this.queue.splice(0, this.queue.length);
    // 3-attempt retry mit backoff (gleicher Pattern wie enrich-openai)
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await this.supabase.rpc(this.rpc, { p_updates: batch });
      if (!error) return data ?? batch.length;
      if (attempt === 3) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(3, attempt - 1)));
    }
    return 0;
  }
}
```

Acceptance: Helper hat einen Vitest-Test der den queue→flush-Pfad
verifiziert (mit gemocktem supabase-Client).

---

## Phase 2 — Pipeline-Scripts Refactor (~3-4 h, in Reihenfolge)

**Strategie:** Einer nach dem anderen, jeweils mit Trockenlauf-Verify
bevor zum nächsten. Reihenfolge nach steigender Komplexität.

### 2a. `src/scripts/normalize-locations.ts` (146 LOC, ~30 min)

**Aktuell:** Zeile 112-126 macht für jeden Event ein eigenes UPDATE in
einem `for`-Loop.

**Refactor:**
- Ersetze inneren Loop durch `BulkUpdater` mit `bulk_update_event_geocoding`
- Achtung: Script updated auch `location_name` (kein FK aber ein freier
  Text). Unsere RPC behandelt nur lat/lng/conf/source — also entweder
  RPC erweitern oder location_name in separater bulk-update behandeln
- **Entscheidung:** RPC erweitern um optional `location_name` (NULL =
  unverändert). Pattern wie enrichment mit COALESCE.

**Acceptance:**
- `npx tsx src/scripts/normalize-locations.ts --dry-run` läuft
- `npx tsx src/scripts/normalize-locations.ts` (auf einem kleinen Datensatz)
  produziert ≤ 5 RPC-Calls statt N UPDATEs (verify pg_stat_statements)
- Bestehende Tests (falls vorhanden) grün

### 2b. `src/scripts/fix-geocoding.ts` (586 LOC, ~45 min)

**Aktuell:** Zwei UPDATE-Branches (Zeile 461-469: gefundene Koords setzen,
Zeile 493-501: Koords nullen wenn falsch). Beide im Loop.

**Refactor:**
- Zwei Queues: `BulkUpdater` für "set" und `BulkUpdater` für "clear"
  (clear = lat=null, lng=null, source='cleared')
- Beide nutzen gleiche `bulk_update_event_geocoding` RPC
- Cleaning-Branch übergibt explizit NULL — RPC muss `NULL` von
  "unchanged" unterscheiden. **Lösung:** in jsonb explizit
  `{lat: null, lng: null}` → in RPC mit `(payload ? 'latitude')` checken
  ob Key existiert, dann setzen.

**Acceptance:**
- Dry-run-Output zeigt korrekte Anzahl erwarteter Cleared/Set-Operationen
- Auf Test-Sample: 1 RPC pro Branch statt N UPDATEs
- Bestehende --dry-run und backup/rollback-Logik funktioniert weiter

### 2c. `src/scripts/openai-geocode.ts` (947 LOC, ~60 min)

**Aktuell:** Größter Volumen-Verursacher (449k Calls). Loop über Locations
(deduped), pro Event 1 UPDATE.

**Refactor:**
- Nach OpenAI-Result: pro Event in BulkUpdater queuen statt direktes
  UPDATE
- WICHTIG: Cache-Logik (`geocode_cache`-Tabelle) bleibt unverändert
- Bestehende `--dry-run`, `--null` Flags weiter unterstützen
- Worker-Concurrency bleibt: jede Worker-Tasks queut, am Ende des Workers
  wird `flush()` getriggert

**Acceptance:**
- `--dry-run` zeigt keine RPC-Calls (nur Logs)
- Live-Lauf auf 100 Events: ≤ 1 RPC-Call (alles in einem Batch)
- Cache-Tabelle wird wie vorher beschrieben

### 2d. `src/scripts/enrich-openai.ts` (1069 LOC, ~60-90 min)

**Aktuell:** 313k Single-Row UPDATEs. Komplexester Refactor weil:
- Workers (6-40 concurrent) jeder updatet einzeln
- Retry-Logic schon eingebaut (commit 9cf9518)
- Payload ist groß (15+ Spalten)

**Refactor:**
- Eine **shared** BulkUpdater-Instanz pro Pipeline-Run, von allen
  Workers benutzt (Queue ist threadsafe weil Single-Threaded JS)
- Worker pusht statt direktem UPDATE
- Am Ende des Pipeline-Runs: einmal `flush()`
- Retry-Logik wandert in den `BulkUpdater` (existiert da schon)
- Ergebnis-Logging: `bulk_update_event_enrichment` returned `affected` —
  davon Erfolgs-Counter ableiten

**Acceptance:**
- Default-Run (gpt-5-mini, 6 worker, 100 Events) nutzt ≤ 1-2 RPCs
- Full-Run (40 worker, 30k Events) nutzt ~60 RPCs (30k / 500 batch)
- Retry-Verhalten bei künstlich gemockter Supabase-Blip funktioniert
- `enrichment_version` Filter-Logik unverändert (resume-safe)

### 2e. `src/scripts/calculate-scores.ts` Validation (~10 min)

**Aktuell:** Schon refactored auf `bulk_update_event_scores`, aber laut
pg_stat_statements `calls=1` (nur das CREATE selbst).

**Action:**
- `pg_stat_statements_reset()` auf der DB
- `npm run score` einmal laufen lassen
- Verify: `bulk_update_event_scores` calls > 0, alte Single-Row Pattern
  steigen nicht mehr

---

## Phase 3 — Pipeline-Integration-Test (~30 min, harte Acceptance)

Hier kommt der **Pipeline-aware** Acceptance-Test, ohne den die Session
nicht "done" ist.

```bash
# 1. Snapshot vor Test
psql "$DATABASE_URL" -c "SELECT pg_stat_statements_reset();"

# 2. Voller Pipeline-Lauf (ohne Scrape, der ist nicht im Scope —
#    nur die Backfill+Enrich+Score Schritte)
npm run scrape:pipeline -- --skip-scrapers --skip-venues --skip-indexing

# 3. pg_stat_statements snapshotten
psql "$DATABASE_URL" -f scripts/audit-snapshot.sql > /tmp/post-pipeline.txt
```

**Acceptance-Kriterien (in `/tmp/post-pipeline.txt` prüfen):**

| Pattern | Vorher (lifetime) | Nach Pipeline-Lauf (delta) | Zielwert |
|---|---|---|---|
| `UPDATE events SET event_score, score_updated_at WHERE id=$` | 2.27 M | < 50 | RPC-batched |
| `UPDATE events SET geocoding_*, lat, lng WHERE id=$` | 449 k | < 100 | RPC-batched |
| `UPDATE events SET category, … WHERE id=$` | 280 k | < 100 | RPC-batched |
| `UPDATE events SET latitude, longitude WHERE id=$` | 121 k | < 50 | RPC-batched |
| `bulk_update_event_*` calls | 1 | 4-8 | RPCs werden genutzt |

Falls eine Zeile **nicht** unter Zielwert: Phase 2-Script nochmal,
Bug fixen, Re-Test.

---

## Phase 4 — One-Off-Scripts (~1 h, wenn Pipeline-Test grün)

Damit auch manuelles Triggern keine Regression bringt.

### 4a. `src/scripts/backfill-slugs.ts` (~20 min)

**Aktuell:** Promise.all-Anti-Pattern, 10k UPDATEs pro Lauf.

**Refactor:** ersetze inneren `Promise.all(chunk.map(...))` durch
`BulkUpdater` mit `bulk_update_event_slugs`. Trivial — nur ein Spalte.

### 4b. `src/scripts/backfill-quality.ts` (~40 min, komplexer)

**Aktuell:** 5 Round-Trips pro Event:
1. DELETE quality_flags
2. INSERT quality_flags (optional)
3. UPSERT event_quality_scores
4. SELECT events.publish_status (für die "preserve duplicate"-Logic)
5. UPDATE events.publish_status, .quality_score

**Refactor:**
- Step 4 (SELECT) eliminieren: in Step 5 nutze
  `WHERE publish_status NOT IN ('duplicate', 'archived')` direkt
- Steps 1-3 in eine RPC `bulk_replace_quality(p_events jsonb)`:
  ```sql
  -- atomic per batch:
  DELETE FROM quality_flags WHERE event_id = ANY(ids);
  INSERT INTO quality_flags (...) SELECT ...;
  INSERT INTO event_quality_scores (...) SELECT ... ON CONFLICT (...) DO UPDATE;
  ```
- Step 5 → `bulk_update_event_publish` RPC (existiert nach Phase 1)

Acceptance: 200k-Event-Backfill in <10 min statt ~5 h.

---

## Phase 5 — Realtime-Konsolidierung (separat, ~3 h)

**Warum separat:** Nicht pipeline-relevant, aber 85.8% der DB-Zeit. Größerer
React-Refactor — sollte nicht das Pipeline-Fix blocken.

### 5a. `NotificationsProvider` in Root-Layout (~1.5 h)

**Files:**
- NEU: `src/components/Notifications/NotificationsProvider.tsx`
- EDIT: `src/app/layout.tsx` (Provider mounten zwischen Auth + children)
- EDIT: `src/components/Notifications/NotificationBell.tsx:41` (channel
  raus, Context rein)
- EDIT: `src/components/Notifications/NotificationToast.tsx:60` (idem)
- EDIT: `src/app/notifications/NotificationsPageClient.tsx:112` (idem)

Acceptance: `pg_replication_slots`+pg_stat_statements zeigen 1 channel
pro user statt 3.

### 5b. DM-Filter ergänzen (~5 min)

**File:** `src/app/messages/MessagesPageClient.tsx:161`

Hinzufügen: `filter: 'or(sender_id.eq.${userId},receiver_id.eq.${userId})'`.

### 5c. Optional: `MessagesProvider` analog zu Notifications (~1.5 h)

Niedrigere Prio, weil weniger frequent als Notifications. Wenn Zeit übrig.

---

## Phase 6 — Doku + Memory (~15 min)

- `docs/TECH-DEBT.md` — den Realtime-Eintrag streichen wenn 5a+5b durch sind
- `docs/db-audit-2026-04-28.md` — Status-Tabelle am Ende: was applied
- `docs/db-fix-session-plan-2026-04-28.md` (dieses File) — am Ende
  Acceptance-Tabelle mit Ist-Werten

---

## Reihenfolge & Abhängigkeiten

```
Phase 0 (SQL Cleanup)
   ↓
Phase 1 (RPC Foundation: SQL + Helper)
   ↓
Phase 2a (normalize-locations) — kleinste Veränderung als Smoke-Test
   ↓
Phase 2b (fix-geocoding)
   ↓
Phase 2c (openai-geocode)
   ↓
Phase 2d (enrich-openai) — der größte
   ↓
Phase 2e (calculate-scores Validation)
   ↓
Phase 3 (Pipeline-Integration-Test) ← HARTES GATE
   ↓ (nur wenn grün)
Phase 4 (One-Offs)
   ↓
Phase 5 (Realtime — kann parallel laufen, ist orthogonal)
   ↓
Phase 6 (Doku)
```

**Wenn Phase 3 fehlschlägt:** zurück in Phase 2 zum verursachenden Script.
**Nicht** unmittelbar zu Phase 4 weitergehen.

---

## Geschätzter Gesamt-Aufwand

| Phase | Dauer | Risiko |
|---|---|---|
| 0 — SQL Cleanup | 30 min | Niedrig |
| 1 — RPC Foundation | 45 min | Niedrig |
| 2a-2d — Pipeline Refactors | 3-3.5 h | Mittel (Code-Change) |
| 2e — Score Validation | 10 min | Niedrig |
| 3 — Pipeline-Test | 30 min | — (Acceptance Gate) |
| 4 — One-Offs | 1 h | Niedrig |
| 5 — Realtime (parallel-fähig) | 3 h | Mittel-Niedrig |
| 6 — Doku | 15 min | — |
| **Total** | **~9-10 h** | |

**Realistisch in einer Session erreichbar:**
- Phase 0 + 1 + 2 + 3: ~5-6 h ← der Pipeline-Fix
- Phase 4: optional in der gleichen Session (+1 h)
- Phase 5: eigene Session (3 h)

---

## Was NICHT in dieser Session

- Bulk-Inserts (Pipeline insertet bereits via Upsert in Batches, ist OK)
- Index-Strategie für `venues` seq_scans (separate Session, braucht
  Code-Trace)
- Storage-Bucket-Hardening
- HaveIBeenPwned

---

## Rollback-Plan

Pro Phase:
- **Phase 0:** Migration ist idempotent. Bei Problem: Indexes in 30 sek
  zurück erstellen (Definitions stehen im Bericht). `visibility`-NOT-NULL
  rückbauen: `ALTER TABLE events ALTER COLUMN visibility DROP NOT NULL;`
- **Phase 1:** RPCs droppen, Helper-Code löschen — kein Live-Code nutzt
  sie noch.
- **Phase 2:** Git-Revert pro Script. Pipeline läuft mit alten
  single-row-UPDATEs weiter — keine Daten-Korruption.
- **Phase 3:** Test-only, kein Rollback.
- **Phase 4:** wie 2.
- **Phase 5:** Git-Revert. Falls Provider live aber broken: Notification-
  components fallen auf eigenen Channel zurück (alter Code temporär
  zurück).

---

## Reproduzier-Befehle für die Session

```bash
# Pipeline trockenlaufen (ohne Scrape, ohne Indexing) für schnellen Test
npm run scrape:pipeline -- \
  --skip-scrapers --skip-venues --skip-indexing --skip-embeddings

# Single-Script-Tests
npx tsx --env-file=.env.local src/scripts/normalize-locations.ts --dry-run
npx tsx --env-file=.env.local src/scripts/fix-geocoding.ts --dry-run
npm run openai-geocode -- --dry-run

# pg_stat_statements snapshot
# (Supabase MCP ausreichend, sonst psql)

# Reset für sauberen Vorher/Nachher-Vergleich
# SELECT pg_stat_statements_reset();
```
