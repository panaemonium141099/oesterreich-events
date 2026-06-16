-- Robust keyword search RPC (used by /api/events ?search=).
-- Per-word AND matching with separator normalization, so "dicht und ergreifend"
-- finds "dicht & ergreifend" (and vice versa); word order, punctuation, case and
-- extra separators no longer break the match. Replaces the prior naive
-- single-substring ILIKE. Applied to prod via Supabase MCP on 2026-06-16.
CREATE OR REPLACE FUNCTION public.search_event_ids(q text, max_ids integer DEFAULT 50000)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE PARALLEL SAFE
AS $function$
  WITH terms AS (
    SELECT array_remove(
             regexp_split_to_array(
               btrim(regexp_replace(lower(q), '[^a-z0-9äöüß]+', ' ', 'g')),
               '\s+'
             ),
             'und'                         -- "und" / normalized "&","+" are noise
           ) AS ws
  )
  SELECT e.id
  FROM events e
  CROSS JOIN terms
  CROSS JOIN LATERAL (
    SELECT regexp_replace(lower(
             COALESCE(e.title, '')         || ' ' ||
             COALESCE(e.location_name, '') || ' ' ||
             COALESCE(e.address, '')       || ' ' ||
             COALESCE(e.category, '')
           ), '[^a-z0-9äöüß]+', ' ', 'g') AS hay
  ) h
  WHERE e.visibility = 'public'
    AND e.publish_status IN ('published', 'published_low_confidence')
    AND EXISTS (SELECT 1 FROM unnest(terms.ws) w WHERE length(w) >= 2)
    AND NOT EXISTS (
      SELECT 1 FROM unnest(terms.ws) w
      WHERE length(w) >= 2 AND h.hay NOT LIKE '%' || w || '%'
    )
  LIMIT max_ids;
$function$;