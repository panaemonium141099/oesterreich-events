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
  event_score: number | null;
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
 * bbox-Kandidaten-Pool vs. Rueckgabe-Cap (Review Runden 3+5): der
 * Distanz-Sort + Cap passiert NACH dem haversine-Filter, damit wirklich
 * die naechsten POIs zurueckkommen. Weil supabase-js keine DB-seitige
 * Distanz-Sortierung kann (Micro-Instanz, kein PostGIS-RPC), gilt fuer
 * ueberlaufende Pools ein Shrink-Verfahren (s. fetchActivityCandidates):
 * ist die bbox dichter als der Pool, wird der Radius halbiert und neu
 * geholt — enthaelt der komplette kleinere Kreis >= CAP Treffer, sind
 * die CAP naechsten BEWEISBAR darin enthalten. Nur wenn selbst das
 * scheitert (pathologisch dicht UND leerer Innenkreis), bleibt ein
 * dokumentiertes Best-Effort auf dem Namens-sortierten Pool.
 */
const ACTIVITY_POOL_LIMIT = 200;
const ACTIVITY_RESULT_CAP = 60;
const ACTIVITY_SHRINK_ATTEMPTS = 3;

type ActivityRow = Omit<NearbyActivity, '_distance_km'>;

async function queryActivityBbox(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<ActivityRow[] | null> {
  const { minLat, maxLat, minLng, maxLng } = bboxAround(lat, lng, radiusKm);
  const { data, error } = await getServiceClient()
    .from('poi_activities')
    .select(ACTIVITY_COLUMNS)
    .eq('visible', true)
    .eq('is_closed', false)
    // Duplikate (E11) sind zwar visible=false, aber defensiv trotzdem
    // ausschliessen — ein Rekonsolidierungs-Fenster darf keine Dublette
    // in Hub/Event-Detail spuelen (und keinen Slot im 60er-Cap fressen).
    .is('duplicate_of', null)
    .gte('lat', minLat).lte('lat', maxLat)
    .gte('lng', minLng).lte('lng', maxLng)
    .order('name', { ascending: true })
    .limit(ACTIVITY_POOL_LIMIT);
  if (error || !data) return null;
  return data as ActivityRow[];
}

function toNearby(rows: ActivityRow[], lat: number, lng: number, maxKm: number): NearbyActivity[] {
  return rows
    .map((a) => {
      if (typeof a.lat !== 'number' || typeof a.lng !== 'number') return null;
      const d = haversineKm(lat, lng, a.lat, a.lng);
      if (d > maxKm) return null;
      return { ...a, _distance_km: d };
    })
    .filter((x): x is NearbyActivity => x !== null)
    .sort((a, b) => a._distance_km - b._distance_km);
}

async function fetchActivityCandidates(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<NearbyActivity[]> {
  let fallbackPool: ActivityRow[] | null = null;
  let r = radiusKm;

  for (let attempt = 0; attempt <= ACTIVITY_SHRINK_ATTEMPTS; attempt++) {
    const rows = await queryActivityBbox(lat, lng, r);
    if (rows === null) return []; // Fehler degradiert zu [] (wie Events-Loader der Hub-Seite)

    const poolComplete = rows.length < ACTIVITY_POOL_LIMIT;
    if (poolComplete) {
      if (r === radiusKm) {
        // Normalfall: bbox vollstaendig geladen -> exakt.
        return toNearby(rows, lat, lng, radiusKm).slice(0, ACTIVITY_RESULT_CAP);
      }
      // Geschrumpfter, aber KOMPLETTER Innenkreis: >= CAP Punkte mit
      // Distanz <= r bedeuten, dass die CAP naechsten global alle hier
      // drin liegen (der CAP-te naechste ist <= r entfernt).
      const inner = toNearby(rows, lat, lng, r);
      if (inner.length >= ACTIVITY_RESULT_CAP) {
        return inner.slice(0, ACTIVITY_RESULT_CAP);
      }
      // Innenkreis komplett, aber < CAP (Review Runde 6): das garantierte
      // Innen-Set BEHALTEN und den Ring r..radiusKm best-effort aus dem
      // Original-Pool auffuellen — nie ein bereits gefundenes nahes
      // Ergebnis zugunsten des Namens-sortierten Pools verwerfen.
      const innerIds = new Set(inner.map((a) => a.id));
      const ring = toNearby(fallbackPool ?? [], lat, lng, radiusKm).filter(
        (a) => !innerIds.has(a.id),
      );
      return [...inner, ...ring]
        .sort((a, b) => a._distance_km - b._distance_km)
        .slice(0, ACTIVITY_RESULT_CAP);
    }

    fallbackPool ??= rows;
    r = r / 2;
  }

  // Best-Effort (pathologisch dichte bbox, Pool auch beim kleinsten
  // Radius voll): Namens-sortierter Original-Pool — alle Rueckgaben sind
  // echte Treffer im Radius, nur die "naechste 60"-Garantie entfaellt.
  return toNearby(fallbackPool ?? [], lat, lng, radiusKm).slice(0, ACTIVITY_RESULT_CAP);
}

/**
 * Aktivitaeten im Radius um (lat, lng), nach Distanz aufsteigend (max
 * ACTIVITY_RESULT_CAP). Fehler degradieren zu [] (Sektion faellt weg
 * statt 500 — gleiches Verhalten wie der Events-Loader der Hub-Seite).
 */
export const loadNearbyActivitiesCached = unstable_cache(
  (lat: number, lng: number, radiusKm: number): Promise<NearbyActivity[]> =>
    fetchActivityCandidates(lat, lng, radiusKm),
  ['nearby-activities'],
  { revalidate: 3600, tags: ['activity'] },
);

const EVENT_COLUMNS =
  'id, title, slug, start_date, location_name, address, postal_code, bundesland, ' +
  'latitude, longitude, category, image_url, event_score';

/** bbox-Kandidaten-Pool (Review Runde 4): radius-/Koordinaten-Filter
 *  laeuft NACH dem Fetch — mit zu kleinem Pool koennte die Sektion in
 *  dichten Gegenden leer bleiben, obwohl es Treffer <= 10 km gibt. */
const EVENT_POOL_LIMIT = 60;

/** Der Konsument (NearbyEventsSection) zeigt max. 3 Karten — unter
 *  dieser Schwelle lohnt sich der Backfill-Refetch (Review Runde 6). */
const EVENT_MIN_RESULTS = 3;

type EventRow = Omit<NearbyFutureEvent, '_distance_km'>;

async function queryEventBbox(
  lat: number,
  lng: number,
  bboxRadiusKm: number,
  nowIso: string,
): Promise<EventRow[] | null> {
  const { minLat, maxLat, minLng, maxLng } = bboxAround(lat, lng, bboxRadiusKm);
  const { data, error } = await getServiceClient()
    .from('events')
    .select(EVENT_COLUMNS)
    .gte('start_date', nowIso)
    .eq('publish_status', 'published')
    .eq('visibility', 'public')
    .gte('latitude', minLat).lte('latitude', maxLat)
    .gte('longitude', minLng).lte('longitude', maxLng)
    .order('event_score', { ascending: false, nullsFirst: false })
    .order('start_date', { ascending: true })
    .limit(EVENT_POOL_LIMIT);
  if (error || !data) return null;
  return data as unknown as EventRow[];
}

function toNearbyEvents(rows: EventRow[], lat: number, lng: number, radiusKm: number): NearbyFutureEvent[] {
  return rows
    .map((e) => {
      if (e.latitude == null || e.longitude == null) return null;
      const d = haversineKm(lat, lng, e.latitude, e.longitude);
      if (d > radiusKm) return null;
      return { ...e, _distance_km: d };
    })
    .filter((x): x is NearbyFutureEvent => x !== null);
}

/** Ranking-Komparator == DB-Ordering (score desc nulls-last, Datum asc). */
function byScoreThenDate(a: NearbyFutureEvent, b: NearbyFutureEvent): number {
  const scoreA = a.event_score ?? Number.NEGATIVE_INFINITY;
  const scoreB = b.event_score ?? Number.NEGATIVE_INFINITY;
  if (scoreA !== scoreB) return scoreB - scoreA;
  return a.start_date.localeCompare(b.start_date);
}

/**
 * Kommende Events (NUR future) im Radius um (lat, lng). Cutoff ist der
 * volle Zeitstempel (Review Runde 5): ein heute um 09:00 gestartetes
 * Event ist NICHT "kommend" — Datums-only wuerde es bis Mitternacht
 * durchlassen (gleiches Muster wie V4RelatedEvents). Public-Surface-
 * Guard wie ueberall (visibility='public' — dieser Pfad liest mit
 * SERVICE-ROLE, publish_status allein reicht nicht; Review Runde 4).
 * Ranking wie der Hub-Loader: event_score desc, dann start_date asc —
 * der Konsument sliced auf 3.
 *
 * Backfill (Review Runde 6): fressen High-Score-Events in den bbox-Ecken
 * (ausserhalb des Kreises) den vollen Pool und bleiben < 3 Treffer
 * uebrig, folgt EIN Refetch mit der einbeschriebenen bbox
 * (radius/sqrt(2)) — die liegt vollstaendig IM Kreis, jede Row zaehlt.
 */
export const loadNearbyFutureEventsCached = unstable_cache(
  async (lat: number, lng: number, radiusKm: number): Promise<NearbyFutureEvent[]> => {
    const nowIso = new Date().toISOString();

    const rows = await queryEventBbox(lat, lng, radiusKm, nowIso);
    if (rows === null) return [];

    let result = toNearbyEvents(rows, lat, lng, radiusKm);

    if (result.length < EVENT_MIN_RESULTS && rows.length >= EVENT_POOL_LIMIT) {
      const inscribed = await queryEventBbox(lat, lng, radiusKm / Math.SQRT2, nowIso);
      if (inscribed !== null) {
        const seen = new Set(result.map((e) => e.id));
        result = [
          ...result,
          ...toNearbyEvents(inscribed, lat, lng, radiusKm).filter((e) => !seen.has(e.id)),
        ].sort(byScoreThenDate);
      }
    }

    return result;
  },
  ['activity-nearby-events'],
  { revalidate: 3600, tags: ['event', 'activity'] },
);
