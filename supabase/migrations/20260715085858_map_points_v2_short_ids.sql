-- fn-16 Slice 2: Payload-Diät. Gemessen: UUID-Strings = 51 % des Snapshots
-- (2,55 von 4,98 MB). ids jetzt als 12-Hex-Präfix (Kollisionsrisiko bei
-- 65k Zeilen ≈ 7,6e-6 — akzeptiert; /api/events/[id] löst Präfixe per
-- UUID-Range-Scan auf, EXPLAIN: PK-Index, 1,4 ms). v-Bump auf 2: alte
-- Clients lehnen v2 ab und fallen auf die Batch-Logik zurück (saubere
-- Degradation im Deploy-Überlapp). Einzige Änderungen ggü. v1: short_id
-- statt id, 'v',2.
CREATE OR REPLACE FUNCTION public.get_event_map_points()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH pts AS (
    SELECT
      row_number() OVER (ORDER BY event_score DESC NULLS LAST, id) AS rn,
      replace(left(id::text, 13), '-', '') AS short_id,
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
    'v', 2,
    'generatedAt', now(),
    'n', (SELECT count(*) FROM pts),
    'cats',      to_jsonb((SELECT arr FROM cats)),
    'bls',       to_jsonb((SELECT arr FROM bls)),
    'districts', to_jsonb((SELECT arr FROM districts)),
    'tiers',     to_jsonb((SELECT arr FROM tiers)),
    'ids',   (SELECT COALESCE(jsonb_agg(short_id ORDER BY rn), '[]'::jsonb) FROM pts),
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
$function$;
