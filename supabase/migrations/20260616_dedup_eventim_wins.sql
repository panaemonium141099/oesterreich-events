-- Eventim always wins in deduplication: any non-Eventim event that shares a
-- content_fingerprint (normalized title + date) with an Eventim event is marked
-- as a duplicate of that Eventim event (it carries the official affiliate ticket
-- link). Idempotent — already-'duplicate' rows are skipped — so the daily import
-- cron can call it after every run to keep future duplicates from surfacing.
-- Applied to prod via Supabase MCP on 2026-06-16; first run marked 2125 rows.
CREATE OR REPLACE FUNCTION public.dedup_eventim_wins()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE n integer;
BEGIN
  WITH eventim_canon AS (
    SELECT content_fingerprint,
           (array_agg(id ORDER BY id) FILTER (WHERE source_name = 'Eventim'))[1] AS eventim_id
    FROM public.events
    WHERE content_fingerprint IS NOT NULL
      AND publish_status IN ('published', 'published_low_confidence')
      AND start_date >= now()::date
    GROUP BY content_fingerprint
    HAVING bool_or(source_name = 'Eventim') AND bool_or(source_name <> 'Eventim')
  )
  UPDATE public.events e
  SET publish_status = 'duplicate', duplicate_of = c.eventim_id, dedup_score = 1.0
  FROM eventim_canon c
  WHERE e.content_fingerprint = c.content_fingerprint
    AND e.source_name <> 'Eventim'
    AND e.publish_status IN ('published', 'published_low_confidence');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
