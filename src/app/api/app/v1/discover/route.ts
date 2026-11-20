/**
 * GET /api/app/v1/discover — Übersicht von „Entdecken" der nativen App.
 *
 * Liest den Karten-Snapshot (RPC `get_event_map_points`, dieselbe Quelle
 * wie /entdecken und /map), lässt `planShelves` die Regale wählen und füllt
 * nur die gewählten Events mit Details (RPC `get_event_details_by_short_ids`,
 * rund 100 Zeilen). Umrechnung in Karten in `src/lib/app-api/discover.ts`.
 *
 * Last: der Snapshot ist groß (rund 5 MB JSON). Der Server liest ihn dafür
 * höchstens alle zehn Minuten (`unstable_cache`) und behält nur die fertige
 * Übersicht (wenige KB). Fehler werden nicht gecacht: die Route antwortet
 * 503 und die App behält ihre letzte Übersicht.
 */
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { resilient } from '@/lib/app-api/resilient';
import { createClient } from '@supabase/supabase-js';
import { createTranslator } from 'next-intl';
import { planShelves } from '@/components/Discover/v4/shelves-select';
import { discoverPointIds, toAppDiscover, type AppDiscover } from '@/lib/app-api/discover';
import type { AppTranslate } from '@/lib/app-api/landing';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';
import { SITE_COUNTRY } from '@/lib/site-country';
import { viennaToday } from '@/lib/utils/event-time';
import { decodeMapPoints, type MapPointsPayload } from '@/lib/v4/map-points';
import type { Event } from '@/types/events';

const REVALIDATE_SECONDS = 600;
/** Die Details-RPC nimmt höchstens 48 Kurz-IDs je Aufruf (wie /api/events/details). */
const DETAILS_CHUNK = 48;

/** Kurz-ID eines Punkts: die ersten 12 Hex-Zeichen der UUID. */
const shortId = (id: string) => id.replace(/-/g, '').slice(0, 12).toLowerCase();

async function buildAppDiscover(): Promise<AppDiscover> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: payload, error } = await supabase.rpc('get_event_map_points', { p_country: SITE_COUNTRY });
  if (error) throw new Error(`get_event_map_points: ${error.message}`);
  const points = payload && (payload as MapPointsPayload).n > 0 ? decodeMapPoints(payload as MapPointsPayload) : [];
  if (points.length === 0) throw new Error('Karten-Snapshot ist leer');

  const today = viennaToday();
  const plan = planShelves(points, today);

  const ids = discoverPointIds(plan);
  const details = new Map<string, Partial<Event>>();
  for (let i = 0; i < ids.length; i += DETAILS_CHUNK) {
    const { data, error: detailsError } = await supabase.rpc('get_event_details_by_short_ids', {
      short_ids: ids.slice(i, i + DETAILS_CHUNK),
    });
    if (detailsError) throw new Error(`get_event_details_by_short_ids: ${detailsError.message}`);
    for (const row of (data ?? []) as Array<Partial<Event> & { id: string }>) {
      details.set(shortId(row.id), row);
    }
  }

  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  return toAppDiscover({ plan, today, details, allEvents: points }, { t, locale: 'de', origin: SITE_ORIGIN });
}

const getAppDiscoverCached = unstable_cache(buildAppDiscover, ['app-discover-v1'], {
  revalidate: REVALIDATE_SECONDS,
});

// Gleichzeitige Anfragen teilen einen Lauf; nach einem Fehlschlag eine Minute
// Pause und so lange die letzte gelungene Antwort (siehe resilient.ts).
const get = resilient(() => getAppDiscoverCached());

export async function GET() {
  try {
    const { value, stale } = await get();
    return NextResponse.json(value, {
      headers: {
        // Eine alte Antwort soll kein Zwischenspeicher weiterreichen.
        'Cache-Control': stale ? 'no-store' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
        ...(stale ? { 'X-LT-Stale': '1' } : {}),
      },
    });
  } catch (err) {
    console.error('[app-api] discover:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Die Übersicht ist gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } },
    );
  }
}
