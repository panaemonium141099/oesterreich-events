-- fn-25 Phase C5: Karten-Snapshot kennt den Wissensstand zum Ort.
--
-- event_map_points bekommt location_status und pin_allowed; der columnar
-- Payload (get_event_map_points, v2) setzt Flag-Bit 16, wenn die Position
-- KEIN belegter Event-Pin ist (Gemeinde-/PLZ-Mittelpunkt, unbestätigte
-- Alt-Koordinate). Der Client rendert solche Punkte als Sammelmarker
-- („N Events · Ort unbestätigt"), sobald NEXT_PUBLIC_LOCATION_GATING=1
-- gesetzt ist (Phase F); bis dahin ignoriert er das Bit.
--
-- Zeilen ohne gespeicherte Entscheidung gelten als ungefähr, außer die
-- Koordinate ist manuell oder aus strukturierten Venue-Daten.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>
--   danach einmal: SELECT public.rebuild_event_map_points_payload();

set statement_timeout = '15min';

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
  event_score,
  location_status,
  COALESCE(
    (location_resolution -> 'allowed' ->> 'pin')::boolean,
    geocoding_confidence IN ('manual', 'json-ld-venue')
  ) AS pin_allowed
FROM public.events
WHERE visibility = 'public'
  AND country = 'AT'
  AND publish_status IN ('published', 'published_low_confidence')
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND start_date >= now()::date
WITH DATA;

CREATE UNIQUE INDEX event_map_points_id_key ON public.event_map_points (id);
REVOKE ALL ON public.event_map_points FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_map_points TO service_role;

CREATE OR REPLACE FUNCTION public.rebuild_event_map_points_payload()
RETURNS void LANGUAGE sql AS $fn$
  INSERT INTO public.event_map_points_payload (id, payload, generated_at)
  SELECT 1, (
    WITH pts AS MATERIALIZED (
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
              THEN 8 ELSE 0 END)
          + (CASE WHEN pin_allowed THEN 0 ELSE 16 END) AS flags
      FROM public.event_map_points
    ),
    cats AS (SELECT array_agg(x ORDER BY x) AS arr FROM (SELECT DISTINCT category x FROM pts) t),
    bls AS (SELECT array_agg(x ORDER BY x) AS arr FROM (SELECT DISTINCT bundesland x FROM pts) t),
    districts AS (SELECT array_agg(x ORDER BY x) AS arr FROM (SELECT DISTINCT district x FROM pts) t),
    tiers AS (SELECT array_agg(x ORDER BY x) AS arr FROM (SELECT DISTINCT price_tier x FROM pts) t)
    SELECT jsonb_build_object(
      'v', 2, 'generatedAt', now(), 'n', agg.cnt,
      'cats', to_jsonb(c.arr), 'bls', to_jsonb(b.arr), 'districts', to_jsonb(d.arr), 'tiers', to_jsonb(ti.arr),
      'ids', agg.ids, 'lat', agg.lats, 'lng', agg.lngs, 'cat', agg.cat_idx, 'bl', agg.bl_idx,
      'district', agg.district_idx, 'tier', agg.tier_idx, 'start', agg.starts, 'end', agg.ends,
      'score', agg.scores, 'flags', agg.flagss
    )
    FROM cats c, bls b, districts d, tiers ti,
    LATERAL (
      SELECT count(*) AS cnt,
        COALESCE(jsonb_agg(short_id ORDER BY rn), '[]'::jsonb) AS ids,
        COALESCE(jsonb_agg(lat ORDER BY rn), '[]'::jsonb) AS lats,
        COALESCE(jsonb_agg(lng ORDER BY rn), '[]'::jsonb) AS lngs,
        COALESCE(jsonb_agg(array_position(c.arr, category) - 1 ORDER BY rn), '[]'::jsonb) AS cat_idx,
        COALESCE(jsonb_agg(array_position(b.arr, bundesland) - 1 ORDER BY rn), '[]'::jsonb) AS bl_idx,
        COALESCE(jsonb_agg(array_position(d.arr, district) - 1 ORDER BY rn), '[]'::jsonb) AS district_idx,
        COALESCE(jsonb_agg(array_position(ti.arr, price_tier) - 1 ORDER BY rn), '[]'::jsonb) AS tier_idx,
        COALESCE(jsonb_agg(start_day ORDER BY rn), '[]'::jsonb) AS starts,
        COALESCE(jsonb_agg(end_day ORDER BY rn), '[]'::jsonb) AS ends,
        COALESCE(jsonb_agg(score ORDER BY rn), '[]'::jsonb) AS scores,
        COALESCE(jsonb_agg(flags ORDER BY rn), '[]'::jsonb) AS flagss
      FROM pts
    ) agg
  ), now()
  ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, generated_at = EXCLUDED.generated_at;
$fn$;

notify pgrst, 'reload schema';
