/**
 * GET /api/app/v1/was-tun/[slug]?thema=<Thema> — „Was kann man in X
 * machen?" für die native App: Frage, Antwort, Themen, erste Seite der
 * Veranstaltungen und Ausflugsziele, OSM-Ziele, häufige Fragen.
 *
 * Derselbe Lader wie /was-tun/[slug] der Website (`loadWasTunData`, je
 * Stunde einmal gelesen; gleiche Argumente treffen dieselben
 * Cache-Einträge wie die Seite). Wiener Gemeinden führen wie dort zu Wien.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createTranslator } from 'next-intl';
import type { AppTranslate } from '@/lib/app-api/landing';
import { toAppWasTun } from '@/lib/app-api/was-tun';
import { loadWasTunData } from '@/lib/was-tun/loaders';
import { resolveWasTunPlace, wasTunRedirectSlug } from '@/lib/was-tun/places';
import { wasTunThemeBySlug } from '@/lib/was-tun/themes';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = SLUG.test(rawSlug) ? (wasTunRedirectSlug(rawSlug) ?? rawSlug) : '';
  const place = slug ? resolveWasTunPlace(slug) : null;
  if (!place) {
    return NextResponse.json({ error: 'Diesen Ort kennen wir nicht.' }, { status: 404 });
  }
  const themeSlug = request.nextUrl.searchParams.get('thema');
  const theme = themeSlug ? wasTunThemeBySlug(themeSlug) : null;
  if (themeSlug && !theme) {
    return NextResponse.json({ error: 'Dieses Thema gibt es nicht.' }, { status: 404 });
  }

  try {
    const data = await loadWasTunData(place, theme);
    const messages = await loadMessages('de', getSite());
    const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
    const body = toAppWasTun(place, theme, data, { t, locale: 'de', origin: SITE_ORIGIN, mapboxToken: null });
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[app-api] was-tun:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Die Seite ist gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } },
    );
  }
}
