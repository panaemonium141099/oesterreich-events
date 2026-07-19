'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
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
 *    locally. If yes, swaps the pill for Bell + Avatar.
 *
 * The brief 50–200 ms anon → logged-in flash on first paint is acceptable
 * because these are tiny corner-pixel elements, not content.
 *
 * Avatar opens a dropdown menu (Profil / Gespeichert / Feed / Gruppen /
 * Admin if role / Abmelden) — same UX as MapTopBar so the user has one
 * canonical place to reach all account surfaces. Profile (first_name,
 * avatar_url, role) is fetched once after session resolves; first paint
 * shows the email-initial fallback until that resolves.
 */

interface MiniProfile {
  first_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

function initialFromSession(session: Session, profile: MiniProfile | null): string {
  if (profile?.first_name) return profile.first_name[0]!.toUpperCase();
  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const firstName = typeof meta?.first_name === 'string' ? meta.first_name : null;
  const email = session.user.email ?? null;
  return (firstName?.[0] ?? email?.[0] ?? '?').toUpperCase();
}

export function V4TopNavAuth() {
  const t = useTranslations('Nav');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MiniProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const loadProfile = async (userId: string) => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, avatar_url, role')
          .eq('id', userId)
          .maybeSingle();
        if (mounted) setProfile((data as MiniProfile | null) ?? null);
      } catch {
        /* swallow — UI falls back to session-metadata initial */
      }
    };

    supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
      const s = res.data.session;
      if (!mounted || !s?.user) return;
      setSession(s);
      loadProfile(s.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, s: Session | null) => {
        if (!mounted) return;
        if (s?.user) {
          setSession(s);
          loadProfile(s.user.id);
        } else {
          setSession(null);
          setProfile(null);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Click-outside closes the dropdown without trapping focus.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  if (!session) {
    return (
      <Link
        href="/auth/login"
        className="press-haptic inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-[var(--v4-ink)] bg-[var(--v4-ink)]/0 border border-[var(--v4-hairline-3)] hover:bg-[var(--v4-ink)]/[0.04] transition-colors"
      >
        {t('login')}
      </Link>
    );
  }

  const email = session.user.email ?? '';
  const initial = initialFromSession(session, profile);
  const isAdmin = profile?.role === 'god' || profile?.role === 'admin';

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
  };

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

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Profilmenü"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="press-haptic inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--v4-ink)]/[0.06] text-[11px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] overflow-hidden"
        >
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            initial
          )}
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 min-w-[220px] rounded-xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface)] shadow-lg overflow-hidden z-50"
          >
            <div className="px-3.5 py-3 border-b border-[var(--v4-hairline-1)]">
              <div className="text-[13px] font-semibold text-[var(--v4-ink)] truncate">
                {profile?.first_name || email.split('@')[0]}
              </div>
              <div className="text-[11px] text-[var(--v4-ink-50)] truncate">{email}</div>
            </div>
            {[
              { href: '/profile', label: 'Mein Profil' },
              // /gemerkt = pure bookmark list; /saved is the Pläne workspace
              // (reachable via the "Meine Pläne" link in the top nav row).
              { href: '/gemerkt', label: 'Gespeichert' },
              { href: '/feed', label: 'Feed' },
              { href: '/groups', label: 'Meine Gruppen' },
            ].map((it) => (
              <Link
                key={it.href}
                href={it.href}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-3.5 py-2.5 text-[13px] text-[var(--v4-ink)] hover:bg-[var(--v4-ink)]/[0.04]"
              >
                {it.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-3.5 py-2.5 text-[13px] font-semibold text-[var(--v4-ink)] border-t border-[var(--v4-hairline-1)] hover:bg-[var(--v4-ink)]/[0.04]"
              >
                Admin Panel
              </Link>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="block w-full text-left px-3.5 py-2.5 text-[13px] text-[#c0392b] border-t border-[var(--v4-hairline-1)] hover:bg-[#c0392b]/[0.06]"
            >
              Abmelden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
