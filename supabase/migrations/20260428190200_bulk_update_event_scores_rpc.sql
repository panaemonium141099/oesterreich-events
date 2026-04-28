-- Bulk-update RPC for calculate-scores.ts
--
-- Without this RPC, scripts/calculate-scores.ts fired one UPDATE per event
-- (Promise.all over chunks of 20). Across runs that accumulated to 2.27
-- million single-row updates in pg_stat_statements (7.5 % of all DB time)
-- and was the second-largest contributor to Supabase saturation right
-- behind the realtime WAL.
--
-- This function takes the full batch as a JSONB array and runs a single
-- UPDATE … FROM jsonb_to_recordset(). One round-trip, one query plan,
-- one set of locks, one row-level write per event — instead of N round
-- trips with N plans.
--
-- Returns the number of rows actually updated (so the caller can
-- detect drift or stale event ids).

CREATE OR REPLACE FUNCTION public.bulk_update_event_scores(
  p_updates jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH src AS (
    SELECT id, event_score, score_updated_at
    FROM jsonb_to_recordset(p_updates) AS x(
      id uuid,
      event_score numeric,
      score_updated_at timestamptz
    )
  )
  UPDATE public.events e
  SET event_score = src.event_score,
      score_updated_at = src.score_updated_at
  FROM src
  WHERE e.id = src.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Service-role only — never want anonymous traffic touching event_score.
REVOKE ALL ON FUNCTION public.bulk_update_event_scores(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_event_scores(jsonb) TO service_role;
