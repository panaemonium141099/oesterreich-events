-- fn-31.7: Indizes auf die Regionsschlüssel (Spalten aus 20261114170000,
-- Backfill DE am 14.11.2026: 218.340 von 227.976 Zeilen mit gemeinde_key).
--
-- lasstreffen.de filtert nach Land, Kreis und Gemeinde über diese Spalten.
-- Wie bei den Länder-Indizes aus 20261112160000 nur veröffentlichte Zeilen
-- (gleiches Prädikat, damit dieselben Abfragen sie nutzen), das Datum als
-- zweite Spalte für „kommend, sortiert“.
-- Das Land (`country`) steckt in den Schlüsseln: eine Land-ID, ein
-- Kreisschlüssel und ein Gemeindeschlüssel gehören zu genau einem Staat.
--
-- CONCURRENTLY: nicht in einer Transaktion ausführen, jede Anweisung einzeln.
-- Schlägt eine fehl, bleibt ein ungültiger Index stehen (pg_index.indisvalid);
-- dann DROP INDEX und neu anlegen.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>

SET statement_timeout = '15min';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_region_start_published
  ON public.events (region_id, start_date)
  WHERE publish_status IN ('published', 'published_low_confidence') AND region_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_kreis_start_published
  ON public.events (kreis_key, start_date)
  WHERE publish_status IN ('published', 'published_low_confidence') AND kreis_key IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_gemeinde_start_published
  ON public.events (gemeinde_key, start_date)
  WHERE publish_status IN ('published', 'published_low_confidence') AND gemeinde_key IS NOT NULL;

VACUUM (ANALYZE) public.events;
