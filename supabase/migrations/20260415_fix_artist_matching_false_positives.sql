-- Fix false positive artist-event matches for short/common-word artist names.
--
-- Changes:
-- 1. New: match_exact_artist_titles_batch — batch word boundary regex for 4-7 char names
-- 2. New: match_exact_artist_titles_music_only �� word boundary regex + music category gate
-- 3. Align existing functions with prod (add source_type filter)

-- ============================================================
-- 1. match_exact_artist_titles_batch: batch word boundary match for 4-7 char names
-- ============================================================
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
      AND e.title ~* (E'\\m' || a.name || E'\\M');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 2. match_exact_artist_titles_music_only: word boundary + music category gate
--    For blocklisted artist names (common words like "Dame", "Wanda", etc.)
-- ============================================================
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
      AND e.category IN ('Musik', 'Nightlife')
      AND e.title ~* (E'\\m' || a.name || E'\\M');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 3. Align existing functions with prod (add source_type filter)
-- ============================================================

-- 3a. match_exact_artist_title (single name, 3-char)
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

-- 3b. match_fuzzy_artist_titles (8+ char names)
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
      AND a.name <% e.title;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3c. match_artist_descriptions (6+ char names)
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
