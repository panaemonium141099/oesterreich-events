-- fn-21: Beherbergungs-POIs aus OpenStreetMap für den Abschnitt
-- "Unterkünfte in der Nähe" auf Event-Detailseiten.
--
-- Daten (c) OpenStreetMap contributors, ODbL 1.0 — Import via
-- src/scripts/import-stay-pois.ts (Overpass, ganz Österreich, nur benannte
-- Objekte der tourism-Whitelist). Eigener Bestand, KEIN Join/Merge mit
-- venues/osm_pois/poi_activities (gleiche Begründung wie osm_pois-Migration:
-- saubere ODbL-Abgrenzung, kein Misch-Schreibpfad).
--
-- Zugriff ausschließlich über die RPC nearby_stays() — bbox-vorgefiltert
-- (Index auf lat) und hart limitiert, Micro-Instanz-tauglich.

CREATE TABLE IF NOT EXISTS public.stay_pois (
  osm_id     bigint PRIMARY KEY,
  name       text NOT NULL,
  kind       text NOT NULL,          -- hotel | guest_house | apartment | hostel | alpine_hut | camp_site | chalet | motel
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  city       text,                   -- addr:city aus OSM, für den Booking-Suchstring
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stay_pois_lat_idx ON public.stay_pois (lat, lng);

ALTER TABLE public.stay_pois ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stay_pois_public_read ON public.stay_pois;
CREATE POLICY stay_pois_public_read ON public.stay_pois FOR SELECT USING (true);

GRANT SELECT ON public.stay_pois TO anon, authenticated;
GRANT ALL ON public.stay_pois TO service_role;

-- Nächstgelegene Unterkünfte zu einem Punkt. Planare Näherung reicht für
-- <=20 km Radius völlig (Fehler < 0,5 %); bbox nutzt den (lat,lng)-Index.
CREATE OR REPLACE FUNCTION public.nearby_stays(
  p_lat   double precision,
  p_lng   double precision,
  p_limit integer DEFAULT 4
)
RETURNS TABLE (osm_id bigint, name text, kind text, city text, distance_km double precision)
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT
    s.osm_id,
    s.name,
    s.kind,
    s.city,
    sqrt(
      pow((s.lat - p_lat) * 110.57, 2) +
      pow((s.lng - p_lng) * 111.32 * cos(radians(p_lat)), 2)
    ) AS distance_km
  FROM public.stay_pois s
  WHERE s.lat BETWEEN p_lat - 0.15 AND p_lat + 0.15
    AND s.lng BETWEEN p_lng - 0.22 AND p_lng + 0.22
  ORDER BY
    pow(s.lat - p_lat, 2) + pow((s.lng - p_lng) * cos(radians(p_lat)), 2)
  LIMIT LEAST(GREATEST(p_limit, 1), 10)
$$;

GRANT EXECUTE ON FUNCTION public.nearby_stays TO anon, authenticated, service_role;
