/**
 * GET /api/app/v1/activities — gefilterte Liste der Freizeitaktivitäten für
 * die native App.
 *
 * Die Abfrage selbst stellt `/api/activities` (derselbe Handler, dieselben
 * Filter und dieselbe Sortierung wie /aktivitaeten der Website); diese
 * Route reicht die erlaubten Parameter durch und rechnet die Zeilen in
 * Karten um (`toAppActivityCard`). Seitenweise über `cursor`; `count=1`
 * liefert zusätzlich `total`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { GET as activitiesGET } from '@/app/api/activities/route';
import { toAppActivityCard, type AppTranslate } from '@/lib/app-api/landing';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';

/** Parameter von /api/activities, die die App setzen darf. */
const ALLOWED = ['gemeinde', 'bundesland', 'bezirk', 'bbox', 'tag', 'setting', 'q', 'barrierefrei', 'count', 'cursor'] as const;

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 60;

type Row = {
  id: string;
  slug: string;
  name: string;
  tags?: string[] | null;
  town?: string | null;
  bundesland?: string | null;
  images?: unknown;
  price_hint?: string | null;
  accessible?: boolean;
};

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const params = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = source.get(key);
    if (value) params.set(key, value);
  }
  const limit = Number.parseInt(source.get('limit') ?? '', 10);
  params.set('limit', String(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), MAX_LIMIT) : DEFAULT_LIMIT));

  const inner = await activitiesGET(
    new NextRequest(new URL(`/api/activities?${params.toString()}`, request.nextUrl.origin)),
  );
  if (!inner.ok) {
    return NextResponse.json(
      { error: 'Die Liste ist gerade nicht verfügbar.' },
      { status: inner.status === 400 ? 400 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const body = (await inner.json()) as { activities?: Row[]; nextCursor?: string | null; hasMore?: boolean; total?: number };

  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  const ctx = { t, locale: 'de' as const, origin: SITE_ORIGIN };

  return NextResponse.json(
    {
      activities: (body.activities ?? []).map(row => ({
        ...toAppActivityCard(row, ctx),
        priceHint: row.price_hint ?? null,
        accessible: row.accessible === true,
      })),
      total: typeof body.total === 'number' ? body.total : null,
      nextCursor: body.nextCursor ?? null,
      hasMore: Boolean(body.hasMore),
    },
    { headers: { 'Cache-Control': inner.headers.get('Cache-Control') ?? 'public, max-age=60' } },
  );
}
