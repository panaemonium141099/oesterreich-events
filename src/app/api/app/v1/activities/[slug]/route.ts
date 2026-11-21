/**
 * GET /api/app/v1/activities/[slug] — ein Ausflugsziel der nativen App:
 * Bilder mit Nachweis, Beschreibung, Barrierefreiheit, Öffnungszeiten,
 * Kurzfakten, Quelle, Lage und Events in der Nähe.
 *
 * Dieselben Lader wie /aktivitaet/[slug] der Website: `resolveActivitySlug`
 * (ein veralteter Slug liefert den aktuellen Eintrag statt einer
 * Umleitung), `getActivityById` und `loadNearbyFutureEventsCached` (alle je
 * Stunde einmal gelesen). „Jetzt geöffnet" rechnet die Route je Anfrage,
 * deshalb nur eine Minute Zwischenspeicher.
 *
 * Das Buchungsangebot steht bewusst nicht hier: die App holt es wie die
 * Website erst im Gerät von `/api/activities/[id]/booking` (Viator-Regel:
 * keine Produktdaten in zwischengespeicherten, indexierbaren Antworten).
 */
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import {
  APP_ACTIVITY_NEARBY_RADIUS_KM,
  toAppActivityDetail,
} from '@/lib/app-api/activities';
import type { AppTranslate } from '@/lib/app-api/landing';
import { activityResolverStore, getActivityById } from '@/lib/activities/activity-detail-loaders';
import { loadNearbyFutureEventsCached } from '@/lib/activities/nearby-loaders';
import { resolveActivitySlug } from '@/lib/activities/resolver';
import { getGemeindeBySlug } from '@/lib/gemeinden/data';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.includes('/') || slug.length > 200) {
    return NextResponse.json({ error: 'Ungültiges Ausflugsziel.' }, { status: 400 });
  }
  try {
    let resolution = await resolveActivitySlug(slug, activityResolverStore);
    // Veralteter Slug: gleich den aktuellen Eintrag liefern.
    if (resolution.outcome === 'redirect') resolution = await resolveActivitySlug(resolution.slug, activityResolverStore);
    const activity = resolution.outcome === 'render' ? await getActivityById(resolution.id) : null;
    if (!activity) {
      return NextResponse.json({ error: 'Dieses Ausflugsziel gibt es nicht (mehr).' }, { status: 404 });
    }

    const nearbyEvents = await loadNearbyFutureEventsCached(activity.lat, activity.lng, APP_ACTIVITY_NEARBY_RADIUS_KM).catch(
      () => [],
    );
    const gemeinde = activity.gemeinde_slug ? getGemeindeBySlug(activity.gemeinde_slug) : null;
    const messages = await loadMessages('de', getSite());
    const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;

    const detail = toAppActivityDetail(
      { activity, gemeindeName: gemeinde?.name ?? null, nearbyEvents, now: new Date() },
      { t, locale: 'de', origin: SITE_ORIGIN, mapboxToken: null },
    );
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    });
  } catch (err) {
    console.error('[app-api] activity detail:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Das Ausflugsziel ist gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
    );
  }
}
