-- fn-13 Phase 10 — SEO KPI storage
--
-- Two tables:
--
-- 1. `seo_snapshots` — daily JSON rollup of Search Console + CrUX + internal
--    metrics. One row per day. The `metrics` JSONB blob holds the full
--    snapshot shape; changing the shape is an additive migration (old rows
--    just lack the new keys). This table is the history source for trend
--    charts in the admin dashboard and for the traffic-drop alerter.
--
-- 2. `seo_experiments` — A/B test declarations. Each experiment gates a
--    specific hub-page title variant between two alternatives ('A' and 'B').
--    Middleware reads `status='running'` rows on each request, assigns the
--    caller a sticky cookie variant, and that cookie drives rendering. Done
--    this way — rather than edge config or a third-party service — because
--    we already control middleware, DB, and the hub pages end-to-end.

-- ─── snapshots ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_snapshots (
  -- yyyy-mm-dd date key — one snapshot per UTC day. Using DATE (not
  -- timestamptz) lets us upsert idempotently with `ON CONFLICT (snapshot_date)`.
  snapshot_date DATE PRIMARY KEY,
  -- Unified shape — see src/lib/seo/snapshot.ts for the TypeScript type.
  -- Why JSONB: we expect the metric set to evolve (new GSC dimensions, new
  -- hub types, new alert thresholds). Columnar storage for every metric
  -- would force a migration per evolution — JSONB lets us append and the
  -- dashboard adapts.
  metrics JSONB NOT NULL,
  -- When the snapshot was actually computed. Useful for debugging cron
  -- drift (snapshot_date=2026-04-24, collected_at=2026-04-24T06:00:00 means
  -- the daily cron ran on schedule).
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Collected-at index for "most recent snapshot" queries + alert checks
CREATE INDEX IF NOT EXISTS seo_snapshots_collected_at_idx ON seo_snapshots(collected_at DESC);

COMMENT ON TABLE seo_snapshots IS
  'Daily SEO metrics rollup — Search Console + CrUX + internal. One row per UTC day.';

-- Only service-role reads/writes — never expose to client RLS.
ALTER TABLE seo_snapshots ENABLE ROW LEVEL SECURITY;
-- No policies = no public access. Service role bypasses RLS.

-- ─── experiments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Human-readable name shown in the admin UI ("Gemeinde H1 — town name first vs event count first").
  name TEXT NOT NULL,
  -- Hub-page type this experiment targets. Middleware only applies the
  -- variant when path matches this scope.
  scope TEXT NOT NULL CHECK (scope IN ('gemeinde', 'thema', 'bundesland', 'event_detail')),
  -- 'running' — middleware assigns, pages read cookie
  -- 'paused' — middleware ignores, existing assignments kept for consistency
  -- 'concluded' — winner decided, variant is frozen into page code separately
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'concluded')),
  -- The two variants to test. Each is a short key (A/B) plus a JSON payload
  -- that the rendering code interprets (e.g. { "title_template": "..." }).
  -- JSONB so future variants can carry more than a single string.
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  -- Winner assignment after experiment concludes (null while running).
  winner CHAR(1) CHECK (winner IS NULL OR winner IN ('A', 'B')),
  -- Traffic split — how many % of impressions go to B. 50 = standard
  -- 50/50, 10 = conservative guardrail, 0 = fully frozen (same as paused).
  split_b_pct INT NOT NULL DEFAULT 50 CHECK (split_b_pct BETWEEN 0 AND 100),
  -- Timing. started_at fires the moment a cron promotes this to 'running'
  -- (or on INSERT if inserted as running).
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS seo_experiments_status_scope_idx
  ON seo_experiments(status, scope)
  WHERE status = 'running';

COMMENT ON TABLE seo_experiments IS
  'A/B title-variant experiments for hub pages. Middleware reads active ones each request.';

ALTER TABLE seo_experiments ENABLE ROW LEVEL SECURITY;
-- Admins can SELECT (for the dashboard), mutations go via API route with
-- service role. Policy mirrors `event_series_admin_delete` style.
CREATE POLICY "Admins can view experiments" ON seo_experiments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'god')
  ));

-- ─── impression counter for experiment tracking ───────────────────
-- Each hub-page render with an active experiment writes one row here.
-- Simple event log; the admin dashboard aggregates into (variant × day).
CREATE TABLE IF NOT EXISTS seo_experiment_impressions (
  id BIGSERIAL PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES seo_experiments(id) ON DELETE CASCADE,
  variant CHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
  -- Which specific hub URL triggered the impression. Allows per-URL winner
  -- analysis, e.g. if variant B beats A only in high-PLZ gemeinden.
  path TEXT NOT NULL,
  -- Session/user dimension — can be null (crawler + anon). Used to
  -- dedupe when the same caller hits the page multiple times in a
  -- session and we only want to count unique exposures.
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_experiment_impressions_lookup_idx
  ON seo_experiment_impressions(experiment_id, created_at DESC);

ALTER TABLE seo_experiment_impressions ENABLE ROW LEVEL SECURITY;
-- Service-role writes. Admins read via admin API route.
