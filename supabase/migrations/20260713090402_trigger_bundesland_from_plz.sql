-- Dauerhafte Selbstheilung: neue/aktualisierte AT-Events ohne bundesland
-- bekommen es deterministisch aus der PLZ (Mapping wie getBundeslandFromPLZ).
CREATE OR REPLACE FUNCTION set_bundesland_from_plz()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bundesland IS NULL
     AND NEW.postal_code ~ '^\d{4}$'
     AND (NEW.country IS NULL OR NEW.country = 'AT') THEN
    NEW.bundesland := CASE
      WHEN NEW.postal_code LIKE '1%' THEN 'wien'
      WHEN NEW.postal_code LIKE '2%' OR NEW.postal_code LIKE '3%' THEN 'niederoesterreich'
      WHEN NEW.postal_code LIKE '4%' THEN 'oberoesterreich'
      WHEN substring(NEW.postal_code, 1, 2)::int BETWEEN 50 AND 57 THEN 'salzburg'
      WHEN substring(NEW.postal_code, 1, 2)::int BETWEEN 60 AND 66 THEN 'tirol'
      WHEN substring(NEW.postal_code, 1, 2)::int BETWEEN 67 AND 69 THEN 'vorarlberg'
      WHEN substring(NEW.postal_code, 1, 2)::int BETWEEN 70 AND 78 THEN 'burgenland'
      WHEN NEW.postal_code LIKE '8%' THEN 'steiermark'
      WHEN NEW.postal_code LIKE '9%' THEN 'kaernten'
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bundesland_from_plz ON events;
CREATE TRIGGER trg_bundesland_from_plz
  BEFORE INSERT OR UPDATE OF postal_code ON events
  FOR EACH ROW
  EXECUTE FUNCTION set_bundesland_from_plz();
