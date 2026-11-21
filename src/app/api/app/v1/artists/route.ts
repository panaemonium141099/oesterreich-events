/**
 * GET /api/app/v1/artists — Künstler-Verzeichnis der nativen App: Regale
 * (Diese Woche live, Auf Tour, je Spielart) und alle Künstler von A bis Z.
 *
 * Dieselbe Quelle wie /artists der Website: `getArtistsDirectoryCached`
 * (Eventim-Künstler mit Termin in Österreich in den nächsten 90 Tagen, je
 * Stunde einmal gelesen). Umrechnung in `src/lib/app-api/artists.ts`; die
 * Liste trägt je Künstler nur den nächsten Termin, alle Termine liefert
 * `/api/app/v1/artists/[slug]`.
 */
import { NextResponse } from 'next/server';
import { createTranslator } from 'next-intl';
import { toAppArtistsDirectory } from '@/lib/app-api/artists';
import type { AppTranslate } from '@/lib/app-api/landing';
import { resilient } from '@/lib/app-api/resilient';
import { getArtistsDirectoryCached } from '@/lib/artists/get-artists-directory';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';

// Gleichzeitige Anfragen teilen einen Lauf; nach einem Fehlschlag eine Minute
// Pause und so lange die letzte gelungene Antwort (siehe resilient.ts).
const get = resilient(async () => {
  const directory = await getArtistsDirectoryCached();
  const messages = await loadMessages('de', getSite());
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  return toAppArtistsDirectory(directory.artists, directory.today, { t, locale: 'de', origin: SITE_ORIGIN });
});

export async function GET() {
  try {
    const { value, stale } = await get();
    return NextResponse.json(value, {
      headers: {
        // Eine alte Antwort soll kein Zwischenspeicher weiterreichen.
        'Cache-Control': stale ? 'no-store' : 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600',
        ...(stale ? { 'X-LT-Stale': '1' } : {}),
      },
    });
  } catch (err) {
    console.error('[app-api] artists:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Das Künstler-Verzeichnis ist gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } },
    );
  }
}
