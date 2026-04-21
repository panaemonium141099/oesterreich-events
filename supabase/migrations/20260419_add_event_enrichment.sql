-- Event enrichment columns for the Wizard-Planner feature.
--
-- Adds 7 new per-event attributes populated by the local-LLM classifier
-- (Qwen 2.5 14B via LM Studio). The existing `category` + `tags` columns
-- keep their role; these are ADDITIVE so rollback is a simple column drop
-- with zero impact on existing features.
--
-- Column design notes:
--   audience/vibe/setting are TEXT[] because events often hit multiple
--     values (a kirtag is both "familien-mit-kindern" AND "traditionell").
--   language/price_tier/duration_type are TEXT (single-choice).
--   is_student_friendly/is_family_friendly are BOOLEAN for one-click
--     wizard filters — cheaper than scanning an array.
--
-- Index strategy:
--   GIN on the array columns — required for efficient `'tag' = ANY(col)`
--     or `col && ARRAY[...]` queries when the Wizard filters on a genre.
--   Partial boolean indexes — only index the TRUE rows. For
--     is_student_friendly this is maybe 10-20% of events, so the index
--     stays small AND every wizard query like
--     `WHERE is_student_friendly = true` only scans that subset.
--   Language is a low-cardinality single-value column — regular btree is fine.

ALTER TABLE events ADD COLUMN IF NOT EXISTS audience TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS vibe TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS setting TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS price_tier TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_type TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_student_friendly BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_family_friendly BOOLEAN DEFAULT false;

-- Provenance: track which classifier version wrote these fields, so we
-- can re-run selectively when the prompt or taxonomy changes.
ALTER TABLE events ADD COLUMN IF NOT EXISTS enrichment_version TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS enrichment_at TIMESTAMPTZ;

-- ── Indexes ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS events_audience_gin ON events USING GIN (audience);
CREATE INDEX IF NOT EXISTS events_vibe_gin ON events USING GIN (vibe);
CREATE INDEX IF NOT EXISTS events_setting_gin ON events USING GIN (setting);

CREATE INDEX IF NOT EXISTS events_language ON events (language) WHERE language IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_price_tier ON events (price_tier) WHERE price_tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_duration_type ON events (duration_type) WHERE duration_type IS NOT NULL;

-- Partial indexes — only the TRUE rows. Huge space savings since these
-- will fire on a minority of events.
CREATE INDEX IF NOT EXISTS events_student_friendly ON events (id)
  WHERE is_student_friendly = true;
CREATE INDEX IF NOT EXISTS events_family_friendly ON events (id)
  WHERE is_family_friendly = true;

-- Version lookup for the batch runner ("give me events still on old version").
CREATE INDEX IF NOT EXISTS events_enrichment_version
  ON events (enrichment_version);
