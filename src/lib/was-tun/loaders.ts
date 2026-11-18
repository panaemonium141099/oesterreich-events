/**
 * Datenabfragen der Seiten „Was kann man in X machen?" (/was-tun/[slug]).
 *
 * Die Seite zeigt den GANZEN Bestand ihres Orts: je Art eine erste Seite mit
 * Gesamtzahl, der Rest lädt über /api/events bzw. /api/activities nach.
 * Damit erste Seite und Nachladen dieselbe Menge meinen, filtert und
 * sortiert jede Abfrage hier exakt wie die jeweilige API:
 *
 *   Events      sichtbar, veröffentlicht (auch low_confidence), ab heute,
 *               Land der Seite, mit Koordinaten; Reihenfolge start_date, id
 *   Aktivitäten visible, nicht geschlossen; Reihenfolge quality_score, id
 *
 * Der Ort ist entweder die Bundesland-Spalte oder ein Rechteck um den
 * Mittelpunkt (`scopeParams`: derselbe Parameter geht an die API).
 *
 * Fehler degradieren zu leeren Listen: die Seite fällt dann unter die
 * Index-Schwelle statt mit 500 zu antworten.
 */

import { unstable_cache } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { bboxAround } from '@/lib/gemeinden/data';
import { encodeActivityCursor } from '@/lib/activities/cursor';
import { loadNearbyOsmPoisCached, type NearbyOsmPoi } from '@/lib/osm/nearby-pois';
import { SITE_COUNTRY } from '@/lib/site-country';
import type { WasTunActivity, WasTunEvent } from './content';
import type { WasTunPlace } from './places';

/** Größe der ersten Seite je Art. */
export const EVENTS_FIRST_PAGE = 40;
export const ACTIVITIES_FIRST_PAGE = 20;
/** Kandidaten der Regale (nach Score), wie auf den Event-Übersichten. */
const SHELF_POOL = 60;

/** Lazy, damit tsc und Tests ohne Env laufen. */
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[was-tun] NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Der Ort als API-Parameter: `{ bundesland }` oder `{ bbox: 'süd,west,nord,ost' }`.
 * Pur; die Seite reicht ihn an die Nachlade-Komponenten weiter.
 */
export function scopeParams(place: WasTunPlace): Record<string, string> {
  if (!place.center) return { bundesland: place.bundeslandId };
  const { minLat, maxLat, minLng, maxLng } = bboxAround(place.center.lat, place.center.lng, place.center.radiusKm);
  const r = (n: number) => n.toFixed(5);
  return { bbox: [r(minLat), r(minLng), r(maxLat), r(maxLng)].join(',') };
}

const EVENT_COLUMNS =
  'id, title, slug, start_date, end_date, location_name, address, postal_code, bundesland, district, ' +
  'latitude, longitude, category, tags, image_url, image_width, source_id, price_text, price_min, price_max, event_score';

/** Basisfilter der Liste, identisch zu /api/events. */
function eventsInScope(scopeKey: string, select: string, count: boolean) {
  const today = new Date().toISOString().slice(0, 10);
  let query = getServiceClient()
    .from('events')
    .select(select, count ? { count: 'exact' } : undefined)
    .eq('visibility', 'public')
    .in('publish_status', ['published', 'published_low_confidence'])
    .gte('start_date', today)
    .eq('country', SITE_COUNTRY)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  const [kind, value] = scopeKey.split('=');
  if (kind === 'bundesland') {
    query = query.eq('bundesland', value);
  } else {
    const [south, west, north, east] = value.split(',').map(Number);
    query = query.gte('latitude', south).lte('latitude', north).gte('longitude', west).lte('longitude', east);
  }
  return query;
}

function scopeKeyOf(place: WasTunPlace): string {
  const p = scopeParams(place);
  return p.bundesland ? `bundesland=${p.bundesland}` : `bbox=${p.bbox}`;
}

const loadEventsCached = unstable_cache(
  async (scopeKey: string): Promise<{ events: WasTunEvent[]; total: number; pool: WasTunEvent[] }> => {
    const [page, pool] = await Promise.all([
      eventsInScope(scopeKey, EVENT_COLUMNS, true)
        .order('start_date', { ascending: true })
        .order('id', { ascending: true })
        .limit(EVENTS_FIRST_PAGE),
      eventsInScope(scopeKey, EVENT_COLUMNS, false)
        .order('event_score', { ascending: false, nullsFirst: false })
        .order('start_date', { ascending: true })
        .limit(SHELF_POOL),
    ]);
    const events = page.error || !page.data ? [] : (page.data as unknown as WasTunEvent[]);
    return {
      events,
      // Ohne Zählung (Fehler) wenigstens die geladene Seite.
      total: typeof page.count === 'number' ? page.count : events.length,
      pool: pool.error || !pool.data ? [] : (pool.data as unknown as WasTunEvent[]),
    };
  },
  ['was-tun-events-v2'],
  { revalidate: 3600, tags: ['event'] },
);

const ACTIVITY_COLUMNS = 'id, slug, name, tags, town, price_hint, images, quality_score';

const loadActivitiesCached = unstable_cache(
  async (scopeKey: string): Promise<{ activities: WasTunActivity[]; total: number; nextCursor: string | null }> => {
    let query = getServiceClient()
      .from('poi_activities')
      .select(ACTIVITY_COLUMNS, { count: 'exact' })
      .eq('visible', true)
      .eq('is_closed', false);
    const [kind, value] = scopeKey.split('=');
    if (kind === 'bundesland') {
      query = query.eq('bundesland', value);
    } else {
      const [south, west, north, east] = value.split(',').map(Number);
      query = query.gte('lat', south).lte('lat', north).gte('lng', west).lte('lng', east);
    }
    const { data, error, count } = await query
      .order('quality_score', { ascending: false })
      .order('id', { ascending: true })
      .limit(ACTIVITIES_FIRST_PAGE + 1);
    if (error || !data) return { activities: [], total: 0, nextCursor: null };

    const rows = data as unknown as Array<WasTunActivity & { quality_score: number }>;
    const hasMore = rows.length > ACTIVITIES_FIRST_PAGE;
    const activities = hasMore ? rows.slice(0, ACTIVITIES_FIRST_PAGE) : rows;
    const last = activities[activities.length - 1];
    return {
      activities,
      total: typeof count === 'number' ? count : activities.length,
      nextCursor: hasMore && last ? encodeActivityCursor({ q: last.quality_score, id: last.id }) : null,
    };
  },
  ['was-tun-activities-v2'],
  { revalidate: 3600, tags: ['activity'] },
);

export interface WasTunData {
  /** Erste Seite der Events (nächster Termin zuerst) und ihr Gesamtbestand. */
  events: WasTunEvent[];
  eventTotal: number;
  /** Kandidaten der Regale (beste Events nach Score). */
  shelfPool: WasTunEvent[];
  /** Erste Seite der Aktivitäten und ihr Gesamtbestand. */
  activities: WasTunActivity[];
  activityTotal: number;
  activityCursor: string | null;
  /** OSM-Ziele: eigene Sektion mit eigener Attribution, nie gemischt (ODbL). */
  osmPois: NearbyOsmPoi[];
}

/**
 * Alles, was die Seite zeigt. generateMetadata und die Seite rufen mit
 * denselben Argumenten auf und treffen dieselben Cache-Einträge.
 */
export async function loadWasTunData(place: WasTunPlace): Promise<WasTunData> {
  const key = scopeKeyOf(place);
  const [ev, act, osmPois] = await Promise.all([
    loadEventsCached(key),
    loadActivitiesCached(key),
    place.center
      ? loadNearbyOsmPoisCached(place.center.lat, place.center.lng, place.center.radiusKm)
      : Promise.resolve([] as NearbyOsmPoi[]),
  ]);
  return {
    events: ev.events,
    eventTotal: ev.total,
    shelfPool: ev.pool,
    activities: act.activities,
    activityTotal: act.total,
    activityCursor: act.nextCursor,
    osmPois,
  };
}
