-- fn-24: Master-Koordinaten dürfen keine Ortsidentität erfinden.
--
-- BEFUND (Audit 2026-09-06, §2B/§2D, gegen Prod verifiziert)
-- ─────────────────────────────────────────────────────────────────────
-- `trg_apply_master_coords` überschreibt bei JEDEM INSERT/UPDATE die
-- Event-Koordinaten mit einer Master-Koordinate, die über den
-- normalisierten Ortsnamen gefunden wird. Zwei Fehler darin:
--
-- 1. NAMENSGLEICHHEIT IST KEINE ORTSIDENTITÄT.
--    Findet der exakte Treffer auf (Name, PLZ) nichts, greift ein
--    Fallback auf (Name, postal_code IS NULL) — und der trifft
--    unabhängig davon, ob das EVENT eine PLZ hat. Ein Event in Graz
--    mit PLZ 8010 und location_name 'Hauptplatz' bekam damit die
--    Koordinate irgendeines anderen 'Hauptplatz' in Österreich.
--
--    Gemessen: 515 der 6.040 'verified'-Master haben postal_code IS NULL,
--    darunter generische Namen wie 'großer saal', 'dornerplatz',
--    'chelsea' — und ein Eintrag für den Ortsnamen 'österreich'
--    (→ 48.3069/14.2858, Linz). Über diesen Eintrag bekam jedes Event,
--    dessen Scraper den Ortsnamen mit "Österreich" aufgefüllt hatte,
--    einen Linzer Kartenpin — inklusive der US-Meetups
--    ("Dumpling Fest Des Moines" lag auf Linz).
--
-- 2. MANUELLE KORREKTUREN WURDEN ÜBERSCHRIEBEN.
--    Der Trigger prüfte `geocoding_confidence` nicht. Eine per Hand
--    gesetzte Koordinate ('manual') und die Mapbox-verifizierten
--    Gemeinde-Zentroide ('gemeinde-registry') — beide Rang 0 im
--    Confidence-Modell von supabase-sync.ts — wurden beim nächsten
--    Scrape stillschweigend auf den Master zurückgesetzt.
--
-- ÄNDERUNG
-- ─────────────────────────────────────────────────────────────────────
-- a) Der PLZ-lose Fallback greift nur noch, wenn das Event selbst
--    keine PLZ hat. Ein Event MIT PLZ bekommt entweder den exakten
--    (Name, PLZ)-Master oder gar keinen.
-- b) Gesperrte Herkünfte ('manual', 'gemeinde-registry') werden nie
--    überschrieben.
-- c) Platzhalter-Namen werden aus der Master-Tabelle entfernt: sie
--    benennen keinen Ort und können deshalb keinen Master haben.

-- ── a) + b): Trigger-Funktion ────────────────────────────────────────
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

  -- Gesperrte Herkunft: hand-korrigiert oder Mapbox-verifizierter
  -- Gemeinde-Zentroid. Der Master hat hier nichts zu suchen.
  IF NEW.geocoding_confidence IN ('manual', 'gemeinde-registry') THEN
    RETURN NEW;
  END IF;

  norm_name := public.normalize_location_name(NEW.location_name);

  -- Exakter Treffer auf (Name, PLZ). Das ist der einzige Pfad, der für
  -- ein Event MIT PLZ zulässig ist.
  SELECT latitude, longitude INTO master_lat, master_lng
  FROM public.location_master_coords
  WHERE location_name_normalized = norm_name
    AND COALESCE(postal_code, '') = COALESCE(NEW.postal_code, '')
    AND confidence = 'verified'
  LIMIT 1;

  -- Namensbasierter Fallback NUR für Events ohne eigene PLZ. Vorher lief
  -- dieser Zweig auch für Events mit PLZ und trug damit die Koordinate
  -- eines gleichnamigen Ortes aus einer anderen Gemeinde ein.
  IF master_lat IS NULL AND NEW.postal_code IS NULL THEN
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

COMMENT ON FUNCTION public.apply_master_coords() IS
  'Setzt verifizierte Master-Koordinaten auf events. Respektiert die Sperren manual/gemeinde-registry; der PLZ-lose Namensfallback greift nur für Events ohne eigene PLZ (sonst wandert eine Koordinate über Gemeindegrenzen).';

-- ── c) Platzhalter-Master entfernen ──────────────────────────────────
-- Diese "Ortsnamen" benennen keinen Ort. Ein Master darauf verteilt eine
-- einzige Koordinate über beliebig viele unzusammenhängende Events.
DELETE FROM public.location_master_coords
WHERE location_name_normalized IN (
  'osterreich', 'oesterreich', 'österreich', 'austria',
  'deutschland', 'germany', 'schweiz', 'switzerland',
  'online', 'online event', 'onlineevent', 'virtuell', 'virtual', 'webinar',
  'tba', 'tbd', 'unbekannt', 'unknown', 'diverse', 'keine angabe',
  'verschiedene orte', 'diverse orte', 'wird bekanntgegeben',
  '-', '--', '?'
);
