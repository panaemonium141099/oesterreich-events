/**
 * GET /api/app/v1/activities/facets — Filter der Freizeitaktivitäten für die
 * native App: Themen, Umgebung und Bundesländer mit ihren Bezirken samt
 * Zahl der Orte.
 *
 * Dieselbe Quelle wie das Filter-Modul von /aktivitaeten
 * (`loadActivityBezirkCountsCached`, je Stunde einmal gelesen).
 */
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { toAppActivityFacets } from '@/lib/app-api/activities';
import type { AppTranslate } from '@/lib/app-api/landing';
import { resilient } from '@/lib/app-api/resilient';
import { loadActivityBezirkCountsCached } from '@/lib/activities/list-loaders';
import { loadMessages } from '@/i18n/messages';
import { getSite } from '@/lib/site';

const get = resilient(async () => {
  const counts = await loadActivityBezirkCountsCached();
  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  return toAppActivityFacets(counts, { t, locale: 'de' });
});

export async function GET() {
  try {
    const { value, stale } = await get();
    return NextResponse.json(value, {
      headers: {
        'Cache-Control': stale ? 'no-store' : 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
        ...(stale ? { 'X-LT-Stale': '1' } : {}),
      },
    });
  } catch (err) {
    console.error('[app-api] activity facets:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Die Filter sind gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } },
    );
  }
}
