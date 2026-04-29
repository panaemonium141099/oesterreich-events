-- event_counts_for_stats RPC erweitern: dedup_total field.
--
-- Map zeigt im Header sidebarEvents.length nach client-side Dedup
-- `(lower(trim(title)), start_date::date)`. Damit Landing dieselbe
-- Zahl rendern kann braucht die RPC eine pendant-Berechnung.
--
-- HashAggregate-Plan: ~3.8 s pro uncached Aufruf — 1 h edge-cached
-- via /api/stats/counts.

CREATE OR REPLACE FUNCTION public.event_counts_for_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT bundesland, category, latitude, longitude, publish_status, title, start_date
    FROM public.events
    WHERE visibility = 'public'
      AND start_date >= now()::date
  ),
  region_agg AS (
    SELECT bundesland, count(*)::bigint AS c
    FROM base
    WHERE bundesland IS NOT NULL
    GROUP BY bundesland
  ),
  cat_agg AS (
    SELECT category, count(*)::bigint AS c
    FROM base
    WHERE category IS NOT NULL
    GROUP BY category
  ),
  total_agg AS (
    SELECT count(*)::bigint AS c
    FROM base
    WHERE publish_status IN ('published', 'published_low_confidence')
      AND latitude BETWEEN 46.3 AND 49.1
      AND longitude BETWEEN 9.5 AND 17.2
  ),
  dedup_total_agg AS (
    SELECT count(*)::bigint AS c FROM (
      SELECT 1 FROM base
      WHERE publish_status IN ('published', 'published_low_confidence')
        AND latitude BETWEEN 46.3 AND 49.1
        AND longitude BETWEEN 9.5 AND 17.2
        AND title IS NOT NULL
      GROUP BY lower(trim(title)), start_date::date
    ) g
  )
  SELECT jsonb_build_object(
    'regions',     (SELECT COALESCE(jsonb_object_agg(bundesland, c), '{}'::jsonb) FROM region_agg),
    'categories',  (SELECT COALESCE(jsonb_object_agg(category, c), '{}'::jsonb) FROM cat_agg),
    'total',       (SELECT c FROM total_agg),
    'dedup_total', (SELECT c FROM dedup_total_agg)
  );
$$;

REVOKE ALL ON FUNCTION public.event_counts_for_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_counts_for_stats() TO anon, authenticated, service_role;
