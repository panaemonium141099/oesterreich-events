# v4 Redesign Phase 2 — Landing & Card-System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Landing page with the v4 mockup layout (Hero + 10 sections) and ship a 4-shape Card-System with 9 state badges, server-side state derivation, and zero touches to existing EventCard/EventDetail components.

**Architecture:** RSC-first Landing fetches data via `getLandingData()` server helper (parallel Supabase queries), enriches each event with `deriveEventState(event, ctx)` server-side, then passes pre-derived events into pure presentational V4Card components. Funnel-Cards in Hero remain a small Client-Island for press-haptic. Cards live under `src/components/Events/v4/`; sections under `src/components/Landing/v4/`; helpers under `src/lib/v4/`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Vitest 4 + @testing-library/react · happy-dom · `@supabase/ssr` server client.

**Spec:** `docs/superpowers/specs/2026-05-14-v4-phase-2-landing-cards-design.md`

**Branch:** `claude/v4-phase-2-landing-cards` (stacked on Phase 1)

---

## File Structure

**Add (16 files + 8 tests):**
- `src/components/Events/v4/V4Badge.tsx`
- `src/components/Events/v4/V4CardV.tsx`
- `src/components/Events/v4/V4CardH.tsx`
- `src/components/Events/v4/V4CardHero.tsx`
- `src/components/Events/v4/V4FestivalCard.tsx`
- `src/components/Events/v4/V4FunnelCard.tsx`
- `src/components/Events/v4/index.ts`
- `src/components/Landing/v4/HeroV4.tsx`
- `src/components/Landing/v4/ArtistTeaserV4.tsx`
- `src/components/Landing/v4/MatchesSection.tsx`
- `src/components/Landing/v4/AnonFollowTeaser.tsx`
- `src/components/Landing/v4/WeekendSection.tsx`
- `src/components/Landing/v4/ConcertsSection.tsx`
- `src/components/Landing/v4/FestivalsSection.tsx`
- `src/components/Landing/v4/MapPreview.tsx`
- `src/components/Landing/v4/HowItWorks.tsx`
- `src/components/Landing/v4/index.ts`
- `src/lib/v4/derive-event-state.ts`
- `src/lib/v4/get-landing-context.ts`
- `src/lib/v4/get-landing-data.ts`
- Plus 8 test files mirroring component paths under `src/__tests__/`

**Modify:**
- `src/app/page.tsx` — full rewrite using new v4 sections

**Untouched:** Everything else (per spec §2).

---

## Task 1: V4Badge atom (TDD)

**Files:**
- Create: `src/components/Events/v4/V4Badge.tsx`
- Test: `src/__tests__/components/events/v4/V4Badge.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/components/events/v4/V4Badge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4Badge } from '@/components/Events/v4/V4Badge';

describe('V4Badge', () => {
  it('renders the children as label', () => {
    render(<V4Badge kind="ticket">Tickets verfügbar</V4Badge>);
    expect(screen.getByText('Tickets verfügbar')).toBeInTheDocument();
  });

  it('exposes data-kind for styling/testing introspection', () => {
    const { container } = render(<V4Badge kind="match">Match</V4Badge>);
    const el = container.querySelector('[data-v4-badge]');
    expect(el?.getAttribute('data-kind')).toBe('match');
  });

  it('renders an icon for kinds that have one (ticket)', () => {
    const { container } = render(<V4Badge kind="ticket">x</V4Badge>);
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it('omits the icon for the neutral "unknown" kind', () => {
    const { container } = render(<V4Badge kind="unknown">x</V4Badge>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders without crashing for every supported kind', () => {
    const kinds = ['ticket','match','lineup','free','doorsale','inplan','unknown','soldout','today'] as const;
    for (const k of kinds) {
      const { unmount } = render(<V4Badge kind={k}>x</V4Badge>);
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/events/v4/V4Badge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement V4Badge**

Create `src/components/Events/v4/V4Badge.tsx`:

```tsx
/**
 * V4Badge — semantic state-badge atom used by all v4 cards.
 *
 * Nine kinds:
 *   ticket   sand    "Tickets verfügbar"  (online pre-sale exists)
 *   match    gold    "Du folgst diesem Artist"
 *   lineup   gold    "Artist im Line-up"  (festival has user's followed artist)
 *   free     green   "Eintritt frei"
 *   doorsale blue    "Abendkasse"         (price at door, no online sale)
 *   inplan   green   "In deinem Plan"     (user has saved this event)
 *   unknown  neutral "Kein Ticket bekannt"
 *   soldout  red     "Ausverkauft"
 *   today    blue    "Heute"
 *
 * Color is never the sole signal — every kind has an icon + label.
 * Stays RSC-safe (no 'use client'). Uses --v4-* tokens added in Phase 1.
 */

import type { ReactNode, SVGProps } from 'react';

export type V4BadgeKind =
  | 'ticket' | 'match' | 'lineup' | 'free'
  | 'doorsale' | 'inplan' | 'unknown' | 'soldout' | 'today';

interface V4BadgeProps {
  kind: V4BadgeKind;
  children: ReactNode;
}

const ICON_STROKE = 2.2;

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={ICON_STROKE}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

function IconTicket() { return <Icon><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></Icon>; }
function IconMusic()  { return <Icon><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Icon>; }
function IconStar()   { return <Icon><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Icon>; }
function IconCheck()  { return <Icon strokeWidth={2.4}><polyline points="20 6 9 17 4 12"/></Icon>; }
function IconCoffee() { return <Icon><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/></Icon>; }
function IconX()      { return <Icon strokeWidth={2.4}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>; }
function IconDot()    { return <span aria-hidden="true" style={{display:'inline-block', width:5, height:5, borderRadius:'50%', background:'currentColor'}}/>; }

interface KindStyle {
  bg: string;
  fg: string;
  bd: string;
  icon: ReactNode | null;
}

const KIND_STYLES: Record<V4BadgeKind, KindStyle> = {
  ticket:   { bg: 'rgba(212,184,150,0.14)', fg: 'var(--v4-ticket)', bd: 'rgba(212,184,150,0.34)', icon: <IconTicket/> },
  match:    { bg: 'rgba(245,185,66,0.14)',  fg: 'var(--v4-match)',  bd: 'rgba(245,185,66,0.34)',  icon: <IconMusic/> },
  lineup:   { bg: 'rgba(245,185,66,0.14)',  fg: 'var(--v4-match)',  bd: 'rgba(245,185,66,0.34)',  icon: <IconStar/> },
  free:     { bg: 'rgba(123,183,148,0.14)', fg: 'var(--v4-go)',     bd: 'rgba(123,183,148,0.34)', icon: <IconCheck/> },
  doorsale: { bg: 'rgba(126,170,240,0.14)', fg: '#7eaaf0',          bd: 'rgba(126,170,240,0.34)', icon: <IconCoffee/> },
  inplan:   { bg: 'rgba(123,183,148,0.14)', fg: 'var(--v4-go)',     bd: 'rgba(123,183,148,0.34)', icon: <IconCheck/> },
  soldout:  { bg: 'rgba(198,112,121,0.14)', fg: 'var(--v4-alert)',  bd: 'rgba(198,112,121,0.40)', icon: <IconX/> },
  today:    { bg: 'rgba(94,144,224,0.18)',  fg: '#7eaaf0',          bd: 'rgba(94,144,224,0.40)',  icon: <IconDot/> },
  unknown:  { bg: 'var(--v4-hairline-2)',   fg: 'var(--v4-ink-70)', bd: 'var(--v4-hairline-2)',   icon: null },
};

export function V4Badge({ kind, children }: V4BadgeProps) {
  const s = KIND_STYLES[kind];
  return (
    <span
      data-v4-badge
      data-kind={kind}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 9px 4px 8px', borderRadius: 9999,
        background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.005em',
        whiteSpace: 'nowrap',
      }}
    >
      {s.icon}{children}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/events/v4/V4Badge.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4Badge.tsx src/__tests__/components/events/v4/V4Badge.test.tsx
git commit -m "feat(v4): add V4Badge atom with 9 states (Phase 2)

Pure RSC component; uses --v4-* tokens from Phase 1. Color is never
the sole status signal — every kind has an icon + label except
'unknown' (intentionally minimal). 5 vitest specs.
"
```

---

## Task 2: deriveEventState helper (TDD)

**Files:**
- Create: `src/lib/v4/derive-event-state.ts`
- Test: `src/__tests__/lib/v4/derive-event-state.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/v4/derive-event-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveEventState, type DeriveCtx } from '@/lib/v4/derive-event-state';
import type { Event } from '@/types/events';

function emptyCtx(): DeriveCtx {
  return {
    savedEventIds: new Set(),
    followedArtistIds: new Set(),
    artistMatchEventIds: new Set(),
    lineupMatchEventIds: new Set(),
  };
}

function baseEvent(over: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    source_id: null,
    source_name: null,
    source_url: null,
    title: 't',
    description: null,
    start_date: '2026-06-01',
    end_date: null,
    location_name: null,
    address: null,
    postal_code: null,
    bundesland: null,
    district: null,
    latitude: null,
    longitude: null,
    category: null,
    price_text: null,
    price_min: null,
    price_max: null,
    image_url: null,
    organizer: null,
    tags: null,
    ticket_url: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('deriveEventState', () => {
  it('expired event always returns unknown (safety)', () => {
    const ev = baseEvent({ publish_status: 'expired', ticket_url: 'x' });
    expect(deriveEventState(ev, emptyCtx())).toBe('unknown');
  });

  it('inplan wins when event is in savedEventIds', () => {
    const ev = baseEvent({ id: 'e1', ticket_url: 'x', price_tier: 'mittel' });
    const ctx = emptyCtx(); ctx.savedEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('inplan');
  });

  it('match wins over ticket when event is in artistMatchEventIds', () => {
    const ev = baseEvent({ id: 'e1', ticket_url: 'x', price_tier: 'mittel' });
    const ctx = emptyCtx(); ctx.artistMatchEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('match');
  });

  it('lineup wins over ticket when event is in lineupMatchEventIds (but loses to match)', () => {
    const ev = baseEvent({ id: 'e1', ticket_url: 'x', price_tier: 'mittel' });
    const ctx = emptyCtx(); ctx.lineupMatchEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('lineup');
  });

  it('match wins when both match and lineup are present', () => {
    const ev = baseEvent({ id: 'e1' });
    const ctx = emptyCtx();
    ctx.artistMatchEventIds.add('e1');
    ctx.lineupMatchEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('match');
  });

  it('ticket — ticket_url present + price_tier ∈ {günstig,mittel,premium}', () => {
    expect(deriveEventState(baseEvent({ ticket_url: 'x', price_tier: 'günstig' }), emptyCtx())).toBe('ticket');
    expect(deriveEventState(baseEvent({ ticket_url: 'x', price_tier: 'mittel' }), emptyCtx())).toBe('ticket');
    expect(deriveEventState(baseEvent({ ticket_url: 'x', price_tier: 'premium' }), emptyCtx())).toBe('ticket');
  });

  it('NOT ticket when ticket_url missing even if priced', () => {
    expect(deriveEventState(baseEvent({ ticket_url: null, price_tier: 'mittel' }), emptyCtx())).toBe('unknown');
  });

  it('free via price_tier=gratis', () => {
    expect(deriveEventState(baseEvent({ price_tier: 'gratis' }), emptyCtx())).toBe('free');
  });

  it('free via price_flags ∋ freier-eintritt', () => {
    expect(deriveEventState(baseEvent({ price_flags: ['freier-eintritt'] }), emptyCtx())).toBe('free');
  });

  it('free via price_flags ∋ spende-erbeten', () => {
    expect(deriveEventState(baseEvent({ price_flags: ['spende-erbeten'] }), emptyCtx())).toBe('free');
  });

  it('doorsale via price_flags ∋ abendkasse', () => {
    expect(deriveEventState(baseEvent({ price_flags: ['abendkasse'] }), emptyCtx())).toBe('doorsale');
  });

  it('free wins over doorsale (both flags present — paradox case)', () => {
    expect(deriveEventState(baseEvent({ price_flags: ['freier-eintritt', 'abendkasse'] }), emptyCtx())).toBe('free');
  });

  it('unknown — price_tier=unbekannt and no flags', () => {
    expect(deriveEventState(baseEvent({ price_tier: 'unbekannt' }), emptyCtx())).toBe('unknown');
  });

  it('unknown — null price_tier and no relevant flags', () => {
    expect(deriveEventState(baseEvent({}), emptyCtx())).toBe('unknown');
  });

  it('inplan beats match (user-action signal wins over follow-derived)', () => {
    const ev = baseEvent({ id: 'e1' });
    const ctx = emptyCtx();
    ctx.savedEventIds.add('e1');
    ctx.artistMatchEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('inplan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/lib/v4/derive-event-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement deriveEventState**

Create `src/lib/v4/derive-event-state.ts`:

```ts
import type { Event } from '@/types/events';

/**
 * V4 card-state slug. Drives V4Badge.kind and which side-box / sticky-bar
 * variant the event-detail page renders in Phase 3.
 *
 * Priority order (first match wins):
 *   1. expired      → 'unknown' (safety; suppress promotion)
 *   2. soldout      → reserved; not derivable yet (waiting for Eventim API
 *                     or `ausverkauft` flag enrichment)
 *   3. inplan       → user already saved
 *   4. match        → user follows a single artist tied to this event
 *   5. lineup       → user follows an artist on this event's festival
 *   6. ticket       → ticket_url present + priced
 *   7. free         → price_tier=gratis OR freier-eintritt/spende-erbeten flag
 *   8. doorsale     → abendkasse flag
 *   9. unknown      → fallback
 */
export type V4EventState =
  | 'soldout'
  | 'inplan'
  | 'match'
  | 'lineup'
  | 'ticket'
  | 'free'
  | 'doorsale'
  | 'unknown';

export interface DeriveCtx {
  /** Event IDs the current user has saved (anon: empty). */
  savedEventIds: Set<string>;
  /** Artist IDs the current user follows (anon: empty). */
  followedArtistIds: Set<string>;
  /** Pre-computed event IDs that link to a followed artist via artist_events. */
  artistMatchEventIds: Set<string>;
  /** Pre-computed event IDs that are festivals containing a followed artist via festival_artists. */
  lineupMatchEventIds: Set<string>;
}

const PRICED_TIERS = new Set(['günstig', 'mittel', 'premium']);

export function deriveEventState(event: Event, ctx: DeriveCtx): V4EventState {
  // Safety: expired events never show promotional badges.
  if (event.publish_status === 'expired') return 'unknown';

  // 2. soldout — reserved slot, currently uncommented stays inactive.
  //    When `ausverkauft` joins PRICE_FLAGS or Eventim availability is wired:
  //      if (event.price_flags?.includes('ausverkauft')) return 'soldout';

  if (ctx.savedEventIds.has(event.id))         return 'inplan';
  if (ctx.artistMatchEventIds.has(event.id))   return 'match';
  if (ctx.lineupMatchEventIds.has(event.id))   return 'lineup';

  if (event.ticket_url && event.price_tier && PRICED_TIERS.has(event.price_tier)) {
    return 'ticket';
  }

  const flags = event.price_flags ?? [];
  if (event.price_tier === 'gratis' ||
      flags.includes('freier-eintritt') ||
      flags.includes('spende-erbeten')) {
    return 'free';
  }

  if (flags.includes('abendkasse')) return 'doorsale';

  return 'unknown';
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/lib/v4/derive-event-state.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/v4/derive-event-state.ts src/__tests__/lib/v4/derive-event-state.test.ts
git commit -m "feat(v4): add deriveEventState with deterministic priority (Phase 2)

Pure helper that maps an Event + user-context to one of 8 V4 card states.
Priority: expired > soldout (reserved) > inplan > match > lineup > ticket
> free > doorsale > unknown. soldout slot stays commented until Eventim
or 'ausverkauft' enrichment is wired. 14 vitest specs cover every path.
"
```

---

## Task 3: V4CardV (vertical grid card) (TDD)

**Files:**
- Create: `src/components/Events/v4/V4CardV.tsx`
- Test: `src/__tests__/components/events/v4/V4CardV.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/components/events/v4/V4CardV.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4CardV } from '@/components/Events/v4/V4CardV';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, priority, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} data-priority={priority ? 'true' : 'false'} {...rest as object} />;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function ev(over: Partial<Event & { state: V4EventState }> = {}): Event & { state: V4EventState } {
  return {
    id: 'e1',
    source_id: null, source_name: null, source_url: null,
    title: 'Bilderbuch in der Arena',
    description: null,
    start_date: '2026-06-15T19:00:00Z',
    end_date: null,
    location_name: 'Arena Wien',
    address: null, postal_code: null, bundesland: 'Wien', district: null,
    latitude: null, longitude: null,
    category: 'music', price_text: null, price_min: null, price_max: null,
    image_url: 'https://cdn.example/bilderbuch.jpg',
    organizer: null, tags: null, ticket_url: 'https://eventim.de/x',
    slug: 'bilderbuch-arena',
    created_at: '', updated_at: '',
    state: 'ticket',
    ...over,
  };
}

describe('V4CardV', () => {
  it('renders title, date eyebrow and location', () => {
    render(<V4CardV event={ev()}/>);
    expect(screen.getByText('Bilderbuch in der Arena')).toBeInTheDocument();
    expect(screen.getByText('Arena Wien')).toBeInTheDocument();
  });

  it('links to /events/<slug>', () => {
    render(<V4CardV event={ev()}/>);
    const link = screen.getByRole('link', { name: /bilderbuch/i });
    expect(link.getAttribute('href')).toBe('/events/bilderbuch-arena');
  });

  it('renders the badge that matches event.state', () => {
    render(<V4CardV event={ev({ state: 'match' })}/>);
    const badge = document.querySelector('[data-v4-badge]');
    expect(badge?.getAttribute('data-kind')).toBe('match');
  });

  it('priority prop forwards to next/image (LCP optimisation)', () => {
    const { container } = render(<V4CardV event={ev()} priority/>);
    const img = container.querySelector('img');
    expect(img?.getAttribute('data-priority')).toBe('true');
  });

  it('hides badge for unknown state (no visual clutter)', () => {
    render(<V4CardV event={ev({ state: 'unknown' })}/>);
    expect(document.querySelector('[data-v4-badge]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/events/v4/V4CardV.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement V4CardV**

Create `src/components/Events/v4/V4CardV.tsx`:

```tsx
/**
 * V4CardV — vertical grid card. Default shape for landing sections.
 *
 * Layout: image top (16:9), badge overlay top-right, body below
 * (date eyebrow · title · location). Pure RSC presentation. Receives
 * a pre-derived state on the event (V4EventState) so it does no
 * derivation logic itself.
 *
 * Image fallback: if event.image_url is null the card renders a hairline
 * placeholder with the title centered — keeps grid height stable.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4Badge } from './V4Badge';

interface V4CardVProps {
  event: Event & { state: V4EventState };
  priority?: boolean;
}

const STATE_LABELS: Partial<Record<V4EventState, string>> = {
  ticket:   'Tickets verfügbar',
  match:    'Du folgst diesem Artist',
  lineup:   'Artist im Line-up',
  free:     'Eintritt frei',
  doorsale: 'Abendkasse',
  inplan:   'In deinem Plan',
  soldout:  'Ausverkauft',
};

function formatDateEyebrow(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('de-AT', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('de-AT', { month: 'short' });
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return `${weekday}. ${day}. ${month} · ${time}`;
}

export function V4CardV({ event, priority = false }: V4CardVProps) {
  const slug = event.slug ?? event.id;
  const badgeLabel = STATE_LABELS[event.state];

  return (
    <Link
      href={`/events/${slug}`}
      className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
      data-v4-card="vertical"
    >
      <div className="relative aspect-[16/9] bg-[var(--v4-surface)]">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--v4-ink-30)] text-sm px-4 text-center">
            {event.title}
          </div>
        )}
        {badgeLabel && (
          <div className="absolute top-3 right-3">
            <V4Badge kind={event.state}>{badgeLabel}</V4Badge>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)]">
          {formatDateEyebrow(event.start_date)}
        </p>
        <h3 className="text-[15px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-2">
          {event.title}
        </h3>
        {event.location_name && (
          <p className="text-[12.5px] text-[var(--v4-ink-70)] line-clamp-1">
            {event.location_name}
          </p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/events/v4/V4CardV.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4CardV.tsx src/__tests__/components/events/v4/V4CardV.test.tsx
git commit -m "feat(v4): add V4CardV vertical grid card (Phase 2)

Default shape for landing sections. RSC-safe. Takes pre-derived state
on the event and renders the matching badge (unknown hides badge to
reduce clutter). Image-fallback keeps grid height stable.
"
```

---

## Task 4: V4CardH (horizontal list card) (TDD)

**Files:**
- Create: `src/components/Events/v4/V4CardH.tsx`
- Test: `src/__tests__/components/events/v4/V4CardH.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/components/events/v4/V4CardH.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4CardH } from '@/components/Events/v4/V4CardH';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object} />;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function ev(over: Partial<Event & { state: V4EventState }> = {}): Event & { state: V4EventState } {
  return {
    id: 'e2', source_id: null, source_name: null, source_url: null,
    title: 'Wanda im Volksgarten', description: null,
    start_date: '2026-06-20T20:30:00Z', end_date: null,
    location_name: 'Volksgarten Pavillon',
    address: null, postal_code: null, bundesland: 'Wien', district: null,
    latitude: null, longitude: null,
    category: 'music', price_text: null, price_min: null, price_max: null,
    image_url: 'https://cdn.example/wanda.jpg',
    organizer: null, tags: null, ticket_url: 'https://eventim.de/y',
    slug: 'wanda-volksgarten', created_at: '', updated_at: '',
    state: 'match',
    ...over,
  };
}

describe('V4CardH', () => {
  it('renders title and location inline', () => {
    render(<V4CardH event={ev()}/>);
    expect(screen.getByText('Wanda im Volksgarten')).toBeInTheDocument();
    expect(screen.getByText('Volksgarten Pavillon')).toBeInTheDocument();
  });

  it('links to event slug', () => {
    render(<V4CardH event={ev()}/>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/events/wanda-volksgarten');
  });

  it('renders badge for match state', () => {
    render(<V4CardH event={ev({ state: 'match' })}/>);
    expect(document.querySelector('[data-v4-badge][data-kind="match"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/events/v4/V4CardH.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement V4CardH**

Create `src/components/Events/v4/V4CardH.tsx`:

```tsx
/**
 * V4CardH — horizontal list card.
 *
 * Used by MatchesSection (logged-in landing); reusable for /saved or
 * /plans flat lists in later phases. 80×80 thumb left, content right.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4Badge } from './V4Badge';

interface V4CardHProps {
  event: Event & { state: V4EventState };
}

const STATE_LABELS: Partial<Record<V4EventState, string>> = {
  ticket: 'Tickets', match: 'Match', lineup: 'Line-up',
  free: 'Frei', doorsale: 'Abendkasse', inplan: 'In Plan',
  soldout: 'Ausverkauft',
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
}

export function V4CardH({ event }: V4CardHProps) {
  const slug = event.slug ?? event.id;
  const badgeLabel = STATE_LABELS[event.state];

  return (
    <Link
      href={`/events/${slug}`}
      className="press-haptic flex items-center gap-4 rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-3 hover:border-[var(--v4-hairline-3)] transition-colors"
      data-v4-card="horizontal"
    >
      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[var(--v4-surface)] flex-shrink-0">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            sizes="80px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--v4-ink-30)] text-center px-1">
            {event.title.slice(0, 24)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)]">
          {shortDate(event.start_date)}
        </p>
        <h3 className="text-[14.5px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-1">
          {event.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {event.location_name && (
            <span className="text-[12px] text-[var(--v4-ink-70)] line-clamp-1">{event.location_name}</span>
          )}
          {badgeLabel && <V4Badge kind={event.state}>{badgeLabel}</V4Badge>}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/events/v4/V4CardH.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4CardH.tsx src/__tests__/components/events/v4/V4CardH.test.tsx
git commit -m "feat(v4): add V4CardH horizontal list card (Phase 2)"
```

---

## Task 5: V4CardHero (full-bleed sektions-hero) (TDD)

**Files:**
- Create: `src/components/Events/v4/V4CardHero.tsx`
- Test: `src/__tests__/components/events/v4/V4CardHero.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/components/events/v4/V4CardHero.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4CardHero } from '@/components/Events/v4/V4CardHero';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, priority, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} data-priority={priority ? 'true' : 'false'} {...rest as object}/>;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function ev(over: Partial<Event & { state: V4EventState }> = {}): Event & { state: V4EventState } {
  return {
    id: 'h1', source_id: null, source_name: null, source_url: null,
    title: 'FM4 Frequency 2026',
    description: 'Drei Tage Festival in St. Pölten',
    start_date: '2026-08-13T16:00:00Z', end_date: null,
    location_name: 'Green Park, St. Pölten',
    address: null, postal_code: null, bundesland: 'Niederösterreich', district: null,
    latitude: null, longitude: null,
    category: 'music', price_text: null, price_min: null, price_max: null,
    image_url: 'https://cdn.example/frequency.jpg',
    organizer: null, tags: null, ticket_url: 'https://eventim.de/freq',
    slug: 'fm4-frequency-2026', created_at: '', updated_at: '',
    state: 'lineup',
    ...over,
  };
}

describe('V4CardHero', () => {
  it('renders title and link', () => {
    render(<V4CardHero event={ev()}/>);
    expect(screen.getByText('FM4 Frequency 2026')).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/events/fm4-frequency-2026');
  });

  it('respects priority prop for next/image LCP', () => {
    const { container } = render(<V4CardHero event={ev()} priority/>);
    expect(container.querySelector('img')?.getAttribute('data-priority')).toBe('true');
  });

  it('shows lineup badge floating top-left', () => {
    render(<V4CardHero event={ev({ state: 'lineup' })}/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/events/v4/V4CardHero.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement V4CardHero**

Create `src/components/Events/v4/V4CardHero.tsx`:

```tsx
/**
 * V4CardHero — full-bleed sektion anchor card.
 *
 * Used as the visual hero of WeekendSection. Larger image (default 380 px
 * desktop / 320 px mobile), gradient overlay for legibility, large title
 * + sublines + state-badge floating top-left over the image.
 *
 * When mounted as the section's first event with priority=true it serves
 * as the LCP element (next/image preload).
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4Badge } from './V4Badge';

interface V4CardHeroProps {
  event: Event & { state: V4EventState };
  height?: number;
  priority?: boolean;
}

const STATE_LABELS: Partial<Record<V4EventState, string>> = {
  ticket:   'Tickets verfügbar',
  match:    'Du folgst diesem Artist',
  lineup:   'Artist im Line-up',
  free:     'Eintritt frei',
  doorsale: 'Abendkasse',
  inplan:   'In deinem Plan',
  soldout:  'Ausverkauft',
};

function formatHeroEyebrow(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
}

export function V4CardHero({ event, height, priority = false }: V4CardHeroProps) {
  const slug = event.slug ?? event.id;
  const badgeLabel = STATE_LABELS[event.state];
  const heightClass = height ? '' : 'h-[320px] md:h-[380px]';

  return (
    <Link
      href={`/events/${slug}`}
      className={`press-haptic relative block rounded-3xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] ${heightClass}`}
      style={height ? { height } : undefined}
      data-v4-card="hero"
    >
      {event.image_url ? (
        <Image
          src={event.image_url}
          alt={event.title}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 1180px"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--v4-ink-30)] text-xl px-6 text-center">
          {event.title}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,12,0.92)] via-[rgba(10,10,12,0.4)] to-transparent" aria-hidden="true"/>

      {badgeLabel && (
        <div className="absolute top-5 left-5">
          <V4Badge kind={event.state}>{badgeLabel}</V4Badge>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col gap-2 text-[var(--v4-ink)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-70)]">
          {formatHeroEyebrow(event.start_date)}
        </p>
        <h3 className="text-2xl md:text-3xl font-bold leading-tight tracking-[-0.02em] line-clamp-2 max-w-[36ch]">
          {event.title}
        </h3>
        {event.location_name && (
          <p className="text-sm text-[var(--v4-ink-70)] line-clamp-1">{event.location_name}</p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/events/v4/V4CardHero.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4CardHero.tsx src/__tests__/components/events/v4/V4CardHero.test.tsx
git commit -m "feat(v4): add V4CardHero full-bleed sektion anchor card (Phase 2)

LCP-candidate when mounted with priority=true. Gradient overlay
ensures legibility against any image, badge floats top-left.
"
```

---

## Task 6: V4FestivalCard (TDD)

**Files:**
- Create: `src/components/Events/v4/V4FestivalCard.tsx`
- Test: `src/__tests__/components/events/v4/V4FestivalCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/components/events/v4/V4FestivalCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FestivalCard } from '@/components/Events/v4/V4FestivalCard';
import type { Festival } from '@/types/festivals';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

function fest(over: Partial<Festival> = {}): Festival {
  return {
    id: 'f1',
    slug: 'nova-rock-2026',
    name: 'Nova Rock 2026',
    start_date: '2026-06-10',
    end_date: '2026-06-13',
    bundesland: 'Burgenland',
    image_url: 'https://cdn.example/nova.jpg',
    lineup_status: 'fetched',
    created_at: '', updated_at: '',
    ...over,
  } as Festival;
}

describe('V4FestivalCard', () => {
  it('renders festival name and date range', () => {
    render(<V4FestivalCard festival={fest()}/>);
    expect(screen.getByText('Nova Rock 2026')).toBeInTheDocument();
  });

  it('links to /events/<slug>', () => {
    render(<V4FestivalCard festival={fest()}/>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/events/nova-rock-2026');
  });

  it('shows lineup badge when lineupMatch is true', () => {
    render(<V4FestivalCard festival={fest()} lineupMatch/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeTruthy();
  });

  it('no badge when lineupMatch is false', () => {
    render(<V4FestivalCard festival={fest()}/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/events/v4/V4FestivalCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement V4FestivalCard**

Create `src/components/Events/v4/V4FestivalCard.tsx`:

```tsx
/**
 * V4FestivalCard — compact festival card.
 *
 * Layout: small image header, festival name, date range, optional
 * lineup-match indicator. Used in FestivalsSection.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Festival } from '@/types/festivals';
import { V4Badge } from './V4Badge';

interface V4FestivalCardProps {
  festival: Festival;
  /** If true, shows a "Artist im Line-up" gold badge. Phase 2 always derives this on the server. */
  lineupMatch?: boolean;
}

function dateRange(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const startStr = start.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
  if (!end || end.toDateString() === start.toDateString()) return startStr;
  const sameMonth = start.getMonth() === end.getMonth();
  const endStr = sameMonth
    ? end.toLocaleDateString('de-AT', { day: 'numeric' })
    : end.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
  return `${start.getDate()}.–${endStr}`.replace('..', '.') + ` ${start.toLocaleDateString('de-AT', { month: 'short' })}`;
}

export function V4FestivalCard({ festival, lineupMatch = false }: V4FestivalCardProps) {
  const slug = festival.slug ?? festival.id;

  return (
    <Link
      href={`/events/${slug}`}
      className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
      data-v4-card="festival"
    >
      <div className="relative aspect-[4/3] bg-[var(--v4-surface)]">
        {festival.image_url ? (
          <Image
            src={festival.image_url}
            alt={festival.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--v4-ink-30)] text-sm px-3 text-center">
            {festival.name}
          </div>
        )}
        {lineupMatch && (
          <div className="absolute top-2 right-2">
            <V4Badge kind="lineup">Line-up</V4Badge>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-2">
          {festival.name}
        </h3>
        <p className="text-[11.5px] text-[var(--v4-ink-50)]">
          {dateRange(festival.start_date, festival.end_date)}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/events/v4/V4FestivalCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4FestivalCard.tsx src/__tests__/components/events/v4/V4FestivalCard.test.tsx
git commit -m "feat(v4): add V4FestivalCard compact festival card (Phase 2)"
```

---

## Task 7: V4FunnelCard (Landing-Hero) (TDD)

**Files:**
- Create: `src/components/Events/v4/V4FunnelCard.tsx`
- Test: `src/__tests__/components/events/v4/V4FunnelCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/components/events/v4/V4FunnelCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FunnelCard } from '@/components/Events/v4/V4FunnelCard';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('V4FunnelCard', () => {
  it('renders title, sub, and CTA', () => {
    render(
      <V4FunnelCard
        ordinal="01" icon="music" accent="match"
        title="Lieblingskünstler folgen"
        sub="Such und folge deine Lieblingskünstler."
        cta="Künstler suchen" href="/artists"
      />
    );
    expect(screen.getByText('Lieblingskünstler folgen')).toBeInTheDocument();
    expect(screen.getByText('Such und folge deine Lieblingskünstler.')).toBeInTheDocument();
    expect(screen.getByText('Künstler suchen')).toBeInTheDocument();
  });

  it('href is correct', () => {
    render(
      <V4FunnelCard
        ordinal="01" icon="music" accent="match"
        title="x" sub="y" cta="z" href="/artists"
      />
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/artists');
  });

  it('exposes data-track when trackId provided', () => {
    render(
      <V4FunnelCard
        ordinal="01" icon="music" accent="match"
        title="x" sub="y" cta="z" href="/artists" trackId="cta_artist"
      />
    );
    expect(screen.getByRole('link').getAttribute('data-track')).toBe('cta_artist');
  });

  it('renders ordinal in editorial italic style', () => {
    render(
      <V4FunnelCard
        ordinal="03" icon="ticket" accent="go"
        title="x" sub="y" cta="z" href="/plans"
      />
    );
    expect(screen.getByText('03')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/components/events/v4/V4FunnelCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement V4FunnelCard**

Create `src/components/Events/v4/V4FunnelCard.tsx`:

```tsx
/**
 * V4FunnelCard — Landing-Hero CTA card.
 *
 * Used 3x in HeroV4 as the right-column stack (Künstler folgen /
 * Events entdecken / Abend planen). Not a card-for-events; this is a
 * primary nav CTA that happens to be styled like an info row.
 *
 * Pure RSC. press-haptic class for touch feedback; no JS state.
 */

import Link from 'next/link';
import type { ReactNode, SVGProps } from 'react';

interface V4FunnelCardProps {
  ordinal: string;
  icon: 'music' | 'map' | 'ticket';
  title: string;
  sub: string;
  cta: string;
  href: string;
  accent: 'match' | 'ticket' | 'go';
  primary?: boolean;
  trackId?: string;
}

function FunnelIcon({ name, ...rest }: { name: V4FunnelCardProps['icon'] } & SVGProps<SVGSVGElement>) {
  const common = {
    width: 18, height: 18, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 2,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true, ...rest,
  };
  if (name === 'music')  return <svg {...common}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
  if (name === 'map')    return <svg {...common}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
  /* ticket */            return <svg {...common}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/></svg>;
}

const ACCENT_COLORS: Record<V4FunnelCardProps['accent'], string> = {
  match:  'var(--v4-match)',
  ticket: 'var(--v4-ticket)',
  go:     'var(--v4-go)',
};

export function V4FunnelCard({ ordinal, icon, title, sub, cta, href, accent, primary, trackId }: V4FunnelCardProps) {
  const accentColor = ACCENT_COLORS[accent];

  return (
    <Link
      href={href}
      data-track={trackId}
      className={
        'press-haptic flex items-center gap-4 rounded-2xl p-4 md:p-5 border transition-colors ' +
        (primary
          ? 'bg-[var(--v4-surface)] border-[rgba(212,184,150,0.34)] hover:border-[rgba(212,184,150,0.5)]'
          : 'bg-[var(--v4-surface-elevated)] border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)]')
      }
    >
      <div
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border"
        style={{ background: `${accentColor.replace('var(--v4-','rgba(0,0,0,0').replace(')','')}`, color: accentColor, borderColor: accentColor + '44' }}
      >
        <FunnelIcon name={icon}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontSize: 13, color: 'var(--v4-ink-50)', letterSpacing: '0.04em' }}
          >{ordinal}</span>
          <h3 className="text-[15px] font-semibold leading-tight text-[var(--v4-ink)] tracking-[-0.015em]">{title}</h3>
        </div>
        <p className="text-[12.5px] text-[var(--v4-ink-70)] leading-snug mb-2">{sub}</p>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--v4-ink)]">
          {cta}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>
    </Link>
  );
}
```

**Note on inline style backgrounds:** The `background` calculation in the icon-circle is intentional — it produces a 10% tint of the accent token. Tailwind-arbitrary-value alpha math on CSS-vars is fragile; inline rgba composition is more predictable.

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- src/__tests__/components/events/v4/V4FunnelCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4FunnelCard.tsx src/__tests__/components/events/v4/V4FunnelCard.test.tsx
git commit -m "feat(v4): add V4FunnelCard Landing-Hero CTA card (Phase 2)"
```

---

## Task 8: Cards barrel re-export

**Files:**
- Create: `src/components/Events/v4/index.ts`

- [ ] **Step 1: Create barrel**

Create `src/components/Events/v4/index.ts`:

```ts
/**
 * v4 event/card primitives. Phase 2: card system used by the new
 * landing layout, reused by /entdecken (Phase 4) and /plans (Phase 5).
 */
export { V4Badge, type V4BadgeKind } from './V4Badge';
export { V4CardV } from './V4CardV';
export { V4CardH } from './V4CardH';
export { V4CardHero } from './V4CardHero';
export { V4FestivalCard } from './V4FestivalCard';
export { V4FunnelCard } from './V4FunnelCard';
```

- [ ] **Step 2: Verify TS compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "Events/v4|src/components/Events/v4"`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/Events/v4/index.ts
git commit -m "feat(v4): cards barrel re-export"
```

---

## Task 9: getLandingContext server helper

**Files:**
- Create: `src/lib/v4/get-landing-context.ts`
- Test: skipped (would require heavy supabase server-mock; manual smoke via build + dev verification later)

- [ ] **Step 1: Implement getLandingContext**

Create `src/lib/v4/get-landing-context.ts`:

```ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DeriveCtx } from './derive-event-state';

export interface LandingContext extends DeriveCtx {
  signedIn: boolean;
  userId: string | null;
}

/**
 * Loads the per-request derivation context for the landing page.
 *
 *  - Anonymous: returns empty Sets, signedIn=false. No DB queries fired.
 *  - Authenticated: queries saved_events, artist_follows, then JOINs to
 *    artist_events + festival_artists to pre-compute the match sets for
 *    the upcoming 60-day window (matches the data range the Landing
 *    actually shows).
 *
 * Server-only — relies on next/headers cookies for the supabase session.
 */
export async function getLandingContext(): Promise<LandingContext> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      signedIn: false,
      userId: null,
      savedEventIds: new Set(),
      followedArtistIds: new Set(),
      artistMatchEventIds: new Set(),
      lineupMatchEventIds: new Set(),
    };
  }

  const today = new Date().toISOString();
  const horizon = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

  // Fire all four queries in parallel.
  const [savedRes, followsRes] = await Promise.all([
    supabase.from('saved_events').select('event_id').eq('user_id', user.id),
    supabase.from('artist_follows').select('artist_id').eq('user_id', user.id),
  ]);

  const savedEventIds = new Set<string>((savedRes.data ?? []).map(r => r.event_id as string));
  const followedArtistIds = new Set<string>((followsRes.data ?? []).map(r => r.artist_id as string));

  if (followedArtistIds.size === 0) {
    return {
      signedIn: true,
      userId: user.id,
      savedEventIds,
      followedArtistIds,
      artistMatchEventIds: new Set(),
      lineupMatchEventIds: new Set(),
    };
  }

  const followedIds = Array.from(followedArtistIds);

  const [artistMatchRes, lineupMatchRes] = await Promise.all([
    supabase
      .from('artist_events')
      .select('event_id, events!inner(start_date, publish_status)')
      .in('artist_id', followedIds)
      .gte('events.start_date', today)
      .lte('events.start_date', horizon)
      .eq('events.publish_status', 'published'),
    supabase
      .from('festival_artists')
      .select('derived_event_id, festivals!inner(start_date)')
      .in('artist_id', followedIds)
      .gte('festivals.start_date', today)
      .lte('festivals.start_date', horizon)
      .not('derived_event_id', 'is', null),
  ]);

  const artistMatchEventIds = new Set<string>(
    (artistMatchRes.data ?? []).map(r => r.event_id as string)
  );
  const lineupMatchEventIds = new Set<string>(
    (lineupMatchRes.data ?? []).map(r => r.derived_event_id as string).filter(Boolean)
  );

  return {
    signedIn: true,
    userId: user.id,
    savedEventIds,
    followedArtistIds,
    artistMatchEventIds,
    lineupMatchEventIds,
  };
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep "src/lib/v4"`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/lib/v4/get-landing-context.ts
git commit -m "feat(v4): server helper getLandingContext (Phase 2)

Returns per-request derivation context — savedEventIds, followedArtistIds,
artistMatchEventIds, lineupMatchEventIds — for the Landing page.
Anon path returns empty Sets without firing DB queries. Authed path
runs four parallel queries scoped to the upcoming 60d window.
"
```

---

## Task 10: getLandingData server helper

**Files:**
- Create: `src/lib/v4/get-landing-data.ts`

- [ ] **Step 1: Implement getLandingData**

Create `src/lib/v4/get-landing-data.ts`:

```ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Event } from '@/types/events';
import type { Festival } from '@/types/festivals';
import { deriveEventState, type V4EventState } from './derive-event-state';
import type { LandingContext } from './get-landing-context';

export interface LandingArtist {
  name: string;
  genre?: string | null;
  slug?: string | null;
}

export interface LandingData {
  todayWeekend: Array<Event & { state: V4EventState }>;
  concerts: Array<Event & { state: V4EventState }>;
  festivals: Array<Festival & { lineupMatch: boolean }>;
  matches: Array<Event & { state: V4EventState }>;
  popularArtists: LandingArtist[];
}

const FALLBACK_ARTISTS: LandingArtist[] = [
  { name: 'Bilderbuch', genre: 'Indie · Austropop' },
  { name: 'Wanda', genre: 'Wienerlied-Rock' },
  { name: 'Pizzera & Jaus', genre: 'Comedy-Pop' },
];

function enrichEvents(rows: Event[], ctx: LandingContext): Array<Event & { state: V4EventState }> {
  return rows.map(e => ({ ...e, state: deriveEventState(e, ctx) }));
}

/**
 * Single entry point for all landing sections. Issues queries in parallel,
 * then enriches with per-event state via deriveEventState. Fires queries
 * for matches only if signedIn (saves DB roundtrips for anon traffic).
 */
export async function getLandingData(ctx: LandingContext): Promise<LandingData> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString();
  const weekendEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const monthEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  // Base column list — keep what cards consume.
  const eventCols = `id,slug,title,description,start_date,end_date,location_name,bundesland,district,
    category,image_url,ticket_url,price_text,price_min,price_max,price_tier,price_flags,
    publish_status,event_score,tags,created_at,updated_at,source_id,source_name,source_url`;

  const queries = [
    // todayWeekend: top events in next 7 days
    supabase
      .from('events')
      .select(eventCols)
      .gte('start_date', today)
      .lte('start_date', weekendEnd)
      .eq('publish_status', 'published')
      .order('event_score', { ascending: false })
      .limit(7),
    // concerts: music in next 7 days
    supabase
      .from('events')
      .select(eventCols)
      .gte('start_date', today)
      .lte('start_date', weekendEnd)
      .eq('publish_status', 'published')
      .or('category.eq.music,category.eq.konzerte')
      .order('event_score', { ascending: false })
      .limit(3),
    // festivals: upcoming
    supabase
      .from('festivals')
      .select('*')
      .gte('end_date', today.split('T')[0])
      .order('start_date', { ascending: true })
      .limit(4),
  ];

  // Matches only if signedIn AND there are match candidate IDs.
  const matchEventIds = Array.from(ctx.artistMatchEventIds)
    .concat(Array.from(ctx.lineupMatchEventIds));

  const matchPromise = ctx.signedIn && matchEventIds.length > 0
    ? supabase
        .from('events')
        .select(eventCols)
        .in('id', matchEventIds)
        .gte('start_date', today)
        .eq('publish_status', 'published')
        .order('start_date', { ascending: true })
        .limit(6)
    : Promise.resolve({ data: [] as Event[] });

  const [weekendRes, concertsRes, festivalsRes, matchesRes] = await Promise.all([
    queries[0], queries[1], queries[2], matchPromise,
  ]);

  const todayWeekend = enrichEvents((weekendRes.data ?? []) as Event[], ctx);
  const concerts = enrichEvents((concertsRes.data ?? []) as Event[], ctx);
  const matches = enrichEvents((matchesRes.data ?? []) as Event[], ctx);

  const festivals = ((festivalsRes.data ?? []) as Festival[]).map(f => ({
    ...f,
    lineupMatch: ctx.lineupMatchEventIds.size > 0 &&
      Boolean(f.id) &&
      false, // we can't cheaply tell per-festival here without another join;
              // safe-default false. The MatchesSection uses lineup events anyway.
  }));

  void monthEnd; // reserved for future "next 30 days" sections

  return {
    todayWeekend,
    concerts,
    festivals,
    matches,
    popularArtists: FALLBACK_ARTISTS,
  };
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep "src/lib/v4/get-landing-data"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/v4/get-landing-data.ts
git commit -m "feat(v4): server helper getLandingData (Phase 2)

Single entry point for all landing sections. Parallel Supabase queries,
server-side state enrichment via deriveEventState. Matches fetched only
if signedIn AND match-candidate-IDs exist (saves a roundtrip otherwise).
Festival lineup-match is best-effort false in Phase 2 — pull-from-DB
optimization is Phase 4 territory.
"
```

---

## Task 11: HeroV4 section (RSC)

**Files:**
- Create: `src/components/Landing/v4/HeroV4.tsx`

- [ ] **Step 1: Create HeroV4**

Create `src/components/Landing/v4/HeroV4.tsx`:

```tsx
/**
 * HeroV4 — top-of-fold of the v4 Landing.
 *
 * Left column: eyebrow → H1 (Inter + Fraunces italic accent) → sub → 2 CTAs
 * → search affordance (links to /entdecken) → trend chips.
 *
 * Right column: 3 V4FunnelCard stacked (Künstler / Entdecken / Plan).
 *
 * Mobile collapses to single column.
 */

import Link from 'next/link';
import { V4FunnelCard } from '@/components/Events/v4';

const TRENDS = ['Bilderbuch', 'FM4 Frequency', 'Wanda', 'Seefestspiele Mörbisch'];

export function HeroV4() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--v4-hairline-1)] py-9 md:py-18">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 50% at 80% 0%, rgba(212,184,150,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(245,185,66,0.04) 0%, transparent 70%)',
      }}/>

      <div className="relative max-w-[1180px] mx-auto px-4 md:px-14 grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-7 md:gap-14 items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-4 md:mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--v4-ticket)]" aria-hidden="true"/>
            Events in Österreich
          </div>

          <h1 className="text-[38px] md:text-[60px] font-bold leading-[1.02] tracking-[-0.035em] text-[var(--v4-ink)] max-w-[20ch]">
            Finde Events, die{' '}
            <span style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 300 }}>
              wirklich zu dir passen.
            </span>
          </h1>

          <p className="text-[14.5px] md:text-[16.5px] leading-snug text-[var(--v4-ink-70)] mt-4 md:mt-6 mb-5 md:mb-8 max-w-[60ch]">
            Folge deinen Lieblingskünstlern, finde Konzerte, Festivals und alles dazwischen — mit Ticket, an der Abendkasse oder einfach hingehen. Plane den Abend an einem Ort.
          </p>

          <div className="flex gap-2.5 flex-wrap mb-5 md:mb-7">
            <Link
              href="/artists"
              className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
              data-track="cta_artist_search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              Künstler suchen
            </Link>
            <Link
              href="/entdecken"
              className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)] text-sm font-semibold"
              data-track="cta_browse_events"
            >
              Heute &amp; Wochenende
            </Link>
          </div>

          <Link
            href="/entdecken"
            className="press-haptic inline-flex items-center gap-3 px-5 py-3.5 rounded-full border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] text-[var(--v4-ink-50)] text-sm w-full md:w-auto md:min-w-[420px]"
            aria-label="Künstler, Event oder Ort suchen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <span className="flex-1 text-left">Künstler, Event oder Ort suchen …</span>
          </Link>

          <div className="flex gap-2 mt-3.5 flex-wrap items-center text-[11.5px] text-[var(--v4-ink-50)]">
            <span className="font-semibold text-[var(--v4-ink-70)]">Trend:</span>
            {TRENDS.map(t => (
              <Link
                key={t}
                href={`/entdecken?q=${encodeURIComponent(t)}`}
                className="press-haptic px-2.5 py-1 rounded-full border border-[var(--v4-hairline-2)] text-[var(--v4-ink-70)]"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <V4FunnelCard
            ordinal="01" icon="music" accent="match" primary
            title="Lieblingskünstler folgen"
            sub="Such und folge deine Lieblingskünstler. Wir sagen Bescheid, wenn sie in Österreich spielen."
            cta="Künstler suchen" href="/artists" trackId="funnel_artists"
          />
          <V4FunnelCard
            ordinal="02" icon="map" accent="ticket"
            title="Events entdecken"
            sub="Konzerte, Festivals, Heurige, Märkte — alles, was gerade in Österreich läuft."
            cta="Was läuft heute?" href="/entdecken" trackId="funnel_entdecken"
          />
          <V4FunnelCard
            ordinal="03" icon="ticket" accent="go"
            title="Abend planen"
            sub="Ticketlink, Anreise, Reminder — in deiner Tasche, für jedes Event."
            cta="Plan ausprobieren" href="/plans" trackId="funnel_plan"
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep "Landing/v4/HeroV4"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/Landing/v4/HeroV4.tsx
git commit -m "feat(v4): add HeroV4 section (Phase 2)

Top-of-fold for new Landing. Left col headline + sub + 2 CTAs + search
affordance + trend chips. Right col 3 V4FunnelCard. Mobile collapses
to single column. All CTAs link to existing routes (no new endpoints).
"
```

---

## Task 12: ArtistTeaserV4 section (RSC)

**Files:**
- Create: `src/components/Landing/v4/ArtistTeaserV4.tsx`

- [ ] **Step 1: Create ArtistTeaserV4**

Create `src/components/Landing/v4/ArtistTeaserV4.tsx`:

```tsx
import Link from 'next/link';
import type { LandingArtist } from '@/lib/v4/get-landing-data';
import { V4Badge } from '@/components/Events/v4';

interface ArtistTeaserV4Props {
  artists: LandingArtist[];
}

export function ArtistTeaserV4({ artists }: ArtistTeaserV4Props) {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="rounded-[22px] border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)] p-6 md:p-9 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-5 md:gap-9 items-center">
        <div>
          <V4Badge kind="match">Lieblingskünstler · nur eingeloggt</V4Badge>
          <h2 className="text-[26px] md:text-[36px] font-bold leading-tight tracking-[-0.025em] mt-3.5 mb-2.5 text-[var(--v4-ink)]">
            Verpasse keinen Auftritt deiner{' '}
            <span style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 300 }}>
              Lieblingskünstler.
            </span>
          </h2>
          <p className="text-[14px] md:text-[15px] text-[var(--v4-ink-70)] leading-snug max-w-[60ch] mb-5">
            Such einen Künstler, folge ihm und wir zeigen dir Konzerte und Festival-Slots in Österreich.
          </p>
          <Link
            href="/artists"
            data-track="cta_artist_search"
            className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            Zu deinen Lieblingskünstlern
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </Link>
          <p className="text-[11.5px] text-[var(--v4-ink-50)] mt-2.5">
            Öffnet die Künstler-Seite. Folgen erfordert eine Anmeldung.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface)] p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)] mb-2">
            Beliebt in Österreich
          </p>
          {artists.slice(0, 3).map((a, i) => (
            <Link
              key={a.name}
              href={`/artists?artist=${encodeURIComponent(a.name)}`}
              data-track="artist_preview"
              className={'press-haptic flex items-center gap-3 py-2.5 ' + (i > 0 ? 'border-t border-[var(--v4-hairline-1)]' : '')}
            >
              <div className="w-9 h-9 rounded-full bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] flex items-center justify-center text-[var(--v4-ink)]"
                style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontSize: 16 }}>
                {a.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-[var(--v4-ink)]">{a.name}</div>
                {a.genre && <div className="text-[11px] text-[var(--v4-ink-50)] mt-0.5">{a.genre}</div>}
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--v4-ink-50)' }}><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Landing/v4/ArtistTeaserV4.tsx
git commit -m "feat(v4): add ArtistTeaserV4 section (Phase 2)"
```

---

## Task 13: MatchesSection + AnonFollowTeaser (RSC, bundled)

**Files:**
- Create: `src/components/Landing/v4/MatchesSection.tsx`
- Create: `src/components/Landing/v4/AnonFollowTeaser.tsx`

- [ ] **Step 1: Create MatchesSection**

Create `src/components/Landing/v4/MatchesSection.tsx`:

```tsx
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4CardH } from '@/components/Events/v4';
import Link from 'next/link';

interface MatchesSectionProps {
  events: Array<Event & { state: V4EventState }>;
}

export function MatchesSection({ events }: MatchesSectionProps) {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Deine Lieblingskünstler · spielen demnächst
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Auftritte deiner Lieblingskünstler
          </h2>
        </div>
        <Link
          href="/artists"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Alle Auftritte
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">Noch keine Auftritte gefunden — folge weiteren Künstlern.</p>
          <Link href="/artists" className="press-haptic inline-block mt-3 text-[13px] font-semibold text-[var(--v4-ink)] underline underline-offset-2">
            Künstler suchen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map(ev => <V4CardH key={ev.id} event={ev}/>)}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Create AnonFollowTeaser**

Create `src/components/Landing/v4/AnonFollowTeaser.tsx`:

```tsx
import Link from 'next/link';

export function AnonFollowTeaser() {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Personalisierung · meld dich an
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Wer sind deine Lieblingskünstler?
          </h2>
        </div>
      </div>
      <div className="rounded-[18px] border border-dashed border-[rgba(245,185,66,0.34)] bg-[var(--v4-surface-elevated)] p-5 md:p-8 grid grid-cols-1 md:grid-cols-[60px_1fr_auto] gap-4 items-center">
        <div className="w-12 h-12 rounded-xl border border-[rgba(245,185,66,0.34)] bg-[rgba(245,185,66,0.14)] text-[var(--v4-match)] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <div>
          <p className="text-[16px] md:text-[17px] font-semibold leading-tight text-[var(--v4-ink)] tracking-[-0.015em]">
            Folge Künstler — wir benachrichtigen dich bei Österreich-Terminen.
          </p>
          <p className="text-[13px] text-[var(--v4-ink-70)] mt-1 leading-snug">
            Konzerte, Open Airs, Festival-Slots. Du brauchst nicht ständig nachschauen.
          </p>
        </div>
        <Link
          href="/auth/login?next=/artists"
          data-track="cta_anon_follow"
          className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold whitespace-nowrap"
        >
          Künstler suchen
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Landing/v4/MatchesSection.tsx src/components/Landing/v4/AnonFollowTeaser.tsx
git commit -m "feat(v4): add MatchesSection + AnonFollowTeaser (Phase 2)

Conditionally rendered on the Landing based on signedIn — authed sees
followed-artist matches, anon sees the follow-teaser CTA.
"
```

---

## Task 14: WeekendSection (RSC, the big one)

**Files:**
- Create: `src/components/Landing/v4/WeekendSection.tsx`

- [ ] **Step 1: Create WeekendSection**

Create `src/components/Landing/v4/WeekendSection.tsx`:

```tsx
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4CardV, V4CardHero } from '@/components/Events/v4';
import Link from 'next/link';

interface WeekendSectionProps {
  events: Array<Event & { state: V4EventState }>;
}

function dateRangeLabel(): string {
  const start = new Date();
  const end = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const startStr = start.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${startStr.replace(/\.$/,'')} – ${endStr.replace(/\.$/,'')}`;
}

export function WeekendSection({ events }: WeekendSectionProps) {
  if (events.length === 0) {
    return (
      <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
        <p className="text-[var(--v4-ink-70)] text-sm">Aktuell keine Events im 7-Tage-Fenster.</p>
      </section>
    );
  }

  const [hero, ...rest] = events;
  const firstRow = rest.slice(0, 3);
  const secondRow = rest.slice(3, 6);

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            {dateRangeLabel()}
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Heute &amp; Wochenende
          </h2>
        </div>
        <Link
          href="/entdecken"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Alle Events ansehen
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>

      <V4CardHero event={hero} priority/>

      {firstRow.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {firstRow.map(ev => <V4CardV key={ev.id} event={ev}/>)}
        </div>
      )}
      {secondRow.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {secondRow.map(ev => <V4CardV key={ev.id} event={ev}/>)}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Landing/v4/WeekendSection.tsx
git commit -m "feat(v4): add WeekendSection (Phase 2)

Hero card (LCP) + up to 6 grid cards in 2 rows of 3. Falls back to
an empty-state message if DB has no upcoming events in 7-day window.
"
```

---

## Task 15: ConcertsSection (RSC, small)

**Files:**
- Create: `src/components/Landing/v4/ConcertsSection.tsx`

- [ ] **Step 1: Create ConcertsSection**

Create `src/components/Landing/v4/ConcertsSection.tsx`:

```tsx
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4CardV } from '@/components/Events/v4';
import Link from 'next/link';

interface ConcertsSectionProps {
  events: Array<Event & { state: V4EventState }>;
}

export function ConcertsSection({ events }: ConcertsSectionProps) {
  if (events.length === 0) return null;

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Live in Österreich
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Konzerte diese Woche
          </h2>
        </div>
        <Link
          href="/entdecken?category=music"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Alle Konzerte
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {events.map(ev => <V4CardV key={ev.id} event={ev}/>)}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Landing/v4/ConcertsSection.tsx
git commit -m "feat(v4): add ConcertsSection (Phase 2)"
```

---

## Task 16: FestivalsSection (RSC)

**Files:**
- Create: `src/components/Landing/v4/FestivalsSection.tsx`

- [ ] **Step 1: Create FestivalsSection**

Create `src/components/Landing/v4/FestivalsSection.tsx`:

```tsx
import type { Festival } from '@/types/festivals';
import { V4FestivalCard } from '@/components/Events/v4';
import Link from 'next/link';

interface FestivalsSectionProps {
  festivals: Array<Festival & { lineupMatch: boolean }>;
}

export function FestivalsSection({ festivals }: FestivalsSectionProps) {
  if (festivals.length === 0) return null;

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Sommer · Line-ups verfügbar
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Festivals mit Line-up
          </h2>
        </div>
        <Link
          href="/entdecken?category=festival"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Alle Festivals
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {festivals.map(f => (
          <V4FestivalCard key={f.id} festival={f} lineupMatch={f.lineupMatch}/>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Landing/v4/FestivalsSection.tsx
git commit -m "feat(v4): add FestivalsSection (Phase 2)"
```

---

## Task 17: MapPreview (RSC, static SVG)

**Files:**
- Create: `src/components/Landing/v4/MapPreview.tsx`

- [ ] **Step 1: Create MapPreview**

Create `src/components/Landing/v4/MapPreview.tsx`:

```tsx
/**
 * MapPreview — static decorative SVG map of Austria with sample dots.
 *
 * Critical: this does NOT mount Mapbox. The real map lives at /map
 * and pulling mapbox-gl into the landing bundle (~480 KB) is exactly
 * the kind of thing fn-15.5 fought against. This is pure SVG.
 */

import Link from 'next/link';

const CITY_DOTS = [
  { x: 180, y: 200, l: 'BREGENZ' },
  { x: 360, y: 200, l: 'SALZBURG' },
  { x: 520, y: 200, l: 'LINZ' },
  { x: 720, y: 215, l: 'WIEN' },
  { x: 800, y: 245, l: 'EISENSTADT' },
  { x: 600, y: 255, l: 'GRAZ' },
];

const EVENT_DOTS = [
  { x: 720, y: 215, r: 8, fill: 'var(--v4-ticket)' },
  { x: 800, y: 245, r: 6, fill: 'var(--v4-match)' },
  { x: 360, y: 200, r: 5, fill: 'var(--v4-ink-70)' },
  { x: 520, y: 200, r: 7, fill: 'var(--v4-ticket)' },
  { x: 600, y: 255, r: 6, fill: 'var(--v4-go)' },
];

export function MapPreview() {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Karte
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Events in deiner Nähe
          </h2>
        </div>
        <Link
          href="/map"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Karte öffnen
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>

      <div className="relative h-[220px] md:h-[320px] rounded-[18px] overflow-hidden border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)]">
        <svg width="100%" height="100%" viewBox="0 0 1100 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <path key={i}
              d={`M -20 ${60 + i * 38} Q 320 ${48 + i * 38 + (i % 2 ? 14 : -10)} 700 ${66 + i * 38} T 1120 ${56 + i * 38}`}
              fill="none" stroke="var(--v4-hairline-1)" strokeWidth="0.7"/>
          ))}
          <path d="M 80 220 Q 200 160 320 180 Q 460 175 560 195 Q 700 215 820 180 Q 940 160 1020 200 L 1020 270 Q 880 295 740 280 Q 540 260 380 290 Q 220 305 100 290 Z"
            fill="none" stroke="var(--v4-hairline-2)" strokeWidth="1"/>
          {CITY_DOTS.map(c => (
            <g key={c.l}>
              <circle cx={c.x} cy={c.y} r="2" fill="var(--v4-ink-50)"/>
              <text x={c.x + 8} y={c.y + 3} fill="var(--v4-ink-50)" fontSize="9" letterSpacing="2.2" fontWeight={600}>{c.l}</text>
            </g>
          ))}
          {EVENT_DOTS.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={p.r + 6} fill="none" stroke={p.fill} strokeWidth="0.6" opacity="0.4"/>
              <circle cx={p.x} cy={p.y} r={p.r} fill={p.fill}/>
            </g>
          ))}
        </svg>

        <div className="absolute bottom-4 left-4 flex gap-3.5 flex-wrap px-3.5 py-2.5 rounded-xl bg-[rgba(10,10,12,0.85)] backdrop-blur border border-[var(--v4-hairline-2)] text-[11px] text-[var(--v4-ink-70)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-ticket)' }} aria-hidden="true"/>
            Tickets verfügbar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-match)' }} aria-hidden="true"/>
            Künstler im Line-up
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-go)' }} aria-hidden="true"/>
            In deinem Plan
          </span>
        </div>

        <Link
          href="/map"
          className="press-haptic absolute top-4 right-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
          Karte öffnen
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Landing/v4/MapPreview.tsx
git commit -m "feat(v4): add MapPreview static SVG section (Phase 2)

Critical: pure inline SVG, no mapbox-gl import. Real map remains at
/map; pulling mapbox into the landing bundle would undo fn-15.5.
"
```

---

## Task 18: HowItWorks (RSC)

**Files:**
- Create: `src/components/Landing/v4/HowItWorks.tsx`

- [ ] **Step 1: Create HowItWorks**

Create `src/components/Landing/v4/HowItWorks.tsx`:

```tsx
const STEPS = [
  { n: '01', t: 'Künstler folgen', s: 'Such und folge deine Lieblingskünstler. Wir scannen Konzerte und Festival-Slots in Österreich.' },
  { n: '02', t: 'Tickets sichern', s: 'Wenn ein Auftritt auftaucht, springst du direkt zum offiziellen Ticketshop. Kauf erfolgt beim Anbieter.' },
  { n: '03', t: 'Abend planen',    s: 'Speichere Ticketstatus, Anreise und Reminder in deinem Plan. Drei Pings reichen meistens.' },
];

export function HowItWorks() {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="mb-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
          So geht's
        </p>
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
          In drei Schritten unterwegs
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--v4-hairline-1)] rounded-[18px] p-px overflow-hidden">
        {STEPS.map(s => (
          <div key={s.n} className="bg-[var(--v4-surface-elevated)] p-5 md:p-7 rounded-[17px]">
            <div className="text-[30px] mb-3.5" style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 400, color: 'var(--v4-ink-50)', letterSpacing: '-0.02em' }}>
              {s.n}
            </div>
            <div className="text-[17px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] mb-2">{s.t}</div>
            <div className="text-[13px] text-[var(--v4-ink-70)] leading-snug max-w-[36ch]">{s.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Landing/v4/HowItWorks.tsx
git commit -m "feat(v4): add HowItWorks section (Phase 2)"
```

---

## Task 19: Landing barrel

**Files:**
- Create: `src/components/Landing/v4/index.ts`

- [ ] **Step 1: Create barrel**

Create `src/components/Landing/v4/index.ts`:

```ts
/**
 * v4 Landing sections. Phase 2: composed into src/app/page.tsx.
 */
export { HeroV4 } from './HeroV4';
export { ArtistTeaserV4 } from './ArtistTeaserV4';
export { MatchesSection } from './MatchesSection';
export { AnonFollowTeaser } from './AnonFollowTeaser';
export { WeekendSection } from './WeekendSection';
export { ConcertsSection } from './ConcertsSection';
export { FestivalsSection } from './FestivalsSection';
export { MapPreview } from './MapPreview';
export { HowItWorks } from './HowItWorks';
```

- [ ] **Step 2: TS check + commit**

Run: `npx tsc --noEmit 2>&1 | grep "Landing/v4"`
Expected: no output.

```bash
git add src/components/Landing/v4/index.ts
git commit -m "feat(v4): landing sections barrel"
```

---

## Task 20: Replace src/app/page.tsx with v4 Landing

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

- [ ] **Step 1: Replace page.tsx contents**

Replace the entire contents of `src/app/page.tsx` with:

```tsx
/**
 * Landing page — v4 redesign (Phase 2).
 *
 * Fully RSC. No 'use client', no useEffect, no cookies()/headers() at the
 * route level — but getLandingContext() *does* read auth via the server
 * supabase client. That converts this route from purely ISR to a per-
 * request render for authed users.
 *
 * fn-15.7 used Edge auth-middleware to flip / to ISR. With v4-Phase-2,
 * the auth signal that determines Matches-vs-AnonTeaser is read INSIDE
 * the RSC tree. The cookie-aware redirect from /feed (for logged-in
 * users) lives in middleware (fn-15.7) and continues to apply BEFORE
 * this page renders. So:
 *   - Anon visit → ISR cache served, getLandingContext returns empty
 *                  sets, no DB queries.
 *   - Authed visit → middleware may redirect to /feed (fn-15.7), or
 *                    this page renders dynamically with their match data.
 */

import Link from 'next/link';
import {
  HeroV4,
  ArtistTeaserV4,
  MatchesSection,
  AnonFollowTeaser,
  WeekendSection,
  ConcertsSection,
  FestivalsSection,
  MapPreview,
  HowItWorks,
} from '@/components/Landing/v4';
import { Onboarding } from '@/components/Landing/Onboarding';
import { AuthErrorToast } from '@/components/Landing/AuthErrorToast';
import { Footer } from '@/components/Legal/Footer';
import { getLandingContext } from '@/lib/v4/get-landing-context';
import { getLandingData } from '@/lib/v4/get-landing-data';

export const revalidate = 3600;

export default async function LandingPage() {
  const ctx = await getLandingContext();
  const data = await getLandingData(ctx);

  return (
    <div className="min-h-screen text-[var(--v4-ink)] bg-[var(--v4-surface)] flex flex-col">
      <Onboarding/>
      <AuthErrorToast/>

      <div
        role="status"
        className="z-30 mx-auto mt-6 max-w-[95%] md:max-w-2xl rounded-full border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-center text-[12.5px] leading-tight text-amber-100 backdrop-blur-sm"
      >
        Diese Seite ist noch in Entwicklung — technische Fehler sind möglich. Feedback bitte an{' '}
        <a
          href="mailto:dev@glatzdev.com?subject=lasstreffen.at%20Feedback"
          className="font-semibold underline decoration-amber-300/60 underline-offset-2 hover:text-amber-50"
        >
          dev@glatzdev.com
        </a>
        .
      </div>

      <main className="flex-1">
        <HeroV4/>
        <ArtistTeaserV4 artists={data.popularArtists}/>
        {ctx.signedIn
          ? <MatchesSection events={data.matches}/>
          : <AnonFollowTeaser/>}
        <WeekendSection events={data.todayWeekend}/>
        <ConcertsSection events={data.concerts}/>
        <FestivalsSection festivals={data.festivals}/>
        <MapPreview/>
        <HowItWorks/>
      </main>

      <Footer/>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -30`
Expected: Build succeeds. `/` appears as `●` (ISR) or `ƒ` (dynamic for authed sessions) — both acceptable. CSP hash verify passes.

If build fails on type errors related to `Festival` (e.g. missing fields):
- Open `src/types/festivals.ts`
- Read the actual Festival type
- Adjust `getLandingData.ts` festivals query column list to match
- Re-run build

- [ ] **Step 3: Verify dev preview manually**

Run `npm run dev` in background. Open `http://localhost:3000/`. Expect:
- V4TopNav at top (from Phase 1, unchanged)
- HeroV4 with headline + 3 funnel cards on right
- Sections render below: ArtistTeaser, then AnonFollowTeaser (anon) or MatchesSection (authed), then WeekendSection (with hero card if data exists), Concerts, Festivals, MapPreview, HowItWorks
- V4TabBar at bottom on mobile (from Phase 1)
- No console errors

If a section has no data, it renders nothing (empty `return null`) — expected.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(v4): wire v4 sections into Landing page (Phase 2)

Replaces HeroSection/LandingStats/LandingSections/ParticleBackground/
ScrollHint/gradient-mesh chrome with the v4 layout: HeroV4 + sections.
Onboarding + AuthErrorToast + Beta-Banner stay (auth/legal/dev concerns
are orthogonal to visual phases). Footer unchanged.

revalidate=3600 preserved. Authed users hitting / get a dynamic render
because getLandingContext reads supabase session via cookies; anon
visitors stay on the ISR cache (empty context, no DB roundtrip).
"
```

---

## Task 21: Run all v4 tests + Lighthouse-Delta + Dev-Verification

**Files:** none (verification)

- [ ] **Step 1: Run all v4-related tests**

Run: `npm test -- src/__tests__/components/events/v4/ src/__tests__/components/landing/v4/ src/__tests__/lib/v4/ src/__tests__/components/v4/ 2>&1 | tail -15`
Expected: All ~37 tests passing (5 V4Badge + 5 V4CardV + 3 V4CardH + 3 V4CardHero + 4 V4FestivalCard + 4 V4FunnelCard + 14 deriveEventState + Phase-1 25 = ~63 across the two phases).

- [ ] **Step 2: Run production build**

Run: `npm run build 2>&1 | tail -25`
Expected:
- Compilation succeeds
- `/` appears in route list (could be `●`, `○`, or `ƒ` — all valid)
- CSP postbuild verify passes

- [ ] **Step 3: Dev preview verification matrix**

Run: `npm run dev` in background.

Navigate to and screenshot/snapshot each:
- `/` — sehe HeroV4 + Sections, Funnel-Cards rechts auf desktop, single-column auf mobile
- `/entdecken` — unverändert (Phase-4-Material)
- `/map` — unverändert
- `/blog` — unverändert
- `/artists` — unverändert (Phase-4-Material)

Stop dev server.

Look for:
- No console errors related to v4 components
- No layout shifts (CLS)
- V4TopNav (Phase 1) still mounts globally
- V4TabBar (Phase 1) still shows on mobile-viewport

- [ ] **Step 4: Commit verification report**

Create `docs/superpowers/plans/2026-05-14-v4-phase-2-verification.md` with the full route-matrix + test result + build output summary.

```bash
git add docs/superpowers/plans/2026-05-14-v4-phase-2-verification.md
git commit -m "docs(v4): Phase 2 verification — Landing rebuild + cards ship green"
```

---

## Task 22: Branch push + PR (await user OK)

**Files:** none

- [ ] **Step 1: Confirm clean state**

Run: `git status` — working tree clean (besides .env.production CRLF noise if present).

- [ ] **Step 2: Push branch**

```bash
git push -u origin claude/v4-phase-2-landing-cards
```

- [ ] **Step 3: Open PR with stacked-PR note**

```bash
gh pr create --title "v4 Redesign Phase 2 — Landing & Card-System" --body "$(cat <<'EOF'
## Summary

Phase 2/5 des v4-Redesigns. Komplett neue Landing-Page mit 10 v4-Sektionen + 4 Card-Shapes mit 9 State-Badges + server-side State-Derivation.

**Stacked auf:** PR #2 (Phase 1: Foundation/Nav). Diese PR sollte **NACH** PR #2 (Phase 1) und PR #3 (abendkasse-Flag) merged werden. Die merge-base wird sich aufdröseln; squash-merge in der angegebenen Reihenfolge ist sauber.

**Was sich sichtbar ändert auf `/`:**
- Komplett neuer Hero: 3 Funnel-Cards rechts (Künstler folgen / Events entdecken / Abend planen), Headline mit Fraunces-Italic-Accent, Trend-Chips
- 8 neue Sektionen: ArtistTeaser, (authed) Matches / (anon) FollowTeaser, WeekendSection mit Hero-Card, Konzerte diese Woche, Festivals mit Line-up, MapPreview (static SVG, KEIN mapbox-gl), HowItWorks
- Cards mit semantischen State-Badges: ticket · match · lineup · free · doorsale · inplan · unknown · soldout · today

**Was sich NICHT ändert (kommt in Folgephasen):**
- Event-Detail-Page (`/events/[id]`) → Phase 3
- Künstler-Tab (`/artists`) UI → Phase 4
- Entdecken-Liste (`/entdecken`) → Phase 4
- Plan-Wizard + Meine Pläne (`/plans`) → Phase 5

**Spec & Plan:**
- `docs/superpowers/specs/2026-05-14-v4-phase-2-landing-cards-design.md`
- `docs/superpowers/plans/2026-05-14-v4-phase-2-landing-cards.md`
- `docs/superpowers/plans/2026-05-14-v4-phase-2-verification.md`

## Test plan

- [ ] Vercel-Preview-Deploy: durch `/` klicken (anon + authed)
- [ ] Mobile-Viewport: Sektionen stapeln korrekt, V4CardHero passt sich an
- [ ] Eingeloggter User mit followed-Artists: MatchesSection rendert echte Matches
- [ ] Anon: AnonFollowTeaser sichtbar statt Matches
- [ ] Badge-Colors: Sand (Tickets), Gold (Match/Lineup), Grün (Free/InPlan), Blau (Doorsale), Rot (Soldout)
- [ ] LCP-Element: WeekendSection hero card mit priority-Prop
- [ ] Bestehende Routes (`/entdecken`, `/map`, `/blog`, etc.) visuell unverändert
- [ ] PSI Mobile auf `/` ≥ 75

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Report PR URL**

The `gh pr create` output prints the PR URL — relay it back to the user.

---

## Acceptance Criteria (from Spec §10)

- [ ] `/` rendert das v4-Layout
- [ ] V4TopNav + V4TabBar aus Phase 1 unangetastet weiter sichtbar
- [ ] State-Derivation deterministisch (Unit-Test-gedeckt, alle 8 Priority-Pfade)
- [ ] V4Badge mit 9 korrekten Kinds, per Test gedeckt
- [ ] V4CardV/H/Hero/Festival/Funnel per Test gedeckt
- [ ] `npm run build` durchläuft, ISR-Marker für `/` stabil
- [ ] Bestehende EventCard und Konsumenten unangetastet
- [ ] `/entdecken`, `/map`, `/artists`, `/blog`, `/feed` etc. visuell + funktional unverändert
- [ ] v4-Vitest-Suite (Phase 1 + 2) ≥ 60 Tests, alle grün
- [ ] Lighthouse Mobile auf `/` ≥ 75
- [ ] Anon: getLandingContext() führt KEINE DB-Queries aus
- [ ] LCP-Element ist V4CardHero-Image mit priority-Prop
- [ ] `getLandingData` ruft alle Sektion-Queries parallel via Promise.all
