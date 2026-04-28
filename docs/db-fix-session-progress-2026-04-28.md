# DB-Fix Session Progress — 2026-04-28 (Mach D)

Fortsetzung von `db-audit-2026-04-28.md` + `db-fix-session-plan-2026-04-28.md`.
Status der Implementierung am Ende dieser Session.

---

## ✅ Geliefert

### Phase 0 — SQL Cleanup + Garbage Collection

**Migration:** `20260428220000_phase0_cleanup_and_garbage_collection.sql` ✅ applied

- Migration-Tracker für gestrige 5 Migrations nachgetragen
- `events.visibility` NOT NULL DEFAULT 'public' (alle 172,901 sind public)
- 18 zero-scan Indexes auf `events` gedroppt (~36 MB)
- 14 Subset-Duplikat-Indexes gedroppt (~25 MB) inkl. `idx_events_source` (19 MB)
- 3 venue_aliases Indexes/Constraint gedroppt (Tabelle leer)
- `idx_quality_flags_severity` gedroppt
- `work_mem` 3.4MB → 16MB (anon/auth) / 32MB (service_role)
- 14 SECURITY-DEFINER Functions REVOKEd von anon/authenticated
- 9 Functions: `search_path` festgesetzt
- group_pinboard_notes DELETE: 2 Policies → 1 OR-Policy
- groups UPDATE: über-permissive duplicate gedroppt
- event_series + venues: cosmetic-Duplikate konsolidiert
- ANALYZE auf 5 Tabellen

**Verifiziert:** DB-Größe 654 MB → **587 MB** (−67 MB / -10%). events
indexes: 35+ → **19** alle mit echter Nutzung. visibility, work_mem,
function privileges alle bestätigt.

### Phase 1a — Bulk-RPC Foundation (SQL)

**Migrations:**
- `20260428230000_bulk_update_event_rpcs.sql` ✅ applied
- `20260428230100_bulk_update_event_rpcs_v2_correct_types.sql` ✅ applied (Types-Fix)
- `20260428230200_bulk_update_event_geocoding_add_postal_code.sql` ✅ applied
- `20260428230300_bulk_update_event_enrichment_add_at_pricetext.sql` ✅ applied

4 neue RPCs:
- `bulk_update_event_geocoding(p_updates jsonb)` — Sparse-Pattern (location_name, lat, lng, conf, source, postal_code optional)
- `bulk_update_event_enrichment(p_updates jsonb)` — Sparse-Pattern für 18 Enrichment-Spalten
- `bulk_update_event_slugs(p_updates jsonb)` — Strict (id+slug)
- `bulk_update_event_publish(p_updates jsonb)` — Strict mit duplicate/archived guard

Alle SECURITY DEFINER, search_path=public, REVOKE FROM PUBLIC, GRANT
service_role only.

Smoke-Tests: alle 4 RPCs callable, empty-payload = 0 affected, real
single-row no-op = 1 affected.

### Phase 1b — Shared Helper

**Neue Datei:** `src/lib/db/bulk-update.ts`

```typescript
export class BulkUpdater {
  async add(row: BulkUpdateRow): Promise<void>;  // queue + auto-flush bei 500
  async flush(): Promise<number>;                 // letzten Rest rauspushen
  readonly stats: BulkUpdaterStats;               // metrics für end-of-run Report
}

export function makeBulkUpdater(supabase, rpc, overrides?): BulkUpdater;
```

Built-in 3-attempt retry mit exponential backoff bei 502/504/fetch-failed/
timeout/ECONN. Hard-fail (oder soft-fail per Option) sonst.

### Phase 2 — Pipeline-Scripts Refactored

**Alle 4 pipeline-attached Scripts auf BulkUpdater umgestellt:**

| Script | Vor | Nach |
|---|---|---|
| `src/scripts/normalize-locations.ts` | 121k Single-Row UPDATEs | 1 RPC pro 500 events |
| `src/scripts/fix-geocoding.ts` | 2 UPDATE-Branches in for-loop | beide queuen → 1 RPC pro 500 |
| `src/scripts/openai-geocode.ts` | 449k Single-Row UPDATEs | 1 RPC pro 500 (postal_code mit drin) |
| `src/scripts/enrich-openai.ts` | 313k Single-Row UPDATEs (with retry) | shared queue über alle Workers |
| `src/scripts/calculate-scores.ts` | (gestern bereits refactored) | bulk_update_event_scores RPC |

Jeder Script hat:
- `makeBulkUpdater(supabase, '<rpc>')` am Start
- `await updater.add(payload)` statt `.from('events').update(...).eq('id', id)`
- `await updater.flush()` am Ende
- End-of-run `updater.stats` Logging (calls, affected, retries, errors)

`enrich-openai.ts` zusätzlich: `processOne()` und `worker()` bekamen den
shared `updater` als Parameter durchgereicht. SchemaMismatchError-
Detection beim flush-Throw beibehalten — frühzeitiger Bail bei DB-
Schema-Drift.

**Typecheck:** alle 5 Scripts grün (außer pre-existing path-alias issue
in fetch-page.ts der nichts mit dem Refactor zu tun hat).

### Phase 4a — One-Off-Script

`src/scripts/backfill-slugs.ts` — Promise.all-Pool-Anti-Pattern
(25× concurrent UPDATEs pro Chunk = 500 RPCs pro Batch) ersetzt durch
einen RPC-Call pro 500 events.

### Phase 5b — Realtime DM Filter

`src/app/messages/MessagesPageClient.tsx:161` — fehlender server-side
Filter ergänzt. Vorher: jeder eingeloggte Browser bekam ALLE
direct_messages-Inserts der ganzen DB als WAL-Stream (RLS blockierte
nur das Lesen, nicht das WAL-Decoding). Jetzt: zwei Subscriptions auf
gleichem Channel mit `filter: 'sender_id=eq.${userId}'` und
`receiver_id=eq.${userId}` (Postgres Realtime hat kein OR-Filter).

---

## 📋 Deferred (next session)

### Phase 4b — `backfill-quality.ts` Refactor

**Komplexität:** 5 Round-Trips pro Event (DELETE flags + INSERT flags +
UPSERT scores + SELECT publish_status + UPDATE event). Brauchst zusätzlich:

- `bulk_replace_event_quality_flags(p_input jsonb)` — DELETE + INSERT atomic
- `bulk_upsert_event_quality_scores(p_updates jsonb)` — UPSERT mit ON CONFLICT
- Bestehende `bulk_update_event_publish` (hat duplicate/archived guard)

**Warum Defer:** Script ist **nicht in der Pipeline**, sondern One-Off.
Ein voller Pipeline-Lauf produziert dadurch keinen Müll. Lower priority.

### Phase 5a — `NotificationsProvider` in Root-Layout

**Aktuell:** 3 Channels pro User auf `notifications` (NotificationToast,
NotificationBell, NotificationsPageClient). Alle korrekt gefiltert,
aber 3× WAL-Lookup pro Event.

**Fix:** EINEN shared channel `notifications:${userId}` in Root-Layout-
Provider, multiplexed via React Context an die 3 Komponenten.

**Geschätzt 1.5-2h Code-Refactor.**

### Pipeline-Integration-Test

```bash
# Reset stats für sauberen Vorher/Nachher-Vergleich:
psql "$DATABASE_URL" -c "SELECT pg_stat_statements_reset();"
# Pipeline-Lauf (skipping scrape selbst):
npm run scrape:pipeline -- --skip-scrapers --skip-venues --skip-indexing
# Dann pg_stat_statements ziehen — Single-Row-UPDATE Patterns sollten
# unter den Zielwerten aus dem Plan liegen.
```

---

## Erwartete Wirkung

Beim nächsten `npm run scrape:pipeline`:

| UPDATE-Pattern | Vor | Nach |
|---|---|---|
| `UPDATE events SET event_score …` | 73k pro vollem Rescore | ~50 RPC calls |
| `UPDATE events SET geocoding_*, lat, lng …` | je nach Delta 5-15k | ≤30 RPC calls |
| `UPDATE events SET category, audience, vibe, …` | je nach Delta 5-30k | ≤60 RPC calls |
| `UPDATE events SET latitude, longitude …` | je nach Delta 5-15k | (subsumed in geocoding) |
| `UPDATE events SET location_name, lat, lng …` | 121k im normalize-Lauf | ≤250 RPC calls |

**Insgesamt:** typischer Pipeline-Lauf produziert statt ~30k+ Single-
Row-UPDATEs jetzt **~150-300 Bulk-RPC-Calls**. Pipeline-Müll-Akkumulation
ist gestoppt.

---

## Files Changed This Session

### New
- `supabase/migrations/20260428220000_phase0_cleanup_and_garbage_collection.sql`
- `supabase/migrations/20260428230000_bulk_update_event_rpcs.sql`
- `src/lib/db/bulk-update.ts`
- `docs/db-audit-2026-04-28.md`
- `docs/db-fix-session-plan-2026-04-28.md`
- `docs/db-fix-session-progress-2026-04-28.md` (this file)

### Modified
- `src/scripts/normalize-locations.ts`
- `src/scripts/fix-geocoding.ts`
- `src/scripts/openai-geocode.ts`
- `src/scripts/enrich-openai.ts`
- `src/scripts/backfill-slugs.ts`
- `src/app/messages/MessagesPageClient.tsx`

### Live DB Changes (not in git)
- 4 follow-up migrations applied via MCP `apply_migration` to fix
  RPC types (geocoding_confidence is text not numeric, tags/audience/
  vibe/etc are text[] not jsonb, plus added postal_code + enrichment_at +
  price_text):
  - `20260428190557_phase0_cleanup_and_garbage_collection`
    (auto-numbered by MCP)
  - `bulk_update_event_rpcs`
  - `bulk_update_event_rpcs_v2_correct_types`
  - `bulk_update_event_geocoding_add_postal_code`
  - `bulk_update_event_enrichment_add_at_pricetext`

---

Last updated: 2026-04-28 ~22:30 lokal.
