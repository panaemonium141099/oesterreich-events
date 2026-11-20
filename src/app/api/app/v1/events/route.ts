/**
 * GET /api/app/v1/events — gefilterte Event-Liste der nativen App.
 *
 * Die Abfrage selbst stellt `/api/events` (derselbe Handler, dieselben
 * Filter, dieselbe Sortierung und derselbe Länderfilter wie die Liste der
 * Website); diese Route reicht die erlaubten Parameter durch und rechnet
 * die Zeilen in Karten um (`toAppEventCard`). So gibt es keine zweite
 * Filterlogik, die von der ersten abweichen könnte.
 *
 * Seitenweise über `cursor` (aus `nextCursor` der vorigen Antwort).
 * `countOnly=true` liefert nur `{ total }` für die Vorschau im Filter.
 *
 * `ids=<Kurz-ID,…>` (1 bis 48 Kurz-IDs aus dem Karten-Snapshot, je 12 Hex)
 * liefert stattdessen genau diese Events als Karten, in der Reihenfolge der
 * IDs: die Karte der App füllt damit einen angetippten Punkt oder Cluster.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTranslator } from 'next-intl';
import { GET as eventsGET } from '@/app/api/events/route';
import { toAppEventCard, type AppTranslate } from '@/lib/app-api/landing';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';
import type { Event } from '@/types/events';

/** Parameter von /api/events, die die App setzen darf. */
const ALLOWED = [
  'bundesland', 'bundeslands', 'district', 'districts', 'category', 'categories', 'tags',
  'dateFrom', 'dateTo', 'priceMin', 'priceMax', 'priceTier', 'priceTiers', 'search',
  'placeName', 'placePostalCode', 'bbox', 'eveningOnly', 'studentFriendly', 'familyFriendly',
  'venue_id', 'city', 'sort', 'cursor', 'countOnly',
] as const;

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;

const SHORT_ID = /^[0-9a-f]{12}$/;
/** Obergrenze der Details-RPC je Aufruf (wie /api/events/details). */
const MAX_IDS = 48;

async function cardContext() {
  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  return { t, locale: 'de' as const, origin: SITE_ORIGIN, mapboxToken: null };
}

/** Karten zu Kurz-IDs des Karten-Snapshots (RPC `get_event_details_by_short_ids`). */
async function eventsByShortIds(raw: string) {
  const ids = raw.toLowerCase().split(',').map(id => id.trim()).filter(Boolean);
  if (ids.length === 0 || ids.length > MAX_IDS || ids.some(id => !SHORT_ID.test(id))) {
    return NextResponse.json({ error: `ids: 1 bis ${MAX_IDS} Kurz-IDs (12 Hex) erwartet` }, { status: 400 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc('get_event_details_by_short_ids', { short_ids: ids });
  if (error) {
    console.error('[app-api] events by ids:', error.message);
    return NextResponse.json(
      { error: 'Die Events sind gerade nicht verfügbar.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const ctx = await cardContext();
  const shortId = (id: string) => id.replace(/-/g, '').slice(0, 12).toLowerCase();
  const byShortId = new Map(((data ?? []) as Event[]).map(event => [shortId(event.id), event]));
  const events = ids.flatMap(id => {
    const event = byShortId.get(id);
    return event?.title ? [toAppEventCard(event, ctx)] : [];
  });
  return NextResponse.json(
    { events, total: events.length, nextCursor: null, hasMore: false },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=900, stale-while-revalidate=86400' } },
  );
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const ids = source.get('ids');
  if (ids !== null) return eventsByShortIds(ids);

  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = source.get(key);
    if (value) params.set(key, value);
  }
  if (!params.has('bundesland') && !params.has('bundeslands')) params.set('bundesland', 'all');
  params.set('slim', 'true');
  const limit = Number.parseInt(source.get('limit') ?? '', 10);
  params.set('limit', String(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), MAX_LIMIT) : DEFAULT_LIMIT));

  const inner = await eventsGET(new NextRequest(new URL(`/api/events?${params.toString()}`, request.nextUrl.origin)));
  if (!inner.ok) {
    return NextResponse.json(
      { error: 'Die Liste ist gerade nicht verfügbar.' },
      { status: inner.status === 400 ? 400 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const body = (await inner.json()) as {
    events?: Event[];
    total?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
  };
  const cacheControl = inner.headers.get('Cache-Control') ?? 'public, max-age=60';

  if (params.get('countOnly') === 'true') {
    return NextResponse.json({ total: body.total ?? 0 }, { headers: { 'Cache-Control': cacheControl } });
  }

  const ctx = await cardContext();

  return NextResponse.json(
    {
      events: (body.events ?? []).map(event => toAppEventCard(event, ctx)),
      total: typeof body.total === 'number' ? body.total : null,
      nextCursor: body.nextCursor ?? null,
      hasMore: Boolean(body.hasMore),
    },
    { headers: { 'Cache-Control': cacheControl } },
  );
}
