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
 * Ein Thema (themes.ts) kommt als weitere API-Parameter dazu; hier wirken
 * genau die, die `applyEventParams` und `applyActivityParams` kennen.
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
import { themeFilters, type WasTunTheme } from './themes';

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
  const params = new URLSearchParams(scopeKey);
  const bundesland = params.get('bundesland');
  const bbox = params.get('bbox');
  if (bundesland) {
    query = query.eq('bundesland', bundesland);
  } else if (bbox) {
    const [south, west, north, east] = bbox.split(',').map(Number);
    query = query.gte('latitude', south).lte('latitude', north).gte('longitude', west).lte('longitude', east);
  }
  // Themenfilter, Zeile für Zeile wie in /api/events.
  const categories = params.get('categories');
  if (categories) query = query.in('category', categories.split(',').map((c) => c.trim()).filter(Boolean));
  const dateFrom = params.get('dateFrom');
  if (dateFrom) query = query.gte('start_date', dateFrom);
  const dateTo = params.get('dateTo');
  if (dateTo) query = query.lte('start_date', `${dateTo}T23:59:59`);
  const priceTier = params.get('priceTier');
  if (priceTier) query = query.eq('price_tier', priceTier);
  return query;
}

/** Parameter in fester Reihenfolge: Cache-Schlüssel und API-Aufruf zugleich. */
function toKey(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map((k) => [k, params[k]] as [string, string]);
  return new URLSearchParams(sorted).toString();
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
  ['was-tun-events-v3'],
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
    const params = new URLSearchParams(scopeKey);
    const bundesland = params.get('bundesland');
    const bbox = params.get('bbox');
    if (bundesland) {
      query = query.eq('bundesland', bundesland);
    } else if (bbox) {
      const [south, west, north, east] = bbox.split(',').map(Number);
      query = query.gte('lat', south).lte('lat', north).gte('lng', west).lte('lng', east);
    }
    // Themenfilter wie in /api/activities.
    const setting = params.get('setting');
    if (setting) query = query.eq('setting', setting);
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
  ['was-tun-activities-v3'],
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
  /** Parameter fürs Nachladen (Ort plus Thema); null, wenn das Thema die Art nicht zeigt. */
  eventApiParams: Record<string, string> | null;
  activityApiParams: Record<string, string> | null;
}

/**
 * Alles, was die Seite zeigt. generateMetadata und die Seite rufen mit
 * denselben Argumenten auf und treffen dieselben Cache-Einträge.
 */
export async function loadWasTunData(place: WasTunPlace, theme: WasTunTheme | null = null): Promise<WasTunData> {
  const scope = scopeParams(place);
  const filters = themeFilters(theme);
  const eventApiParams = filters.events ? { ...scope, ...filters.events } : null;
  const activityApiParams = filters.activities ? { ...scope, ...filters.activities } : null;

  const noEvents = { events: [] as WasTunEvent[], total: 0, pool: [] as WasTunEvent[] };
  const noActivities = { activities: [] as WasTunActivity[], total: 0, nextCursor: null as string | null };
  const [ev, act, osmPois] = await Promise.all([
    eventApiParams ? loadEventsCached(toKey(eventApiParams)) : Promise.resolve(noEvents),
    activityApiParams ? loadActivitiesCached(toKey(activityApiParams)) : Promise.resolve(noActivities),
    // OSM-Ziele nur auf der Grundseite: sie tragen keine Themen-Kennzeichen.
    place.center && !theme
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
    eventApiParams,
    activityApiParams,
  };
}
