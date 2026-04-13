-- Lineup matching RPC: direct-lookup for followed artists against festival_artists
-- Uses btree equality on artist_name_normalized for fast lookups.
-- Returns derived_event_id, event_title, festival_name for notification copy.
-- Task: fn-12-festival-lineup-ingestion-pipeline.7

-- ============================================================
-- match_lineup_artists: direct equality lookup
-- ============================================================
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
      AND fa.derived_event_id IS NOT NULL;
END;
$$;
