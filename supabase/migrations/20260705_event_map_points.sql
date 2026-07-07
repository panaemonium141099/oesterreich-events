-- fn-16 Slice 1: kompakter Points-Snapshot fuer /map (alle Future-AT-Events).
--
-- Problem: /map laedt ~68k Events ueber ~30 sequenzielle limit=3000-Batches;
-- jede Batch-Query kostet 10-13 s DB-Zeit (BitmapAnd ueber ~40k Heap-Pages
-- = 325 MB I/O, EXPLAIN-ANALYZE-verifiziert 2026-07-05, wiederholte Laeufe
-- nicht schneller weil der events-Heap nicht in den Buffer-Cache passt).
--
-- Loesung: schmale MV (~68k x ~70 B, bleibt im Cache) + eine RPC, die den
-- gesamten Snapshot columnar (Dictionary-kodiert) als EIN jsonb liefert.
-- Muster wie event_stats_cache (20260704): plain-column UNIQUE INDEX, damit
-- REFRESH CONCURRENTLY funktioniert; Refresh alle 15 min via pg_cron.
--
-- Applied to prod via Supabase MCP on 2026-07-05.

DROP MATERIALIZED VIEW IF EXISTS public.event_map_points;

CREATE MATERIALIZED VIEW public.event_map_points AS
SELECT
  id,
  latitude,
  longitude,
  category,
  start_date,
  end_date,
  bundesland,
  district,
  price_tier,
  price_text,
  is_student_friendly,
  is_family_friendly,
  is_boosted,
  event_score
FROM public.events
WHERE visibility = 'public'
  AND country = 'AT'
  AND publish_status IN ('published', 'published_low_confidence')
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND start_date >= now()::date
WITH DATA;

-- Plain-column unique index: Voraussetzung fuer REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX event_map_points_id_key ON public.event_map_points (id);

REVOKE ALL ON public.event_map_points FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_map_points TO service_role;

-- Columnar-Snapshot als ein jsonb. Arrays sind positionsgleich (Index i =
-- Event i), sortiert nach event_score DESC. Kategorien/Bundeslaender/
-- Districts/Tiers sind Dictionary-kodiert (cat[i] = Index in cats).
-- flags-Bitmaske: bit0 boosted, bit1 student, bit2 family, bit3 gratis.
-- start/end: Tage seit 2026-01-01 (end 0 = kein end_date).
CREATE OR REPLACE FUNCTION public.get_event_map_points()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pts AS (
    SELECT
      row_number() OVER (ORDER BY event_score DESC NULLS LAST, id) AS rn,
      id,
      round(latitude::numeric, 5)  AS lat,
      round(longitude::numeric, 5) AS lng,
      COALESCE(category, '')   AS category,
      COALESCE(bundesland, '') AS bundesland,
      COALESCE(district, '')   AS district,
      COALESCE(price_tier, '') AS price_tier,
      (start_date::date - DATE '2026-01-01') AS start_day,
      COALESCE(end_date::date - DATE '2026-01-01', 0) AS end_day,
      COALESCE(event_score, 0)::int AS score,
      (CASE WHEN is_boosted THEN 1 ELSE 0 END)
        + (CASE WHEN is_student_friendly THEN 2 ELSE 0 END)
        + (CASE WHEN is_family_friendly THEN 4 ELSE 0 END)
        + (CASE WHEN price_tier = 'gratis'
                 OR price_text ~* '(gratis|kostenlos|frei(er)? eintritt|free)'
            THEN 8 ELSE 0 END) AS flags
    FROM public.event_map_points
  ),
  cats AS (SELECT array_agg(x ORDER BY x) AS arr FROM (SELECT DISTINCT category   x FROM pts) t),
  bls AS (SELECT array_agg(x ORDER BY x) AS arr FROM (SELECT DISTINCT bundesland x FROM pts) t),
  districts AS (SELECT array_agg(x ORDER BY x) AS arr FROM (SELECT DISTINCT district   x FROM pts) t),
  tiers AS (SELECT array_agg(x ORDER BY x) AS arr FROM (SELECT DISTINCT price_tier x FROM pts) t)
  SELECT jsonb_build_object(
    'v', 1,
    'generatedAt', now(),
    'n', (SELECT count(*) FROM pts),
    'cats',      to_jsonb((SELECT arr FROM cats)),
    'bls',       to_jsonb((SELECT arr FROM bls)),
    'districts', to_jsonb((SELECT arr FROM districts)),
    'tiers',     to_jsonb((SELECT arr FROM tiers)),
    'ids',   (SELECT COALESCE(jsonb_agg(id ORDER BY rn), '[]'::jsonb) FROM pts),
    'lat',   (SELECT COALESCE(jsonb_agg(lat ORDER BY rn), '[]'::jsonb) FROM pts),
    'lng',   (SELECT COALESCE(jsonb_agg(lng ORDER BY rn), '[]'::jsonb) FROM pts),
    'cat',   (SELECT COALESCE(jsonb_agg(array_position((SELECT arr FROM cats), category) - 1 ORDER BY rn), '[]'::jsonb) FROM pts),
    'bl',    (SELECT COALESCE(jsonb_agg(array_position((SELECT arr FROM bls), bundesland) - 1 ORDER BY rn), '[]'::jsonb) FROM pts),
    'district', (SELECT COALESCE(jsonb_agg(array_position((SELECT arr FROM districts), district) - 1 ORDER BY rn), '[]'::jsonb) FROM pts),
    'tier',  (SELECT COALESCE(jsonb_agg(array_position((SELECT arr FROM tiers), price_tier) - 1 ORDER BY rn), '[]'::jsonb) FROM pts),
    'start', (SELECT COALESCE(jsonb_agg(start_day ORDER BY rn), '[]'::jsonb) FROM pts),
    'end',   (SELECT COALESCE(jsonb_agg(end_day ORDER BY rn), '[]'::jsonb) FROM pts),
    'score', (SELECT COALESCE(jsonb_agg(score ORDER BY rn), '[]'::jsonb) FROM pts),
    'flags', (SELECT COALESCE(jsonb_agg(flags ORDER BY rn), '[]'::jsonb) FROM pts)
  );
$$;

REVOKE ALL ON FUNCTION public.get_event_map_points() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_map_points() TO anon, authenticated, service_role;

-- Refresh alle 15 min (CONCURRENTLY dank plain-column unique index).
SELECT cron.schedule(
  'refresh_event_map_points',
  '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.event_map_points;'
);
