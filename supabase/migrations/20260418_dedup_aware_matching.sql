-- Dedup-aware artist/lineup matching.
--
-- After the cross-source dedup step started marking events with
-- publish_status='duplicate' + duplicate_of=<primary>, the artist-matching
-- RPCs continued to match on those duplicate rows — producing multiple
-- notifications (and reminder emails) for the same real event under
-- different event_ids. The fix: every matching RPC filters on
-- publish_status so only the primary/canonical row is considered.
--
-- Every function below is CREATE OR REPLACE — idempotent, no schema change,
-- safe to re-run.

-- ─── 1. match_exact_artist_title (single regex, 3-char names) ────────────
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
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.title ~* p_regex;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── 2. match_exact_artist_titles_batch (batch, 4-7 char names) ──────────
CREATE OR REPLACE FUNCTION match_exact_artist_titles_batch(
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
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.title ~* (E'\\m' || a.name || E'\\M');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── 3. match_exact_artist_titles_music_only (word-boundary + Musik/Nightlife gate) ─
CREATE OR REPLACE FUNCTION match_exact_artist_titles_music_only(
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
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.category IN ('Musik', 'Nightlife')
      AND e.title ~* (E'\\m' || a.name || E'\\M');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── 4. match_fuzzy_artist_titles (pg_trgm, 8+ char names) ───────────────
CREATE OR REPLACE FUNCTION match_fuzzy_artist_titles(
  p_artist_names text[],
  p_threshold real,
  p_since timestamptz
)
RETURNS TABLE(event_id uuid, event_title text, artist_name text, similarity real) AS $$
BEGIN
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
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND a.name <% e.title;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── 5. match_artist_descriptions (substring, 6+ char names) ─────────────
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
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'))
      AND e.description IS NOT NULL
      AND position(lower(a.name) in lower(e.description)) > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── 6. match_lineup_artists (derived festival events) ───────────────────
-- Derived events carry source_type='derived'; the other RPCs above exclude
-- those. Lineup-match IS for derived events, so we keep them — but they
-- must still pass the publish_status gate to avoid sending notifications
-- for duplicated derived events.
CREATE OR REPLACE FUNCTION match_lineup_artists(
  p_artist_names text[],
  p_since timestamptz
)
RETURNS TABLE(
  derived_event_id uuid,
  event_title text,
  parent_event_id uuid,
  festival_id uuid,
  festival_name text,
  artist_name_raw text,
  artist_name_normalized text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
    SELECT
      fa.derived_event_id,
      e.title AS event_title,
      f.parent_event_id,
      f.id AS festival_id,
      f.canonical_name AS festival_name,
      fa.artist_name_raw,
      fa.artist_name_normalized
    FROM festival_artists fa
    JOIN festivals f ON f.id = fa.festival_id
    JOIN events e ON e.id = fa.derived_event_id
    WHERE fa.artist_name_normalized = ANY(p_artist_names)
      AND f.starts_at >= current_date
      AND fa.updated_at > p_since
      AND fa.derived_event_id IS NOT NULL
      AND (e.publish_status IS NULL OR e.publish_status IN ('published', 'published_low_confidence'));
END;
$$;

-- ─── 7. rewire_saved_events_to_primaries: helper for src/scripts/dedup.ts ─
-- When an event is reclassified as a duplicate, user references in
-- `saved_events` and `artist_event_notifications` now point to a hidden
-- row. This helper re-points them to the primary so the user's saved list
-- and pending reminders continue to work.
--
-- Strategy per table: DELETE colliding rows first (user already has a
-- reference to the primary), then UPDATE the remaining duplicate refs to
-- point at the primary. Using sequential statements (not CTEs) ensures the
-- DELETE commits before the UPDATE sees those rows.
CREATE OR REPLACE FUNCTION rewire_saved_events_to_primaries()
RETURNS TABLE(rewired_saved_events int, rewired_artist_notifications int)
LANGUAGE plpgsql
AS $$
DECLARE
  saved_deleted int;
  saved_updated int;
  notif_deleted int;
  notif_updated int;
BEGIN
  -- saved_events: drop rows where the user already saved the primary,
  -- to avoid a unique-violation on the subsequent UPDATE.
  DELETE FROM saved_events se
  USING events e
  WHERE se.event_id = e.id
    AND e.publish_status = 'duplicate'
    AND e.duplicate_of IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM saved_events se2
      WHERE se2.user_id = se.user_id
        AND se2.event_id = e.duplicate_of
    );
  GET DIAGNOSTICS saved_deleted = ROW_COUNT;

  -- saved_events: rewire the survivors to the primary.
  UPDATE saved_events se
  SET event_id = e.duplicate_of
  FROM events e
  WHERE se.event_id = e.id
    AND e.publish_status = 'duplicate'
    AND e.duplicate_of IS NOT NULL;
  GET DIAGNOSTICS saved_updated = ROW_COUNT;

  -- artist_event_notifications: same two-step treatment.
  DELETE FROM artist_event_notifications n
  USING events e
  WHERE n.event_id = e.id
    AND e.publish_status = 'duplicate'
    AND e.duplicate_of IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM artist_event_notifications n2
      WHERE n2.user_id = n.user_id
        AND n2.event_id = e.duplicate_of
    );
  GET DIAGNOSTICS notif_deleted = ROW_COUNT;

  UPDATE artist_event_notifications n
  SET event_id = e.duplicate_of
  FROM events e
  WHERE n.event_id = e.id
    AND e.publish_status = 'duplicate'
    AND e.duplicate_of IS NOT NULL;
  GET DIAGNOSTICS notif_updated = ROW_COUNT;

  rewired_saved_events := saved_deleted + saved_updated;
  rewired_artist_notifications := notif_deleted + notif_updated;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION rewire_saved_events_to_primaries() IS
  'Idempotent helper called by dedup.ts after marking duplicates. Returns counts of rewired saved_events and artist_event_notifications.';
