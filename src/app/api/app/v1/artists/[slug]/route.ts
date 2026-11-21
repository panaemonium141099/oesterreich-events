/**
 * GET /api/app/v1/artists/[slug] — Künstlerblatt der nativen App: alle
 * kommenden Termine in Österreich mit Ticketlink, dazu verwandte Künstler.
 *
 * Liest dasselbe stündlich gebaute Verzeichnis wie die Liste (keine eigene
 * Abfrage); mehrere Feed-IDs eines Namens führt `artistBySlug` zusammen,
 * wie auf /kuenstler/[slug] der Website.
 */
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { toAppArtistDetail } from '@/lib/app-api/artists';
import type { AppTranslate } from '@/lib/app-api/landing';
import { getArtistsDirectoryCached } from '@/lib/artists/get-artists-directory';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG.test(slug)) {
    return NextResponse.json({ error: 'Ungültiger Künstlername.' }, { status: 400 });
  }
  try {
    const directory = await getArtistsDirectoryCached();
    const messages = await loadMessages('de', getSite());
    const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
    const detail = toAppArtistDetail(directory.artists, slug, { t, locale: 'de', origin: SITE_ORIGIN });
    if (!detail) {
      return NextResponse.json({ error: 'Künstler nicht gefunden' }, { status: 404 });
    }
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[app-api] artist detail:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Die Künstlerseite ist gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' } },
    );
  }
}
