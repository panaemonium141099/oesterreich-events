import { HeroSection } from '@/components/Landing/HeroSection';
import { LandingStats } from '@/components/Landing/LandingStats';
import { LandingAuth } from '@/components/Landing/LandingAuth';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { ParticleBackground } from '@/components/Landing/ParticleBackground';
import { Onboarding } from '@/components/Landing/Onboarding';
import { LiveActivity } from '@/components/Landing/LiveActivity';
import { Footer } from '@/components/Legal/Footer';

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

      <main className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-10 px-6 text-center max-w-3xl w-full">
        {/* Brand */}
        <p
          className="text-xs sm:text-sm tracking-[0.3em] uppercase text-white/40 font-medium animate-fade-in opacity-0"
          style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}
        >
          Österreich Events
        </p>

        {/* Decorative line */}
        <div
          className="w-12 h-px bg-white/20 animate-fade-in opacity-0"
          style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}
        />

        {/* Headline */}
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

        {/* Live activity indicator */}
        <LiveActivity />

        {/* Search + CTA */}
        <HeroSection />
      </main>

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
