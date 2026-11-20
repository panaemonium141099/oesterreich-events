/**
 * GET /api/app/v1/events/[id] — Event-Detail der nativen App.
 *
 * `id` ist die UUID des Events. Dieselben Regeln wie die Detailseite der
 * Website: nur Events des Landes der Seite (Loader), eine Dublette liefert
 * ihren Primary, zurückgehaltene Events (`needs_review`, `suppressed`) gibt
 * es nicht (404). Umrechnung in anzeigefertige Werte in
 * `src/lib/app-api/event-detail.ts`.
 *
 * Last: je Event bis zu fünf Abfragen (Event, Dubletten-Quellen, ähnliche
 * Events). Der Server rechnet ein Event höchstens alle zehn Minuten neu
 * (`unstable_cache` je ID); auch „gibt es nicht" bleibt so lange stehen,
 * Fehler werden nicht gecacht.
 */
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createTranslator } from 'next-intl';
import { fetchRelated } from '@/components/Events/v4/V4RelatedEvents';
import { toAppEventDetail, type AppEventDetail } from '@/lib/app-api/event-detail';
import type { AppTranslate } from '@/lib/app-api/landing';
import {
  getDuplicateSources,
  getEventByShortId,
  getSuccessorEvent,
  resolveDuplicatePrimary,
} from '@/lib/events/event-detail-loaders';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';

const REVALIDATE_SECONDS = 600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

async function buildAppEventDetail(id: string): Promise<AppEventDetail | null> {
  let event = await getEventByShortId(id);
  if (event?.publish_status === 'duplicate') event = await resolveDuplicatePrimary(event);
  if (!event || event.publish_status === 'needs_review' || event.publish_status === 'suppressed') {
    return null;
  }

  const now = new Date();
  const end = event.end_date || event.start_date;
  const isPast = end ? new Date(end).getTime() < now.getTime() - DAY_MS : false;

  const [duplicateSources, related, successor, messages] = await Promise.all([
    getDuplicateSources(event.id),
    fetchRelated(event),
    isPast ? getSuccessorEvent(event.slug ?? null, event.title, event.location_name ?? null) : null,
    loadMessages('de', getSite()),
  ]);

  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  return toAppEventDetail(
    { event, duplicateSources, related, successor, now },
    { t, locale: 'de', origin: SITE_ORIGIN },
  );
}

const getAppEventDetailCached = unstable_cache(buildAppEventDetail, ['app-event-detail-v1'], {
  revalidate: REVALIDATE_SECONDS,
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Ungültige Event-ID.' }, { status: 400 });
  }

  try {
    const detail = await getAppEventDetailCached(id.toLowerCase());
    if (!detail) {
      return NextResponse.json({ error: 'Dieses Event gibt es nicht (mehr).' }, { status: 404 });
    }
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[app-api] event detail:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Das Event ist gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
    );
  }
}
