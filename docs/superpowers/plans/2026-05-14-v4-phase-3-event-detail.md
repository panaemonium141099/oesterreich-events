# v4 Redesign Phase 3 — Event-Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 963-LOC `EventDetailV2` monolith with a v4-conformant `V4EventDetail` component family — 6 side-box variants keyed off `deriveEventState` (Phase 2), a state-aware mobile sticky-bar, and a banned-strings snapshot test that enforces trust-copy hygiene.

**Architecture:** RSC-first detail page. `/events/[...slug]/page.tsx` loads the event, computes state server-side via Phase-2 helpers, and passes the derived event into `V4EventDetail`. Side-boxes are pure-render RSC components; only the mobile sticky-bar is a thin client island. EventDetailV2 stays on disk untouched (minimal-scope rule).

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4 · Vitest 4 + @testing-library/react · happy-dom · Supabase SSR client (already in place).

**Spec:** `docs/superpowers/specs/2026-05-14-v4-phase-3-event-detail-design.md`

**Branch:** `claude/v4-phase-3-event-detail` (forked from master after Phase 1 + 2 merged)

---

## File Structure

**Add:**
- `src/components/Events/v4/V4TicketBox.tsx`
- `src/components/Events/v4/V4FreeBox.tsx`
- `src/components/Events/v4/V4DoorsaleBox.tsx`
- `src/components/Events/v4/V4InPlanBox.tsx`
- `src/components/Events/v4/V4UnknownBox.tsx`
- `src/components/Events/v4/V4SoldoutBox.tsx`
- `src/components/Events/v4/V4SideBox.tsx` — dispatcher
- `src/components/Events/v4/V4EventDetailHero.tsx`
- `src/components/Events/v4/V4EventDetailContent.tsx`
- `src/components/Events/v4/V4MobileStickyBar.tsx`
- `src/components/Events/v4/V4EventDetail.tsx` — top-level
- `src/lib/v4/event-detail-trust-copy.ts` — exported constants used by all boxes
- `src/lib/v4/derive-detail-context.ts` — per-event context loader for single-event detail page
- Tests in `src/__tests__/components/events/v4/` (12 test files, ~50 specs total) + 1 banned-strings integration test under `src/__tests__/lib/v4/`

**Modify:**
- `src/app/events/[...slug]/page.tsx` — swap `<EventDetailV2>` for `<V4EventDetail>`, add state derivation
- `src/components/Events/v4/index.ts` — barrel exports

**Untouched (per spec §2):** `EventDetailV2.tsx`, `EventDetail.tsx`, `EventDetailActions.tsx`, `RelatedEvents.tsx`, `EventSheet.tsx`, all Phase 1/2 files, all other routes.

---

## Task 1: Trust-copy constants + state-label dictionary

**Files:**
- Create: `src/lib/v4/event-detail-trust-copy.ts`
- Test: `src/__tests__/lib/v4/event-detail-trust-copy.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/v4/event-detail-trust-copy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  TRUST_COPY_EXTERNAL,
  TRUST_COPY_REDIRECT,
  BANNED_STRINGS,
  providerLine,
} from '@/lib/v4/event-detail-trust-copy';

describe('event-detail-trust-copy', () => {
  it('TRUST_COPY_EXTERNAL is exactly the brief-approved string', () => {
    expect(TRUST_COPY_EXTERNAL).toBe('Kauf und Zahlung erfolgen beim offiziellen Anbieter.');
  });

  it('TRUST_COPY_REDIRECT is exactly the brief-approved string', () => {
    expect(TRUST_COPY_REDIRECT).toBe('Du wirst zum offiziellen Ticketshop weitergeleitet.');
  });

  it('BANNED_STRINGS contains the four hard-banned phrases', () => {
    expect(BANNED_STRINGS).toContain('Kein Aufpreis');
    expect(BANNED_STRINGS).toContain('Personalisierte e-Tickets');
    expect(BANNED_STRINGS).toContain('Boardkarte');
    expect(BANNED_STRINGS).toContain('Bei ÖBB buchen');
  });

  it('providerLine formats as "Offizieller Ticketshop: <name>"', () => {
    expect(providerLine('Eventim')).toBe('Offizieller Ticketshop: Eventim');
    expect(providerLine('oeticket')).toBe('Offizieller Ticketshop: oeticket');
  });

  it('providerLine falls back to a generic phrase when name is null/empty', () => {
    expect(providerLine(null)).toBe('Offizieller Ticketshop');
    expect(providerLine('')).toBe('Offizieller Ticketshop');
  });
});
```

- [ ] **Step 2: Run test → fail**

Run: `npm test -- src/__tests__/lib/v4/event-detail-trust-copy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/v4/event-detail-trust-copy.ts`:

```ts
/**
 * Trust-copy strings used by V4EventDetail's ticket-bearing boxes.
 *
 * Per chat2 brief (docs/superpowers/specs/2026-05-14-v4-phase-3-…-design.md
 * §5) these are the ONLY two trust strings allowed on event detail
 * surfaces, and BANNED_STRINGS lists hard-rejected phrases that
 * mis-promised features (e.g. "Personalisierte e-Tickets") in earlier
 * iterations.
 *
 * The Vitest banned-strings snapshot in
 * src/__tests__/lib/v4/banned-strings-detail.test.tsx greps V4EventDetail
 * render output and fails if any BANNED_STRINGS entry is present.
 */

export const TRUST_COPY_EXTERNAL =
  'Kauf und Zahlung erfolgen beim offiziellen Anbieter.';

export const TRUST_COPY_REDIRECT =
  'Du wirst zum offiziellen Ticketshop weitergeleitet.';

export const BANNED_STRINGS: readonly string[] = [
  'Kein Aufpreis',
  'Personalisierte e-Tickets',
  'Boardkarte',
  'Bei ÖBB buchen',
];

export function providerLine(name: string | null | undefined): string {
  if (!name) return 'Offizieller Ticketshop';
  return `Offizieller Ticketshop: ${name}`;
}
```

- [ ] **Step 4: Run test → pass**

Run: `npm test -- src/__tests__/lib/v4/event-detail-trust-copy.test.ts`
Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/v4/event-detail-trust-copy.ts src/__tests__/lib/v4/event-detail-trust-copy.test.ts
git commit -m "feat(v4): trust-copy constants for Event-Detail (Phase 3)

Two allow-listed strings + four banned phrases + providerLine helper.
Encoded as constants so a downstream banned-strings snapshot test can
verify nothing slips back in.
"
```

---

## Task 2: V4TicketBox (TDD, handles ticket + match + lineup variants)

**Files:**
- Create: `src/components/Events/v4/V4TicketBox.tsx`
- Test: `src/__tests__/components/events/v4/V4TicketBox.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/components/events/v4/V4TicketBox.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4TicketBox } from '@/components/Events/v4/V4TicketBox';

describe('V4TicketBox', () => {
  it('renders provider line + price + primary CTA', () => {
    render(<V4TicketBox provider="Eventim" priceFrom="€ 48,00" ticketUrl="https://eventim.de/x"/>);
    expect(screen.getByText('Offizieller Ticketshop: Eventim')).toBeInTheDocument();
    expect(screen.getByText('€ 48,00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /zu eventim/i })).toBeInTheDocument();
  });

  it('CTA href is the ticketUrl', () => {
    render(<V4TicketBox provider="oeticket" priceFrom="€ 25,00" ticketUrl="https://oeticket.com/abc"/>);
    expect(screen.getByRole('link', { name: /zu oeticket/i }).getAttribute('href')).toBe('https://oeticket.com/abc');
  });

  it('shows ticket badge by default', () => {
    render(<V4TicketBox provider="Eventim" priceFrom="€ 10" ticketUrl="x"/>);
    expect(document.querySelector('[data-v4-badge][data-kind="ticket"]')).toBeTruthy();
  });

  it('variant="match" swaps to gold match badge with personalized label', () => {
    render(<V4TicketBox provider="Eventim" priceFrom="€ 10" ticketUrl="x" variant="match" artistName="Bilderbuch"/>);
    expect(document.querySelector('[data-v4-badge][data-kind="match"]')).toBeTruthy();
    expect(screen.getByText(/du folgst bilderbuch/i)).toBeInTheDocument();
  });

  it('variant="lineup" shows lineup badge with artist-in-lineup wording', () => {
    render(<V4TicketBox provider="Eventim" priceFrom="€ 10" ticketUrl="x" variant="lineup" artistName="Wanda"/>);
    expect(document.querySelector('[data-v4-badge][data-kind="lineup"]')).toBeTruthy();
    expect(screen.getByText(/wanda im line-up/i)).toBeInTheDocument();
  });

  it('renders both trust-copy strings', () => {
    render(<V4TicketBox provider="Eventim" priceFrom="€ 10" ticketUrl="x"/>);
    expect(screen.getByText('Kauf und Zahlung erfolgen beim offiziellen Anbieter.')).toBeInTheDocument();
    expect(screen.getByText('Du wirst zum offiziellen Ticketshop weitergeleitet.')).toBeInTheDocument();
  });

  it('ticket-shop link opens in new tab + rel safe', () => {
    render(<V4TicketBox provider="Eventim" priceFrom="€ 10" ticketUrl="x"/>);
    const link = screen.getByRole('link', { name: /zu eventim/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -- src/__tests__/components/events/v4/V4TicketBox.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/components/Events/v4/V4TicketBox.tsx`:

```tsx
/**
 * V4TicketBox — side-box on event detail when an online ticket exists.
 *
 * Three visual variants:
 *   • ticket   (default)  — sand top-stripe, "Tickets verfügbar" badge
 *   • match               — gold stripe, "Du folgst <artist>" badge
 *   • lineup              — gold stripe, "<artist> im Line-up" badge
 *
 * All three share the same body: provider line, price block, primary CTA
 * ("Zu {provider}"), three secondary actions (Zum Plan / Merken / Teilen),
 * and the two brief-approved trust-copy strings at the bottom.
 *
 * Pure RSC. Ticket links open in a new tab with `rel="noopener noreferrer"`
 * — never lose the user to a partner shop in their main tab.
 */

import { V4Badge } from './V4Badge';
import {
  TRUST_COPY_EXTERNAL,
  TRUST_COPY_REDIRECT,
  providerLine,
} from '@/lib/v4/event-detail-trust-copy';

export type V4TicketBoxVariant = 'ticket' | 'match' | 'lineup';

interface V4TicketBoxProps {
  provider: string;
  priceFrom: string;
  ticketUrl: string;
  variant?: V4TicketBoxVariant;
  /** Required for `match`/`lineup` to personalise the badge label. */
  artistName?: string;
}

const STRIPE_COLOR: Record<V4TicketBoxVariant, string> = {
  ticket: 'var(--v4-ticket)',
  match:  'var(--v4-match)',
  lineup: 'var(--v4-match)',
};

const BORDER_COLOR: Record<V4TicketBoxVariant, string> = {
  ticket: 'rgba(212,184,150,0.34)',
  match:  'rgba(245,185,66,0.34)',
  lineup: 'rgba(245,185,66,0.34)',
};

function badgeLabel(variant: V4TicketBoxVariant, artistName?: string): string {
  if (variant === 'match' && artistName) return `Du folgst ${artistName}`;
  if (variant === 'lineup' && artistName) return `${artistName} im Line-up`;
  return 'Tickets verfügbar';
}

export function V4TicketBox({
  provider, priceFrom, ticketUrl,
  variant = 'ticket', artistName,
}: V4TicketBoxProps) {
  const badgeKind = variant === 'ticket' ? 'ticket' : variant;
  return (
    <div
      data-v4-side-box={variant}
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: `1px solid ${BORDER_COLOR[variant]}`, boxShadow: '0 6px 28px rgba(0,0,0,0.40)' }}
    >
      <div className="h-[3px]" style={{ background: STRIPE_COLOR[variant] }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind={badgeKind}>{badgeLabel(variant, artistName)}</V4Badge>

        <p className="mt-3.5 mb-1 text-[12px] font-medium text-[var(--v4-ink-70)]">
          {providerLine(provider)}
        </p>

        <div className="flex items-baseline gap-2.5 mb-4">
          <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--v4-ink-50)]">ab</span>
          <span className="text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)]">{priceFrom.replace(/^ab\s*/i, '')}</span>
          <span className="text-[12px] text-[var(--v4-ink-50)] ml-1">pro Person</span>
        </div>

        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-track="ticket_click"
          className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ticket)] text-[#1a1208] text-sm font-semibold"
        >
          Zu {provider}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        <div className="mt-2.5 flex gap-2">
          <a href="/saved" className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            Zum Plan
          </a>
          <a href="/saved" className="press-haptic inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]" aria-label="Merken">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </a>
          <a href="#share" className="press-haptic inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]" aria-label="Teilen">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </a>
        </div>

        <div className="mt-4 pt-3.5 border-t border-[var(--v4-hairline-1)] flex flex-col gap-1.5">
          <p className="text-[11.5px] leading-[1.5] text-[var(--v4-ink-50)] flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v4-go)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0,marginTop:2}}><polyline points="20 6 9 17 4 12"/></svg>
            <span>{TRUST_COPY_EXTERNAL}</span>
          </p>
          <p className="text-[11.5px] leading-[1.5] text-[var(--v4-ink-50)] flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v4-go)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0,marginTop:2}}><polyline points="20 6 9 17 4 12"/></svg>
            <span>{TRUST_COPY_REDIRECT}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → pass**

Run: `npm test -- src/__tests__/components/events/v4/V4TicketBox.test.tsx`
Expected: 7/7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4TicketBox.tsx src/__tests__/components/events/v4/V4TicketBox.test.tsx
git commit -m "feat(v4): add V4TicketBox with ticket/match/lineup variants (Phase 3)

3-in-1 side-box: ticket (sand), match (gold + 'Du folgst …'), lineup
(gold + 'X im Line-up'). All variants share provider line, price block,
primary CTA, secondary action row, and the two brief-approved trust-
copy lines. Ticket link opens new tab with rel-noopener-noreferrer.
"
```

---

## Task 3: V4FreeBox + V4DoorsaleBox (TDD, bundled — shared structure)

**Files:**
- Create: `src/components/Events/v4/V4FreeBox.tsx`
- Create: `src/components/Events/v4/V4DoorsaleBox.tsx`
- Test: `src/__tests__/components/events/v4/V4FreeBox.test.tsx`
- Test: `src/__tests__/components/events/v4/V4DoorsaleBox.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/__tests__/components/events/v4/V4FreeBox.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FreeBox } from '@/components/Events/v4/V4FreeBox';

describe('V4FreeBox', () => {
  it('shows free badge + headline + plan-CTA', () => {
    render(<V4FreeBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="free"]')).toBeTruthy();
    expect(screen.getByText(/plane deinen abend/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abend planen/i })).toBeInTheDocument();
  });

  it('plan-CTA points to /saved (Phase-3 stub for Plan Wizard route)', () => {
    render(<V4FreeBox/>);
    expect(screen.getByRole('link', { name: /abend planen/i }).getAttribute('href')).toBe('/saved');
  });

  it('does NOT render ticket trust-copy', () => {
    render(<V4FreeBox/>);
    expect(screen.queryByText(/kauf und zahlung/i)).toBeNull();
  });
});
```

`src/__tests__/components/events/v4/V4DoorsaleBox.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4DoorsaleBox } from '@/components/Events/v4/V4DoorsaleBox';

describe('V4DoorsaleBox', () => {
  it('shows doorsale badge + no-online-presale headline', () => {
    render(<V4DoorsaleBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="doorsale"]')).toBeTruthy();
    expect(screen.getByText(/nur vor ort/i)).toBeInTheDocument();
  });

  it('renders priceAtDoor block when prop present', () => {
    render(<V4DoorsaleBox priceAtDoor="€ 15"/>);
    expect(screen.getByText('€ 15')).toBeInTheDocument();
    expect(screen.getByText(/vor ort/i)).toBeInTheDocument();
  });

  it('omits price block when no priceAtDoor', () => {
    const { container } = render(<V4DoorsaleBox/>);
    expect(container.textContent).not.toMatch(/€ \d+/);
  });
});
```

- [ ] **Step 2: Run both → fail**

Run: `npm test -- src/__tests__/components/events/v4/V4FreeBox.test.tsx src/__tests__/components/events/v4/V4DoorsaleBox.test.tsx`
Expected: both FAIL.

- [ ] **Step 3: Implement both**

`src/components/Events/v4/V4FreeBox.tsx`:

```tsx
/**
 * V4FreeBox — side-box when state === 'free'.
 *
 * No ticket purchase path; pivots to planning. Green accent stripe +
 * "Abend planen" CTA (links to /saved as Phase-3 stub for the future
 * Plan Wizard in Phase 5).
 */

import { V4Badge } from './V4Badge';

export function V4FreeBox() {
  return (
    <div
      data-v4-side-box="free"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(123,183,148,0.34)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-go)' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="free">Eintritt frei</V4Badge>
        <p className="mt-3.5 text-[16px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-tight">
          Plane deinen Abend und lass dich rechtzeitig erinnern.
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          Kein Ticket nötig. Wir merken Anreise und Reminder in deinem Plan.
        </p>

        <a
          href="/saved"
          data-track="plan_started"
          className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold"
        >
          Abend planen
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        <div className="mt-2.5 flex gap-2">
          <a href="/saved" className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Merken
          </a>
          <a href="#share" className="press-haptic inline-flex items-center justify-center px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)]" aria-label="Teilen">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </a>
        </div>
      </div>
    </div>
  );
}
```

`src/components/Events/v4/V4DoorsaleBox.tsx`:

```tsx
/**
 * V4DoorsaleBox — side-box when state === 'doorsale'.
 *
 * Telegraphs "no online presale — buy at the door". Optional priceAtDoor
 * prop renders a small "vor Ort: €X" block. Blue accent (doorsale token).
 */

import { V4Badge } from './V4Badge';

interface V4DoorsaleBoxProps {
  priceAtDoor?: string;
}

export function V4DoorsaleBox({ priceAtDoor }: V4DoorsaleBoxProps) {
  return (
    <div
      data-v4-side-box="doorsale"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(126,170,240,0.34)' }}
    >
      <div className="h-[3px]" style={{ background: '#7eaaf0' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="doorsale">Abendkasse</V4Badge>
        <p className="mt-3.5 text-[16px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-tight">
          Tickets gibt's nur vor Ort — kein Online-Verkauf.
        </p>

        {priceAtDoor && (
          <div
            className="mt-3 rounded-[10px] px-3.5 py-2.5 flex items-baseline gap-2 border border-[var(--v4-hairline-2)] bg-[var(--v4-surface)]"
          >
            <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--v4-ink-50)]">vor Ort</span>
            <span className="text-[17px] font-bold tracking-[-0.015em] text-[var(--v4-ink)]">{priceAtDoor}</span>
          </div>
        )}

        <p className="mt-3 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          Plane Anreise und Reminder — wir erinnern dich rechtzeitig.
        </p>

        <a
          href="/saved"
          data-track="plan_started"
          className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
        >
          Abend planen
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        <div className="mt-2.5 flex gap-2">
          <a href="#route" data-track="route_opened" className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]">
            Route
          </a>
          <a href="/saved" className="press-haptic inline-flex items-center justify-center px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)]" aria-label="Merken">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → pass**

Run: `npm test -- src/__tests__/components/events/v4/V4FreeBox.test.tsx src/__tests__/components/events/v4/V4DoorsaleBox.test.tsx`
Expected: 3/3 + 3/3 = 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4FreeBox.tsx src/components/Events/v4/V4DoorsaleBox.tsx src/__tests__/components/events/v4/V4FreeBox.test.tsx src/__tests__/components/events/v4/V4DoorsaleBox.test.tsx
git commit -m "feat(v4): add V4FreeBox + V4DoorsaleBox side-boxes (Phase 3)

Free events pivot to 'Abend planen' (green). Abendkasse renders an
optional 'vor Ort: €X' block plus Route + Merken actions. Both link
to /saved as Phase-3 stub for the Plan Wizard coming in Phase 5.
"
```

---

## Task 4: V4InPlanBox + V4UnknownBox (TDD, bundled)

**Files:**
- Create: `src/components/Events/v4/V4InPlanBox.tsx`
- Create: `src/components/Events/v4/V4UnknownBox.tsx`
- Test: `src/__tests__/components/events/v4/V4InPlanBox.test.tsx`
- Test: `src/__tests__/components/events/v4/V4UnknownBox.test.tsx`

- [ ] **Step 1: Write tests**

`V4InPlanBox.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4InPlanBox } from '@/components/Events/v4/V4InPlanBox';

describe('V4InPlanBox', () => {
  it('shows in-plan badge and "Plan öffnen" CTA', () => {
    render(<V4InPlanBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="inplan"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /plan öffnen/i })).toBeInTheDocument();
  });

  it('CTA links to /saved (Phase 3 stub)', () => {
    render(<V4InPlanBox/>);
    expect(screen.getByRole('link', { name: /plan öffnen/i }).getAttribute('href')).toBe('/saved');
  });
});
```

`V4UnknownBox.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4UnknownBox } from '@/components/Events/v4/V4UnknownBox';

describe('V4UnknownBox', () => {
  it('shows unknown badge', () => {
    render(<V4UnknownBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="unknown"]')).toBeTruthy();
  });

  it('headline mentions no-known-shop messaging', () => {
    render(<V4UnknownBox/>);
    expect(screen.getByText(/kein.*ticketshop/i)).toBeInTheDocument();
  });

  it('offers Merken + Route as primary actions', () => {
    render(<V4UnknownBox/>);
    expect(screen.getByRole('link', { name: /merken/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /route/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -- src/__tests__/components/events/v4/V4InPlanBox.test.tsx src/__tests__/components/events/v4/V4UnknownBox.test.tsx`
Expected: both FAIL.

- [ ] **Step 3: Implement both**

`src/components/Events/v4/V4InPlanBox.tsx`:

```tsx
/**
 * V4InPlanBox — side-box when user already has this event in their plan.
 *
 * Green accent. Communicates "you're set — open your plan to manage it".
 */

import { V4Badge } from './V4Badge';

export function V4InPlanBox() {
  return (
    <div
      data-v4-side-box="inplan"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(123,183,148,0.34)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-go)' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="inplan">In deinem Plan</V4Badge>
        <p className="mt-3.5 text-[16px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-tight">
          Du gehst hin. Wir kümmern uns um Reminder &amp; Anreise.
        </p>

        <a
          href="/saved"
          data-track="plan_opened"
          className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold"
        >
          Plan öffnen
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        <a
          href="/saved"
          data-track="plan_remove"
          className="press-haptic mt-2 inline-flex w-full items-center justify-center gap-1 px-3 py-2 text-[12px] text-[var(--v4-ink-50)]"
        >
          Aus Plan entfernen
        </a>
      </div>
    </div>
  );
}
```

`src/components/Events/v4/V4UnknownBox.tsx`:

```tsx
/**
 * V4UnknownBox — side-box when we can't infer a ticket path (no
 * online shop known, no free/doorsale flag). Neutral hairline border;
 * pivots to Merken + Route.
 */

import { V4Badge } from './V4Badge';

export function V4UnknownBox() {
  return (
    <div
      data-v4-side-box="unknown"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]"
    >
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="unknown">Kein Online-Verkauf bekannt</V4Badge>
        <p className="mt-3.5 text-[15.5px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-[1.4]">
          Wir kennen keinen Ticketshop für dieses Event.
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          Wenn du hin willst, merken wir es — Anreise &amp; Reminder gehen trotzdem.
        </p>

        <div className="mt-[18px] flex flex-col gap-2">
          <a
            href="/saved"
            data-track="event_saved"
            className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Merken
          </a>
          <a
            href="#route"
            data-track="route_opened"
            className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]"
          >
            Route öffnen
          </a>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → pass**

Run: `npm test -- src/__tests__/components/events/v4/V4InPlanBox.test.tsx src/__tests__/components/events/v4/V4UnknownBox.test.tsx`
Expected: 2/2 + 3/3 = 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4InPlanBox.tsx src/components/Events/v4/V4UnknownBox.tsx src/__tests__/components/events/v4/V4InPlanBox.test.tsx src/__tests__/components/events/v4/V4UnknownBox.test.tsx
git commit -m "feat(v4): add V4InPlanBox + V4UnknownBox side-boxes (Phase 3)"
```

---

## Task 5: V4SoldoutBox (TDD)

**Files:**
- Create: `src/components/Events/v4/V4SoldoutBox.tsx`
- Test: `src/__tests__/components/events/v4/V4SoldoutBox.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4SoldoutBox } from '@/components/Events/v4/V4SoldoutBox';

describe('V4SoldoutBox', () => {
  it('shows soldout badge in red tone', () => {
    render(<V4SoldoutBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="soldout"]')).toBeTruthy();
  });

  it('headline conveys sold-out status', () => {
    render(<V4SoldoutBox/>);
    expect(screen.getByText(/aktuell vergriffen/i)).toBeInTheDocument();
  });

  it('CTA scrolls to similar-events anchor', () => {
    render(<V4SoldoutBox/>);
    expect(screen.getByRole('link', { name: /ähnliche events/i }).getAttribute('href')).toBe('#similar-events');
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```tsx
/**
 * V4SoldoutBox — restrained red side-box when tickets are sold out.
 *
 * Doesn't shout. Pivots the user to similar events further down the
 * page (anchor link). Phase 3 reserves the soldout state visually;
 * actual derivation comes later when Eventim availability is wired.
 */

import { V4Badge } from './V4Badge';

export function V4SoldoutBox() {
  return (
    <div
      data-v4-side-box="soldout"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(198,112,121,0.40)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-alert)' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="soldout">Ausverkauft</V4Badge>
        <p className="mt-3.5 text-[15.5px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-[1.4]">
          Tickets sind aktuell vergriffen.
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          Wir zeigen dir ähnliche Events darunter — vielleicht ist was dabei.
        </p>

        <a
          href="#similar-events"
          className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]"
        >
          Ähnliche Events
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → pass**

Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4SoldoutBox.tsx src/__tests__/components/events/v4/V4SoldoutBox.test.tsx
git commit -m "feat(v4): add V4SoldoutBox side-box (Phase 3)

Restrained red, pivots user to similar-events anchor below.
"
```

---

## Task 6: V4SideBox dispatcher + banned-strings snapshot test

**Files:**
- Create: `src/components/Events/v4/V4SideBox.tsx`
- Test: `src/__tests__/components/events/v4/V4SideBox.test.tsx`
- Test: `src/__tests__/lib/v4/banned-strings-detail.test.tsx`

- [ ] **Step 1: Write tests**

`V4SideBox.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { V4SideBox } from '@/components/Events/v4/V4SideBox';

describe('V4SideBox dispatcher', () => {
  function probe(boxAttr: string) {
    return document.querySelector(`[data-v4-side-box="${boxAttr}"]`);
  }

  it('state=ticket → V4TicketBox', () => {
    render(<V4SideBox state="ticket" provider="Eventim" priceFrom="€ 10" ticketUrl="x"/>);
    expect(probe('ticket')).toBeTruthy();
  });

  it('state=match → V4TicketBox match variant', () => {
    render(<V4SideBox state="match" provider="Eventim" priceFrom="€ 10" ticketUrl="x" artistName="Bilderbuch"/>);
    expect(probe('match')).toBeTruthy();
  });

  it('state=lineup → V4TicketBox lineup variant', () => {
    render(<V4SideBox state="lineup" provider="Eventim" priceFrom="€ 10" ticketUrl="x" artistName="Wanda"/>);
    expect(probe('lineup')).toBeTruthy();
  });

  it('state=free → V4FreeBox', () => {
    render(<V4SideBox state="free"/>);
    expect(probe('free')).toBeTruthy();
  });

  it('state=doorsale → V4DoorsaleBox', () => {
    render(<V4SideBox state="doorsale"/>);
    expect(probe('doorsale')).toBeTruthy();
  });

  it('state=inplan → V4InPlanBox', () => {
    render(<V4SideBox state="inplan"/>);
    expect(probe('inplan')).toBeTruthy();
  });

  it('state=unknown → V4UnknownBox', () => {
    render(<V4SideBox state="unknown"/>);
    expect(probe('unknown')).toBeTruthy();
  });

  it('state=soldout → V4SoldoutBox', () => {
    render(<V4SideBox state="soldout"/>);
    expect(probe('soldout')).toBeTruthy();
  });

  it('state=ticket WITHOUT ticketUrl falls back to UnknownBox (safety)', () => {
    render(<V4SideBox state="ticket"/>);
    expect(probe('unknown')).toBeTruthy();
  });
});
```

`src/__tests__/lib/v4/banned-strings-detail.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { V4SideBox } from '@/components/Events/v4/V4SideBox';
import { BANNED_STRINGS } from '@/lib/v4/event-detail-trust-copy';

describe('banned-strings — event detail surfaces', () => {
  const states = ['ticket','match','lineup','free','doorsale','inplan','unknown','soldout'] as const;

  for (const state of states) {
    it(`no banned strings appear in V4SideBox state=${state}`, () => {
      const { container } = render(
        <V4SideBox
          state={state}
          provider="Eventim"
          priceFrom="€ 10"
          ticketUrl="https://eventim.de/x"
          artistName="Bilderbuch"
        />
      );
      const text = container.textContent ?? '';
      for (const banned of BANNED_STRINGS) {
        expect(text).not.toContain(banned);
      }
    });
  }
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement dispatcher**

```tsx
/**
 * V4SideBox — routes per-state to the correct side-box variant.
 *
 * Phase 3 fallback rule: if state=ticket/match/lineup but ticketUrl is
 * missing, we degrade to UnknownBox to avoid rendering a primary CTA
 * without a destination. State-derivation in Phase 2 normally prevents
 * this combo, but defensive code keeps the contract safe.
 */

import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4TicketBox, type V4TicketBoxVariant } from './V4TicketBox';
import { V4FreeBox } from './V4FreeBox';
import { V4DoorsaleBox } from './V4DoorsaleBox';
import { V4InPlanBox } from './V4InPlanBox';
import { V4UnknownBox } from './V4UnknownBox';
import { V4SoldoutBox } from './V4SoldoutBox';

interface V4SideBoxProps {
  state: V4EventState;
  provider?: string;
  priceFrom?: string;
  ticketUrl?: string;
  priceAtDoor?: string;
  artistName?: string;
}

export function V4SideBox(props: V4SideBoxProps) {
  const { state, provider, priceFrom, ticketUrl, priceAtDoor, artistName } = props;

  // Variants of TicketBox.
  if (state === 'ticket' || state === 'match' || state === 'lineup') {
    if (!provider || !priceFrom || !ticketUrl) {
      return <V4UnknownBox/>;
    }
    return (
      <V4TicketBox
        provider={provider}
        priceFrom={priceFrom}
        ticketUrl={ticketUrl}
        variant={state as V4TicketBoxVariant}
        artistName={artistName}
      />
    );
  }

  if (state === 'free')     return <V4FreeBox/>;
  if (state === 'doorsale') return <V4DoorsaleBox priceAtDoor={priceAtDoor}/>;
  if (state === 'inplan')   return <V4InPlanBox/>;
  if (state === 'soldout')  return <V4SoldoutBox/>;
  return <V4UnknownBox/>;
}
```

- [ ] **Step 4: Run → pass**

Run: `npm test -- src/__tests__/components/events/v4/V4SideBox.test.tsx src/__tests__/lib/v4/banned-strings-detail.test.tsx`
Expected: 9/9 dispatcher + 8/8 banned-strings = 17/17 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4SideBox.tsx src/__tests__/components/events/v4/V4SideBox.test.tsx src/__tests__/lib/v4/banned-strings-detail.test.tsx
git commit -m "feat(v4): V4SideBox dispatcher + banned-strings snapshot test (Phase 3)

State→box map for the 8 derived states. Defensive UnknownBox fallback
when a ticket-tier state arrives without ticketUrl/provider/price.
Banned-strings test renders every state and verifies none of the four
chat2-banned phrases appear in output — regression net for trust copy.
"
```

---

## Task 7: V4EventDetailHero

**Files:**
- Create: `src/components/Events/v4/V4EventDetailHero.tsx`
- Test: `src/__tests__/components/events/v4/V4EventDetailHero.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EventDetailHero } from '@/components/Events/v4/V4EventDetailHero';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, priority, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} data-priority={priority ? 'true' : 'false'} {...rest as object}/>;
  },
}));

describe('V4EventDetailHero', () => {
  const baseProps = {
    title: 'Bilderbuch in der Stadthalle',
    startDate: '2026-09-15T20:00:00Z',
    locationName: 'Stadthalle Halle D',
    city: 'Wien',
    imageUrl: 'https://cdn.example/hero.jpg',
  };

  it('renders title as h1', () => {
    render(<V4EventDetailHero {...baseProps}/>);
    expect(screen.getByRole('heading', { level: 1, name: /bilderbuch in der stadthalle/i })).toBeInTheDocument();
  });

  it('shows location and city', () => {
    render(<V4EventDetailHero {...baseProps}/>);
    expect(screen.getByText(/stadthalle halle d/i)).toBeInTheDocument();
    expect(screen.getByText(/wien/i)).toBeInTheDocument();
  });

  it('uses next/image with priority for LCP', () => {
    const { container } = render(<V4EventDetailHero {...baseProps}/>);
    const img = container.querySelector('img');
    expect(img?.getAttribute('data-priority')).toBe('true');
    expect(img?.getAttribute('src')).toBe('https://cdn.example/hero.jpg');
  });

  it('falls back to text-only hero when no image', () => {
    render(<V4EventDetailHero {...baseProps} imageUrl={null}/>);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```tsx
/**
 * V4EventDetailHero — full-bleed image hero with title + date + location
 * as a single legible block bottom-left over a vertical gradient mask.
 *
 * RSC. Uses next/image with `priority` to become the LCP element on
 * /events/<slug>. Falls back to a text-only hero when imageUrl is null.
 */

import Image from 'next/image';

interface V4EventDetailHeroProps {
  title: string;
  startDate: string;
  locationName: string | null;
  city: string | null;
  imageUrl?: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function V4EventDetailHero({ title, startDate, locationName, city, imageUrl }: V4EventDetailHeroProps) {
  const dateLabel = formatDate(startDate);
  const placeLabel = [locationName, city].filter(Boolean).join(' · ');

  return (
    <section className="relative h-[320px] md:h-[480px] overflow-hidden">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-[var(--v4-surface-elevated)]"/>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(10,10,12,0.40) 0%, rgba(10,10,12,0.10) 35%, rgba(10,10,12,0.92) 100%)',
        }}
      />

      <div className="absolute left-0 right-0 bottom-0">
        <div className="max-w-[1180px] mx-auto px-5 md:px-14 py-5 md:py-9 flex flex-col items-start gap-2.5">
          <h1
            className="m-0 text-[30px] md:text-[52px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.02] max-w-[760px]"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
          >
            {title}
          </h1>
          <div className="flex flex-wrap gap-3 items-center text-[13.5px] md:text-[16px] font-medium text-[var(--v4-ink-70)]">
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {dateLabel}
            </span>
            {placeLabel && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {placeLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run → pass**

Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4EventDetailHero.tsx src/__tests__/components/events/v4/V4EventDetailHero.test.tsx
git commit -m "feat(v4): add V4EventDetailHero with next/image LCP priority (Phase 3)"
```

---

## Task 8: V4EventDetailContent

**Files:**
- Create: `src/components/Events/v4/V4EventDetailContent.tsx`
- Test: `src/__tests__/components/events/v4/V4EventDetailContent.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EventDetailContent } from '@/components/Events/v4/V4EventDetailContent';

describe('V4EventDetailContent', () => {
  it('renders description heading + body', () => {
    render(<V4EventDetailContent description="Drei Sets, eine Bühne, kein Eintritt."/>);
    expect(screen.getByText(/worum geht.?s/i)).toBeInTheDocument();
    expect(screen.getByText(/drei sets/i)).toBeInTheDocument();
  });

  it('omits description block when description is null', () => {
    render(<V4EventDetailContent description={null}/>);
    expect(screen.queryByText(/worum geht.?s/i)).toBeNull();
  });

  it('renders tag chips when tags present', () => {
    render(<V4EventDetailContent description={null} tags={['rock','open-air']}/>);
    expect(screen.getByText('rock')).toBeInTheDocument();
    expect(screen.getByText('open-air')).toBeInTheDocument();
  });

  it('renders similar-events anchor when section present', () => {
    const { container } = render(<V4EventDetailContent description={null} hasSimilar/>);
    expect(container.querySelector('#similar-events')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```tsx
/**
 * V4EventDetailContent — the main content column of the event detail.
 *
 * Phase 3 keeps the structure minimal and forward-compatible:
 *   • Description block (h3 "Worum geht's?" + paragraph)
 *   • Tag chips (neutral hairline pills)
 *   • #similar-events anchor + section header (caller renders the actual
 *     similar-event grid; we just provide the landing target for the
 *     soldout box scroll-CTA)
 *
 * Lineup grid + venue map snippet are explicit follow-ups (Phase 3.1)
 * since they need their own data wiring and would balloon this file.
 */

import type { ReactNode } from 'react';

interface V4EventDetailContentProps {
  description: string | null;
  tags?: string[] | null;
  hasSimilar?: boolean;
  similarChildren?: ReactNode;
}

export function V4EventDetailContent({ description, tags, hasSimilar, similarChildren }: V4EventDetailContentProps) {
  const tagList = (tags ?? []).filter(Boolean);

  return (
    <div className="max-w-[700px]">
      {description && (
        <section className="mt-7">
          <h3 className="m-0 mb-3 text-[16px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
            Worum geht&apos;s?
          </h3>
          <p className="m-0 max-w-[640px] text-[14.5px] leading-[1.6] text-[var(--v4-ink-70)]" style={{ textWrap: 'pretty' }}>
            {description}
          </p>
        </section>
      )}

      {tagList.length > 0 && (
        <section className="mt-7 flex flex-wrap gap-2">
          {tagList.map(t => (
            <span
              key={t}
              className="inline-flex items-center px-2.5 py-1 rounded-full border border-[var(--v4-hairline-2)] text-[11.5px] font-medium text-[var(--v4-ink-70)]"
            >
              {t}
            </span>
          ))}
        </section>
      )}

      {hasSimilar && (
        <section id="similar-events" className="mt-10">
          <h3 className="m-0 mb-4 text-[16px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
            Ähnliche Events
          </h3>
          {similarChildren}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run → pass**

Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4EventDetailContent.tsx src/__tests__/components/events/v4/V4EventDetailContent.test.tsx
git commit -m "feat(v4): add V4EventDetailContent (description + tags + similar anchor)"
```

---

## Task 9: V4MobileStickyBar

**Files:**
- Create: `src/components/Events/v4/V4MobileStickyBar.tsx`
- Test: `src/__tests__/components/events/v4/V4MobileStickyBar.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MobileStickyBar } from '@/components/Events/v4/V4MobileStickyBar';

describe('V4MobileStickyBar', () => {
  it('state=ticket renders "Zu {provider}" + price', () => {
    render(<V4MobileStickyBar state="ticket" provider="Eventim" priceFrom="€ 48" ticketUrl="x"/>);
    expect(screen.getByText('€ 48')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /zu eventim/i })).toBeInTheDocument();
  });

  it('state=free renders "Abend planen"', () => {
    render(<V4MobileStickyBar state="free"/>);
    expect(screen.getByRole('link', { name: /abend planen/i })).toBeInTheDocument();
  });

  it('state=inplan renders "Plan öffnen"', () => {
    render(<V4MobileStickyBar state="inplan"/>);
    expect(screen.getByRole('link', { name: /plan öffnen/i })).toBeInTheDocument();
  });

  it('state=unknown renders "Merken"', () => {
    render(<V4MobileStickyBar state="unknown"/>);
    expect(screen.getByRole('link', { name: /merken/i })).toBeInTheDocument();
  });

  it('is md:hidden (desktop suppresses it)', () => {
    const { container } = render(<V4MobileStickyBar state="free"/>);
    expect(container.firstElementChild?.className).toContain('md:hidden');
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```tsx
/**
 * V4MobileStickyBar — fixed bottom action bar on the event detail.
 *
 * Five state-variants compress the side-box message to a single
 * primary CTA + a short status tag. Rendered above V4TabBar (Phase 1)
 * by being lower in z-order; offset by 76px so the tab bar stays visible.
 *
 * Pure server-rendered <a> elements; no client JS. The 'md:hidden'
 * Tailwind class keeps it out of the desktop layout entirely.
 */

import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4Badge } from './V4Badge';

interface V4MobileStickyBarProps {
  state: V4EventState;
  provider?: string;
  priceFrom?: string;
  ticketUrl?: string;
  priceAtDoor?: string;
}

export function V4MobileStickyBar({ state, provider, priceFrom, ticketUrl, priceAtDoor }: V4MobileStickyBarProps) {
  return (
    <div
      data-v4-event-sticky={state}
      className="md:hidden fixed left-0 right-0 z-[22] flex items-center gap-3 px-4 py-3 border-t border-[var(--v4-hairline-2)] bg-[rgba(10,10,12,0.96)] backdrop-blur"
      style={{ bottom: 76 }}
    >
      {state === 'ticket' || state === 'match' || state === 'lineup' ? (
        provider && priceFrom && ticketUrl ? (
          <>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--v4-ink-50)]">ab</span>
              <span className="text-[17px] font-bold tracking-[-0.015em] text-[var(--v4-ink)]">{priceFrom.replace(/^ab\s*/i,'')}</span>
            </div>
            <div className="flex-1"/>
            <a
              href={ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-track="ticket_click_mobile"
              className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--v4-ticket)] text-[#1a1208] text-sm font-semibold"
            >
              Zu {provider}
            </a>
          </>
        ) : (
          <>
            <V4Badge kind="unknown">Kein Ticket bekannt</V4Badge>
            <div className="flex-1"/>
            <a href="/saved" className="press-haptic px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]">Merken</a>
          </>
        )
      ) : state === 'free' ? (
        <>
          <V4Badge kind="free">Eintritt frei</V4Badge>
          <div className="flex-1"/>
          <a href="/saved" data-track="plan_started_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold">Abend planen</a>
        </>
      ) : state === 'doorsale' ? (
        <>
          <V4Badge kind="doorsale">{priceAtDoor ? `Abendkasse · ${priceAtDoor}` : 'Abendkasse'}</V4Badge>
          <div className="flex-1"/>
          <a href="/saved" data-track="plan_started_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold">Abend planen</a>
        </>
      ) : state === 'inplan' ? (
        <>
          <V4Badge kind="inplan">In deinem Plan</V4Badge>
          <div className="flex-1"/>
          <a href="/saved" data-track="plan_opened_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold">Plan öffnen</a>
        </>
      ) : state === 'soldout' ? (
        <>
          <V4Badge kind="soldout">Ausverkauft</V4Badge>
          <div className="flex-1"/>
          <a href="#similar-events" className="press-haptic px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]">Ähnliche Events</a>
        </>
      ) : (
        <>
          <V4Badge kind="unknown">Kein Ticket bekannt</V4Badge>
          <div className="flex-1"/>
          <a href="/saved" data-track="event_saved_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold">Merken</a>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run → pass**

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4MobileStickyBar.tsx src/__tests__/components/events/v4/V4MobileStickyBar.test.tsx
git commit -m "feat(v4): add V4MobileStickyBar with 5 state variants (Phase 3)

Fixed bottom on mobile (md:hidden), offset 76px above V4TabBar.
Compresses side-box decision into single CTA + status badge per state.
"
```

---

## Task 10: derive-detail-context helper

**Files:**
- Create: `src/lib/v4/derive-detail-context.ts`

(No test — heavy Supabase mock; covered indirectly by Task 13 dev preview.)

- [ ] **Step 1: Implement**

```ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isFalsePositiveMatch } from '@/lib/artist-matching';
import type { DeriveCtx } from './derive-event-state';

/**
 * Loads the minimal context needed to derive a V4EventState for a
 * SINGLE event id. Cheaper than getLandingContext (which scopes a
 * 60-day window across all matched events).
 *
 *  - Anon: empty sets, no DB queries fired.
 *  - Authed: three small queries — saved_events for THIS event,
 *    artist_event_notifications for THIS event, plus a single artist
 *    name to thread through to V4TicketBox's match/lineup variant.
 */
export interface DetailContext extends DeriveCtx {
  signedIn: boolean;
  matchedArtistName?: string;
}

export async function deriveDetailContext(eventId: string): Promise<DetailContext> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const empty: DetailContext = {
    signedIn: false,
    savedEventIds: new Set(),
    followedArtistIds: new Set(),
    artistMatchEventIds: new Set(),
    lineupMatchEventIds: new Set(),
  };

  if (!user) return empty;

  const [savedRes, notifRes] = await Promise.all([
    supabase
      .from('saved_events')
      .select('event_id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('artist_event_notifications')
      .select('artist_name, match_source, events!inner(title)')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .limit(5),
  ]);

  const savedEventIds = new Set<string>();
  if (savedRes.data?.event_id) savedEventIds.add(savedRes.data.event_id);

  const artistMatchEventIds = new Set<string>();
  const lineupMatchEventIds = new Set<string>();
  let matchedArtistName: string | undefined;

  type NotifRow = {
    artist_name: string;
    match_source: string;
    events: { title: string } | Array<{ title: string }> | null;
  };

  for (const n of (notifRes.data ?? []) as NotifRow[]) {
    const eventInfo = Array.isArray(n.events) ? n.events[0] : n.events;
    const eventTitle = eventInfo?.title ?? '';
    if (n.match_source === 'lineup') {
      lineupMatchEventIds.add(eventId);
      matchedArtistName ??= n.artist_name;
    } else if (!isFalsePositiveMatch(n.artist_name, eventTitle)) {
      artistMatchEventIds.add(eventId);
      matchedArtistName ??= n.artist_name;
    }
  }

  return {
    signedIn: true,
    savedEventIds,
    followedArtistIds: new Set(),
    artistMatchEventIds,
    lineupMatchEventIds,
    matchedArtistName,
  };
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep "derive-detail-context"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/v4/derive-detail-context.ts
git commit -m "feat(v4): derive-detail-context — per-event user context (Phase 3)

Light cousin of getLandingContext; scoped to a single event id so the
two queries fire on the detail page render path. Returns matchedArtistName
so the TicketBox match/lineup variant can show 'Du folgst …' / '… im Line-up'.
"
```

---

## Task 11: V4EventDetail top-level component

**Files:**
- Create: `src/components/Events/v4/V4EventDetail.tsx`
- Test: `src/__tests__/components/events/v4/V4EventDetail.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EventDetail } from '@/components/Events/v4/V4EventDetail';
import type { Event } from '@/types/events';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, priority, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

function ev(over: Partial<Event> = {}): Event {
  return {
    id: 'e1', source_id: null, source_name: null, source_url: null,
    title: 'Bilderbuch', description: 'Eines der größten Konzerte',
    start_date: '2026-09-15T20:00:00Z', end_date: null,
    location_name: 'Stadthalle', address: null, postal_code: null,
    bundesland: 'Wien', district: null,
    latitude: null, longitude: null,
    category: 'music', price_text: null, price_min: null, price_max: null,
    image_url: 'https://cdn.example/hero.jpg',
    organizer: null, tags: ['rock', 'austropop'],
    ticket_url: 'https://eventim.at/x',
    slug: 'bilderbuch', created_at: '', updated_at: '',
    ...over,
  };
}

describe('V4EventDetail', () => {
  it('renders hero + content + side-box', () => {
    render(<V4EventDetail event={ev()} state="ticket" provider="Eventim" priceFrom="€ 48"/>);
    expect(screen.getByRole('heading', { level: 1, name: /bilderbuch/i })).toBeInTheDocument();
    expect(screen.getByText(/eines der größten konzerte/i)).toBeInTheDocument();
    expect(document.querySelector('[data-v4-side-box="ticket"]')).toBeTruthy();
  });

  it('mounts mobile sticky bar', () => {
    render(<V4EventDetail event={ev()} state="ticket" provider="Eventim" priceFrom="€ 48"/>);
    expect(document.querySelector('[data-v4-event-sticky="ticket"]')).toBeTruthy();
  });

  it('renders state=free without provider', () => {
    render(<V4EventDetail event={ev({ ticket_url: null })} state="free"/>);
    expect(document.querySelector('[data-v4-side-box="free"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Implement**

```tsx
/**
 * V4EventDetail — top-level v4 event detail composition.
 *
 * RSC. Caller (the route page.tsx) provides a pre-derived V4EventState
 * plus optional ticket fields. We compose hero + content + side-box + mobile
 * sticky-bar. Layout is two-col on desktop, single column on mobile with
 * the sticky-bar fixed at bottom.
 */

import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4EventDetailHero } from './V4EventDetailHero';
import { V4EventDetailContent } from './V4EventDetailContent';
import { V4SideBox } from './V4SideBox';
import { V4MobileStickyBar } from './V4MobileStickyBar';

interface V4EventDetailProps {
  event: Event;
  state: V4EventState;
  provider?: string;
  priceFrom?: string;
  priceAtDoor?: string;
  artistName?: string;
  /** Pre-rendered similar-events grid; mounted under #similar-events anchor. */
  similar?: React.ReactNode;
}

export function V4EventDetail({
  event, state,
  provider, priceFrom, priceAtDoor, artistName,
  similar,
}: V4EventDetailProps) {
  const ticketUrl = event.ticket_url ?? undefined;

  return (
    <div className="bg-[var(--v4-surface)] min-h-screen">
      <V4EventDetailHero
        title={event.title}
        startDate={event.start_date}
        locationName={event.location_name}
        city={event.bundesland}
        imageUrl={event.image_url}
      />

      <div className="max-w-[1180px] mx-auto px-5 md:px-14 py-8 md:py-12 grid grid-cols-1 md:grid-cols-[1fr_400px] gap-8 md:gap-12 pb-[120px] md:pb-12">
        <V4EventDetailContent
          description={event.description}
          tags={event.tags}
          hasSimilar={Boolean(similar)}
          similarChildren={similar}
        />

        <aside className="order-first md:order-last md:sticky md:top-[88px] md:self-start">
          <V4SideBox
            state={state}
            provider={provider}
            priceFrom={priceFrom}
            ticketUrl={ticketUrl}
            priceAtDoor={priceAtDoor}
            artistName={artistName}
          />
        </aside>
      </div>

      <V4MobileStickyBar
        state={state}
        provider={provider}
        priceFrom={priceFrom}
        ticketUrl={ticketUrl}
        priceAtDoor={priceAtDoor}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run → pass**

Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4EventDetail.tsx src/__tests__/components/events/v4/V4EventDetail.test.tsx
git commit -m "feat(v4): add V4EventDetail composing hero + content + side-box + sticky-bar"
```

---

## Task 12: Update Cards barrel to export Phase 3 components

**Files:**
- Modify: `src/components/Events/v4/index.ts`

- [ ] **Step 1: Read current barrel**

Run: `cat src/components/Events/v4/index.ts`

- [ ] **Step 2: Append Phase-3 exports**

Replace the file content with:

```ts
/**
 * v4 event/card primitives. Phase 2: card system used by the new
 * landing layout, reused by /entdecken (Phase 4) and /plans (Phase 5).
 * Phase 3: event-detail side-boxes + hero + content + mobile sticky-bar.
 */
export { V4Badge, type V4BadgeKind } from './V4Badge';
export { V4CardV } from './V4CardV';
export { V4CardH } from './V4CardH';
export { V4CardHero } from './V4CardHero';
export { V4FestivalCard } from './V4FestivalCard';
export { V4FunnelCard } from './V4FunnelCard';

// Phase 3 — event detail
export { V4TicketBox, type V4TicketBoxVariant } from './V4TicketBox';
export { V4FreeBox } from './V4FreeBox';
export { V4DoorsaleBox } from './V4DoorsaleBox';
export { V4InPlanBox } from './V4InPlanBox';
export { V4UnknownBox } from './V4UnknownBox';
export { V4SoldoutBox } from './V4SoldoutBox';
export { V4SideBox } from './V4SideBox';
export { V4EventDetailHero } from './V4EventDetailHero';
export { V4EventDetailContent } from './V4EventDetailContent';
export { V4MobileStickyBar } from './V4MobileStickyBar';
export { V4EventDetail } from './V4EventDetail';
```

- [ ] **Step 3: TypeScript check + commit**

```bash
npx tsc --noEmit 2>&1 | grep "Events/v4/index" || echo OK
git add src/components/Events/v4/index.ts
git commit -m "feat(v4): export Phase-3 detail components from cards barrel"
```

---

## Task 13: Swap import in /events/[...slug]/page.tsx

**Files:**
- Modify: `src/app/events/[...slug]/page.tsx`

- [ ] **Step 1: Read existing page.tsx to locate the EventDetailV2 usage**

Run: `grep -nE "EventDetailV2|<EventDetailV2" src/app/events/\[...slug\]/page.tsx`

Expected: import line + at least one JSX usage.

- [ ] **Step 2: Make 4 edits**

In `src/app/events/[...slug]/page.tsx`:

**Edit A — replace import:**

Find:
```tsx
import { EventDetailV2 } from '@/components/Events/EventDetailV2';
```

Replace with:
```tsx
import { V4EventDetail } from '@/components/Events/v4';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import { deriveDetailContext } from '@/lib/v4/derive-detail-context';
```

**Edit B — derive state + render V4EventDetail.**

Locate the JSX that mounts `<EventDetailV2 event={event} ... />` and replace with:

```tsx
const detailCtx = await deriveDetailContext(event.id);
const state = deriveEventState(event, detailCtx);
// Best-effort ticket meta: provider name + priceFrom string from event row.
const provider = event.source_name ?? undefined;
const priceFrom = event.price_text ?? (event.price_min != null ? `€ ${event.price_min}` : undefined);
const priceAtDoor = event.price_text ?? undefined;

return (
  <V4EventDetail
    event={event}
    state={state}
    provider={provider}
    priceFrom={priceFrom}
    priceAtDoor={priceAtDoor}
    artistName={detailCtx.matchedArtistName}
  />
);
```

Place the derivation block AFTER the existing `event` is loaded (after `resolveEvent` returns) and BEFORE the return JSX. Wrap the whole render path in `async` if not already.

**Edit C — handle nested data.**

The existing page may also pass `venue`, `lineup`, `friends`, `similar` to EventDetailV2. For Phase 3, **don't** pass `friends` (chat2-Brief: out of scope). If `RelatedEvents` is mounted, pass its rendered JSX through `similar` prop to V4EventDetail. If unsure, comment out those data calls and add a note for follow-up. The Phase-3 minimum is title/description/hero + side-box.

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds. No type errors. ISR marker `●` or `ƒ` for `/events/[...slug]` (latter is fine if auth changes dynamic-ness).

If build fails on missing fields (e.g. `event.source_name` doesn't exist), check the Event type and use the right column. The script `src/scripts/check-festival-join.ts` no longer exists; if you need DB introspection use the supabase admin UI or read `src/types/events.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/events/[...slug]/page.tsx
git commit -m "feat(v4): swap EventDetailV2 for V4EventDetail on /events/[...slug] (Phase 3)

Adds server-side state derivation via deriveDetailContext + deriveEventState.
Friends-avatars intentionally removed from event detail per chat2 brief
(Friends belong to Plan context, Phase 5).
"
```

---

## Task 14: End-to-end verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Full v4 test run**

Run: `npm test -- src/__tests__/components/events/v4/ src/__tests__/components/v4/ src/__tests__/lib/v4/`
Expected: All Phase 1 + Phase 2 + Phase 3 tests pass (~110 tests total).

- [ ] **Step 2: Production build**

Run: `npm run build 2>&1 | tail -30`
Expected: clean, CSP postbuild verify passes.

- [ ] **Step 3: Dev preview verification**

Run: `npm run dev` (background).

Visit a couple of event slugs:
- A music event with ticket_url + price (expect ticket or match state side-box)
- A free event (expect free side-box)
- A festival (expect lineup or ticket state)
- A small local event without ticket_url (expect unknown box)

Confirm:
- Hero image renders LCP-priority
- Side-box right rail on desktop, mobile sticky-bar at bottom
- No banned trust-copy strings anywhere in rendered HTML (grep)

Stop dev server.

- [ ] **Step 4: Verify EventDetailV2 no longer imported**

Run: `grep -rn "from '@/components/Events/EventDetailV2'" src/ | grep -v __tests__ | grep -v ".bak"`
Expected: no output (only test files or backups may still reference it; production code must not).

- [ ] **Step 5: Push + open PR**

```bash
git push -u origin claude/v4-phase-3-event-detail
gh pr create --base master --title "v4 Redesign Phase 3 — Event-Detail Redesign" --body "$(cat <<'EOF'
## Summary

Phase 3/5 of v4 redesign. Replaces EventDetailV2 (963 LOC client-state monolith) with a composable V4EventDetail family on /events/[...slug]:

- 6 side-box variants (ticket/match/lineup/free/doorsale/inplan/unknown/soldout) driven by Phase-2 deriveEventState
- 5-variant mobile sticky-bar
- Hero with LCP-priority next/image
- Content column: description + tags + #similar-events anchor
- Trust-copy strictly enforced: only the two brief-approved strings; banned-strings snapshot test catches regressions

**Out-of-Scope:** Friends-avatars removed from event detail (chat2: Friends belong to Plan context, Phase 5). Plan-Wizard CTAs all link to /saved as a stub; Phase 5 swaps to the real wizard. EventDetailV2.tsx is no longer imported but stays on disk (minimal-scope rule, cleanup in a later phase).

## Test plan

- [ ] Vercel preview: visit a music event with ticket → ticket side-box, "Zu Eventim" CTA
- [ ] Visit a free event → green free box, "Abend planen"
- [ ] Visit an event without ticket_url → neutral unknown box
- [ ] Mobile viewport: sticky bar visible at bottom, V4TabBar still visible below it
- [ ] No friend-avatars row anywhere on event detail
- [ ] No banned strings in any rendered detail page (Kein Aufpreis / Personalisierte e-Tickets / Boardkarte / Bei ÖBB buchen)
- [ ] PSI Mobile on a sample event detail ≥ 75

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Report PR URL**

The `gh pr create` output prints the PR URL — relay to the user.

---

## Acceptance Criteria (from Spec §8)

- [ ] /events/<slug> renders v4 layout for all 8 states (test-covered)
- [ ] State-Box-Switch correct (match/lineup→gold ticket box, free→green, doorsale→blue, inplan→green, unknown→neutral, soldout→red)
- [ ] Mobile sticky-bar visible + correct per state
- [ ] Banned-strings snapshot green for all 8 states
- [ ] Only the 2 approved trust-copy strings in ticket-bearing surfaces
- [ ] Friends-Avatars / RSVP-Counter NOT visible
- [ ] `npm run build` succeeds, ISR marker intact
- [ ] Slug-redirects + metadata still work
- [ ] v4-vitest suite (Phase 1+2+3) ≥ 80 tests green
- [ ] EventDetailV2 not imported anywhere in production code
