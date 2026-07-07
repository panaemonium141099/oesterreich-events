-- Stats-Pipeline repariert (Perf-Audit 2026-07-04):
--
-- Problem: event_counts_for_stats() live-scannte bei jedem Aufruf alle future
-- events (~90k Zeilen, mean 3.4s / max 58.6s laut pg_stat_statements) und war
-- eine Hauptquelle der Statement-Timeouts. Gleichzeitig refreshte pg_cron alle
-- 5 min die MV event_stats_cache, die von keinem Code gelesen wurde — und der
-- Refresh schlug fehl, weil ihr Unique-Index ein Expression-Index ((1)) war,
-- den REFRESH CONCURRENTLY nicht akzeptiert ("cannot refresh materialized view
-- concurrently", 8x/24h in den Postgres-Logs).
--
-- Fix:
--   1. MV neu erstellt:
--      - AT-only base (Parität mit 20260616_stats_counts_at_only.sql — die
--        alte MV-Definition stammte von davor und leakte DE/CH-Events)
--      - plain id-Spalte + UNIQUE INDEX darauf, damit REFRESH CONCURRENTLY
--        funktioniert (braucht Unique-Index auf echten Spalten)
--      - dedup_total wieder im Payload (route.ts erwartet es; die
--        20260616-RPC lieferte es nicht mehr -> Feld war immer 0)
--   2. event_counts_for_stats() liest nur noch die MV (Single-Row-Read).
--      Signatur, Volatility und Grants unveraendert — der Caller
--      (src/app/api/stats/counts/route.ts) braucht keine Aenderung.
--
-- Der bestehende pg_cron-Job (alle 5 min REFRESH MATERIALIZED VIEW
-- CONCURRENTLY public.event_stats_cache) bleibt unveraendert und
-- funktioniert mit dem neuen Index.
--
-- Applied to prod via Supabase MCP on 2026-07-04.

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
)
SELECT
  1 AS id,
  jsonb_build_object(
    'regions',     (SELECT COALESCE(jsonb_object_agg(bundesland, c), '{}'::jsonb) FROM region_agg),
    'categories',  (SELECT COALESCE(jsonb_object_agg(category, c), '{}'::jsonb) FROM cat_agg),
    'total',       (SELECT c FROM total_agg),
    'dedup_total', (SELECT c FROM dedup_total_agg)
  ) AS payload,
  now() AS refreshed_at
WITH DATA;

-- Plain-column unique index: Voraussetzung fuer REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX event_stats_cache_id_key ON public.event_stats_cache (id);

-- Nur der SECURITY-DEFINER-RPC (Owner postgres) liest die MV; kein Direktzugriff noetig
REVOKE ALL ON public.event_stats_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_stats_cache TO service_role;

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
