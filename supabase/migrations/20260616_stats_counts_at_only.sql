-- Landing stats stay Austria-only (the country toggle is map-page-only).
-- DE/CH events now exist in `events`; without this guard they leak into the
-- category counts. regions (null bundesland) + total (AT-bbox) were already safe.
-- Applied to prod via Supabase MCP on 2026-06-16.
CREATE OR REPLACE FUNCTION public.event_counts_for_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT bundesland, category, latitude, longitude, publish_status
    FROM public.events
    WHERE visibility = 'public'
      AND country = 'AT'
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
  )
  SELECT jsonb_build_object(
    'regions',    (SELECT COALESCE(jsonb_object_agg(bundesland, c), '{}'::jsonb) FROM region_agg),
    'categories', (SELECT COALESCE(jsonb_object_agg(category, c), '{}'::jsonb) FROM cat_agg),
    'total',      (SELECT c FROM total_agg)
  );
$$;

REVOKE ALL ON FUNCTION public.event_counts_for_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_counts_for_stats() TO anon, authenticated, service_role;
