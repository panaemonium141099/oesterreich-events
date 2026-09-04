/**
 * Landing page — v4 redesign, statische Shell (§10.2, 2026-07-08).
 *
 * WIRKLICH fully static/ISR: kein cookies(), kein auth, keine
 * personalisierten Queries im RSC-Pfad. getLandingData() nutzt einen
 * cookie-freien Anon-Client → dieselbe gecachte HTML für ALLE Besucher
 * (auch eingeloggte — vorher kippte getLandingContext() die Route für
 * sie in einen Per-Request-Render mit 8 Roundtrips).
 *
 * Personalisierung (YouTube-Muster): <PersonalizedMatches/> rendert den
 * Anon-Teaser im statischen HTML und tauscht client-seitig via
 * /api/me/landing auf die Künstler-Matches um — nur wenn ein Auth-Cookie
 * sichtbar ist; anonyme Besucher feuern keinen Request.
 */

import {
  HeroV4,
  ArtistTeaserV4,
  PersonalizedMatches,
  WeekendSection,
  WeatherSection,
  ConcertsSection,
  FestivalsSection,
  MapPreview,
  HowItWorks,
  NewsletterSignup,
} from '@/components/Landing/v4';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { Onboarding } from '@/components/Landing/Onboarding';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { Footer } from '@/components/Legal/Footer';
import { getLandingData } from '@/lib/v4/get-landing-data';
import { RegionHubsSection } from '@/components/Landing/v4/RegionHubsSection';
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
  const t = await getTranslations({ locale, namespace: 'Landing' });
  const data = await getLandingData();

  return (
    <div className="min-h-screen text-[var(--v4-ink)] bg-[var(--v4-surface)] flex flex-col">
      <Onboarding/>
      <AuthErrorToast/>

      <div
        role="status"
        className="z-30 mx-auto mt-6 max-w-[95%] md:max-w-2xl rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-center text-[12.5px] leading-tight text-amber-100 backdrop-blur-sm"
      >
        {t('devNotice')}{' '}
        <a
          href="mailto:dev@glatzdev.com?subject=lasstreffen.at%20Feedback"
          className="font-semibold underline decoration-amber-300/60 underline-offset-2 hover:text-amber-50"
        >
          dev@glatzdev.com
        </a>
        .
      </div>

      <main className="flex-1">
        <HeroV4/>
        <ArtistTeaserV4 artists={data.popularArtists}/>
        <PersonalizedMatches/>
        <WeekendSection events={data.todayWeekend}/>
        {/* Wetter-reaktiv (fn-19): rendert nur bei Regen/Hitze, client-only */}
        <WeatherSection/>
        <ConcertsSection events={data.concerts}/>
        <FestivalsSection festivals={data.festivals}/>
        <NewsletterSignup/>
        <RegionHubsSection/>
        <MapPreview/>
        <HowItWorks/>
      </main>

      <Footer/>
    </div>
  );
}
