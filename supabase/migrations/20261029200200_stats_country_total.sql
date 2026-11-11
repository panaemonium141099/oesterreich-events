-- event_stats_cache: Feld country_total für die Event-Zahl der Startseite (fn-30).
--
-- `total` zählt eine Bounding-Box (46.3..49.1 / 9.5..17.2) und damit auch
-- Südtirol und Bayern mit; die Kopfzeile der Tagesausgabe („über 88.000
-- Events“) braucht die Zahl nur für Österreich: publish_status = 'published',
-- start_date >= now(), country = 'AT'. Die übrigen Felder (regions,
-- categories, total, dedup_total) bleiben unverändert, /api/stats/counts
-- liest weiter dieselben Schlüssel.
--
-- Eine MV lässt sich nicht per ALTER umdefinieren, deshalb DROP + CREATE wie
-- in 20260704_stats_counts_read_mv.sql. Die RPC event_counts_for_stats()
-- (LANGUAGE sql, liest `payload` der Zeile id = 1) hat keine
-- Katalog-Abhängigkeit auf die MV und liefert das neue Feld automatisch mit;
-- sie wird hier nur neu angelegt, damit Definition und Rechte an einer Stelle
-- stehen (CREATE OR REPLACE behält bestehende Rechte, REVOKE/GRANT stellen
-- den Sollzustand aus 20261008130000 ausdrücklich her).
--
-- Der pg_cron-Job (REFRESH MATERIALIZED VIEW CONCURRENTLY
-- public.event_stats_cache, alle 30 min) bleibt unverändert; der Unique-Index
-- auf der echten Spalte id wird neu angelegt, sonst scheitert CONCURRENTLY.
--
-- Ops (Pflicht nach dem Ausführen im Dashboard/MCP):
--   NOTIFY pgrst, 'reload schema';
-- Laufzeit: ein Heap-Pass über die kommenden AT-Events (WITH DATA), wie der
-- nächtliche Refresh; nicht über PostgREST ausführen (Statement-Timeout).

DROP MATERIALIZED VIEW IF EXISTS public.event_stats_cache;

CREATE MATERIALIZED VIEW public.event_stats_cache AS
WITH base AS (
  SELECT bundesland, category, latitude, longitude, publish_status, title, start_date
  FROM public.events
  WHERE visibility = 'public'
    AND country = 'AT'
    AND start_date >= now()::date
),
region_agg AS (
  SELECT bundesland, count(*)::bigint AS c
  FROM base
  WHERE bundesland IS NOT NULL
  GROUP BY bundesland
),
cat_agg AS (
  SELECT category, count(*)::bigint AS c
  FROM base
  WHERE category IS NOT NULL
  GROUP BY category
),
total_agg AS (
  SELECT count(*)::bigint AS c
  FROM base
  WHERE publish_status IN ('published', 'published_low_confidence')
    AND latitude BETWEEN 46.3 AND 49.1
    AND longitude BETWEEN 9.5 AND 17.2
),
dedup_total_agg AS (
  SELECT count(*)::bigint AS c
  FROM (
    SELECT 1
    FROM base
    WHERE publish_status IN ('published', 'published_low_confidence')
      AND latitude BETWEEN 46.3 AND 49.1
      AND longitude BETWEEN 9.5 AND 17.2
      AND title IS NOT NULL
    GROUP BY lower(trim(title)), start_date::date
  ) g
),
country_total_agg AS (
  -- Startseite: nur Österreich (base filtert country = 'AT'), nur published,
  -- nur kommende Events ab jetzt (nicht ab Tagesbeginn wie `total`).
  SELECT count(*)::bigint AS c
  FROM base
  WHERE publish_status = 'published'
    AND start_date >= now()
)
SELECT
  1 AS id,
  jsonb_build_object(
    'regions',       (SELECT COALESCE(jsonb_object_agg(bundesland, c), '{}'::jsonb) FROM region_agg),
    'categories',    (SELECT COALESCE(jsonb_object_agg(category, c), '{}'::jsonb) FROM cat_agg),
    'total',         (SELECT c FROM total_agg),
    'dedup_total',   (SELECT c FROM dedup_total_agg),
    'country_total', (SELECT c FROM country_total_agg)
  ) AS payload,
  now() AS refreshed_at
WITH DATA;

-- Plain-column unique index: Voraussetzung fuer REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX event_stats_cache_id_key ON public.event_stats_cache (id);

-- Nur der SECURITY-DEFINER-RPC (Owner postgres) liest die MV; kein Direktzugriff noetig
REVOKE ALL ON public.event_stats_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_stats_cache TO service_role;

-- Unverändert: Single-Row-Read der MV, read-only, bewusst öffentlich
-- (docs/ops/funktionsrechte-prod-stand-2026-10-08.md).
CREATE OR REPLACE FUNCTION public.event_counts_for_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payload FROM public.event_stats_cache WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.event_counts_for_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_counts_for_stats() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
