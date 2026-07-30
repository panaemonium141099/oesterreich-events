-- fn-18.7: Sekundaer-Indizes fuer osm_pois — SEPARATE Migration, bewusst NICHT
-- zusammen mit dem Basis-Schema anwenden (gleiches Muster wie
-- 20260724121000_poi_activities_indexes.sql).
--
-- ANWENDUNG: via Supabase-Dashboard/MCP, erst NACH dem Initial-Bulk-Load
-- (`npm run import-osm-pois`). Grund: der Load schreibt ~60-80k Rows in
-- 500er-Batches — Sekundaer-Indizes waehrend des Imports kosten unnoetig
-- Write-Amplification auf der Micro-Instanz.
--
-- OPS-SCHRITT NACH DEM ANWENDEN (dokumentiert, KEIN Script-Schritt —
-- PostgREST/Service-Key kann kein Maintenance-SQL):
--   ANALYZE public.osm_pois;
-- einmalig im Dashboard ausfuehren, danach uebernimmt Autovacuum.
--
-- Der Upsert-Konflikt-Target (osm_type, osm_id) ist bereits als UNIQUE-
-- Constraint im Basis-Schema und muss deshalb VOR dem Load existieren.

-- Anzeige-Pfad: bbox-Nearby der Gemeinde-Hub-Sektion (billige >=/<=-Vergleiche
-- auf lat/lng — Muster wie events/poi_activities, kein PostGIS auf Micro).
create index if not exists osm_pois_lat_idx on public.osm_pois (lat);
create index if not exists osm_pois_lng_idx on public.osm_pois (lng);

-- Direkte Gemeinde-Zuordnung (Auswertung/Reporting, Coverage-Checks).
create index if not exists osm_pois_gemeinde_slug_idx on public.osm_pois (gemeinde_slug);

-- Bundesland-Auswertungen (Import-Report, Abdeckungs-Kontrolle).
create index if not exists osm_pois_bundesland_idx on public.osm_pois (bundesland);

-- Kategorie-Filter/Statistik der kuratierten Whitelist.
create index if not exists osm_pois_category_idx on public.osm_pois (category);
