-- Artist matching RPC functions for pg_trgm-based artist-event matching.
-- Task: fn-10-spotify-artist-alerts-follow-artists.6

-- ============================================================
-- 1. match_exact_artist_title: word boundary regex match for 3-char names
-- ============================================================
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
      AND e.title ~* p_regex;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 2. match_fuzzy_artist_titles: pg_trgm word_similarity batch match
-- ============================================================
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
      AND a.name <% e.title;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 3. match_artist_descriptions: substring check for 6+ char names
-- ============================================================
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
      AND e.description IS NOT NULL
      AND position(lower(a.name) in lower(e.description)) > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
