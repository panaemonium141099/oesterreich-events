-- RPC: bulk-apply Master-Coords auf Events innerhalb eines Datumsbereichs.
-- Wird vom Pipeline-Skript src/scripts/fix-duplicate-coords.ts in seiner finalen
-- Phase aufgerufen. Date-Range-Splitting hält jeden Aufruf unter dem
-- statement_timeout (60s default).
--
-- Logik:
--  - JOIN events ↔ location_master_coords über
--      a) m.location_name_normalized = simpel-norm(e.location_name), oder
--      b) simpel-norm(m.location_name) = simpel-norm(e.location_name)
--    (gleiche OR-Fallback-Logik wie der Trigger)
--  - Filter: live + nicht duplicate + (published|public|null) + lat/lng vorhanden
--  - Date-Range: NOW + days_from … NOW + days_to
--  - Skip wenn lat/lng schon gleich dem Master ist
--
-- Returns: Anzahl aktualisierter Zeilen.

CREATE OR REPLACE FUNCTION public.apply_master_coords_bulk(
  days_from INTEGER DEFAULT 0,
  days_to   INTEGER DEFAULT 1825
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET statement_timeout = '300s'
AS $func$
DECLARE
  affected INTEGER;
BEGIN
  WITH to_update AS (
    SELECT e.id, m.latitude AS new_lat, m.longitude AS new_lng
    FROM public.events e
    JOIN public.location_master_coords m
      ON (
        m.location_name_normalized = regexp_replace(lower(trim(e.location_name)), '\s+', ' ', 'g')
        OR regexp_replace(lower(trim(m.location_name)), '\s+', ' ', 'g')
           = regexp_replace(lower(trim(e.location_name)), '\s+', ' ', 'g')
      )
     AND COALESCE(m.postal_code, '') = COALESCE(e.postal_code, '')
     AND m.confidence = 'verified'
    WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL
      AND e.start_date >= NOW() + (days_from || ' days')::interval
      AND e.start_date <  NOW() + (days_to   || ' days')::interval
      AND e.duplicate_of IS NULL
      AND (e.publish_status IS NULL OR e.publish_status IN ('published','public'))
      AND e.location_name IS NOT NULL AND TRIM(e.location_name) <> ''
      AND (e.latitude != m.latitude OR e.longitude != m.longitude)
  )
  UPDATE public.events e
  SET latitude = u.new_lat,
      longitude = u.new_lng,
      geocoding_source = 'master_coords',
      geocoding_confidence = 'verified'
  FROM to_update u
  WHERE e.id = u.id;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.apply_master_coords_bulk(INTEGER, INTEGER) TO service_role;
