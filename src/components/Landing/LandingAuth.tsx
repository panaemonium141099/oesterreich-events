'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/**
 * LandingAuth — top-right auth pill on the landing.
 *
 * Self-contained: imports the browser supabase client directly instead of
 * leaning on `<AuthProvider>` so the landing route never has to mount the
 * full auth context (fn-15.5 bundle-win) and the page render stays ISR
 * (fn-15.7: no server-side cookies/auth at the route level).
 *
 * SSR renders the anonymous CTA (Anmelden / Registrieren) so the ISR-baked
 * HTML is correct for the >95 % anonymous traffic + Googlebot. On hydration
 * we ask the supabase client if there's a local session — if yes, swap the
 * pair for a "Mein Feed" button + small avatar initial. Brief flash from
 * anonymous → logged-in is acceptable here (~50-200 ms) because the pill is
 * a tiny corner element, not content the user is reading.
 */
export function LandingAuth() {
  const [authed, setAuthed] = useState(false);
  const [initial, setInitial] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || !session?.user) return;
      setAuthed(true);
      const meta = session.user.user_metadata as Record<string, unknown> | undefined;
      const firstName = typeof meta?.first_name === 'string' ? meta.first_name : null;
      const email = session.user.email ?? null;
      const ch = (firstName?.[0] ?? email?.[0] ?? '?').toUpperCase();
      setInitial(ch);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setAuthed(true);
        const meta = session.user.user_metadata as Record<string, unknown> | undefined;
        const firstName = typeof meta?.first_name === 'string' ? meta.first_name : null;
        const email = session.user.email ?? null;
        const ch = (firstName?.[0] ?? email?.[0] ?? '?').toUpperCase();
        setInitial(ch);
      } else {
        setAuthed(false);
        setInitial(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div
      className="fixed top-6 right-6 z-50 animate-fade-in opacity-0"
      style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
    >
      {authed ? (
        <Link
          href="/feed"
          className="flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-sm text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300"
          aria-label="Zum Feed"
        >
          <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-semibold text-white/80">
            {initial ?? '·'}
          </span>
          Mein Feed
        </Link>
      ) : (
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
      )}
    </div>
  );
}
