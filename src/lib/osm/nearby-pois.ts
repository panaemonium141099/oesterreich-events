/**
 * Nearby-Loader fuer OSM-Freizeit-POIs (fn-18 Task 7) — einzige Lese-Flaeche
 * des `osm_pois`-Bestands.
 *
 * ── ODbL / strikte Trennung ────────────────────────────────────────────────
 * Dieser Loader liest AUSSCHLIESSLICH `osm_pois`. Er kennt poi_activities
 * nicht, macht keinen Join, keinen Cross-Bestands-Dedup und keine
 * Namens-/Distanz-Abgleiche gegen den eigenen Bestand. Der Gemeinde-Hub
 * rendert beide Listen NEBENEINANDER (je eigene Sektion, je eigene
 * Attribution) — dass dieselbe Einrichtung in beiden auftauchen kann, ist
 * akzeptiert und Teil der ODbL-Strategie (Begruendung im Header von
 * supabase/migrations/20260727090000_osm_pois.sql).
 *
 * Technik: identisches Muster wie src/lib/activities/nearby-loaders.ts —
 * unstable_cache + bbox-Vorfilter (indexierte >=/<=-Vergleiche auf lat/lng)
 * + exakter Haversine-Nachfilter. Service-Role, weil osm_pois keinen
 * anon-Lesepfad hat. Fehler degradieren zu [] (Sektion faellt weg statt 500).
 */

import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { bboxAround, haversineKm } from '@/lib/gemeinden/data';

export interface NearbyOsmPoi {
  id: string;
  name: string;
  category: string;
  town: string | null;
  lat: number;
  lng: number;
  website: string | null;
  _distance_km: number;
}

/** Kandidaten-Pool der bbox-Query; der Haversine-Nachfilter kappt danach. */
const POOL_LIMIT = 300;
/** Maximal zurueckgegebene POIs (die Sektion zeigt eine Teilmenge davon). */
const RESULT_CAP = 60;

const COLUMNS = 'id, name, category, town, lat, lng, website';

type OsmPoiRow = Omit<NearbyOsmPoi, '_distance_km'>;

/** Lazy — kein Modul-Load-Throw, damit tsc/Tests ohne Env laufen. */
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[osm/nearby-pois] NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * OSM-POIs im Radius um (lat, lng), nach Distanz aufsteigend.
 *
 * Anders als beim Aktivitaeten-Loader gibt es hier KEIN Shrink-Verfahren:
 * die Sektion ist eine ergaenzende Uebersicht ohne "die naechsten N"-
 * Garantie, und der Pool ist mit 300 gross genug, dass ein 10-km-Radius in
 * aller Regel vollstaendig geladen wird. Die DB-Sortierung nach `name` haelt
 * das Ergebnis bei vollem Pool wenigstens deterministisch (stabiles ISR-HTML).
 */
async function fetchNearbyOsmPois(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<NearbyOsmPoi[]> {
  const { minLat, maxLat, minLng, maxLng } = bboxAround(lat, lng, radiusKm);
  const { data, error } = await getServiceClient()
    .from('osm_pois')
    .select(COLUMNS)
    .gte('lat', minLat).lte('lat', maxLat)
    .gte('lng', minLng).lte('lng', maxLng)
    .order('name', { ascending: true })
    .limit(POOL_LIMIT);
  if (error || !data) return [];

  return (data as OsmPoiRow[])
    .map((p) => {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return null;
      const d = haversineKm(lat, lng, p.lat, p.lng);
      if (d > radiusKm) return null;
      return { ...p, _distance_km: d };
    })
    .filter((x): x is NearbyOsmPoi => x !== null)
    .sort((a, b) => a._distance_km - b._distance_km)
    .slice(0, RESULT_CAP);
}

export const loadNearbyOsmPoisCached = unstable_cache(
  (lat: number, lng: number, radiusKm: number): Promise<NearbyOsmPoi[]> =>
    fetchNearbyOsmPois(lat, lng, radiusKm),
  ['nearby-osm-pois'],
  { revalidate: 86400, tags: ['osm-poi'] },
);
