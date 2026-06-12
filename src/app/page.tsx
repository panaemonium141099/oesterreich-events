/**
 * Landing page — v4 redesign (Phase 2).
 *
 * Fully RSC. No 'use client', no useEffect, no cookies()/headers() at the
 * route level — but getLandingContext() *does* read auth via the server
 * supabase client. That converts this route from purely ISR to a per-
 * request render for authed users.
 *
 * fn-15.7 used Edge auth-middleware to flip / to ISR. With v4-Phase-2,
 * the auth signal that determines Matches-vs-AnonTeaser is read INSIDE
 * the RSC tree. The cookie-aware redirect from /feed (for logged-in
 * users) lives in middleware (fn-15.7) and continues to apply BEFORE
 * this page renders. So:
 *   - Anon visit → ISR cache served, getLandingContext returns empty
 *                  sets, no DB queries.
 *   - Authed visit → middleware may redirect to /feed (fn-15.7), or
 *                    this page renders dynamically with their match data.
 */

import {
  HeroV4,
  ArtistTeaserV4,
  MatchesSection,
  AnonFollowTeaser,
  WeekendSection,
  ConcertsSection,
  FestivalsSection,
  MapPreview,
  HowItWorks,
} from '@/components/Landing/v4';
import { Onboarding } from '@/components/Landing/Onboarding';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { Footer } from '@/components/Legal/Footer';
import { getLandingContext } from '@/lib/v4/get-landing-context';
import { getLandingData } from '@/lib/v4/get-landing-data';
import { RegionHubsSection } from '@/components/Landing/v4/RegionHubsSection';

export const revalidate = 3600;

export default async function LandingPage() {
  const ctx = await getLandingContext();
  const data = await getLandingData(ctx);

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
        {ctx.signedIn
          ? <MatchesSection appearances={data.matches}/>
          : <AnonFollowTeaser/>}
        <WeekendSection events={data.todayWeekend}/>
        <ConcertsSection events={data.concerts}/>
        <FestivalsSection festivals={data.festivals}/>
        <RegionHubsSection/>
        <MapPreview/>
        <HowItWorks/>
      </main>

      <Footer/>
    </div>
  );
}
