/**
 * Startseite als Tagesausgabe (fn-30), statische Shell (§10.2).
 *
 * WIRKLICH fully static/ISR: kein cookies(), kein auth, keine
 * personalisierten Queries im RSC-Pfad. getLandingData() nutzt einen
 * cookie-freien Anon-Client → dieselbe gecachte HTML für ALLE Besucher.
 *
 * Aufbau nach Mockup D (docs/design/landing-redesign/d-tagesausgabe.html):
 * Kopf (Masthead: Datumszeile, H1, Suche), Bühne (Tipp des Tages, Saison,
 * Karte, Diese Woche live), darunter in fester Reihenfolge Heute Abend
 * (Programmliste), Dieses Wochenende, Nach Region, Festivals + Blog,
 * Freizeit, Newsletter-Zeile, Für Veranstalter, Footer mit Hinweiszeile.
 *
 * Client-Inseln: DateLine (Wetter, Mitternacht), SeasonWeather, ArtistsLive
 * (einziger Leser von /api/me/landing, nur mit sb-Cookie), ProgramListIsland
 * (abgelaufene Zeilen ausblenden), ActivitiesShelf (Titel nach Wetter),
 * NewsletterRow (Formular). Regale laufen über die Bausteine von /entdecken
 * (shelf-ui.tsx), damit beide Seiten gleich aussehen.
 *
 * Raster der Bühne: Desktop (lg) `1.45fr 1fr 1fr`, zwei Zeilen à 256 px,
 * Tipp und Saison zwei Zeilen hoch; Tablet (md) zwei Spalten, Tipp über
 * die volle Breite; Handy eine Spalte (Tipp 320 px, Karte 180 px). Ohne
 * Künstler-Pool wird die Karte zwei Zeilen hoch.
 */

import {
  Masthead,
  TipOfDay,
  SeasonCard,
  MapTile,
  ArtistsLive,
  ProgramList,
  WeekendShelf,
  RegionShelf,
  FestivalsBlog,
  ActivitiesShelf,
  NewsletterRow,
  OrganizerRow,
  DevNotice,
} from '@/components/Landing/v4';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { Footer } from '@/components/Legal/Footer';
import { getLandingData } from '@/lib/v4/get-landing-data';
import { routing } from '@/i18n/routing';

export const revalidate = 3600;

/**
 * Canonical + hreflang der Startseite. Lag bis 2026-09 im Layout und galt
 * damit versehentlich für alle Unterseiten (siehe Kommentar dort). Die
 * Startseite ist der einzige Ort, an dem der alte Layout-Wert korrekt
 * war: sie existiert wirklich zweisprachig, also kanonisiert /en auf
 * sich selbst.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: bilingualAlternates('', locale) };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // fn-17: setRequestLocale MUSS vor jeder Übersetzung stehen, sonst kippt
  // next-intl die Route in dynamisches Rendering und die ISR-Shell ist weg.
  const { locale: rawLocale } = await params;
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  setRequestLocale(locale);
  const data = await getLandingData();
  const hasArtists = data.artistsLive.length > 0;

  return (
    <div className="min-h-screen text-[var(--v4-ink)] bg-[var(--v4-surface)] flex flex-col">
      <AuthErrorToast/>

      <main className="flex-1">
        <div className="mx-auto max-w-[1180px] px-4 md:px-14">
          <Masthead today={data.today} countryTotal={data.countryTotal}/>

          <section
            className="mt-2.5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr] lg:grid-rows-[256px_256px] [&>*]:min-w-0"
            data-testid="landing-stage"
          >
            {data.tip && (
              <TipOfDay
                tip={data.tip}
                className="h-[320px] md:col-span-2 md:h-[360px] lg:col-span-1 lg:row-span-2 lg:h-auto"
              />
            )}
            <SeasonCard season={data.season} className="md:row-span-2"/>
            <MapTile
              pins={data.mapPins}
              tall={!hasArtists}
              className={hasArtists ? 'h-[180px] md:h-[220px] lg:h-auto' : 'h-[180px] md:h-auto md:row-span-2'}
            />
            {hasArtists && <ArtistsLive artists={data.artistsLive}/>}
          </section>

          <ProgramList events={data.program} today={data.today}/>
          <WeekendShelf events={data.weekend} range={data.weekendRange}/>
          <RegionShelf/>
          <FestivalsBlog festivals={data.festivals} posts={data.posts}/>
          <ActivitiesShelf activities={data.activities}/>
          <NewsletterRow/>
          <OrganizerRow/>
        </div>
      </main>

      <Footer notice={<DevNotice/>}/>
    </div>
  );
}
