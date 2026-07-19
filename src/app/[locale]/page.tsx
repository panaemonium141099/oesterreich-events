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
  ConcertsSection,
  FestivalsSection,
  MapPreview,
  HowItWorks,
  NewsletterSignup,
} from '@/components/Landing/v4';
import { Onboarding } from '@/components/Landing/Onboarding';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { Footer } from '@/components/Legal/Footer';
import { getLandingData } from '@/lib/v4/get-landing-data';
import { RegionHubsSection } from '@/components/Landing/v4/RegionHubsSection';

export const revalidate = 3600;

export default async function LandingPage() {
  const data = await getLandingData();

  return (
    <div className="min-h-screen text-[var(--v4-ink)] bg-[var(--v4-surface)] flex flex-col">
      <Onboarding/>
      <AuthErrorToast/>

      <div
        role="status"
        className="z-30 mx-auto mt-6 max-w-[95%] md:max-w-2xl rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-center text-[12.5px] leading-tight text-amber-100 backdrop-blur-sm"
      >
        Diese Seite ist noch in Entwicklung — technische Fehler sind möglich. Feedback bitte an{' '}
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
