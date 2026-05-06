-- fn-14.2 Migration B: sources + source_runs + source_metrics view.
--
-- Mandatory (not optional) — fn-14.6 Auto-Disable / Trust-Enforcement
-- logic depends on these tables. The original spec marked them
-- optional; that was wrong (Codex-Review-Finding).
--
-- Schema split rationale
--   `sources`            — current state per source (enabled, last
--                          trust score, cooldown). One row per source.
--   `source_runs`        — append-only run history (one row per
--                          scraper run). Sliding-window aggregates
--                          (events_7d / events_30d_median) come from
--                          this audit log, not from hot-write columns
--                          on `sources` (avoids per-run contention,
--                          and gives auditable history).
--   `source_metrics`     — view that aggregates source_runs into the
--                          counters Auto-Disable Rule needs.
--
-- NULL-Handling for Auto-Disable Rule (documented at view level)
--   * runs_30d < 14         → DO NOT evaluate disable rule (warm-up).
--   * events_30d_median = 0 → DO NOT evaluate disable rule (edge-case
--                              guard — every Failure-Zahl < 0.2 × 0
--                              would be false but better explicit).
--   Only when `runs_30d >= 14 AND events_30d_median > 0` does the
--   Sliding-Window-Rule fire. fn-14.6 enforces this in code; the view
--   exposes the raw counters.
--
-- Bootstrap
--   For each distinct source_name in `events`, an entry is seeded with
--   defaults (enabled=true, no trust score). This avoids FK violations
--   when scrape.ts later inserts source_runs rows for legacy sources.

CREATE TABLE IF NOT EXISTS sources (
  source_name           TEXT PRIMARY KEY,
  enabled               BOOLEAN DEFAULT TRUE,
  consecutive_failures  INT     DEFAULT 0,
  last_trust_score      NUMERIC,
  last_run_at           TIMESTAMPTZ,
  last_run_events       INT     DEFAULT 0,
  disabled_at           TIMESTAMPTZ,
  disabled_reason       TEXT,
  cooldown_until        TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Trust-ranking lookup. WHERE enabled=TRUE means the index only
-- contains live sources — disabled ones don't pollute it.
CREATE INDEX IF NOT EXISTS sources_trust_idx
  ON sources(last_trust_score)
  WHERE enabled = TRUE;

-- Append-only run history. status is constrained to a small enum so
-- partial-failure counts can be computed cleanly.
CREATE TABLE IF NOT EXISTS source_runs (
  id              BIGSERIAL PRIMARY KEY,
  source_name     TEXT NOT NULL REFERENCES sources(source_name) ON DELETE CASCADE,
  run_at          TIMESTAMPTZ DEFAULT NOW(),
  events_found    INT NOT NULL DEFAULT 0,
  events_upserted INT NOT NULL DEFAULT 0,
  duration_ms     INT,
  status          TEXT CHECK (status IN ('success','failed','partial')) DEFAULT 'success',
  error_message   TEXT
);

CREATE INDEX IF NOT EXISTS source_runs_source_time_idx
  ON source_runs(source_name, run_at DESC);

-- Aggregate view feeding the Sliding-Window Auto-Disable Rule.
-- COALESCE wraps the median because PERCENTILE_DISC over an empty
-- filter set returns NULL — fn-14.6 wants 0 there so the rule
-- short-circuits ("no history yet → don't disable").
CREATE OR REPLACE VIEW source_metrics AS
SELECT
  source_name,
  COUNT(*) FILTER (WHERE run_at > NOW() - INTERVAL '7 days')                                 AS runs_7d,
  COUNT(*) FILTER (WHERE run_at > NOW() - INTERVAL '30 days')                                AS runs_30d,
  COALESCE(SUM(events_found) FILTER (WHERE run_at > NOW() - INTERVAL '7 days'), 0)           AS events_7d,
  COALESCE(
    PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY events_found)
      FILTER (WHERE run_at > NOW() - INTERVAL '30 days'),
    0
  )                                                                                          AS events_30d_median
FROM source_runs
GROUP BY source_name;

-- Bootstrap: ensure every source_name observed in events has a row in
-- `sources`, so subsequent INSERTs into source_runs don't violate FK.
-- ON CONFLICT DO NOTHING keeps this idempotent on re-apply.
INSERT INTO sources (source_name)
SELECT DISTINCT source_name
FROM events
WHERE source_name IS NOT NULL
ON CONFLICT (source_name) DO NOTHING;

-- Permissions: backend services use service_role; views inherit from
-- their underlying tables, so granting SELECT on the view is enough
-- for read-side consumers.
GRANT SELECT ON source_metrics TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON sources TO service_role;
GRANT SELECT, INSERT ON source_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE source_runs_id_seq TO service_role;
