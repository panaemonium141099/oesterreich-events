-- Vorberechnetes map-points-Payload (Befund 2026-08-26, Prod-Incident).
--
-- /api/events/map-points (und damit /map) lief auf HTTP 500: die RPC
-- get_event_map_points baute das columnar jsonb bei JEDEM Aufruf neu und
-- scannte dabei die pts-CTE ~14-mal (ein Subselect pro Spalten-Array).
-- Bei fn-16 mit ~45k MV-Zeilen ging sich das unterm 8-s-anon-Timeout
-- aus; inzwischen haelt die MV 74,7k Zeilen (fn-18-Wachstum), und unter
-- I/O-Last (Google crawlt seit dem Sitemap-Fix ~8x mehr URLs) kippt
-- jeder Aufruf in den Timeout. Gemessen waehrend des Incidents: selbst
-- ein nackter Seq-Scan der MV (1.8k Buffer) brauchte 81 s.
--
-- Fix: das Payload wird EINMAL pro MV-Refresh vorberechnet und in
-- event_map_points_payload (Single-Row-Tabelle) abgelegt. Die RPC
-- liest nur noch diese eine Zeile -> Millisekunden, immun gegen
-- I/O-Stuerme. Der Builder laeuft im pg_cron-Job direkt nach dem
-- REFRESH (Job 4, 15-min-Timeout, ausserhalb jedes Request-Pfads)
-- und nutzt einen Single-Scan (LATERAL mit allen jsonb_aggs) statt
-- der 14 CTE-Scans.
--
-- API/Client bleiben unveraendert: gleiche RPC-Signatur, gleiches
-- v2-Payload-Format (src/lib/v4/map-points.ts).

CREATE TABLE IF NOT EXISTS public.event_map_points_payload (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

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
              THEN 8 ELSE 0 END) AS flags
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

-- RPC auf Read-Only umstellen — ERST nachdem der Builder einmal gelaufen
-- ist (auf Prod via Bootstrap-Cron erledigt, dann diese Ersetzung):
CREATE OR REPLACE FUNCTION public.get_event_map_points()
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT payload FROM public.event_map_points_payload WHERE id = 1;
$fn$;

-- pg_cron Job 4 (refresh_event_map_points) haengt den Rebuild an den
-- MV-Refresh (auf Prod via cron.alter_job gesetzt):
--   SET statement_timeout = '15min';
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.event_map_points;
--   SELECT public.rebuild_event_map_points_payload();
