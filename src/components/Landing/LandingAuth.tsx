import Link from 'next/link';

/**
 * LandingAuth — fn-15.5 round-8 (codex), fn-15.7 (Edge-Middleware):
 *
 * Pre-refactor this was a client component that called the old auth
 * context to swap between an "Anmelden / Registrieren" pair and a
 * logged-in user dropdown (avatar + profile menu). That import-graph
 * dragged auth-context.tsx -> @supabase/ssr into the landing-page bundle
 * even though anonymous visitors (95% of traffic + Googlebot) gained
 * nothing from it.
 *
 * As of fn-15.7 the per-page `AuthRedirectGate` async Server Component
 * is gone — the redirect for logged-in visitors happens at the Edge in
 * `src/middleware.ts` (cookie-sniff -> 307 to /feed). The people who
 * ever reach LandingAuth are therefore:
 *   - Anonymous visitors → want the auth CTA.
 *   - The rare logged-in user who appends `?home` to bypass the Edge
 *     gate. They miss the profile-dropdown UI but the SocialNav
 *     (mounted on authenticated routes) covers profile / signout from
 *     anywhere else.
 *
 * So this component is now a pure server component with two `<Link>`
 * tags. Zero auth-context imports → auth code stays out of the landing
 * chunk, and the landing route stays a fully static ISR shell.
 */
export function LandingAuth() {
  return (
    <div
      className="fixed top-6 right-6 z-50 animate-fade-in opacity-0"
      style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
    >
      <div className="flex items-center gap-3">
        <Link
          href="/auth/login"
          className="px-4 py-2 rounded-full text-sm text-white/60 hover:text-white transition-colors duration-300"
        >
          Anmelden
        </Link>
        <Link
          href="/auth/register"
          className="px-4 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-sm text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300"
        >
          Registrieren
        </Link>
      </div>
    </div>
  );
}
