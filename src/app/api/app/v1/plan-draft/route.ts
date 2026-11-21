/**
 * GET /api/app/v1/plan-draft?event=<UUID> — Vorbelegung des Plan-Assistenten
 * der nativen App für ein Event: Karte, Ticketlink, Ziel der Anreise,
 * ÖBB-Routenplaner und die Standardwerte eines neuen Plans.
 *
 * Öffentliche Event-Daten, kein Konto nötig; gespeichert wird der Plan erst
 * über `/api/plans`. Derselbe Loader wie das Event-Detail (nur Events des
 * Landes der Seite, eine Dublette liefert ihren Primary). Je Event höchstens
 * alle zehn Minuten neu gerechnet.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { unstable_cache } from 'next/cache';
import { createTranslator } from 'next-intl';
import type { AppTranslate } from '@/lib/app-api/landing';
import { defaultPlanState, toAppPlanDraft, type AppPlanDraft } from '@/lib/app-api/plans';
import { getEventByShortId, resolveDuplicatePrimary } from '@/lib/events/event-detail-loaders';
import { loadMessages } from '@/i18n/messages';
import { plzReference } from '@/lib/location/plz-reference';
import { getSite, SITE_ORIGIN } from '@/lib/site';

const REVALIDATE_SECONDS = 600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function buildDraft(id: string): Promise<AppPlanDraft | null> {
  let event = await getEventByShortId(id);
  if (event?.publish_status === 'duplicate') event = await resolveDuplicatePrimary(event);
  if (!event || event.publish_status === 'needs_review' || event.publish_status === 'suppressed') {
    return null;
  }
  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  // Stadt des Plans: der Post-Ort der PLZ, nicht der Name des Saals.
  const postOrt = event.postal_code ? (plzReference(event.postal_code)?.orte[0] ?? null) : null;
  return toAppPlanDraft(event, defaultPlanState(event, new Date(), postOrt), {
    t,
    locale: 'de',
    origin: SITE_ORIGIN,
    mapboxToken: null,
  });
}

const getDraftCached = unstable_cache(buildDraft, ['app-plan-draft-v1'], { revalidate: REVALIDATE_SECONDS });

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('event') ?? '';
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'Ungültige Event-ID.' }, { status: 400 });
  }
  try {
    const draft = await getDraftCached(id.toLowerCase());
    if (!draft) {
      return NextResponse.json({ error: 'Dieses Event gibt es nicht (mehr).' }, { status: 404 });
    }
    return NextResponse.json(draft, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[app-api] plan draft:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Der Plan kann gerade nicht vorbereitet werden.' },
      { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
    );
  }
}
