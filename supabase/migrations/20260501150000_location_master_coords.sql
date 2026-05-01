-- Master-Coord-Registry für location_name → verifizierte Koordinate.
--
-- Hintergrund: ~58k Events haben mit der gleichen `location_name` mehrere
-- unterschiedliche Geocodes erhalten (per-Scrape-Drift, Geocoder-Inkonsistenzen,
-- Mehrdeutigkeiten zwischen Gemeinden). Diese Tabelle hält pro
-- (normalisiertem location_name + PLZ) die verifizierte Koord. Ein Trigger
-- auf `events` überschreibt zukünftige Inserts/Updates damit, sodass alle
-- Events mit der gleichen Ortsbezeichnung garantiert auf dem gleichen Fleck
-- erscheinen — egal von welchem Scraper sie kommen.
--
-- Source-Validierung: Nominatim/OSM oder OpenAI mit Austria-Bbox-Check.

CREATE TABLE IF NOT EXISTS public.location_master_coords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name   TEXT NOT NULL,
  location_name_normalized TEXT NOT NULL,
  postal_code     TEXT,
  city            TEXT,
  bundesland      TEXT,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  source          TEXT NOT NULL,         -- 'known_venues' | 'geocode_cache' | 'nominatim' | 'openai' | 'manual'
  confidence      TEXT NOT NULL DEFAULT 'verified', -- 'verified' | 'review' | 'low'
  source_event_count INTEGER,            -- Anzahl Events, die ursprünglich abweichende Coords hatten
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eindeutigkeit über (normalized_name, postal_code). Wo PLZ NULL ist, wird der
-- COALESCE-Trick im Index verwendet (PostgreSQL behandelt NULL in UNIQUE
-- standardmäßig nicht als gleich).
CREATE UNIQUE INDEX IF NOT EXISTS idx_lmc_norm_plz_unique
  ON public.location_master_coords (location_name_normalized, COALESCE(postal_code, ''));

CREATE INDEX IF NOT EXISTS idx_lmc_lookup
  ON public.location_master_coords (location_name_normalized, postal_code)
  WHERE confidence = 'verified';

-- Hilfsfunktion: einfache Normalisierung (lowercase, trim, collapse whitespace).
-- Achtung: muss IMMUTABLE sein, sonst kann sie nicht in Indizes/Triggern
-- effizient genutzt werden. Bewusst minimal — die Skript-seitige Logik in
-- src/lib/location-normalizer.ts macht mehr (Umlaut-Translit etc.), aber für
-- den Trigger reicht der Lower-Case-Abgleich, weil das Skript dieselbe
-- Lookup-Funktion benutzt.
CREATE OR REPLACE FUNCTION public.normalize_location_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  RETURN regexp_replace(lower(trim(name)), '\s+', ' ', 'g');
END;
$$;

-- Trigger: vor INSERT oder UPDATE auf events, prüfe ob für den
-- (location_name, postal_code) ein Master-Coord existiert. Wenn ja, ÜBERSCHREIBE
-- die per-Scrape-Coords. Dadurch landet jedes Event garantiert auf der
-- verifizierten Master-Coord, egal ob via Pipeline oder Direct-Insert.
CREATE OR REPLACE FUNCTION public.apply_master_coords()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  master_lat DOUBLE PRECISION;
  master_lng DOUBLE PRECISION;
  norm_name  TEXT;
BEGIN
  IF NEW.location_name IS NULL OR length(trim(NEW.location_name)) = 0 THEN
    RETURN NEW;
  END IF;

  norm_name := public.normalize_location_name(NEW.location_name);

  -- Versuche zuerst exakter Match auf (norm_name, postal_code), dann auf
  -- (norm_name, NULL postal_code). Nur 'verified' Master-Coords werden
  -- angewendet.
  SELECT latitude, longitude INTO master_lat, master_lng
  FROM public.location_master_coords
  WHERE location_name_normalized = norm_name
    AND COALESCE(postal_code, '') = COALESCE(NEW.postal_code, '')
    AND confidence = 'verified'
  LIMIT 1;

  IF master_lat IS NULL THEN
    SELECT latitude, longitude INTO master_lat, master_lng
    FROM public.location_master_coords
    WHERE location_name_normalized = norm_name
      AND postal_code IS NULL
      AND confidence = 'verified'
    LIMIT 1;
  END IF;

  IF master_lat IS NOT NULL THEN
    NEW.latitude := master_lat;
    NEW.longitude := master_lng;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_master_coords ON public.events;
CREATE TRIGGER trg_apply_master_coords
BEFORE INSERT OR UPDATE OF location_name, postal_code, latitude, longitude ON public.events
FOR EACH ROW EXECUTE FUNCTION public.apply_master_coords();

-- RLS: nur Service-Rolle schreibt; alle authentifizierten Nutzer können lesen
-- (ist Hilfsdaten, kein Userdata).
ALTER TABLE public.location_master_coords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lmc_read_all" ON public.location_master_coords;
CREATE POLICY "lmc_read_all" ON public.location_master_coords
  FOR SELECT USING (true);

-- Service-Rolle umgeht RLS automatisch; keine explizite Write-Policy nötig.

COMMENT ON TABLE public.location_master_coords IS
  'Verifizierte Master-Koordinate pro (location_name, postal_code). Trigger trg_apply_master_coords überschreibt event.lat/lng damit.';
