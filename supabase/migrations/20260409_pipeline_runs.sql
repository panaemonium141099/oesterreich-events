-- Pipeline-level run tracking (one row per full pipeline execution)
CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger text NOT NULL CHECK (trigger IN ('cron', 'manual', 'github_dispatch')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial_failure', 'failed')),
  total_events_scraped int DEFAULT 0,
  total_events_updated int DEFAULT 0,
  total_errors int DEFAULT 0,
  pipeline_steps jsonb DEFAULT '{}',
  github_run_id bigint,
  github_run_url text
);

CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs (started_at DESC);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs (status);

-- Per-scraper stats per pipeline run
CREATE TABLE scraper_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  scraper_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  events_found int DEFAULT 0,
  events_updated int DEFAULT 0,
  duration_ms int DEFAULT 0,
  error_message text,
  retry_count int DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scraper_stats_run_id ON scraper_stats (run_id);
CREATE INDEX idx_scraper_stats_scraper_name ON scraper_stats (scraper_name);
CREATE INDEX idx_scraper_stats_started_at ON scraper_stats (started_at DESC);
