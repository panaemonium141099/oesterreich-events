'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * V4TopNavAuth — auth-aware right-hand cluster of the v4 top nav.
 *
 * Self-hydrating, identical pattern to src/components/Landing/LandingAuth.tsx:
 *  - Mounts on Server with the anonymous state baked in (the "Anmelden"
 *    pill). That's what ISR caches and what >95 % of traffic (incl. crawlers)
 *    sees. NO AuthProvider in Root Layout — fn-15.5 Bundle-Win bleibt intakt.
 *  - On Client, asks the supabase browser client whether a session exists
 *    locally. If yes, swaps the pill for Bell + Avatar-Initial.
 *
 * The brief 50–200 ms anon → logged-in flash on first paint is acceptable
 * because these are tiny corner-pixel elements, not content.
 *
 * Phase 1 scope: Bell linkt 1:1 zu /notifications (Bestandsroute), Avatar
 * linkt zu /profile. Realtime-Dropdown-Sheet kommt in einer späteren Phase.
 */

function initialFromSession(session: Session): string {
  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const firstName = typeof meta?.first_name === 'string' ? meta.first_name : null;
  const email = session.user.email ?? null;
  return (firstName?.[0] ?? email?.[0] ?? '?').toUpperCase();
}

export function V4TopNavAuth() {
  const [authed, setAuthed] = useState(false);
  const [initial, setInitial] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
      const session = res.data.session;
      if (!mounted || !session?.user) return;
      setAuthed(true);
      setInitial(initialFromSession(session));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (!mounted) return;
        if (session?.user) {
          setAuthed(true);
          setInitial(initialFromSession(session));
        } else {
          setAuthed(false);
          setInitial(null);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!authed) {
    return (
      <Link
        href="/auth/login"
        className="press-haptic inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-[var(--v4-ink)] bg-[var(--v4-ink)]/0 border border-[var(--v4-hairline-3)] hover:bg-[var(--v4-ink)]/[0.04] transition-colors"
      >
        Anmelden
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/notifications"
        aria-label="Benachrichtigungen"
        className="press-haptic relative inline-flex items-center justify-center w-9 h-9 rounded-full text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
      >
        {/* Bell icon — inline SVG so we don't pull lucide-react for one icon */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <span
          aria-hidden="true"
          className="absolute top-[7px] right-[7px] w-2 h-2 rounded-full bg-[var(--v4-match)] ring-2 ring-[var(--v4-surface)]"
        />
      </Link>

      <Link
        href="/profile"
        aria-label="Profil"
        className="press-haptic inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--v4-ink)]/[0.06] text-[11px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
      >
        {initial ?? '·'}
      </Link>
    </div>
  );
}
