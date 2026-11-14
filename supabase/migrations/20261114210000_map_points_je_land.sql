-- fn-31.8: Karten-Snapshot je Land.
--
-- Bisher filterte die MV `event_map_points` fest auf Österreich und es gab
-- genau ein Payload. lasstreffen.de braucht dieselbe Karte für Deutschland.
--
--   event_map_points            führt AT und DE, mit `country`; die Region
--                               ist `bundesland` (AT) bzw. `region_id` (DE),
--                               unter demselben Spaltennamen wie bisher.
--   event_map_points_payload    je Land eine Zeile (Schlüssel `country`).
--   rebuild_event_map_points_payload(p_country)   baut das Payload eines Landes;
--   rebuild_event_map_points_payload()            baut alle (pg_cron Job 6 ruft
--                                                 weiter diese Form, unverändert).
--   get_event_map_points(p_country default 'AT')  liest die Zeile des Landes.
--
-- Für lasstreffen.at ändert sich nichts: der Aufruf ohne Parameter liefert
-- weiter das österreichische Payload, Format v2 unverändert.
--
-- Ablauf in zwei Transaktionen, damit die Payload-Tabelle nie lange gesperrt
-- ist: (1) MV neu, (2) Tabelle und Funktionen. Danach die Payloads bauen.
-- Nicht um Minute :05 ausführen (Job 6 refresht dann die MV).
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < <datei>

SET statement_timeout = '15min';
SET lock_timeout = '10s';

-- ── (1) MV mit Land ─────────────────────────────────────────────────────
BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.event_map_points;
CREATE MATERIALIZED VIEW public.event_map_points AS
SELECT
  id,
  country,
  latitude,
  longitude,
  category,
  start_date,
  end_date,
  -- Region der Seite: Bundesland-ID bzw. Land-ID. Für DE ist `bundesland`
  -- leer (CHECK auf die neun österreichischen IDs), dort gilt `region_id`.
  COALESCE(bundesland, region_id) AS bundesland,
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
  AND country IN ('AT', 'DE')
  AND publish_status IN ('published', 'published_low_confidence')
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL
  -- Europe/Vienna und Europe/Berlin haben dieselben Regeln.
  AND start_date >= ((now() AT TIME ZONE 'Europe/Vienna')::date)::timestamp AT TIME ZONE 'Europe/Vienna'
WITH DATA;

CREATE UNIQUE INDEX event_map_points_id_key ON public.event_map_points (id);
CREATE INDEX event_map_points_country_idx ON public.event_map_points (country);
REVOKE ALL ON public.event_map_points FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_map_points TO service_role;

-- Bis Teil (2) steht, darf die alte Funktion kein gemischtes Payload bauen.
CREATE OR REPLACE FUNCTION public.rebuild_event_map_points_payload()
RETURNS void LANGUAGE sql AS $fn$ SELECT 1 $fn$;

COMMIT;

-- ── (2) Payload je Land, Funktionen ─────────────────────────────────────
BEGIN;

ALTER TABLE public.event_map_points_payload DROP CONSTRAINT IF EXISTS event_map_points_payload_id_check;
ALTER TABLE public.event_map_points_payload ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'AT';
ALTER TABLE public.event_map_points_payload DROP CONSTRAINT IF EXISTS event_map_points_payload_pkey;
ALTER TABLE public.event_map_points_payload ADD PRIMARY KEY (country);
ALTER TABLE public.event_map_points_payload ALTER COLUMN id DROP NOT NULL;
ALTER TABLE public.event_map_points_payload ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.event_map_points_payload ALTER COLUMN country DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.rebuild_event_map_points_payload(p_country text)
RETURNS void LANGUAGE sql AS $fn$
  INSERT INTO public.event_map_points_payload (country, payload, generated_at)
  SELECT p_country, (
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
        ((start_date AT TIME ZONE 'Europe/Vienna')::date - DATE '2026-01-01') AS start_day,
        COALESCE((
          (CASE WHEN extract(hour FROM end_date AT TIME ZONE 'UTC') >= 23
                THEN end_date - interval '4 hours' ELSE end_date END
          ) AT TIME ZONE 'Europe/Vienna')::date - DATE '2026-01-01', 0) AS end_day,
        COALESCE(event_score, 0)::int AS score,
        (CASE WHEN is_boosted THEN 1 ELSE 0 END)
          + (CASE WHEN is_student_friendly THEN 2 ELSE 0 END)
          + (CASE WHEN is_family_friendly THEN 4 ELSE 0 END)
          + (CASE WHEN price_tier = 'gratis'
                   OR price_text ~* '(gratis|kostenlos|frei(er)? eintritt|free)'
              THEN 8 ELSE 0 END)
          + (CASE WHEN pin_allowed THEN 0 ELSE 16 END) AS flags
      FROM public.event_map_points
      WHERE country = p_country
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
  ON CONFLICT (country) DO UPDATE SET payload = EXCLUDED.payload, generated_at = EXCLUDED.generated_at;
$fn$;

-- Alle Länder der MV. pg_cron Job 6 ruft diese Form nach jedem Refresh.
CREATE OR REPLACE FUNCTION public.rebuild_event_map_points_payload()
RETURNS void LANGUAGE sql AS $fn$
  SELECT public.rebuild_event_map_points_payload('AT');
  SELECT public.rebuild_event_map_points_payload('DE');
$fn$;

-- Neue Signatur: die alte Funktion entfernen, sonst wäre der Aufruf ohne
-- Parameter mehrdeutig (PGRST203).
DROP FUNCTION IF EXISTS public.get_event_map_points();
CREATE FUNCTION public.get_event_map_points(p_country text DEFAULT 'AT')
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT payload FROM public.event_map_points_payload WHERE country = p_country;
$fn$;

-- Rechte ausdrücklich (Default-Privileges seit 2026-10-08: neu angelegte
-- Funktionen sind nicht öffentlich).
REVOKE ALL ON FUNCTION public.get_event_map_points(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_map_points(text) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rebuild_event_map_points_payload(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_event_map_points_payload(text) TO service_role;
REVOKE ALL ON FUNCTION public.rebuild_event_map_points_payload() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_event_map_points_payload() TO service_role;

COMMIT;

-- ── (3) Payloads bauen ──────────────────────────────────────────────────
SELECT public.rebuild_event_map_points_payload('AT');
SELECT public.rebuild_event_map_points_payload('DE');

NOTIFY pgrst, 'reload schema';

SELECT country, (payload ->> 'n')::int AS punkte, pg_size_pretty(octet_length(payload::text)::bigint) AS groesse, generated_at
FROM public.event_map_points_payload ORDER BY country;
