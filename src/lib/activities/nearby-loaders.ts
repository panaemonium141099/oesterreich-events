/**
 * Nearby-Loader fuer die fn-18-Cross-Link-Flaechen (Task 4):
 *
 *   - loadNearbyActivitiesCached: Aktivitaeten im Umkreis (Gemeinde-Hub-
 *     Sektion "Freizeit & Ausfluege" + Event-Detail "In der Naehe erleben")
 *   - loadNearbyFutureEventsCached: kommende Events im Umkreis
 *     (Aktivitaets-Detailseite "Events in der Naehe")
 *
 * Muster: loadNearbyEventsCached der Gemeinde-Hub-Seite (gemeinde/
 * [slug]/page.tsx) — unstable_cache + bboxAround-Vorfilter + exakter
 * haversineKm-Nachfilter. Jede Sektion laedt ueber genau EINEN dieser
 * Loader; Page + generateMetadata mit identischen Args treffen denselben
 * Cache-Eintrag (kein doppelter DB-Roundtrip).
 *
 * Liest via SERVICE-ROLE die Basistabelle poi_activities (fn-18.1 hat den
 * anon-SELECT revoked; die Public-View ist auf diesem Server-Pfad nicht
 * noetig). ACHTUNG: weil die Basistabelle direkt gelesen wird, entfaellt
 * der view-seitige Auto-Filter `visible AND NOT is_closed` — BEIDE
 * Bedingungen werden hier manuell gesetzt, sonst erscheinen dauerhaft
 * geschlossene POIs in Hub-Sektion und Event-Cross-Links (fn-18.2
 * importiert geschlossene POIs mit is_closed=true, aber visible=true).
 */

import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { bboxAround, haversineKm } from '@/lib/gemeinden/data';

/** Kartenfaehige Aktivitaets-Teilmenge (Snippet-Cards, keine Attribution noetig). */
export interface NearbyActivity {
  id: string;
  slug: string;
  name: string;
  tags: string[];
  town: string | null;
  lat: number;
  lng: number;
  price_hint: string | null;
  /** Roh-jsonb — NUR ueber renderableImageUrls() lesen (nie validiert). */
  images: unknown;
  _distance_km: number;
}

/** Event-Teilmenge fuer die "Events in der Naehe"-Karten (buildEventUrlV2-faehig). */
export interface NearbyFutureEvent {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  image_url: string | null;
  _distance_km: number;
}

/**
 * Lazy — kein Modul-Load-Throw, damit tsc/Tests ohne Env funktionieren
 * (gleiches Muster wie activity-detail-loaders.ts).
 */
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[nearby-loaders] NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const ACTIVITY_COLUMNS = 'id, slug, name, tags, town, lat, lng, price_hint, images';

/**
 * Aktivitaeten im Radius um (lat, lng), nach Distanz aufsteigend.
 * Fehler degradieren zu [] (Sektion faellt weg statt 500 — gleiches
 * Verhalten wie der Events-Loader der Hub-Seite).
 */
export const loadNearbyActivitiesCached = unstable_cache(
  async (lat: number, lng: number, radiusKm: number): Promise<NearbyActivity[]> => {
    const { minLat, maxLat, minLng, maxLng } = bboxAround(lat, lng, radiusKm);

    const { data, error } = await getServiceClient()
      .from('poi_activities')
      .select(ACTIVITY_COLUMNS)
      .eq('visible', true)
      .eq('is_closed', false)
      .gte('lat', minLat).lte('lat', maxLat)
      .gte('lng', minLng).lte('lng', maxLng)
      .order('name', { ascending: true })
      .limit(60);

    if (error || !data) return [];

    return (data as Array<Omit<NearbyActivity, '_distance_km'>>)
      .map((a) => {
        if (typeof a.lat !== 'number' || typeof a.lng !== 'number') return null;
        const d = haversineKm(lat, lng, a.lat, a.lng);
        if (d > radiusKm) return null;
        return { ...a, _distance_km: d };
      })
      .filter((x): x is NearbyActivity => x !== null)
      .sort((a, b) => a._distance_km - b._distance_km);
  },
  ['nearby-activities'],
  { revalidate: 3600, tags: ['activity'] },
);

const EVENT_COLUMNS =
  'id, title, slug, start_date, location_name, address, postal_code, bundesland, ' +
  'latitude, longitude, category, image_url';

/**
 * Kommende Events (NUR future, start_date >= heute) im Radius um
 * (lat, lng). Ranking wie der Hub-Loader: event_score desc, dann
 * start_date asc — der Konsument sliced auf 3.
 */
export const loadNearbyFutureEventsCached = unstable_cache(
  async (lat: number, lng: number, radiusKm: number): Promise<NearbyFutureEvent[]> => {
    const { minLat, maxLat, minLng, maxLng } = bboxAround(lat, lng, radiusKm);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await getServiceClient()
      .from('events')
      .select(EVENT_COLUMNS)
      .gte('start_date', today)
      .eq('publish_status', 'published')
      .gte('latitude', minLat).lte('latitude', maxLat)
      .gte('longitude', minLng).lte('longitude', maxLng)
      .order('event_score', { ascending: false, nullsFirst: false })
      .order('start_date', { ascending: true })
      .limit(30);

    if (error || !data) return [];

    return (data as unknown as Array<Omit<NearbyFutureEvent, '_distance_km'>>)
      .map((e) => {
        if (e.latitude == null || e.longitude == null) return null;
        const d = haversineKm(lat, lng, e.latitude, e.longitude);
        if (d > radiusKm) return null;
        return { ...e, _distance_km: d };
      })
      .filter((x): x is NearbyFutureEvent => x !== null);
  },
  ['activity-nearby-events'],
  { revalidate: 3600, tags: ['event', 'activity'] },
);
