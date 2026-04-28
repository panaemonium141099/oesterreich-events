import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { HeroSection } from '@/components/Landing/HeroSection';
import { LandingStats } from '@/components/Landing/LandingStats';
import { LandingAuth } from '@/components/Landing/LandingAuth';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { ParticleBackground } from '@/components/Landing/ParticleBackground';
import { Onboarding } from '@/components/Landing/Onboarding';
import { LiveActivity } from '@/components/Landing/LiveActivity';
import { Footer } from '@/components/Legal/Footer';
import { LandingSections } from '@/components/Landing/LandingSections';

// WebSite + Organization JSON-LD live now in the root layout so every page
// emits them, not just the landing. No page-local JSON-LD here anymore.

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  // Allow ?home to bypass redirect and show landing page
  const forceHome = 'home' in params;

  if (!forceHome) {
    // Auth check with hard timeout — Supabase outages were causing the
    // landing page to hang at 50% loading on mobile (verified 2026-04-28
    // when Supabase had a connection-timeout incident; auth.getUser()
    // never returned, the server render blocked indefinitely, the user
    // saw an unfinished progress bar).
    //
    // Wrap the call in Promise.race against a 2s timer. If Supabase
    // doesn't answer in time we render the landing page anonymously
    // (no redirect to /feed). A logged-in user might briefly see the
    // landing page during a Supabase blip — they can click "Map" /
    // "Feed" and re-auth via client-side flows that recover quickly.
    // Trade-off: degraded auth-aware UX during outages, vs. site
    // staying alive for everyone (anonymous traffic, Googlebot,
    // first-time visitors).
    try {
      const supabase = await createServerSupabaseClient();
      const userResult = await Promise.race<{ data: { user: unknown | null } } | null>([
        supabase.auth.getUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (userResult?.data?.user) {
        redirect('/feed');
      }
    } catch {
      // Server-side Supabase fetch threw — render anonymously.
    }
  }

  return (
    <div
      id="landing-curtain"
      className="min-h-screen text-white flex flex-col items-center relative overflow-hidden gradient-mesh"
    >
      {/* Particle effect behind content */}
      <ParticleBackground />

      {/* Onboarding overlay for first-time visitors */}
      <Onboarding />

      {/* Auth error toast */}
      <AuthErrorToast />

      {/* Top-right auth button */}
      <LandingAuth />

      <main className="flex-1 min-h-screen flex flex-col items-center justify-center gap-8 md:gap-12 px-6 text-center max-w-3xl w-full">
        {/* Headline + Stats + Tagline — tightly grouped */}
        <div className="flex flex-col items-center gap-3 md:gap-4">
          <h1
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight animate-fade-in-up opacity-0 leading-[1.1]"
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
            className="text-white/30 text-sm tracking-[0.12em] animate-fade-in opacity-0"
            style={{ animationDelay: '0.75s', animationFillMode: 'forwards' }}
          >
            Die größte Eventdatenbank Österreichs
          </p>
        </div>

        {/* Search + CTA */}
        <HeroSection />
      </main>

      {/* Landing sections below the hero */}
      <LandingSections />

      {/* Footer */}
      <Footer />

    </div>
  );
}
