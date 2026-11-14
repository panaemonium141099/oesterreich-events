-- fn-31.8: Statistik-Cache je Land.
--
-- `event_stats_cache` zählte fest Österreich. lasstreffen.de zeigte deshalb
-- auf der Karte und im Kopf der Startseite die österreichische Event-Zahl
-- (14.11.2026: „78.635 Events · Deutschland“).
--
-- Die MV führt jetzt je Land eine Zeile (AT, DE), mit denselben Feldern und
-- derselben Zählweise wie bisher. Zwei Dinge sind je Land verschieden:
--   Region        `bundesland` (AT) bzw. `region_id` (DE)
--   Plausi-Box    der grobe Rahmen des Landes für `total`/`dedup_total`
--                 (AT wie bisher 46,3–49,1 / 9,5–17,2; DE 47,2–55,1 / 5,8–15,1,
--                 dieselben Werte wie in src/lib/location/ortsdaten.ts)
--
-- `event_counts_for_stats(p_country default 'AT')`: der Aufruf ohne Parameter
-- liefert weiter Österreich. pg_cron Job 1 (REFRESH … CONCURRENTLY alle
-- 30 min) bleibt unverändert; der eindeutige Index liegt jetzt auf `country`.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase), nicht um Minute :00 oder :30:
--   docker compose exec -T db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < <datei>

SET statement_timeout = '5min';
SET lock_timeout = '10s';

BEGIN;

DROP FUNCTION IF EXISTS public.event_counts_for_stats();
DROP MATERIALIZED VIEW IF EXISTS public.event_stats_cache;

CREATE MATERIALIZED VIEW public.event_stats_cache AS
WITH boxes(country, lat_min, lat_max, lng_min, lng_max) AS (
  VALUES ('AT', 46.3, 49.1, 9.5, 17.2),
         ('DE', 47.2, 55.1, 5.8, 15.1)
),
base AS (
  SELECT country, COALESCE(bundesland, region_id) AS region, category,
         latitude, longitude, publish_status, title, start_date
  FROM public.events
  WHERE visibility = 'public'
    AND country IN ('AT', 'DE')
    AND start_date >= now()::date
),
in_box AS (
  SELECT b.*
  FROM base b
  JOIN boxes x ON x.country = b.country
  WHERE b.publish_status IN ('published', 'published_low_confidence')
    AND b.latitude BETWEEN x.lat_min AND x.lat_max
    AND b.longitude BETWEEN x.lng_min AND x.lng_max
),
region_agg AS (
  SELECT country, region, count(*)::bigint AS c
  FROM base WHERE region IS NOT NULL
  GROUP BY country, region
),
cat_agg AS (
  SELECT country, category, count(*)::bigint AS c
  FROM base WHERE category IS NOT NULL
  GROUP BY country, category
),
total_agg AS (
  SELECT country, count(*)::bigint AS c FROM in_box GROUP BY country
),
dedup_total_agg AS (
  SELECT country, count(*)::bigint AS c
  FROM (
    SELECT country
    FROM in_box
    WHERE title IS NOT NULL
    GROUP BY country, lower(trim(title)), start_date::date
  ) g
  GROUP BY country
),
country_total_agg AS (
  -- Startseite: nur published, nur kommende Events ab jetzt (nicht ab
  -- Tagesbeginn wie `total`).
  SELECT country, count(*)::bigint AS c
  FROM base
  WHERE publish_status = 'published' AND start_date >= now()
  GROUP BY country
)
SELECT
  x.country,
  jsonb_build_object(
    'regions',       (SELECT COALESCE(jsonb_object_agg(region, c), '{}'::jsonb) FROM region_agg r WHERE r.country = x.country),
    'categories',    (SELECT COALESCE(jsonb_object_agg(category, c), '{}'::jsonb) FROM cat_agg k WHERE k.country = x.country),
    'total',         (SELECT c FROM total_agg t WHERE t.country = x.country),
    'dedup_total',   (SELECT c FROM dedup_total_agg d WHERE d.country = x.country),
    'country_total', (SELECT c FROM country_total_agg n WHERE n.country = x.country)
  ) AS payload,
  now() AS refreshed_at
FROM boxes x
WITH DATA;

CREATE UNIQUE INDEX event_stats_cache_country_key ON public.event_stats_cache (country);
REVOKE ALL ON public.event_stats_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_stats_cache TO service_role;

-- Neue Signatur: die alte Funktion ist oben entfernt, sonst wäre der Aufruf
-- ohne Parameter mehrdeutig. Nur lesend, SECURITY DEFINER wie bisher (die MV
-- ist für anon nicht lesbar).
CREATE FUNCTION public.event_counts_for_stats(p_country text DEFAULT 'AT')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payload FROM public.event_stats_cache WHERE country = p_country;
$$;

REVOKE ALL ON FUNCTION public.event_counts_for_stats(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_counts_for_stats(text) TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

SELECT country, payload ->> 'total' AS total, payload ->> 'dedup_total' AS dedup_total,
       payload ->> 'country_total' AS country_total, refreshed_at
FROM public.event_stats_cache ORDER BY country;
