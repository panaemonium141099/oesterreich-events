-- Backfill: existierende Events auf Master-Coords umsetzen.
-- Voraussetzung: 20260501150000_location_master_coords.sql wurde angewendet,
-- und das Skript src/scripts/fix-duplicate-coords.ts wurde durchgelaufen
-- (location_master_coords ist befüllt).
--
-- Trigger trg_apply_master_coords feuert bei diesem UPDATE und schreibt
-- garantiert die master-Coord (selbst wenn das JOIN-Query schon die richtige
-- Coord liefert — der Trigger-Override ist idempotent).

-- Sanity-Check vor dem UPDATE: zeige wie viele Events betroffen sind
DO $$
DECLARE
  affected INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected
  FROM events e
  WHERE EXISTS (
    SELECT 1 FROM public.location_master_coords m
    WHERE m.location_name_normalized = public.normalize_location_name(e.location_name)
      AND COALESCE(m.postal_code, '') = COALESCE(e.postal_code, '')
      AND m.confidence = 'verified'
  );
  RAISE NOTICE 'Backfill: % events will be updated', affected;
END $$;

UPDATE public.events e
SET
  latitude = m.latitude,
  longitude = m.longitude,
  geocoding_source = 'master_coords',
  geocoding_confidence = 'verified'
FROM public.location_master_coords m
WHERE m.location_name_normalized = public.normalize_location_name(e.location_name)
  AND COALESCE(m.postal_code, '') = COALESCE(e.postal_code, '')
  AND m.confidence = 'verified'
  AND (e.latitude IS DISTINCT FROM m.latitude OR e.longitude IS DISTINCT FROM m.longitude);
