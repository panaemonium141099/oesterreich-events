import { Suspense } from 'react';
import Link from 'next/link';
import { HeroSection } from '@/components/Landing/HeroSection';
import { LandingStats } from '@/components/Landing/LandingStats';
import { LandingAuth } from '@/components/Landing/LandingAuth';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { ParticleBackground } from '@/components/Landing/ParticleBackground';
import { Onboarding } from '@/components/Landing/Onboarding';
import { Footer } from '@/components/Legal/Footer';
import { LandingSections } from '@/components/Landing/LandingSections';
import { ScrollHint } from '@/components/Landing/ScrollHint';

/**
 * Pixel-perfect fallback for `LandingStats` while the ISR-build's RPC
 * round-trips. Matches the loaded badge's vertical rhythm (text-lg gap
 * + uppercase tracking-line) so the prerendered HTML and the eventual
 * hydrated content have identical bounding boxes — zero CLS.
 *
 * Why we need a fallback at all if the page is ISR-prerendered: at
 * build time the await resolves and the number is baked into the HTML,
 * so visitors NEVER see this fallback in production. But on the very
 * first Edge regeneration after a 1 h cache miss (or in dev), Next will
 * stream and Suspense kicks in for those ~80–400 ms. The fallback
 * reserves the row's height so the badge below the title doesn't push
 * the search box down when the real number lands.
 */
function StatsBadgeFallback() {
  return (
    <div
      className="flex flex-col items-center gap-2 animate-fade-in opacity-0"
      style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
      aria-hidden="true"
    >
      <p className="text-white/40 text-lg md:text-xl invisible">
        Events in ganz Österreich
      </p>
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/25 invisible">
        Täglich aktualisiert
      </span>
    </div>
  );
}

// WebSite + Organization JSON-LD live now in the root layout so every page
// emits them, not just the landing. No page-local JSON-LD here anymore.

// ISR-revalidate every hour. The landing is a fully static shell at the
// route level — no `cookies()`, no `headers()`, no `useAuth()`, no
// uncached `fetch()`. Both anonymous and logged-in users reach `/`; the
// only auth-aware piece is the top-right `LandingAuth` Client Component
// that self-hydrates its session and swaps Anmelden/Registrieren for the
// "Mein Feed" pill. That swap happens after hydration, so the prerendered
// HTML is identical for everyone and the CDN can serve a single cache
// entry. Build-output for `/` is `●` (ISR) with `Cache-Control:
// s-maxage=3600, stale-while-revalidate=…`.
export const revalidate = 3600;

export default function LandingPage() {
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
      className="min-h-screen text-white flex flex-col items-center relative overflow-hidden gradient-mesh gradient-mesh-animated"
    >
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

          {/* Stats — async RSC (fn-15.9): awaits Supabase RPC at render
              time so the number is baked into the prerendered HTML. The
              Suspense fallback only ever paints during the brief Edge-
              regeneration window after a 1h ISR cache miss; it reserves
              the row's height so there's no CLS when the real badge
              streams in. */}
          <Suspense fallback={<StatsBadgeFallback />}>
            <LandingStats />
          </Suspense>

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

      {/*
        fn-15.5 (round-10 codex): explicit "Karte zeigen" link
        separated from the HeroSection's primary CTA. Points at /map
        (the actual Mapbox surface), not /entdecken (semantic text
        search). The spec moved the embedded Mapbox map off `/` to
        keep mapbox-gl (~480 KB) out of the landing bundle; clicking
        this link is the explicit opt-in to that cost. /map's layout
        wraps ModalShell (Auth + SavedEvents) so save-state on the
        markers works for logged-in users.
      */}
      <div className="mt-10 mb-10 flex flex-col items-center gap-3">
        {/* fn-15.5 round-12 (codex): <Link prefetch={false}> instead of
            a plain <a>. The prefetch={false} keeps the Mapbox-heavy
            /map route OFF the landing prefetch chain (the whole point
            of fn-15.5 was to keep mapbox-gl out of /), while Next.js's
            soft-nav still triggers the view-transition on click and
            avoids the full document reload a bare <a> would cause. */}
        <Link
          href="/map"
          prefetch={false}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 bg-white/[0.04] text-sm text-white/70 hover:text-white hover:border-white/30 hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.97] motion-reduce:transform-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Karte zeigen
        </Link>
        <p className="text-[11px] text-white/30 max-w-xs text-center leading-relaxed">
          Volle Karte mit allen Events lädt auf der nächsten Seite — schneller
          Start hier, Geo-Suche dort.
        </p>
      </div>

      {/* Footer */}
      <Footer />

    </div>
  );
}
