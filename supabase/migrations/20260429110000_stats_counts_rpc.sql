-- /api/stats/counts RPC: ONE query statt 21 individuelle counts.
--
-- Pre-Refactor: Promise.all von 9 region-counts + 12 category-counts +
-- 1 total-count = 22 individuelle PostgREST-Calls. Jeder fällt auf
-- BitmapHeapScan zurück (count='estimated' wird in PostgREST zur
-- exact-count wenn der Filter-Mix komplex ist) → mean ~1 s pro Call,
-- in Summe 30+ s im Free-Tier wegen Connection-Pool-Serialisierung.
--
-- Diese RPC: server-side GROUP BY, ein Heap-Pass für alle Aggregates
-- via shared CTE. Sub-2-Sekunden für die ganze Statistik.
--
-- Returns:
--   { regions: {bl: count}, categories: {cat: count}, total: bigint }
--
-- `total` ist die "Map-equivalent" Zahl (publishable + geocoded + AT-bbox)
-- damit LandingStats die GLEICHE Zahl wie der Map-Counter zeigt.

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
    -- Map-equivalent: publishable + geocoded + AT-bbox.
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
