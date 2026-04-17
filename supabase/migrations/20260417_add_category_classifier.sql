-- Central category classifier: persist raw source signals separately from final
-- canonical values, and record confidence/source/version metadata analogous to
-- the geocoding_confidence model.
--
-- The final `category` and `tags` columns remain the authoritative values read
-- by the app. New columns capture provenance and allow the AI fallback batch
-- script to re-evaluate only hard or stale cases.
--
-- Confidence precedence (highest first):
--   manual > rules_high > rules_medium > ai > ai_low > NULL
--
-- Sources: manual | rules | ai | NULL (unknown/legacy)

ALTER TABLE events ADD COLUMN IF NOT EXISTS source_category_raw TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS source_tags_raw TEXT[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_confidence TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_source TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_version TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_reason TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category_candidates JSONB;

-- Partial indexes: only index rows where the value is non-default to keep
-- indexes small. These queries drive the batch categorize-events.ts script.
CREATE INDEX IF NOT EXISTS idx_events_category_confidence
  ON events (category_confidence);

CREATE INDEX IF NOT EXISTS idx_events_category_needs_review
  ON events (category_needs_review)
  WHERE category_needs_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_events_category_version
  ON events (category_version);

COMMENT ON COLUMN events.source_category_raw IS
  'Raw category hint provided by the scraper / source feed. Signal only, not authoritative.';
COMMENT ON COLUMN events.source_tags_raw IS
  'Raw tag list provided by the scraper / source feed. Signal only, not authoritative.';
COMMENT ON COLUMN events.category_confidence IS
  'Confidence of the canonical category assignment: manual | rules_high | rules_medium | ai | ai_low';
COMMENT ON COLUMN events.category_source IS
  'Stage that produced the canonical category: manual | rules | ai';
COMMENT ON COLUMN events.category_version IS
  'Classifier version tag (e.g. cat-v1). Rows with a stale version are reclassified by the batch script.';
COMMENT ON COLUMN events.category_locked IS
  'When TRUE, no classifier (rules or AI) may overwrite category/tags.';
COMMENT ON COLUMN events.category_needs_review IS
  'Flagged for human review: AI low-confidence fallback or unresolved ambiguity.';
COMMENT ON COLUMN events.category_reason IS
  'Short human-readable explanation of why this category was chosen.';
COMMENT ON COLUMN events.category_candidates IS
  'Top scored candidates as JSON: [{category, score, evidence[]}, ...]';
