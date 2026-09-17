-- Der PostgREST-Rollenkontext (authenticator) laedt pg-safeupdate:
-- UPDATE ohne WHERE wird dort mit "UPDATE requires a WHERE clause"
-- abgewiesen. Der Import-Lauf (npm run import:barrierefrei) ruft die
-- Funktion per RPC auf; pg_cron (postgres-Rolle) war nie betroffen.
-- Gleiche Berechnung wie 20260826180000, nur mit WHERE true.

CREATE OR REPLACE FUNCTION public.recompute_activity_quality_scores()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.poi_activities SET quality_score =
      CASE WHEN length(coalesce(description, '')) >= 600 THEN 25
           WHEN length(coalesce(description, '')) >= 200 THEN 18
           WHEN length(coalesce(description, '')) > 0 THEN 8
           ELSE 0 END
    + CASE WHEN jsonb_typeof(images) = 'array' AND jsonb_array_length(images) >= 3 THEN 20
           WHEN jsonb_typeof(images) = 'array' AND jsonb_array_length(images) >= 1 THEN 12
           ELSE 0 END
    + CASE WHEN jsonb_typeof(opening_times) = 'array' AND jsonb_array_length(opening_times) > 0 THEN 10 ELSE 0 END
    + CASE WHEN online_bookable THEN 8 ELSE 0 END
    + CASE WHEN description_short IS NOT NULL AND length(description_short) > 0 THEN 4 ELSE 0 END
    + CASE
        WHEN jsonb_typeof(opening_times) <> 'array' OR jsonb_array_length(opening_times) = 0 THEN 0
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(opening_times) AS p
          WHERE (p->>'from' IS NULL OR p->>'from' <= to_char(CURRENT_DATE, 'YYYY-MM-DD'))
            AND (p->>'to' IS NULL OR p->>'to' >= to_char(CURRENT_DATE, 'YYYY-MM-DD'))
        ) THEN 10
        ELSE -15
      END
    + (hashtext(id::text || CURRENT_DATE::text) & 7)
  WHERE true;
$$;
