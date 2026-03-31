-- Migration: Create event_tags junction table for multi-tag system
-- Replaces the single `category` column with a many-to-many relationship

-- Create the event_tags junction table
CREATE TABLE IF NOT EXISTS event_tags (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (event_id, tag)
);

-- GIN index for efficient array/tag queries
CREATE INDEX IF NOT EXISTS idx_event_tags_tag ON event_tags USING btree (tag);
CREATE INDEX IF NOT EXISTS idx_event_tags_event_id ON event_tags (event_id);

-- RLS policies: public read, admin/god write
ALTER TABLE event_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_tags_public_read"
  ON event_tags FOR SELECT
  TO public
  USING (true);

CREATE POLICY "event_tags_admin_insert"
  ON event_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'god')
    )
  );

CREATE POLICY "event_tags_admin_update"
  ON event_tags FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'god')
    )
  );

CREATE POLICY "event_tags_admin_delete"
  ON event_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'god')
    )
  );

-- Populate event_tags from existing category column
INSERT INTO event_tags (event_id, tag)
SELECT id, category FROM events
WHERE category IS NOT NULL
ON CONFLICT (event_id, tag) DO NOTHING;

-- Add comment to mark category as deprecated
COMMENT ON COLUMN events.category IS 'DEPRECATED: Use event_tags table instead. Kept for backwards compatibility.';
