import { Suspense } from 'react';
import { HeroSection } from '@/components/Landing/HeroSection';
import { LandingStats } from '@/components/Landing/LandingStats';
import { LandingAuth } from '@/components/Landing/LandingAuth';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { ParticleBackground } from '@/components/Landing/ParticleBackground';
import { Onboarding } from '@/components/Landing/Onboarding';
import { LiveActivity } from '@/components/Landing/LiveActivity';
import { Footer } from '@/components/Legal/Footer';
import { LandingSections } from '@/components/Landing/LandingSections';
import { ScrollHint } from '@/components/Landing/ScrollHint';
import { AuthRedirectGate } from '@/components/Landing/AuthRedirectGate';

// WebSite + Organization JSON-LD live now in the root layout so every page
// emits them, not just the landing. No page-local JSON-LD here anymore.

// ISR: Landing-Hülle wird statisch zur Build-Zeit gerendert + alle 1 h
// regeneriert. Funktioniert weil der Auth-Check (Cookies + getUser) in
// die <AuthRedirectGate>-Komponente unter Suspense ausgelagert wurde,
// damit die Hülle keinen runtime-only-Zugriff mehr hat. Anonyme Visitors
// (Googlebot + 95 % der Erstbesucher) sehen die Landing instant aus dem
// Edge-Cache; logged-in Users werden via Streaming-Redirect zu /feed.
export const revalidate = 3600;

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  // Allow ?home to bypass redirect and show landing page
  const forceHome = 'home' in params;

  return (
    // fn-15.2 — CLS-Stabilität:
    // `min-h-screen` keeps the container at least one viewport tall on
    // empty/short-content states. The footer dropped `mt-auto` (see
    // Footer.tsx comment) because mt-auto's auto-margin was the primary
    // PSI-flagged CLS source (0.535) — async section growth changed the
    // available space mt-auto could expand into, translating the footer
    // by hundreds of pixels mid-load. Now the layout is pure document
    // flow with Suspense skeletons reserving each section's full final
    // height at SSR — no dynamic pushing.
    <div
      id="landing-curtain"
      className="min-h-screen text-white flex flex-col items-center relative overflow-hidden gradient-mesh"
    >
      {/* Auth-Redirect läuft async unter Suspense — blockiert die statische
          Landing-Hülle nicht. Logged-in User kriegen einen Streaming-Redirect
          zu /feed; anonyme Visitor (inkl. Googlebot) sehen die Landing instant
          aus dem Edge-Cache. ?home in der URL überspringt den Auth-Check. */}
      {!forceHome && (
        <Suspense fallback={null}>
          <AuthRedirectGate />
        </Suspense>
      )}
      {/* Particle effect behind content */}
      <ParticleBackground />

      {/* Onboarding overlay for first-time visitors */}
      <Onboarding />

      {/* Auth error toast */}
      <AuthErrorToast />

      {/* Top-right auth button */}
      <LandingAuth />

      {/* Beta-Hinweis — die Seite ist live aber noch im Aufbau, technische
          Fehler sind möglich. Mailto-Link macht Feedback ein-Klick. */}
      <div
        role="status"
        className="z-30 mx-auto mt-3 max-w-[95%] md:max-w-2xl rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-center text-[12.5px] leading-tight text-amber-100 backdrop-blur-sm"
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

      {/*
       * Hero block was previously `min-h-screen flex justify-center` so the
       * search bar landed dead-center of the viewport — pushing the Top-
       * Events carousel completely out of sight. Removed the screen
       * height + dropped vertical gaps so the hero takes ~50vh on
       * desktop, ~60vh on mobile, and the carousel is visible (or just
       * a scroll-hint nudge away) without scrolling.
       */}
      <main className="flex flex-col items-center gap-5 md:gap-7 px-6 text-center max-w-3xl w-full pt-10 md:pt-14">
        {/* Headline + Stats + Tagline — tightly grouped */}
        <div className="flex flex-col items-center gap-2 md:gap-3">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight animate-fade-in-up opacity-0 leading-[1.1]"
            style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
          >
            Entdecke was
            <br />
            los ist.
          </h1>

          {/* Stats */}
          <LandingStats />

          {/* Tagline */}
          <p
            className="text-white/30 text-xs sm:text-sm tracking-[0.12em] animate-fade-in opacity-0"
            style={{ animationDelay: '0.75s', animationFillMode: 'forwards' }}
          >
            Die größte Eventdatenbank Österreichs
          </p>
        </div>

        {/* Search + CTA */}
        <HeroSection />
      </main>

      {/* Scroll-down hint — fades out once the user has scrolled past 80 px */}
      <ScrollHint />

      {/* Landing sections below the hero */}
      <LandingSections />

      {/* Footer */}
      <Footer />

    </div>
  );
}
