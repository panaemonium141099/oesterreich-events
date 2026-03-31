-- Add event scoring columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_score float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_updated_at timestamptz;

-- Index for fast retrieval of top-scored events
CREATE INDEX IF NOT EXISTS idx_events_score_desc
  ON events (event_score DESC);
