# fn-14-datenqualitats-rework-claude-enrichment.2 DB-Migration: image_dims, lifecycle, sources + source_runs (mandatory)

## Description

Datenbankmigration für alle neuen Spalten und Tabellen, die Phase 2-5 brauchen. **`sources` ist MANDATORY** (nicht optional — fn-14.6 enforce-Logik braucht es). **`source_runs` ist NEU** und ersetzt aggregierte Spalten in `sources` für Auto-Disable Sliding-Window-Rule (Codex-Review-Finding: bisherige Schema speicherte `events_scraped_7d`/`events_30d_median` nicht).

**Size:** M (1-2 SQL files, 6 acceptance criteria)

**Files:**
- `supabase/migrations/YYYYMMDD_image_dims_and_lifecycle.sql`
- `supabase/migrations/YYYYMMDD_sources_and_runs.sql`
- `supabase/migrations/YYYYMMDD_bulk_enrichment_extend_v2.sql` (RPC-Update für neue Felder)

## Approach

### Migration via Supabase MCP `apply_migration`
Tool `mcp__6e1eb75e-...__apply_migration` ist verfügbar — direkte Anwendung auf project_id `booljdtrktpotsenbnut`. SQL-Files werden parallel in `supabase/migrations/` archiviert für git-tracking.

### Migration A: events Spalten
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_width INT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_height INT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE events ADD COLUMN IF NOT EXISTS enrichment_failed BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS enrichment_failure_count INT DEFAULT 0;

-- Boolean-Flags aus fn-14.3 Interview (3 NEU)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_dog_friendly BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_wheelchair_accessible BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS events_stale_idx ON events(last_seen_at)
  WHERE publish_status NOT IN ('expired','duplicate','suppressed');

UPDATE events SET last_seen_at = updated_at WHERE last_seen_at IS NULL;
```

### Migration B: sources + source_runs + view (alle MANDATORY)

**sources Tabelle (10 Spalten):**
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

**source_runs Tabelle (NEU — audit-history für Sliding-Window):**
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

**Aggregate View (source_metrics):**
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

**NULL-Handling für Auto-Disable Rule** (explizit dokumentiert):
- `runs_30d < 14` -> Rule NICHT auswerten (nicht genug history)
- `events_30d_median = 0` -> Rule NICHT auswerten (Edge-Case-Schutz)
- Erst wenn `runs_30d >= 14 AND events_30d_median > 0` greift Sliding-Window

### RPC Update — bulk_update_event_enrichment
**Codex-Finding (Critical):** RPC hat fixe Field-Liste. Neue Felder werden silently ignoriert ohne Update.

Erweitere `bulk_update_event_enrichment(jsonb)` analog zu existing pattern in `20260501130000_bulk_update_enrichment_add_struct_fields.sql`:
- Neue Felder im `jsonb_to_recordset(...)` cast: `enrichment_failed BOOLEAN`, `enrichment_failure_count INT`, `price_min NUMERIC`, `is_dog_friendly BOOLEAN`, `is_wheelchair_accessible BOOLEAN`, `is_outdoor BOOLEAN`
- Im UPDATE-Block: hinzufügen an die SET-Klausel
- Idempotent: `CREATE OR REPLACE FUNCTION` mit aktualisierter Signatur

Alternativ-Verifikation: nach Migration ein Test-Call mit `{enrichment_failed: true, enrichment_failure_count: 1, price_min: 10}` -> Felder sollten in DB landen.

### Backfill für existing sources
Vor Auto-Disable activation: leere `source_runs` würde 0 events_30d_median geben -> alle sources würden disabled. Daher seed-script:
```sql
-- Bootstrap: für jede source mit events in events table, simuliere ein "großes" run vor 14 Tagen
INSERT INTO sources (source_name) 
SELECT DISTINCT source_name FROM events 
ON CONFLICT DO NOTHING;

-- Optional: simuliere historic run-data um warm-start zu ermöglichen
-- (oder: Auto-Disable hat 14d Karenz nach Migration before activation)
```

## Key context

- DB hat aktuell **312.983 venues** und **~183k events**
- `ALTER TABLE ADD COLUMN` mit Default ist ab Postgres 11 metadata-only (instant)
- Backfill von `last_seen_at = updated_at` kann long-running sein bei 183k rows — chunked machen wenn >5min
- Existing `enrichment_version` column ist da (`20260419_add_event_enrichment.sql`)
- `category_locked` ist da (`20260417_add_category_classifier.sql`)
- Auto-Disable braucht Karenz nach Migration (14d ohne disable-action), weil `source_runs` history erstmal aufgebaut werden muss

## Acceptance

- [ ] Migration angewendet auf Project `booljdtrktpotsenbnut`
- [ ] events Spalten existieren: `image_width INT`, `image_height INT`, `last_seen_at TIMESTAMPTZ`, `enrichment_failed BOOLEAN`, `enrichment_failure_count INT`, **`is_dog_friendly BOOLEAN`, `is_wheelchair_accessible BOOLEAN`, `is_outdoor BOOLEAN`** (alle 3 default FALSE — fn-14.3 Interview)
- [ ] Partial Index `events_stale_idx` mit korrekter WHERE-Clause
- [ ] `last_seen_at` für existing rows mit `updated_at` Wert befüllt (kein NULL)
- [ ] **`sources` Tabelle existiert mit allen 10 Spalten** + sources_trust_idx
- [ ] **`source_runs` Tabelle existiert** + source_runs_source_time_idx
- [ ] **`source_metrics` View funktioniert** (verifiziert via `SELECT * FROM source_metrics LIMIT 5;`)
- [ ] **`bulk_update_event_enrichment` RPC erweitert** um `enrichment_failed`, `enrichment_failure_count`, `price_min`, `is_dog_friendly`, `is_wheelchair_accessible`, `is_outdoor` — Test-Call schreibt alle 6 Felder erfolgreich
- [ ] NULL-Handling für source_metrics view explizit dokumentiert (runs_30d < 14 -> no disable)
- [ ] Bootstrap: `sources` Tabelle seeded mit allen distinct source_name aus events
- [ ] Migration ist idempotent (zweiter Apply ist no-op)

## Done summary
TBD

## Evidence
- Commits:
- Migration files:
- DB verify (SQL):
