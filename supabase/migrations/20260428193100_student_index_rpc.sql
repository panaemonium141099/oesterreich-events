-- RPC for the /studenten index page — eliminates the per-city N+1.
--
-- Without this RPC, loadStudentIndex() did one full-row fetch per
-- STUDENT_CITY (5 sequential round-trips, each pulling ~500 rows
-- across ~40 columns). Build pre-renders timed out on a saturated
-- Supabase. Even after parallelising in JS the work was still N
-- separate PostgREST queries.
--
-- This function does the aggregation server-side: ONE query, ONE
-- round-trip, returns a tiny result set (one row per Bundesland).
-- The JS caller turns that into a Map<bundesland, count>.
--
-- Quality bar matches MIN_QUALITY (40) — keeps the count meaningful.
-- For the precise post-`computeStudentScore` filter, the per-city
-- /studenten/[city] page still does its own load — but the index
-- just needs an indicator, not exact numbers.

CREATE OR REPLACE FUNCTION public.student_event_counts_by_bundesland(
  p_min_quality integer DEFAULT 40,
  p_bundeslaender text[] DEFAULT NULL
)
RETURNS TABLE (bundesland text, event_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.bundesland,
    count(*) AS event_count
  FROM public.events e
  WHERE e.start_date >= now()
    AND e.quality_score >= p_min_quality
    AND (
      e.publish_status = 'published'
      OR e.publish_status = 'published_low_confidence'
      OR e.publish_status IS NULL
    )
    AND e.bundesland IS NOT NULL
    AND (p_bundeslaender IS NULL OR e.bundesland = ANY(p_bundeslaender))
  GROUP BY e.bundesland;
$$;

GRANT EXECUTE ON FUNCTION public.student_event_counts_by_bundesland(integer, text[]) TO anon, authenticated, service_role;
