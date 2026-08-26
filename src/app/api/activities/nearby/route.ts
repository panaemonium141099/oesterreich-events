/**
 * /api/activities/nearby — Standort-Highlights fuer /aktivitaeten (fn-19).
 *
 * Liefert die besten Aktivitaeten im Umkreis des Users: bbox-Vorfilter
 * (40 km) auf dem (lat,lng)-Bestand, exakter Haversine-Nachfilter,
 * Ranking = quality_score − 1.2 × Distanz-km (Naehe schlaegt Politur,
 * aber ein Top-Ausflugsziel in 20 km schlaegt den mittelmaessigen POI
 * um die Ecke).
 *
 * Cache-Hygiene: der Client rundet lat/lng auf 2 Dezimalstellen
 * (~1,1 km Raster) BEVOR er anfragt — so kollabieren die CDN-Cache-Keys
 * auf ein grobes Gitter statt pro GPS-Fix ein Unikat zu sein. Die Route
 * validiert nur; praezisere Werte werden serverseitig gerundet
 * (Privacy + Cache).
 *
 * Muster wie /api/activities: Service-Role auf der Basistabelle, beide
 * Anzeige-Bedingungen explizit, kein count.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { bboxAround, haversineKm } from '@/lib/gemeinden/data';

const RADIUS_KM = 40;
const POOL_LIMIT = 200;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 24;

/** Oesterreich grob (inkl. Grenzraum) — alles andere ist kein sinnvoller
 *  Standort fuer diese Liste und wird abgelehnt. */
const LAT_MIN = 45.5, LAT_MAX = 49.5, LNG_MIN = 8.5, LNG_MAX = 18.0;

const LIST_COLUMNS =
  'id, slug, name, tags, town, bundesland, setting, price_hint, images, lat, lng, quality_score';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Service nicht konfiguriert' }, { status: 500 });
  }

  const params = request.nextUrl.searchParams;
  const lat = Math.round(Number.parseFloat(params.get('lat') ?? '') * 100) / 100;
  const lng = Math.round(Number.parseFloat(params.get('lng') ?? '') * 100) / 100;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) {
    return NextResponse.json({ error: 'Ungültiger Standort' }, { status: 400 });
  }

  const rawLimit = Number.parseInt(params.get('limit') ?? '', 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const box = bboxAround(lat, lng, RADIUS_KM);
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('poi_activities')
    .select(LIST_COLUMNS)
    .eq('visible', true)
    .eq('is_closed', false)
    .gte('lat', box.minLat)
    .lte('lat', box.maxLat)
    .gte('lng', box.minLng)
    .lte('lng', box.maxLng)
    .order('quality_score', { ascending: false })
    .limit(POOL_LIMIT);

  if (error) {
    console.error('[api/activities/nearby] query failed:', error.message);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }

  type Row = {
    id: string; lat: number | null; lng: number | null; quality_score: number;
  } & Record<string, unknown>;

  const ranked = ((data ?? []) as unknown as Row[])
    .filter(r => r.lat != null && r.lng != null)
    .map(r => {
      const km = haversineKm(lat, lng, r.lat as number, r.lng as number);
      return { row: r, km, rank: r.quality_score - 1.2 * km };
    })
    .filter(x => x.km <= RADIUS_KM)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(x => ({ ...x.row, distance_km: Math.round(x.km * 10) / 10 }));

  return NextResponse.json(
    { activities: ranked },
    {
      headers: {
        // Grobes Koordinaten-Raster + wochenstabiler Bestand → grosszuegig cachen.
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
