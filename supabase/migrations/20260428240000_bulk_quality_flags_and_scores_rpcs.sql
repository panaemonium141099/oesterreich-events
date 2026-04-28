-- Phase 4b: Bulk-RPCs für backfill-quality.ts.
--
-- Vor Refactor: 5 Round-Trips pro Event (DELETE flags + INSERT flags +
-- UPSERT scores + SELECT publish_status + UPDATE event). Bei 200k events
-- = 1 Million PostgREST round-trips.
--
-- Mit diesen 2 zusätzlichen RPCs (+ existing bulk_update_event_publish):
-- 3 RPC-Calls pro 500-Event-Batch.

-- 1. bulk_replace_event_quality_flags
-- DELETE all existing flags for these events + INSERT new ones.
-- Sequential statements im PL/pgSQL (CTE-Order ist in PG12+ undefined
-- für data-modifying steps).
CREATE OR REPLACE FUNCTION public.bulk_replace_event_quality_flags(p_input jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int;
BEGIN
  -- Step 1: clear existing flags for these event_ids
  DELETE FROM public.quality_flags
  WHERE event_id IN (
    SELECT (e->>'event_id')::uuid
    FROM jsonb_array_elements(p_input) AS e
  );

  -- Step 2: insert all new flags (flat-mapped from input array)
  WITH flat AS (
    SELECT
      (e->>'event_id')::uuid AS event_id,
      f->>'flag_type' AS flag_type,
      f->>'severity' AS severity,
      CASE WHEN f ? 'details_json' THEN f->'details_json' ELSE NULL END AS details_json
    FROM jsonb_array_elements(p_input) AS e,
         jsonb_array_elements(COALESCE(e->'flags', '[]'::jsonb)) AS f
  )
  INSERT INTO public.quality_flags (event_id, flag_type, severity, details_json)
  SELECT event_id, flag_type, severity, details_json FROM flat;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.bulk_replace_event_quality_flags(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_replace_event_quality_flags(jsonb) TO service_role;


-- 2. bulk_upsert_event_quality_scores — single INSERT with ON CONFLICT
CREATE OR REPLACE FUNCTION public.bulk_upsert_event_quality_scores(p_updates jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH src AS (
    SELECT
      event_id, completeness_score, date_score, location_score,
      image_score, link_score, dedup_confidence_score,
      source_trust_score, final_quality_score, scoring_version
    FROM jsonb_to_recordset(p_updates) AS x(
      event_id uuid,
      completeness_score double precision,
      date_score double precision,
      location_score double precision,
      image_score double precision,
      link_score double precision,
      dedup_confidence_score double precision,
      source_trust_score double precision,
      final_quality_score double precision,
      scoring_version integer
    )
  )
  INSERT INTO public.event_quality_scores (
    event_id, completeness_score, date_score, location_score,
    image_score, link_score, dedup_confidence_score,
    source_trust_score, final_quality_score, scoring_version
  )
  SELECT * FROM src
  ON CONFLICT (event_id, scoring_version) DO UPDATE SET
    completeness_score     = EXCLUDED.completeness_score,
    date_score             = EXCLUDED.date_score,
    location_score         = EXCLUDED.location_score,
    image_score            = EXCLUDED.image_score,
    link_score             = EXCLUDED.link_score,
    dedup_confidence_score = EXCLUDED.dedup_confidence_score,
    source_trust_score     = EXCLUDED.source_trust_score,
    final_quality_score    = EXCLUDED.final_quality_score;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
REVOKE ALL ON FUNCTION public.bulk_upsert_event_quality_scores(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_upsert_event_quality_scores(jsonb) TO service_role;
