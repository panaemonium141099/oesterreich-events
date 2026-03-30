import { HeroSection } from '@/components/Landing/HeroSection';
import { LandingStats } from '@/components/Landing/LandingStats';
import { LandingAuth } from '@/components/Landing/LandingAuth';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { ParticleBackground } from '@/components/Landing/ParticleBackground';
import { Onboarding } from '@/components/Landing/Onboarding';
import { LiveActivity } from '@/components/Landing/LiveActivity';

export default async function LandingPage() {
  return (
    <div
      id="landing-curtain"
      className="min-h-screen text-white flex flex-col items-center justify-center relative overflow-hidden gradient-mesh"
    >
      {/* Particle effect behind content */}
      <ParticleBackground />

      {/* Onboarding overlay for first-time visitors */}
      <Onboarding />

      {/* Auth error toast */}
      <AuthErrorToast />

      {/* Top-right auth button */}
      <LandingAuth />

      <main className="flex flex-col items-center gap-6 md:gap-10 px-6 text-center max-w-3xl w-full">
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

      {/* Subtle bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </div>
  );
}
