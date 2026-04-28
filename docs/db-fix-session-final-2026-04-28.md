# DB-Fix Session FINAL — 2026-04-28 (Mach D komplett)

Drei Sessions an einem Tag — Mach C (gestern: RLS, FK-Indexes, statement_timeouts,
score-RPC), Mach D Phase 1 (Audit + Pipeline-Refactor: a23b446), Mach D Phase 2
(quality-RPCs + NotificationsProvider: ad3cf48).

Dieses Dokument ist der finale Status — was läuft, was bewiesen ist, was du
noch tun musst.

---

## ✅ Bewiesene Wirkung (live verifiziert via pg_stat_statements)

Nach `pg_stat_statements_reset()` + `npm run score` gegen 106,570 Events:

```
TOP-QUERY (52.7% der DB-Zeit):
  calls=107  mean=1259ms  total=134.7s
  → bulk_update_event_scores RPC (1000 events pro Batch)

#2 (34.2%):  realtime.list_changes WAL — kein Idle-Spam mehr (580 statt 1.7M Calls)
#3 (12.6%): artist-matching SELECT (events Pre-Fetch, 107 calls)

ZERO single-row "UPDATE events SET event_score …" Statements gefunden.
```

**Vorher (pre-Refactor):**
- Score-Lauf produzierte ~73k Single-Row UPDATEs an `events`
- 7.5% der gesamten DB-Zeit ging dafür drauf
- Connection-Pool-Erschöpfung garantiert

**Nachher:**
- 107 RPC-Calls für 106k Events
- **Reduktion: 99.9%**
- Pipeline-Müll ist gestoppt für `npm run score`

---

## ✅ Was ist live applied + im Code

### DB-State (alle Migrationen via MCP applied)

| Migration | Inhalt | Status |
|---|---|---|
| `20260428190000` | RLS auth.uid() InitPlan (95 Policies) | ✅ live |
| `20260428190100` | 32 FK-Indexes + Index-Cleanup | ✅ live |
| `20260428190200` | bulk_update_event_scores RPC | ✅ live + USED |
| `20260428193000` | statement_timeout per role (8s/8s/60s) | ✅ live |
| `20260428193100` | student_event_counts_by_bundesland RPC | ✅ live |
| `20260428220000` | **Phase 0 Cleanup + GC** (Mach D) | ✅ live |
| `20260428230000` | 4 Bulk-RPCs (geocoding/enrichment/slugs/publish) | ✅ live |
| `20260428240000` | quality_flags + scores RPCs | ✅ live |

### DB-Größe Verlauf

```
Pre Mach C:   ~700 MB
Post Mach C:   654 MB
Post Mach D:   587 MB    ← -113 MB seit gestern morgen
events:  538 MB → 479 MB (35+ Indexes → 19, alle in Use)
```

### Code (committed: a23b446 + ad3cf48)

**Pipeline-Scripts (alle 4 → BulkUpdater):**
- `src/scripts/normalize-locations.ts`
- `src/scripts/fix-geocoding.ts`
- `src/scripts/openai-geocode.ts` (postal_code im RPC mit drin)
- `src/scripts/enrich-openai.ts` (shared queue über alle Workers)
- `src/scripts/calculate-scores.ts` (war schon refactored — verifiziert genutzt)

**One-Off-Scripts (BulkUpdater):**
- `src/scripts/backfill-slugs.ts`
- `src/scripts/backfill-quality.ts` (3 RPCs statt 5 Round-Trips/Event)

**Realtime-Konsolidierung:**
- `src/components/Notifications/NotificationsProvider.tsx` (NEU, in layout gemountet)
- `NotificationBell` / `NotificationToast` / `NotificationsPageClient` lesen aus Context
  → 3 Channels pro User → 1 shared Channel
- `MessagesPageClient.tsx` Realtime-Filter auf sender_id/receiver_id ergänzt

**Shared Helper:**
- `src/lib/db/bulk-update.ts` (Queue + auto-flush + 3-attempt retry)

---

## ⚠️ Lerne fürs nächste Mal

**work_mem über `ALTER ROLE` ist defekt in Supabase Pool-Setup.**

Ich hatte gestern `ALTER ROLE … SET work_mem = '16MB'` gesetzt. PostgREST/
Supavisor Pool lowercased den Wert auf `'16mb'` und Postgres rejected
lowercase Units (case-sensitive: nur B, kB, MB, GB, TB sind valid).
Resultat: ALLE PostgREST-Calls failten mit
`"invalid value for parameter work_mem: '16mb'"`.

Fix war 3-stufig:
1. `ALTER ROLE … RESET work_mem` (rolconfig leeren)
2. `NOTIFY pgrst, 'reload config'` (PostgREST-Cache flushen)
3. Dann erst funktionierten Connections wieder

Migration-File `20260428220000_phase0_cleanup_and_garbage_collection.sql`
ist jetzt gefixt (RESET statt SET). Falls du das in Zukunft nochmal probierst,
nutz raw kB-Integer ohne Unit:
```sql
ALTER ROLE service_role SET work_mem TO '32768';  -- 32 MB in kB
NOTIFY pgrst, 'reload config';
```

Aber: temp_files kamen aus den Backfill-Scripts. Mit Bulk-RPCs ist
das Problem stark reduziert — 3500 kB Default reicht.

---

## 🟡 Was DU jetzt noch tun musst

### Pflicht (1 Schritt, ~5-15 min)

**Vollen Pipeline-Lauf starten** — damit die anderen 3 refactored Scripts
(normalize-locations, openai-geocode, enrich-openai) auch live verifiziert
sind. Cron läuft eh täglich, oder manuell:

```bash
npm run scrape:pipeline -- --trigger manual
# Oder: nur die nicht-API-kostenden Steps:
npm run scrape:pipeline -- --skip-scrapers --skip-venues --skip-enrichment --skip-embeddings --skip-indexing
```

Beim nächsten echten Pipeline-Lauf (Cron oder manuell) sind alle 4 Scripts
auf Bulk-RPC. Nichts mehr zu tun außer ggf. `pg_stat_statements_reset()`
vorher für sauberen Vorher/Nachher.

### Optional (kosmetisch)

Nichts. Tech-Debt-Liste in `docs/TECH-DEBT.md` ist um den Realtime-WAL-
Eintrag erleichterbar (ist gefixt durch NotificationsProvider).

---

## 📋 Backlog (kein Pipeline-Impact, eigene Sessions)

- **`raw_events`, `normalized_event_candidates` + `lib/pipeline/*` Code-Cleanup** —
  Phase-2 Scaffolding, runPipeline() wird nirgends aufgerufen. Drop wenn
  klar entschieden ist dass das nie kommt.
- **Past-Duplicate Cleanup** — 16,857 events mit `publish_status='duplicate'`
  und `start_date < now()` belegen ~16 MB. FK-Check nötig vor DELETE.
- **Storage-Bucket-Härtung** — `group-images` + `memories` erlauben listing
- **HaveIBeenPwned-Auth** — Supabase Setting aktivieren
- **`venues` seq_scan-Audit** — 32% pct_seq, 17.9M tup_read im scrape-Lauf

---

## Final-Commits diese Session

```
6be1a7a  perf(db): holistic build robustness — statement_timeout + N+1 elimination
12df4c7  perf(db): RLS auth.uid() InitPlan + FK indexes + bulk-update RPC
a23b446  perf(db): pipeline-aware bulk-update RPCs + GC cleanup (Mach D)
ad3cf48  perf(db): backfill-quality bulk RPCs + NotificationsProvider (Mach D pt2)
HEAD     perf(db): work_mem fix + final session doc (Mach D done)
```

---

Last updated: 2026-04-28 ~21:45 lokal. Verifiziert.
