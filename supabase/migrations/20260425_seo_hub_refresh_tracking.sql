-- fn-13 Phase 10 commit 5 — tracks last content refresh per hub.
--
-- The monthly cron picks top-traffic hubs, rotates their visible intro
-- paragraph from a curated pool, and updates last_refreshed_at. Google
-- signals "last modified" via sitemap lastmod derived from this.
--
-- Why a separate table (and not a column on `gemeinden` / a new table):
--   - `gemeinden` is a read-only registry loaded from JSON at build time
--   - `thema` / `bundesland` hubs don't have DB rows at all
--   - this lets us track refresh state across ALL hub types with one shape

CREATE TABLE IF NOT EXISTS seo_hub_refreshes (
  hub_path TEXT PRIMARY KEY,
  intro_variant_index INT NOT NULL DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refresh_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_hub_refreshes_last_refreshed_idx
  ON seo_hub_refreshes(last_refreshed_at ASC);

COMMENT ON TABLE seo_hub_refreshes IS
  'fn-13 phase 10 — tracks monthly intro-paragraph rotation per SEO hub.';

ALTER TABLE seo_hub_refreshes ENABLE ROW LEVEL SECURITY;
