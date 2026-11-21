/**
 * GET /api/app/v1/festivals — kommende Festivals der nativen App, wie
 * /festivals der Website (Ende nicht vor heute, nach Beginn).
 *
 * Derselbe Lader wie die Seite (`loadUpcomingFestivals`); Umrechnung in
 * `src/lib/app-api/festivals.ts`. Der Lader meldet keinen Fehler, sondern
 * eine leere Liste: zwischengespeichert (zehn Minuten) wird deshalb nur
 * eine Liste mit Einträgen.
 */
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { toAppFestivalList, type AppFestivalList } from '@/lib/app-api/festivals';
import type { AppTranslate } from '@/lib/app-api/landing';
import { loadUpcomingFestivals } from '@/lib/festivals/public';
import { loadMessages } from '@/i18n/messages';
import { TtlCache } from '@/lib/search/search-cache';
import { getSite, SITE_ORIGIN } from '@/lib/site';

export const dynamic = 'force-dynamic';

const cache = new TtlCache<AppFestivalList>(10 * 60_000, 1);
const CACHE_KEY = 'list';

export async function GET() {
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' } });
  }
  try {
    const festivals = await loadUpcomingFestivals();
    const messages = await loadMessages('de', getSite());
    const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
    const list = toAppFestivalList(festivals, { t, locale: 'de', origin: SITE_ORIGIN });
    if (list.festivals.length > 0) cache.set(CACHE_KEY, list);
    return NextResponse.json(list, {
      headers: { 'Cache-Control': list.festivals.length > 0 ? 'public, max-age=300, s-maxage=600' : 'no-store' },
    });
  } catch (err) {
    console.error('[app-api] festivals:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Die Festivals sind gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } },
    );
  }
}
