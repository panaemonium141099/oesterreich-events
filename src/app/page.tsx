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

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'LassTreffen.at',
  url: 'https://lasstreffen.at',
  description: 'Über 40.000 Veranstaltungen in ganz Österreich auf einer interaktiven Karte.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://lasstreffen.at/map?search={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LassTreffen.at',
  url: 'https://lasstreffen.at',
  description: 'Österreichische Event-Discovery-Plattform mit über 40.000 Veranstaltungen auf einer interaktiven Karte.',
};

export default async function LandingPage() {
  // Logged-in users go straight to their feed
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    redirect('/feed');
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

      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, '\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, '\u003c') }}
      />
    </div>
  );
}
