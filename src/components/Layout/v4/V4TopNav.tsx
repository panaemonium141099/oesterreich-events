'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { V4Logo } from './V4Logo';
import { V4TopNavAuth } from './V4TopNavAuth';
import { V4SearchInput } from './V4SearchInput';

/**
 * V4TopNav — global sticky top navigation introduced in v4 redesign Phase 1.
 *
 * Mounted in src/app/layout.tsx (root) so every route — public, semi-public
 * (entdecken, blog), and auth-gated — gets the same chrome. Auth-aware
 * pieces live in <V4TopNavAuth /> which self-hydrates without an
 * AuthProvider, so anonymous routes don't drag @supabase/supabase-js into
 * their initial bundle (see fn-15.5).
 *
 * Active-state derives from usePathname() with startsWith matching:
 *   /, /entdecken*                → Entdecken
 *   /artists*                     → Künstler
 *   /map*                         → Karte
 *   /plans*, /saved*              → Meine Pläne (Phase 1 stub redirects)
 *
 * Below md the central pill-nav hides; only the logo + the auth island
 * remain visible on mobile (the mobile primary nav is V4TabBar at the
 * bottom edge).
 */

interface NavItem {
  href: string;
  label: string;
  matches: ReadonlyArray<string>;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: '/',        label: 'Entdecken',   matches: ['/', '/entdecken'] },
  { href: '/artists', label: 'Künstler',    matches: ['/artists'] },
  { href: '/map',     label: 'Karte',       matches: ['/map'] },
  { href: '/plans',   label: 'Meine Pläne', matches: ['/plans', '/saved'] },
];

function isActive(pathname: string, matches: ReadonlyArray<string>): boolean {
  return matches.some(m =>
    m === '/' ? pathname === '/' : pathname === m || pathname.startsWith(`${m}/`),
  );
}

export function V4TopNav() {
  const pathname = usePathname() ?? '/';

  return (
    <header
      className="sticky top-0 z-30 h-16 border-b border-[var(--v4-hairline-2)] bg-[var(--v4-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--v4-surface)]/80"
      data-v4-topnav
    >
      <div className="h-full max-w-[1180px] mx-auto px-4 md:px-14 flex items-center gap-5">
        <Link href="/" className="press-haptic flex items-center" aria-label="Startseite">
          <V4Logo />
        </Link>

        <nav className="hidden md:flex gap-0.5 ml-3.5" aria-label="Hauptnavigation">
          {NAV_ITEMS.map(item => {
            const active = isActive(pathname, item.matches);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={
                  'press-haptic px-3.5 py-2 rounded-full text-[13.5px] font-semibold tracking-[-0.005em] transition-colors ' +
                  (active
                    ? 'bg-[var(--v4-surface-elevated)] text-[var(--v4-ink)]'
                    : 'text-[var(--v4-ink-50)] hover:text-[var(--v4-ink-70)]')
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <V4SearchInput variant="nav"/>

        <V4TopNavAuth />
      </div>
    </header>
  );
}
