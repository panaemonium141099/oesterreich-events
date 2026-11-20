/**
 * GET /api/app/v1/landing — Startseite der nativen App.
 *
 * Dieselbe Tagesausgabe wie die Startseite der Website: `getLandingData()`
 * (cookie-frei, nur veröffentlichte Daten des Landes der Seite), umgerechnet
 * in anzeigefertige Werte (`src/lib/app-api/landing.ts`).
 *
 * Last: eine Ausgabe sind rund 16 Datenbank-Abfragen. Der Server rechnet sie
 * höchstens alle zehn Minuten neu (`unstable_cache`), egal wie viele Apps
 * fragen. Scheitert die Neuberechnung, antwortet die Route 503 und die App
 * behält ihre letzte Ausgabe; leer gecacht wird nichts (`getLandingData`
 * wirft zur Laufzeit, statt leere Sektionen zu liefern).
 */
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { resilient } from '@/lib/app-api/resilient';
import { createTranslator } from 'next-intl';
import { getLandingData } from '@/lib/v4/get-landing-data';
import { toAppLanding, type AppLanding, type AppTranslate } from '@/lib/app-api/landing';
import { loadMessages } from '@/i18n/messages';
import { getSite, SITE_ORIGIN } from '@/lib/site';

const REVALIDATE_SECONDS = 600;

async function buildAppLanding(): Promise<AppLanding> {
  const [data, messages] = await Promise.all([getLandingData(), loadMessages('de', getSite())]);
  const t = createTranslator({ locale: 'de', messages }) as unknown as AppTranslate;
  return toAppLanding(data, {
    t,
    locale: 'de',
    origin: SITE_ORIGIN,
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  });
}

const getAppLandingCached = unstable_cache(buildAppLanding, ['app-landing-v1'], {
  revalidate: REVALIDATE_SECONDS,
});

// Gleichzeitige Anfragen teilen einen Lauf; nach einem Fehlschlag eine Minute
// Pause und so lange die letzte gelungene Antwort (siehe resilient.ts).
const get = resilient(() => getAppLandingCached());

export async function GET() {
  try {
    const { value, stale } = await get();
    return NextResponse.json(value, {
      headers: {
        // Eine alte Antwort soll kein Zwischenspeicher weiterreichen.
        'Cache-Control': stale ? 'no-store' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
        ...(stale ? { 'X-LT-Stale': '1' } : {}),
      },
    });
  } catch (err) {
    console.error('[app-api] landing:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Die Startseite ist gerade nicht verfügbar.' },
      { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } },
    );
  }
}
