'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * V4TabBar — fixed mobile bottom-tab-bar introduced in v4 redesign Phase 1.
 *
 * Five primary tabs (Entdecken · Künstler · Karte · Pläne · Profil) match
 * the bottom-tab-bar in mockups/v4-shared.jsx (V4TabBar). Desktop hides
 * this whole bar (md:hidden) since V4TopNav already exposes the same
 * destinations.
 *
 * Auth state for the Profil tab follows the same self-hydration pattern
 * as V4TopNavAuth: anonymous render points the Profil tab at /auth/login,
 * client hydration swaps it to /profile if a session is found. Avoids
 * pulling AuthProvider into the root layout (fn-15.5 bundle discipline).
 *
 * The component renders its own bottom-spacer (`data-v4-tabbar-spacer`)
 * so callers don't have to add padding on every page; the spacer is
 * md:hidden so desktop stays untouched.
 */

interface TabItem {
  /** The href shown when authed; for /profile we override to /auth/login when anon. */
  href: string;
  label: string;
  matches: ReadonlyArray<string>;
  icon: 'home' | 'music' | 'map' | 'ticket' | 'user';
}

const TABS: ReadonlyArray<TabItem> = [
  { href: '/entdecken', label: 'Entdecken', matches: ['/', '/entdecken'], icon: 'home' },
  { href: '/artists',  label: 'Künstler',  matches: ['/artists'],         icon: 'music' },
  { href: '/map',      label: 'Karte',     matches: ['/map'],             icon: 'map' },
  { href: '/plans',    label: 'Pläne',     matches: ['/plans', '/saved'], icon: 'ticket' },
  { href: '/profile',  label: 'Profil',    matches: ['/profile', '/auth'], icon: 'user' },
];

function isActive(pathname: string, matches: ReadonlyArray<string>): boolean {
  return matches.some(m =>
    m === '/' ? pathname === '/' : pathname === m || pathname.startsWith(`${m}/`),
  );
}

function TabIcon({ name, active }: { name: TabItem['icon']; active: boolean }) {
  const stroke = active ? 2.2 : 1.6;
  const common = {
    width: 21,
    height: 21,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'music':
      return (
        <svg {...common}>
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
      );
    case 'ticket':
      return (
        <svg {...common}>
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
  }
}

export function V4TabBar() {
  const pathname = usePathname() ?? '/';
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
      if (mounted && res.data.session?.user) setAuthed(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        if (!mounted) return;
        setAuthed(!!session?.user);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // /widget/* wird als iframe in fremde Seiten eingebettet — keine
  // Site-Chrome dort (nach den Hooks, wegen Rules-of-Hooks).
  if (pathname === '/widget' || pathname.startsWith('/widget/')) return null;

  return (
    <>
      <nav
        aria-label="Mobile Hauptnavigation"
        className="md:hidden fixed left-0 right-0 bottom-0 z-25 pb-[26px] pt-2 border-t border-[var(--v4-hairline-2)] bg-gradient-to-t from-[rgba(10,10,12,0.96)] to-[rgba(10,10,12,0.78)] backdrop-blur-xl flex justify-around items-center"
      >
        {TABS.map(tab => {
          const active = isActive(pathname, tab.matches);
          const href =
            tab.href === '/profile' && !authed ? '/auth/login' : tab.href;
          return (
            <Link
              key={tab.label}
              href={href}
              data-active={active}
              aria-label={tab.label}
              className={
                'press-haptic flex flex-col items-center gap-0.5 px-1 py-1 flex-1 min-w-0 ' +
                (active ? 'text-[var(--v4-ink)]' : 'text-[var(--v4-ink-50)]')
              }
            >
              <TabIcon name={tab.icon} active={active} />
              <span className="text-[10px] font-semibold tracking-[0.2px]">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div
        data-v4-tabbar-spacer
        aria-hidden="true"
        className="md:hidden h-[76px]"
      />
    </>
  );
}
