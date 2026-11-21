/**
 * GET /api/app/v1/festivals/[slug] — ein Festival der nativen App: Kopf,
 * Info-Zeilen, Beschreibung, Line-up nach Rolle, Ticketlink und Route.
 *
 * Derselbe Lader wie /festivals/[slug] der Website (`loadFestivalDetail`,
 * samt der einen Tag zwischengespeicherten Anreicherung von der
 * Festival-Website); Umrechnung in `src/lib/app-api/festivals.ts`. Die
 * fertige Antwort bleibt je Festival zehn Minuten im Speicher.
 */
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { toAppFestivalDetail, type AppFestivalDetail } from '@/lib/app-api/festivals';
import type { AppTranslate } from '@/lib/app-api/landing';
import { loadFestivalDetail } from '@/lib/festivals/public';
import { loadMessages } from '@/i18n/messages';
import { TtlCache } from '@/lib/search/search-cache';
import { getSite, SITE_ORIGIN } from '@/lib/site';

export const dynamic = 'force-dynamic';

const cache = new TtlCache<AppFestivalDetail>(10 * 60_000, 200);

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 160) {
    return NextResponse.json({ error: 'Ungültiges Festival.' }, { status: 400 });
  }
  const headers = { 'Cache-Control': 'public, max-age=300, s-maxage=600' };
  const cached = cache.get(slug);
  if (cached) return NextResponse.json(cached, { headers });

  try {
    const data = await loadFestivalDetail(slug);
    if (!data) {
      return NextResponse.json({ error: 'Dieses Festival gibt es nicht (mehr).' }, { status: 404 });
    }
    const messages = await loadMessages('de', getSite());
    const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
    const detail = toAppFestivalDetail(data, { t, locale: 'de', origin: SITE_ORIGIN });
    cache.set(slug, detail);
    return NextResponse.json(detail, { headers });
  } catch (err) {
    console.error('[app-api] festival detail:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Das Festival ist gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
    );
  }
}
