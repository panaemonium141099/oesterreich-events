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
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect('/feed');
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
