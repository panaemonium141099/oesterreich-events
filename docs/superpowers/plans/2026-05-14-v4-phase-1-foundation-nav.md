# v4 Redesign Phase 1 — Foundation & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Etabliere globale v4-Top-Nav + Mobile-Tab-Bar inkl. D7-Logo und v4-Designtokens, ohne Event-/Map-/Auth-/Feature-Logik zu berühren.

**Architecture:** 4 neue UI-Komponenten unter `src/components/Layout/v4/` (V4Logo RSC-fähig, V4TopNav + V4TopNavAuth + V4TabBar als Client), global gemountet im Root-Layout. Auth-Island self-hydratet (kein AuthProvider-Mount → fn-15.5 Bundle-Disziplin bleibt). `/plans` als Redirect-Stub zu `/saved`. Bisheriges `LandingAuth`-Pill und `SocialNav`-Mount werden abgelöst.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Vitest 4 + @testing-library/react · happy-dom · Supabase SSR client.

**Spec:** `docs/superpowers/specs/2026-05-14-v4-phase-1-foundation-nav-design.md`

---

## File Structure

**Add:**
- `src/components/Layout/v4/V4Logo.tsx` — Wordmark + SVG-Pin
- `src/components/Layout/v4/V4TopNav.tsx` — Sticky Desktop-Nav (Client)
- `src/components/Layout/v4/V4TopNavAuth.tsx` — Self-hydrating Auth-Island (Client)
- `src/components/Layout/v4/V4TabBar.tsx` — Fixed Mobile-Tab-Bar (Client)
- `src/components/Layout/v4/index.ts` — Re-exports
- `src/app/plans/page.tsx` — 5-Zeilen Redirect-Stub
- `src/__tests__/components/v4/V4Logo.test.tsx`
- `src/__tests__/components/v4/V4TopNav.test.tsx`
- `src/__tests__/components/v4/V4TopNavAuth.test.tsx`
- `src/__tests__/components/v4/V4TabBar.test.tsx`

**Modify:**
- `src/app/globals.css` — v4-Token-Block am Ende anhängen
- `src/app/layout.tsx` — `<V4TopNav />` und `<V4TabBar />` global mounten
- `src/app/page.tsx` — `<LandingAuth />` raus, Beta-Banner-Margin anpassen
- `src/components/Layout/AppShell.tsx` — `<SocialNav />`-Mount entfernen, Prop bleibt als No-Op

---

## Task 1: v4-Designtokens in globals.css

**Files:**
- Modify: `src/app/globals.css` (anhängen am Ende, aktuell 1022 Zeilen)

- [ ] **Step 1: Append token block**

Anhängen ans Ende von `src/app/globals.css`:

```css

/* ═══════════════════════════════════════════════════════════════════
   v4 Redesign — Foundation Tokens (Phase 1)
   Additiv zu bestehenden --color-* und --planer-* Tokens.
   Verwendung: ab Phase 1 Nav, ab Phase 2 in neuen Card-Komponenten.
   Spec: docs/superpowers/specs/2026-05-14-v4-phase-1-foundation-nav-design.md
   ═══════════════════════════════════════════════════════════════════ */
:root {
  --v4-ink:              #ffffff;
  --v4-ink-70:           rgba(255, 255, 255, 0.70);
  --v4-ink-50:           rgba(255, 255, 255, 0.50);
  --v4-ink-30:           rgba(255, 255, 255, 0.30);

  --v4-hairline-1:       rgba(255, 255, 255, 0.04);
  --v4-hairline-2:       rgba(255, 255, 255, 0.06);
  --v4-hairline-3:       rgba(255, 255, 255, 0.10);
  --v4-hairline-4:       rgba(255, 255, 255, 0.15);

  --v4-surface:          #0a0a0c;
  --v4-surface-elevated: #141416;
  --v4-surface-inset:    #050506;

  /* Semantic accents — bereits hier definiert damit Phase 1 Bell-Dot
     --v4-match nutzen kann. Vollständige Verwendung ab Phase 2. */
  --v4-ticket:           #d4b896;
  --v4-match:            #f5b942;
  --v4-go:               #7bb794;
  --v4-alert:            #c67079;
}
```

- [ ] **Step 2: Verify build still works**

Run: `npm run build`
Expected: Build erfolgreich, keine CSS-Warnings, ISR-Symbol `●` für `/` weiterhin im Output.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(v4): add foundation design tokens (Phase 1)

Adds --v4-* tokens for ink, hairlines, surfaces, and semantic accents
(ticket/match/go/alert). Additive only — no existing tokens renamed.
"
```

---

## Task 2: V4Logo Component (TDD)

**Files:**
- Create: `src/components/Layout/v4/V4Logo.tsx`
- Test: `src/__tests__/components/v4/V4Logo.test.tsx`

- [ ] **Step 1: Write failing test**

Erstelle `src/__tests__/components/v4/V4Logo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4Logo } from '@/components/Layout/v4/V4Logo';

describe('V4Logo', () => {
  it('renders the three text parts of the wordmark', () => {
    render(<V4Logo />);
    expect(screen.getByText('lass')).toBeInTheDocument();
    expect(screen.getByText('treffen')).toBeInTheDocument();
    expect(screen.getByText('at')).toBeInTheDocument();
  });

  it('treffen is the bold emphasis part', () => {
    render(<V4Logo />);
    const treffen = screen.getByText('treffen');
    // font-weight 800 baked into inline styles (extra-bold)
    expect(treffen.style.fontWeight).toBe('800');
  });

  it('lass and at are regular weight', () => {
    render(<V4Logo />);
    expect(screen.getByText('lass').style.fontWeight).toBe('400');
    expect(screen.getByText('at').style.fontWeight).toBe('400');
  });

  it('renders the inline pin SVG between treffen and at', () => {
    const { container } = render(<V4Logo />);
    const svg = container.querySelector('svg[data-v4-logo-pin]');
    expect(svg).toBeTruthy();
    // Pin uses warm accent red #c8553d (LT_PIN from design bundle)
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('#c8553d');
  });

  it('size="sm" renders smaller font than default md', () => {
    const { rerender, container } = render(<V4Logo size="md" />);
    const md = container.firstChild as HTMLElement;
    const mdSize = md.style.fontSize;
    rerender(<V4Logo size="sm" />);
    const sm = container.firstChild as HTMLElement;
    expect(sm.style.fontSize).not.toBe(mdSize);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test -- src/__tests__/components/v4/V4Logo.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/Layout/v4/V4Logo"`.

- [ ] **Step 3: Implement V4Logo**

Erstelle `src/components/Layout/v4/V4Logo.tsx`:

```tsx
/**
 * V4Logo — D7-Wordmark "lass·treffen·📍·at"
 *
 * Lifted from mockups/v4-shared.jsx (V4Logo + V4LogoPin). The pin is a
 * map-marker SVG (not a heart/balloon) baked inline so there's zero
 * extra network request. Renders without 'use client' so it stays a
 * Server Component when imported into RSC trees, but composes safely
 * inside Client-Components too (becomes part of the client bundle when
 * imported there).
 *
 * Two sizes: 'sm' (15 px) for compact contexts (mobile top-bar), 'md'
 * (17 px, default) for the desktop nav.
 *
 * Letter-spacing -0.05em comes straight from the design tokens so the
 * pin sits visually tight to the surrounding letters.
 */

const LT_PIN = '#c8553d';

interface V4LogoProps {
  size?: 'sm' | 'md';
  /** Light surfaces (rare) flip the dot inside the pin to white. */
  light?: boolean;
}

export function V4Logo({ size = 'md', light = false }: V4LogoProps) {
  const fontPx = size === 'sm' ? 15 : 17;
  const pinPx = fontPx * 0.55;
  const ink = light ? '#0a0a0c' : 'var(--v4-ink, #ffffff)';
  const dotColor = light ? '#ffffff' : 'var(--v4-surface, #0a0a0c)';

  return (
    <span
      style={{
        fontFamily: "var(--font-app, 'Inter'), system-ui, -apple-system, sans-serif",
        fontSize: fontPx,
        letterSpacing: '-0.05em',
        color: ink,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
      }}
      data-v4-logo
    >
      <span style={{ fontWeight: 400 }}>lass</span>
      <span style={{ fontWeight: 800 }}>treffen</span>
      <svg
        data-v4-logo-pin
        width={pinPx}
        height={pinPx * 1.25}
        viewBox="0 0 24 30"
        style={{
          display: 'inline-block',
          verticalAlign: 'baseline',
          margin: '0 0.04em',
        }}
        aria-hidden="true"
      >
        <path
          d="M12 1 C 18.5 1 23 5.5 23 11.5 C 23 19 12 29 12 29 C 12 29 1 19 1 11.5 C 1 5.5 5.5 1 12 1 Z"
          fill={LT_PIN}
        />
        <circle cx="12" cy="11.5" r="4" fill={dotColor} />
      </svg>
      <span style={{ fontWeight: 400 }}>at</span>
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/v4/V4Logo.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout/v4/V4Logo.tsx src/__tests__/components/v4/V4Logo.test.tsx
git commit -m "feat(v4): add V4Logo wordmark component (Phase 1)

D7-Wordmark 'lass·treffen·📍·at' as a single inline component with
zero external assets. SSR-safe (no 'use client'), composable into both
RSC and Client trees. 5 vitest specs covering structure + size prop.
"
```

---

## Task 3: V4TopNavAuth Component (TDD)

**Files:**
- Create: `src/components/Layout/v4/V4TopNavAuth.tsx`
- Test: `src/__tests__/components/v4/V4TopNavAuth.test.tsx`

- [ ] **Step 1: Write failing test**

Erstelle `src/__tests__/components/v4/V4TopNavAuth.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Hoisted mock so it's set up before module import.
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

import { V4TopNavAuth } from '@/components/Layout/v4/V4TopNavAuth';

describe('V4TopNavAuth', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockClear();
  });

  it('renders Anmelden link by default (SSR / anon)', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<V4TopNavAuth />);
    expect(screen.getByRole('link', { name: /anmelden/i })).toBeInTheDocument();
  });

  it('shows bell + avatar after hydration when session present', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: {
            email: 'jona@example.com',
            user_metadata: { first_name: 'Jona' },
          },
        },
      },
    });
    render(<V4TopNavAuth />);
    await waitFor(() => {
      expect(screen.getByLabelText(/benachrichtigungen/i)).toBeInTheDocument();
    });
    // Initial of first_name "J"
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('subscribes and unsubscribes to auth state changes on unmount', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const unsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
    const { unmount } = render(<V4TopNavAuth />);
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('Bell linkt zu /notifications für authed user', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: { user: { email: 'jona@example.com', user_metadata: {} } },
      },
    });
    render(<V4TopNavAuth />);
    await waitFor(() => {
      const bell = screen.getByLabelText(/benachrichtigungen/i);
      expect(bell.closest('a')?.getAttribute('href')).toBe('/notifications');
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test -- src/__tests__/components/v4/V4TopNavAuth.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement V4TopNavAuth**

Erstelle `src/components/Layout/v4/V4TopNavAuth.tsx`:

```tsx
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/v4/V4TopNavAuth.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout/v4/V4TopNavAuth.tsx src/__tests__/components/v4/V4TopNavAuth.test.tsx
git commit -m "feat(v4): add self-hydrating auth island (Phase 1)

V4TopNavAuth mirrors the LandingAuth pattern: SSR renders anonymous
state, client hydrates session via supabase browser client. No
AuthProvider mount in root — fn-15.5 bundle discipline preserved.
Phase 1 Bell linkt /notifications, Avatar linkt /profile.
"
```

---

## Task 4: V4TopNav Component (TDD)

**Files:**
- Create: `src/components/Layout/v4/V4TopNav.tsx`
- Test: `src/__tests__/components/v4/V4TopNav.test.tsx`

- [ ] **Step 1: Write failing test**

Erstelle `src/__tests__/components/v4/V4TopNav.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/navigation usePathname — vary per test via mockReturnValue.
const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock supabase client (used by V4TopNavAuth island)
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

import { V4TopNav } from '@/components/Layout/v4/V4TopNav';

describe('V4TopNav', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/');
  });

  it('renders the wordmark logo', () => {
    render(<V4TopNav />);
    expect(screen.getByText('treffen')).toBeInTheDocument();
  });

  it('renders all four primary nav links', () => {
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: 'Entdecken' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Künstler' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Karte' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meine Pläne' })).toBeInTheDocument();
  });

  it('Entdecken is active on /', () => {
    mockPathname.mockReturnValue('/');
    render(<V4TopNav />);
    const link = screen.getByRole('link', { name: 'Entdecken' });
    expect(link.getAttribute('data-active')).toBe('true');
  });

  it('Entdecken is active on /entdecken', () => {
    mockPathname.mockReturnValue('/entdecken');
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: 'Entdecken' }).getAttribute('data-active')).toBe('true');
  });

  it('Künstler is active on /artists/spotify-import (sub-route match)', () => {
    mockPathname.mockReturnValue('/artists/spotify-import');
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: 'Künstler' }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('link', { name: 'Entdecken' }).getAttribute('data-active')).toBe('false');
  });

  it('Meine Pläne is active on both /plans and /saved (Phase 1 stub redirect)', () => {
    mockPathname.mockReturnValue('/saved');
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: 'Meine Pläne' }).getAttribute('data-active')).toBe('true');
  });

  it('renders the search affordance linking to /entdecken', () => {
    render(<V4TopNav />);
    const search = screen.getByRole('link', { name: /suchen/i });
    expect(search.getAttribute('href')).toBe('/entdecken');
  });

  it('renders the auth island (Anmelden pill for anon)', () => {
    render(<V4TopNav />);
    expect(screen.getByRole('link', { name: /anmelden/i })).toBeInTheDocument();
  });

  it('has sticky positioning and z-index for layering', () => {
    const { container } = render(<V4TopNav />);
    const header = container.querySelector('header');
    expect(header?.className).toMatch(/sticky/);
    expect(header?.className).toMatch(/top-0/);
    expect(header?.className).toMatch(/z-30/);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test -- src/__tests__/components/v4/V4TopNav.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement V4TopNav**

Erstelle `src/components/Layout/v4/V4TopNav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { V4Logo } from './V4Logo';
import { V4TopNavAuth } from './V4TopNavAuth';

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

        {/* Search affordance — Phase 1: linkt direkt zu /entdecken. Echtes
            ⌘K-Modal mit Künstler/Events-Tabs kommt in einer späteren Phase. */}
        <Link
          href="/entdecken"
          aria-label="Künstler, Event oder Ort suchen"
          className="press-haptic hidden lg:inline-flex items-center gap-2 min-w-[260px] px-3 py-2 rounded-full border border-[var(--v4-hairline-2)] text-[13px] text-[var(--v4-ink-50)] hover:text-[var(--v4-ink-70)] hover:border-[var(--v4-hairline-3)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="flex-1 text-left">Künstler, Event oder Ort suchen</span>
          <kbd className="px-1.5 py-px text-[10px] rounded border border-[var(--v4-hairline-2)] text-[var(--v4-ink-30)]">
            ⌘ K
          </kbd>
        </Link>

        <V4TopNavAuth />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/v4/V4TopNav.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout/v4/V4TopNav.tsx src/__tests__/components/v4/V4TopNav.test.tsx
git commit -m "feat(v4): add global sticky top navigation (Phase 1)

V4TopNav with 4 primary nav items, search affordance, and auth island.
Active state derives from usePathname with startsWith matching.
Mobile (<md) hides the central pill nav — V4TabBar handles primary
mobile navigation. 9 vitest specs cover structure + active routing.
"
```

---

## Task 5: V4TabBar Component (TDD)

**Files:**
- Create: `src/components/Layout/v4/V4TabBar.tsx`
- Test: `src/__tests__/components/v4/V4TabBar.test.tsx`

- [ ] **Step 1: Write failing test**

Erstelle `src/__tests__/components/v4/V4TabBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const mockPathname = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

const mockGetSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

import { V4TabBar } from '@/components/Layout/v4/V4TabBar';

describe('V4TabBar', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/');
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  it('renders all 5 primary mobile tabs', () => {
    render(<V4TabBar />);
    expect(screen.getByRole('link', { name: /entdecken/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /künstler/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /karte/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pläne/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profil/i })).toBeInTheDocument();
  });

  it('Profil-Tab links to /auth/login when anon', () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<V4TabBar />);
    expect(screen.getByRole('link', { name: /profil/i }).getAttribute('href')).toBe('/auth/login');
  });

  it('Profil-Tab links to /profile when authed', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'a@b.c', user_metadata: {} } } },
    });
    render(<V4TabBar />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /profil/i }).getAttribute('href')).toBe('/profile');
    });
  });

  it('renders the bottom-padding spacer so content does not get hidden', () => {
    const { container } = render(<V4TabBar />);
    const spacer = container.querySelector('[data-v4-tabbar-spacer]');
    expect(spacer).toBeTruthy();
    expect(spacer?.className).toContain('md:hidden');
  });

  it('nav itself is md:hidden (desktop hides this bar)', () => {
    const { container } = render(<V4TabBar />);
    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('md:hidden');
  });

  it('marks the matching tab as active', () => {
    mockPathname.mockReturnValue('/map');
    render(<V4TabBar />);
    expect(screen.getByRole('link', { name: /karte/i }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('link', { name: /entdecken/i }).getAttribute('data-active')).toBe('false');
  });

  it('Meine Pläne tab active on /saved (Phase 1 stub redirect)', () => {
    mockPathname.mockReturnValue('/saved');
    render(<V4TabBar />);
    expect(screen.getByRole('link', { name: /pläne/i }).getAttribute('data-active')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npm test -- src/__tests__/components/v4/V4TabBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement V4TabBar**

Erstelle `src/components/Layout/v4/V4TabBar.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  { href: '/',         label: 'Entdecken', matches: ['/', '/entdecken'], icon: 'home' },
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

    supabase.auth.getSession().then(res => {
      if (mounted && res.data.session?.user) setAuthed(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setAuthed(!!session?.user);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/v4/V4TabBar.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout/v4/V4TabBar.tsx src/__tests__/components/v4/V4TabBar.test.tsx
git commit -m "feat(v4): add mobile bottom tab bar (Phase 1)

V4TabBar with 5 primary tabs and inline Lucide-style SVG icons.
Profil tab auto-routes to /auth/login when anon, /profile when authed
(same self-hydration pattern as V4TopNavAuth). Includes md:hidden
bottom-spacer so callers don't need page-level padding.
"
```

---

## Task 6: Re-export Barrel

**Files:**
- Create: `src/components/Layout/v4/index.ts`

- [ ] **Step 1: Create barrel**

Erstelle `src/components/Layout/v4/index.ts`:

```ts
/**
 * v4 redesign layout primitives. Phase 1: navigation chrome.
 * Future phases will add V4Card, V4Badge, V4StickyBar, V4AuthModal, etc.
 */
export { V4Logo } from './V4Logo';
export { V4TopNav } from './V4TopNav';
export { V4TopNavAuth } from './V4TopNavAuth';
export { V4TabBar } from './V4TabBar';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout/v4/index.ts
git commit -m "feat(v4): add v4 layout barrel re-export"
```

---

## Task 7: /plans Stub Route

**Files:**
- Create: `src/app/plans/page.tsx`

- [ ] **Step 1: Create stub page**

Erstelle `src/app/plans/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

/**
 * /plans — Phase 1 stub. The "Meine Pläne" tab in V4TopNav / V4TabBar
 * links here so the route is functional, but the real Plans page (which
 * consolidates /saved + /groups into a unified plan list with Plan-Wizard
 * deep-links) ships in Phase 5 of the v4 redesign.
 *
 * Until then, redirect to the existing /saved page so users always land
 * on something meaningful when they tap the tab.
 */
export default function PlansStubPage(): never {
  redirect('/saved');
}
```

- [ ] **Step 2: Verify build + redirect works in dev**

Run: `npm run dev` (background)
Open `http://localhost:3000/plans` — expect 307/308 redirect to `/saved`.
Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/app/plans/page.tsx
git commit -m "feat(v4): add /plans stub redirecting to /saved (Phase 1)

Makes the 'Meine Pläne' tab in V4TopNav and V4TabBar functional.
Real Plans page ships in Phase 5 — this stub will be replaced then.
"
```

---

## Task 8: Mount V4TopNav + V4TabBar in Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add imports + mount components**

In `src/app/layout.tsx`, im Import-Block oberhalb von `import { CRITICAL_CSS } ...` einen neuen Import einfügen:

```tsx
import { V4TopNav, V4TabBar } from '@/components/Layout/v4';
```

Im JSX-Body, zwischen `<RouteTransitions />` und dem `<div className="route-root">`, V4TopNav einfügen; und `<V4TabBar />` direkt nach dem schließenden Tag von `<div className="route-root">`:

```tsx
        <RouteTransitions />
        <V4TopNav />
        <div className="route-root" style={{ viewTransitionName: 'route-root' }}>
          {children}
        </div>
        <V4TabBar />
        {modal}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build erfolgreich, kein TS-Error, ISR-Symbol `●` für `/` bleibt im Output.

- [ ] **Step 3: Verify in dev**

Run: `npm run dev` (background)
- Open `http://localhost:3000/` — V4TopNav sticky oben sichtbar mit "Entdecken" aktiv. Logo links, "Anmelden" rechts (anon).
- Open Mobile-Viewport in DevTools (402×874) — V4TabBar fixed unten sichtbar, 5 Tabs.
- Open `/map` — "Karte" aktiv in beiden Bars.
- Open `/plans` — Browser navigiert zu `/saved`, "Meine Pläne" aktiv.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(v4): mount V4TopNav and V4TabBar globally (Phase 1)

Both chrome components ride in the root layout so every route — public,
semi-public, and auth-gated — gets identical navigation. No AuthProvider
mount added; the auth-aware islands self-hydrate.
"
```

---

## Task 9: Remove LandingAuth from Landing Page

**Files:**
- Modify: `src/app/page.tsx` (Lines: import block + JSX body)

- [ ] **Step 1: Remove import**

In `src/app/page.tsx`, entferne diese Zeile:

```tsx
import { LandingAuth } from '@/components/Landing/LandingAuth';
```

- [ ] **Step 2: Remove mount**

Im JSX, lösche den Block:

```tsx
      {/* Top-right auth button */}
      <LandingAuth />
```

- [ ] **Step 3: Adjust beta-banner margin**

Der Beta-Banner darunter hat `mt-3`. Nach Wegfall der absolut positionierten `LandingAuth`-Pille (die im Top-Right schwebt) und Hinzukommen der 64-px-hohen sticky V4TopNav darüber, klingt `mt-3` noch immer richtig (banner sitzt direkt unter der nav). Bestätigen oder anpassen falls visuell off:

Wenn der Banner visuell zu nah an der Nav klebt, ändere `mt-3` zu `mt-6` in dieser Zeile:

```tsx
        className="z-30 mx-auto mt-3 max-w-[95%] md:max-w-2xl rounded-full border ..."
```

Phase-1-Default: `mt-3` belassen, in Dev-Preview prüfen, ggf. in einem follow-up commit anpassen.

- [ ] **Step 4: Verify dev + build**

Run: `npm run dev` (background)
- `http://localhost:3000/` öffnen — keine duplizierte Anmelden/Avatar-Pille im Top-Right mehr. Nur die neue V4TopNav.
- Beta-Banner unter der Nav klar lesbar.
Stop dev server.

Run: `npm run build`
Expected: Build erfolgreich.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor(v4): drop LandingAuth from landing page (Phase 1)

The new global V4TopNav handles the same auth pill in the top-right via
V4TopNavAuth. LandingAuth.tsx stays in src/components/Landing/ (not
deleted, scope-discipline) so future surfaces can still reuse it if
needed.
"
```

---

## Task 10: Remove SocialNav Mount from AppShell

**Files:**
- Modify: `src/components/Layout/AppShell.tsx`

- [ ] **Step 1: Remove SocialNav import + mount**

In `src/components/Layout/AppShell.tsx`:

Entferne den Import:

```tsx
import { SocialNav } from '@/components/Layout/SocialNav';
```

Entferne im JSX die Zeile:

```tsx
{!hideSocialNav && <SocialNav />}
```

Update den Header-Doc-Block damit klar ist, dass die `hideSocialNav`-Prop zum No-Op geworden ist:

```tsx
/**
 * AppShell — authenticated-route provider wrapper.
 *
 * fn-15.5 (Bundle-Architektur): the root layout no longer mounts
 * AuthProvider / NotificationsProvider / NotificationToast — those are
 * authenticated-only concerns and would pull @supabase/supabase-js +
 * the notifications realtime channel into the landing-page bundle for
 * no reason. Public routes (landing, blog, gemeinde, datenschutz, etc.)
 * ship without them.
 *
 * v4-Phase-1: SocialNav (bottom-tab-bar) wurde aus diesem Shell raus-
 * gezogen — die globale V4TabBar im Root-Layout ersetzt sie. Die
 * `hideSocialNav`-Prop bleibt als No-Op erhalten damit bestehende
 * Aufrufer (`/map/layout.tsx` etc.) nicht angefasst werden müssen
 * (minimal-scope-Regel). Cleanup der Prop in einer späteren Aufräum-
 * Phase.
 *
 * Authenticated route layouts wrap their children in this component to
 * opt in to: auth context, saved-events cache, notifications realtime
 * channel, and toast stack.
 *
 * Order matters:
 *   AuthProvider  → owns user/profile/session
 *   NotificationsProvider → reads `useAuth()` for the user id
 *   SavedEventsProvider   → reads `useAuth()` for the user id
 *   {children}            → consume any of the above
 *   NotificationToast     → realtime toast (uses auth + notifications)
 */
```

Das `hideSocialNav`-Prop bleibt in den Props, wird aber nicht mehr im JSX verwendet:

```tsx
interface AppShellProps {
  children: ReactNode;
  /**
   * @deprecated v4-Phase-1: SocialNav wird nicht mehr von AppShell
   * gemountet (globale V4TabBar im Root-Layout). Prop ist No-Op und
   * wird in einer späteren Aufräum-Phase entfernt.
   */
  hideSocialNav?: boolean;
}

export function AppShell({ children, hideSocialNav: _hideSocialNav = false }: AppShellProps) {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <SavedEventsProvider>
          {children}
          <NotificationToast />
        </SavedEventsProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
```

Note: TypeScript flag `noUnusedParameters` could complain — der `_hideSocialNav`-Underscore-Prefix signalisiert "intentionally unused" und Next/TS config respektiert das standardmäßig. Falls doch Warning: `eslint-disable-next-line @typescript-eslint/no-unused-vars` davor.

- [ ] **Step 2: Verify TypeScript + tests**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm test`
Expected: alle 547 + neue Tests laufen grün, keine Regression.

- [ ] **Step 3: Verify in dev**

Run: `npm run dev` (background)
- `http://localhost:3000/feed` öffnen (eingeloggt benötigt) — die alte `SocialNav` ist NICHT mehr sichtbar, dafür die neue `V4TabBar` (auf Mobile-Viewport) und `V4TopNav` oben.
- `http://localhost:3000/map` öffnen — dito, keine doppelte Nav.
Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout/AppShell.tsx
git commit -m "refactor(v4): unmount legacy SocialNav from AppShell (Phase 1)

Global V4TabBar in the root layout supersedes the AppShell-mounted
SocialNav. The hideSocialNav prop is kept as a deprecated no-op so
existing call sites (/map/layout.tsx, /groups/[id]/layout.tsx) don't
need to be touched in this phase — minimal-scope rule.
SocialNav.tsx itself is not deleted; cleanup follows in a later phase.
"
```

---

## Task 11: End-to-End Verification + Performance Delta

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: alle bestehenden 547 + 25 neue v4-Tests grün.

- [ ] **Step 2: Production-Build**

Run: `npm run build`
Expected output enthält:
- `●` (ISR) für Route `/`
- `○` (static) für `/plans`, `/entdecken`, `/blog`
- Keine TypeScript-Errors

- [ ] **Step 3: Route-Smoke-Test (dev)**

Run: `npm run dev` (background)

Klicke durch und verifiziere auf jeder Route die korrekte Nav-Chrome (Desktop + Mobile-Viewport 402×874):

| Route | V4TopNav Active | V4TabBar Active |
|---|---|---|
| `/` | Entdecken | Entdecken |
| `/entdecken` | Entdecken | Entdecken |
| `/artists` (Auth nötig) | Künstler | Künstler |
| `/map` | Karte | Karte |
| `/plans` | (redirected →) `/saved` | (redirected →) `/saved` |
| `/saved` (Auth nötig) | Meine Pläne | Pläne |
| `/feed` (Auth nötig) | keine | keine |
| `/blog` | keine | keine |
| `/profile` (Auth nötig) | keine (kein Tab im Top-Nav) | Profil |
| `/auth/login` (anon) | keine | Profil |

Beobachte:
- Logo (lass·**treffen**·📍·at) sichtbar in V4TopNav links auf jeder Route
- Beta-Banner auf `/` sitzt unter der V4TopNav ohne Überlapp
- Mobile-Viewport: kein Content unter der V4TabBar versteckt (Spacer wirkt)
- Anonymer User: V4TopNav-rechts zeigt "Anmelden", V4TabBar-Profil-Tab linkt zu `/auth/login`
- Eingeloggter User: V4TopNav-rechts zeigt Bell mit Dot + Avatar-Initial, V4TabBar-Profil-Tab linkt zu `/profile`

- [ ] **Step 4: Lighthouse-Delta auf Landing**

Run: `npm run build && npm run start` (background, port 3000)
Baseline-Lighthouse vorher gibt es nicht (Branch hat Änderungen). Statt-dessen: Lighthouse auf der neuen Version laufen lassen und das **Mobile Performance Score** dokumentieren als neue Ausgangsbasis.

Run: `npx -y @lhci/cli@latest collect --url=http://localhost:3000/ --numberOfRuns=3 --settings.preset=mobile` (oder Chrome-DevTools Lighthouse-Tab)
Erwartung: Performance Score ≥ 85 auf Mobile (vergleichbar zum aktuellen fn-15-Stand).

Falls Score < 80: rollback und investigate (vermutlich Backdrop-Filter auf TabBar zu teuer auf Low-End-Mobile — Workaround: solid color statt blur).

Stop server.

- [ ] **Step 5: Visual-Regression-Screenshot**

Manuell oder via Playwright (wenn vorhanden):
- Screenshot `/` Desktop 1280×800 → speichern unter `docs/superpowers/plans/screenshots/2026-05-14-landing-desktop-after.png`
- Screenshot `/` Mobile 402×874 → `2026-05-14-landing-mobile-after.png`

Optional aber empfohlen.

- [ ] **Step 6: Final commit (verification doc only)**

```bash
git add docs/superpowers/plans/screenshots/ 2>/dev/null || true
git commit --allow-empty -m "chore(v4): verify Phase 1 — all routes show new chrome, build green

Verification matrix from docs/superpowers/plans/2026-05-14-v4-phase-1-foundation-nav.md
Step 3 confirmed across all routes. Lighthouse Mobile Performance ≥ 85.
"
```

---

## Task 12: Branch Push + PR

**Files:** none

- [ ] **Step 1: Sync branch**

```bash
git status
git log --oneline master..HEAD
```

Erwarte 11 Commits (10 feat/refactor + 1 spec + 1 verification).

- [ ] **Step 2: Push to remote**

```bash
git push -u origin claude/keen-meninsky-ea9660
```

- [ ] **Step 3: Open PR mit zusammenfassendem Body**

```bash
gh pr create --title "v4 Redesign Phase 1 — Foundation & Navigation" --body "$(cat <<'EOF'
## Summary

Phase 1/5 des v4-Redesigns. Etabliert globale Top-Nav, Mobile-Tab-Bar, D7-Logo und v4-Designtokens ohne Event-, Map- oder Feature-Logik anzufassen.

- Neue Komponenten unter `src/components/Layout/v4/`: V4Logo, V4TopNav, V4TopNavAuth, V4TabBar
- v4-Tokens (`--v4-*`) additiv in globals.css — keine bestehenden Tokens umbenannt
- Global im Root-Layout gemountet; LandingAuth-Pille + SocialNav-Mount abgelöst
- /plans-Stub redirected zu /saved bis Phase 5 die echte Plans-Page bringt
- AuthProvider bleibt **außerhalb** des Root-Layouts (fn-15.5-Bundle-Disziplin)

**Out-of-Scope** (per Spec §2): EventCard/EventDetail, Landing-Content, Card-States, Auth-Modals, Plan-Wizard — kommen in Phasen 2-5.

Spec: `docs/superpowers/specs/2026-05-14-v4-phase-1-foundation-nav-design.md`

## Test plan

- [ ] `npm test` — alle 547+ Tests grün, inkl. ~25 neue v4-Tests
- [ ] `npm run build` — ISR-Symbol `●` für `/` bleibt, keine TS-Errors
- [ ] Vercel-Preview-Deploy aufrufen, manuell durch alle Routes klicken (siehe Verification-Matrix im Plan)
- [ ] Mobile-Viewport: V4TabBar sichtbar, kein Content-Overlap
- [ ] Anon: V4TopNav rechts = "Anmelden", V4TabBar-Profil → /auth/login
- [ ] Authed: V4TopNav rechts = Bell + Avatar, V4TabBar-Profil → /profile
- [ ] Lighthouse Mobile Performance auf `/` ≥ 85

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Return PR URL to user**

Den `gh pr create`-Output enthält die PR-URL. An den User zurückgeben.

---

## Acceptance Criteria (from Spec §10)

- [ ] V4TopNav sichtbar auf `/`, `/entdecken`, `/map`, `/artists`, `/feed`, `/blog`, `/saved`, korrekte Active-Pill
- [ ] Mobile-Viewport: V4TabBar sichtbar auf allen genannten Routes
- [ ] `/plans` → 302/307-Redirect zu `/saved` (Network-Tab verifiziert)
- [ ] `LandingAuth`-Pille auf Landing nicht mehr sichtbar
- [ ] `SocialNav` taucht auf keiner Route mehr auf
- [ ] `npm run build` erfolgreich, ISR-Symbol `●` für `/` bleibt
- [ ] Anon: V4TopNav rechts = "Anmelden"-Pill, kein Bell, kein Avatar
- [ ] Authed: V4TopNav rechts = Bell mit Dot + Avatar-Initial
- [ ] Profil-Tab anon → `/auth/login`, authed → `/profile`
- [ ] Active-State auf Sub-Routes korrekt (z.B. `/artists/spotify-import`)
- [ ] PSI Performance Score auf `/` Mobile ≥ 85
- [ ] Bestehende Vitest-Suite läuft grün
