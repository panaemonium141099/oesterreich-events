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
 */
import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
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

  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  const ctx = { t, locale: 'de' as const, origin: SITE_ORIGIN, mapboxToken: null };

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
