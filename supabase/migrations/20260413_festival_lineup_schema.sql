-- Festival Lineup Ingestion Pipeline: schema migration
-- Creates festivals, festival_artists tables; extends events + artist_event_notifications
-- Task: fn-12-festival-lineup-ingestion-pipeline.1

-- ============================================================
-- 1. Extend events table: parent_event_id self-referencing FK
-- ============================================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES events(id) ON DELETE SET NULL;

-- Partial index for efficient child-event lookups
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id
  ON events (parent_event_id) WHERE parent_event_id IS NOT NULL;

-- ============================================================
-- 2. Widen events.source_type CHECK constraint to include 'derived'
--    Self-contained DO block: handles CHECK constraint (current state)
--    and ENUM type (future-proofing) without manual probing.
-- ============================================================
DO $$
DECLARE
  v_conname text;
BEGIN
  -- Check if source_type uses a CHECK constraint
  SELECT conname INTO v_conname
    FROM pg_constraint
    WHERE conrelid = 'events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%source_type%';

  IF v_conname IS NOT NULL THEN
    -- Drop the existing CHECK and recreate with 'derived'
    EXECUTE format('ALTER TABLE events DROP CONSTRAINT %I', v_conname);
    ALTER TABLE events
      ADD CONSTRAINT events_source_type_check
      CHECK (source_type = ANY (ARRAY['scraped', 'user', 'business', 'derived']));
  ELSE
    -- If it's an ENUM type, add the new value idempotently
    BEGIN
      ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'derived';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'source_type is neither CHECK nor ENUM, skipping';
    END;
  END IF;
END $$;

-- ============================================================
-- 3. Widen artist_event_notifications.match_source CHECK to include 'lineup'
-- ============================================================
ALTER TABLE artist_event_notifications
  DROP CONSTRAINT IF EXISTS artist_event_notifications_match_source_check;

ALTER TABLE artist_event_notifications
  ADD CONSTRAINT artist_event_notifications_match_source_check
  CHECK (match_source = ANY (ARRAY['title', 'description', 'lineup']));

-- ============================================================
-- 4. festivals table
-- ============================================================
CREATE TABLE IF NOT EXISTS festivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  website_url text,
  lineup_url text,
  city text,
  state text,
  starts_at date,
  ends_at date,
  genres text,
  registry_source text,
  spotify_priority text,
  direct_lineup_candidate boolean NOT NULL DEFAULT false,
  lineup_fetch_mode text,
  lineup_status text NOT NULL DEFAULT 'unknown'
    CHECK (lineup_status IN ('unknown', 'fetched', 'error', 'no_lineup')),
  lineup_hash text,
  lineup_last_checked_at timestamptz,
  parent_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. festivals RLS: public SELECT, service-role-only writes
-- ============================================================
ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for festivals"
  ON festivals FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated —
-- only service_role (bypasses RLS) can write.

-- ============================================================
-- 6. festival_artists table
-- ============================================================
CREATE TABLE IF NOT EXISTS festival_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  artist_name_raw text NOT NULL,
  artist_name_normalized text NOT NULL,
  day_label text,
  stage_name text,
  billing text,
  source_url text,
  source_type text,
  confidence_score real,
  spotify_artist_id text,
  matched_by text,
  derived_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one row per artist per festival (v1)
ALTER TABLE festival_artists
  ADD CONSTRAINT uq_festival_artist_per_festival
  UNIQUE (festival_id, artist_name_normalized);

-- ============================================================
-- 7. festival_artists RLS: public SELECT, service-role-only writes
-- ============================================================
ALTER TABLE festival_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for festival_artists"
  ON festival_artists FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for authenticated —
-- only service_role (bypasses RLS) can write.

-- ============================================================
-- 8. Indexes
-- ============================================================

-- Btree index for equality joins on normalized artist names
CREATE INDEX IF NOT EXISTS idx_festival_artists_name_normalized
  ON festival_artists (artist_name_normalized);

-- Unique partial index on events(content_fingerprint) for derived events
-- Scoped to derived to avoid legacy collisions with existing scraped events
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_derived_fingerprint
  ON events (content_fingerprint)
  WHERE source_type = 'derived' AND content_fingerprint IS NOT NULL;

-- ============================================================
-- 9. Cleanup RPC: delete_derived_event
--    Atomic multi-table deletion for derived events.
--    SECURITY DEFINER with fixed search_path; EXECUTE restricted to service_role.
-- ============================================================
CREATE OR REPLACE FUNCTION delete_derived_event(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Guard: only delete derived events
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE id = p_event_id AND source_type = 'derived'
  ) THEN
    RAISE NOTICE 'Event % is not a derived event or does not exist, skipping deletion', p_event_id;
    RETURN;
  END IF;

  -- Delete in FK-safe order:
  -- 1. festival_artists first (before events row disappears, ON DELETE SET NULL would nullify derived_event_id)
  DELETE FROM festival_artists WHERE derived_event_id = p_event_id;

  -- 2. Dependent tables that reference events(id)
  DELETE FROM notifications WHERE event_id = p_event_id;
  DELETE FROM saved_events WHERE event_id = p_event_id;
  DELETE FROM artist_event_notifications WHERE event_id = p_event_id;

  -- 3. The event itself — last
  DELETE FROM events WHERE id = p_event_id;
END;
$$;

-- Restrict execution to service_role only
REVOKE ALL ON FUNCTION delete_derived_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_derived_event(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION delete_derived_event(uuid) TO service_role;

-- ============================================================
-- 10. Re-create existing matching RPCs with derived-event exclusion
--     Uses CREATE OR REPLACE — does NOT edit the old migration file.
--     Adds: AND e.source_type IS DISTINCT FROM 'derived'
--     to prevent false positives from derived event titles
--     (e.g. "Volbeat at Nova Rock 2026" matching fuzzy for "Volbeat").
-- ============================================================

-- 10a. match_exact_artist_title: word boundary regex match
CREATE OR REPLACE FUNCTION match_exact_artist_title(
  p_regex text,
  p_since timestamptz
)
RETURNS TABLE(event_id uuid, event_title text) AS $$
BEGIN
  RETURN QUERY
    SELECT e.id AS event_id, e.title AS event_title
    FROM events e
    WHERE e.start_date >= now()
      AND e.updated_at > p_since
      AND e.source_type IS DISTINCT FROM 'derived'
      AND e.title ~* p_regex;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 10b. match_fuzzy_artist_titles: pg_trgm word_similarity batch match
CREATE OR REPLACE FUNCTION match_fuzzy_artist_titles(
  p_artist_names text[],
  p_threshold real,
  p_since timestamptz
)
RETURNS TABLE(event_id uuid, event_title text, artist_name text, similarity real) AS $$
BEGIN
  -- Set word_similarity threshold for the <% operator
  PERFORM set_config('pg_trgm.word_similarity_threshold', p_threshold::text, true);

  RETURN QUERY
    SELECT e.id AS event_id,
           e.title AS event_title,
           a.name AS artist_name,
           word_similarity(a.name, e.title) AS similarity
    FROM events e
    CROSS JOIN unnest(p_artist_names) AS a(name)
    WHERE e.start_date >= now()
      AND e.updated_at > p_since
      AND e.source_type IS DISTINCT FROM 'derived'
      AND a.name <% e.title;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 10c. match_artist_descriptions: substring check for 6+ char names
CREATE OR REPLACE FUNCTION match_artist_descriptions(
  p_artist_names text[],
  p_since timestamptz
)
RETURNS TABLE(event_id uuid, event_title text, artist_name text) AS $$
BEGIN
  RETURN QUERY
    SELECT e.id AS event_id,
           e.title AS event_title,
           a.name AS artist_name
    FROM events e
    CROSS JOIN unnest(p_artist_names) AS a(name)
    WHERE e.start_date >= now()
      AND e.updated_at > p_since
      AND e.source_type IS DISTINCT FROM 'derived'
      AND e.description IS NOT NULL
      AND position(lower(a.name) in lower(e.description)) > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
