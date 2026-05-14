# v4 Redesign Phase 4 — Künstler + Entdecken-DualMode + Map-Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v4 redesign of `/artists` (full rebuild), `/entdecken` (Smart-Suche + Filter dual-mode with URL-persisted tabs), and `/map` (additive v4-chrome polish).

**Architecture:** New atoms (V4Toast, V4FilterChips, V4SortRow, V4EntdeckenTabs) live under `src/components/Events/v4/` for reuse across all three surfaces. Page-specific composites under `src/components/Artists/v4/`, `src/components/Discover/v4/`, `src/components/Map/v4/`. Mapbox-GL core untouched.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Vitest 4 + @testing-library/react · happy-dom. Reuses Phase-1 `--v4-*` tokens, Phase-2 V4CardV/V4Badge cards.

**Spec:** `docs/superpowers/specs/2026-05-14-v4-phase-4-artists-entdecken-map-design.md`

**Branch:** `claude/v4-phase-4-artists-entdecken-map` (forked from master after Phase 1+2+3 merged)

---

## File Structure

**Add — Atoms (reusable across surfaces):**
- `src/components/Events/v4/V4Toast.tsx`
- `src/components/Events/v4/V4FilterChips.tsx`
- `src/components/Events/v4/V4SortRow.tsx`
- `src/components/Events/v4/V4EntdeckenTabs.tsx`

**Add — Artists surface:**
- `src/components/Artists/v4/V4ArtistsHero.tsx`
- `src/components/Artists/v4/V4ArtistSearchResult.tsx`
- `src/components/Artists/v4/V4FollowedArtistsGrid.tsx`
- `src/components/Artists/v4/V4MatchingEvents.tsx`
- `src/components/Artists/v4/index.ts`
- `src/app/artists/V4ArtistsPageClient.tsx`

**Add — Discover (Entdecken) surface:**
- `src/components/Discover/v4/V4EntdeckenHero.tsx`
- `src/components/Discover/v4/V4EntdeckenFilterMode.tsx`
- `src/components/Discover/v4/V4EntdeckenSmartMode.tsx`
- `src/components/Discover/v4/index.ts`

**Add — Map surface:**
- `src/components/Map/v4/V4MapHeader.tsx`
- `src/components/Map/v4/V4MapFilterChipsOverlay.tsx`
- `src/components/Map/v4/V4MarkerLegend.tsx`
- `src/components/Map/v4/index.ts`

**Modify:**
- `src/components/Events/v4/index.ts` — append atom exports
- `src/app/artists/page.tsx` — swap to V4ArtistsPageClient
- `src/app/entdecken/page.tsx` — full rewrite as tab-orchestrator
- `src/app/map/page.tsx` — additive mounts only

**Untouched (per spec §5.3):** old ArtistsPageClient.tsx, all API routes, Mapbox-GL logic, FilterDrawer, AddArtistsPanel, PopularArtistsSuggestions, ImportedArtistsList, all Phase 1/2/3 components.

---

## Task 1: V4Toast atom (TDD)

**Files:**
- Create: `src/components/Events/v4/V4Toast.tsx`
- Test: `src/__tests__/components/events/v4/V4Toast.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { V4Toast } from '@/components/Events/v4/V4Toast';

describe('V4Toast', () => {
  it('renders children', () => {
    render(<V4Toast>Du folgst jetzt Bilderbuch.</V4Toast>);
    expect(screen.getByText(/du folgst jetzt bilderbuch/i)).toBeInTheDocument();
  });

  it('exposes data-kind for default (match)', () => {
    const { container } = render(<V4Toast>x</V4Toast>);
    const el = container.querySelector('[data-v4-toast]');
    expect(el?.getAttribute('data-kind')).toBe('match');
  });

  it('renders dismiss button that calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(<V4Toast onDismiss={onDismiss}>x</V4Toast>);
    screen.getByRole('button', { name: /schließen/i }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after duration ms', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<V4Toast duration={1000} onDismiss={onDismiss}>x</V4Toast>);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(onDismiss).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('duration=0 means sticky (no auto-dismiss)', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<V4Toast duration={0} onDismiss={onDismiss}>x</V4Toast>);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run → fail.**

Run: `npm test -- src/__tests__/components/events/v4/V4Toast.test.tsx`

- [ ] **Step 3: Implement**

```tsx
'use client';

/**
 * V4Toast — small floating notification atom used by Phase 4 (post-follow
 * confirmation) and Phase 5 (plan-saved). Auto-dismisses after `duration`
 * ms unless duration is 0 (sticky).
 *
 * Renders inline at its mount point — no portal. Callers typically mount
 * it at floating absolute positions (bottom-right etc.).
 */

import { useEffect } from 'react';

export type V4ToastKind = 'match' | 'success' | 'info';

interface V4ToastProps {
  kind?: V4ToastKind;
  children: React.ReactNode;
  /** Auto-dismiss after N ms. 0 = sticky. Default 6000. */
  duration?: number;
  onDismiss?: () => void;
}

const ACCENT: Record<V4ToastKind, { fg: string; bd: string; bg: string }> = {
  match:   { fg: 'var(--v4-match)', bd: 'rgba(245,185,66,0.34)', bg: 'rgba(245,185,66,0.12)' },
  success: { fg: 'var(--v4-go)',    bd: 'rgba(123,183,148,0.34)', bg: 'rgba(123,183,148,0.12)' },
  info:    { fg: '#7eaaf0',         bd: 'rgba(126,170,240,0.34)', bg: 'rgba(126,170,240,0.12)' },
};

export function V4Toast({ kind = 'match', children, duration = 6000, onDismiss }: V4ToastProps) {
  useEffect(() => {
    if (duration === 0 || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  const a = ACCENT[kind];
  return (
    <div
      data-v4-toast
      data-kind={kind}
      role="status"
      className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur"
      style={{ background: a.bg, border: `1px solid ${a.bd}`, color: 'var(--v4-ink)' }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${a.fg.startsWith('var') ? 'transparent' : a.fg}22`, color: a.fg, border: `1px solid ${a.bd}` }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div className="flex-1 min-w-0 text-[13px] leading-snug max-w-[420px]">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Schließen"
          className="press-haptic flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run → 5/5 pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4Toast.tsx src/__tests__/components/events/v4/V4Toast.test.tsx
git commit -m "feat(v4): V4Toast atom — match/success/info kinds with auto-dismiss (Phase 4)"
```

---

## Task 2: V4FilterChips atom (TDD)

**Files:**
- Create: `src/components/Events/v4/V4FilterChips.tsx`
- Test: `src/__tests__/components/events/v4/V4FilterChips.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FilterChips, FILTER_CHIPS } from '@/components/Events/v4/V4FilterChips';

describe('V4FilterChips', () => {
  it('exports the 9 canonical chips', () => {
    const keys = FILTER_CHIPS.map(c => c.key);
    expect(keys).toEqual(['tickets','free','doorsale','today','weekend','concerts','festivals','nearby','mine']);
  });

  it('renders all 9 chip buttons', () => {
    render(<V4FilterChips active={new Set()} onToggle={() => {}}/>);
    expect(screen.getByRole('button', { name: /tickets verfügbar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gratis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meine künstler/i })).toBeInTheDocument();
  });

  it('marks active chip with data-active=true', () => {
    render(<V4FilterChips active={new Set(['tickets'])} onToggle={() => {}}/>);
    expect(screen.getByRole('button', { name: /tickets verfügbar/i }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('button', { name: /gratis/i }).getAttribute('data-active')).toBe('false');
  });

  it('calls onToggle with chip key on click', () => {
    const onToggle = vi.fn();
    render(<V4FilterChips active={new Set()} onToggle={onToggle}/>);
    screen.getByRole('button', { name: /tickets verfügbar/i }).click();
    expect(onToggle).toHaveBeenCalledWith('tickets');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```tsx
'use client';

/**
 * V4FilterChips — 9 toggleable filter chips used by /entdecken (Filter
 * mode) and /map (overlay). Multi-select; parent owns state via the
 * `active` Set + `onToggle` callback.
 *
 * The chip keys are stable strings used in URL params (?chip=tickets,free).
 */

export const FILTER_CHIPS = [
  { key: 'tickets',   label: 'Tickets verfügbar' },
  { key: 'free',      label: 'Gratis' },
  { key: 'doorsale',  label: 'Abendkasse' },
  { key: 'today',     label: 'Heute' },
  { key: 'weekend',   label: 'Wochenende' },
  { key: 'concerts',  label: 'Konzerte' },
  { key: 'festivals', label: 'Festivals' },
  { key: 'nearby',    label: 'In deiner Nähe' },
  { key: 'mine',      label: 'Meine Künstler' },
] as const;

export type V4FilterChipKey = typeof FILTER_CHIPS[number]['key'];

interface V4FilterChipsProps {
  active: Set<string>;
  onToggle: (key: V4FilterChipKey) => void;
}

export function V4FilterChips({ active, onToggle }: V4FilterChipsProps) {
  return (
    <div className="flex gap-2 flex-wrap" data-v4-filter-chips>
      {FILTER_CHIPS.map(chip => {
        const isActive = active.has(chip.key);
        return (
          <button
            key={chip.key}
            type="button"
            data-active={isActive}
            data-chip={chip.key}
            onClick={() => onToggle(chip.key)}
            className={
              'press-haptic inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold tracking-[-0.005em] border transition-colors ' +
              (isActive
                ? 'bg-[rgba(212,184,150,0.14)] text-[var(--v4-ticket)] border-[rgba(212,184,150,0.34)]'
                : 'text-[var(--v4-ink-70)] border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)]')
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run → 4/4 pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4FilterChips.tsx src/__tests__/components/events/v4/V4FilterChips.test.tsx
git commit -m "feat(v4): V4FilterChips atom — 9 canonical filter chips (Phase 4)"
```

---

## Task 3: V4SortRow atom (TDD)

**Files:**
- Create: `src/components/Events/v4/V4SortRow.tsx`
- Test: `src/__tests__/components/events/v4/V4SortRow.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4SortRow, SORT_OPTIONS } from '@/components/Events/v4/V4SortRow';

describe('V4SortRow', () => {
  it('exports 4 sort options', () => {
    expect(SORT_OPTIONS.map(s => s.key)).toEqual(['score','date','tickets','distance']);
  });

  it('renders all sort pills', () => {
    render(<V4SortRow current="score" total={120} onChange={() => {}}/>);
    expect(screen.getByText(/empfohlen/i)).toBeInTheDocument();
    expect(screen.getByText(/datum/i)).toBeInTheDocument();
  });

  it('shows total count', () => {
    render(<V4SortRow current="score" total={42} onChange={() => {}}/>);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('marks current pill active via data-active', () => {
    render(<V4SortRow current="date" total={1} onChange={() => {}}/>);
    expect(screen.getByRole('button', { name: /datum/i }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('button', { name: /empfohlen/i }).getAttribute('data-active')).toBe('false');
  });

  it('calls onChange with sort key', () => {
    const onChange = vi.fn();
    render(<V4SortRow current="score" total={1} onChange={onChange}/>);
    screen.getByRole('button', { name: /datum/i }).click();
    expect(onChange).toHaveBeenCalledWith('date');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```tsx
'use client';

/**
 * V4SortRow — total-count + 4 sort pills. Pure visual atom; parent owns
 * the active sort + total via props.
 */

export const SORT_OPTIONS = [
  { key: 'score',    label: 'Empfohlen' },
  { key: 'date',     label: 'Datum' },
  { key: 'tickets',  label: 'Tickets' },
  { key: 'distance', label: 'Nähe' },
] as const;

export type V4SortKey = typeof SORT_OPTIONS[number]['key'];

interface V4SortRowProps {
  current: V4SortKey;
  total: number;
  onChange: (next: V4SortKey) => void;
}

export function V4SortRow({ current, total, onChange }: V4SortRowProps) {
  return (
    <div className="flex items-center gap-3.5 flex-wrap text-[13px] text-[var(--v4-ink-70)]">
      <div>
        <b className="text-[var(--v4-ink)] font-bold">{total}</b> Events
      </div>
      <div className="flex-1"/>
      <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Sortieren</span>
      <div className="flex gap-1">
        {SORT_OPTIONS.map(opt => {
          const isActive = opt.key === current;
          return (
            <button
              key={opt.key}
              type="button"
              data-active={isActive}
              onClick={() => onChange(opt.key)}
              className={
                'press-haptic px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ' +
                (isActive
                  ? 'bg-[var(--v4-surface-elevated)] text-[var(--v4-ink)] border-[var(--v4-hairline-3)]'
                  : 'text-[var(--v4-ink-70)] border-transparent hover:text-[var(--v4-ink)]')
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run → 5/5 pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4SortRow.tsx src/__tests__/components/events/v4/V4SortRow.test.tsx
git commit -m "feat(v4): V4SortRow atom — total count + 4 sort pills (Phase 4)"
```

---

## Task 4: V4EntdeckenTabs atom + barrel update

**Files:**
- Create: `src/components/Events/v4/V4EntdeckenTabs.tsx`
- Test: `src/__tests__/components/events/v4/V4EntdeckenTabs.test.tsx`
- Modify: `src/components/Events/v4/index.ts` — append Phase-4 atom exports

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EntdeckenTabs } from '@/components/Events/v4/V4EntdeckenTabs';

describe('V4EntdeckenTabs', () => {
  it('renders both tabs', () => {
    render(<V4EntdeckenTabs current="filter" onChange={() => {}}/>);
    expect(screen.getByRole('tab', { name: /filter/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /smart-suche/i })).toBeInTheDocument();
  });

  it('marks current tab aria-selected', () => {
    render(<V4EntdeckenTabs current="smart" onChange={() => {}}/>);
    expect(screen.getByRole('tab', { name: /smart-suche/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /filter/i }).getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange with the other mode', () => {
    const onChange = vi.fn();
    render(<V4EntdeckenTabs current="filter" onChange={onChange}/>);
    screen.getByRole('tab', { name: /smart-suche/i }).click();
    expect(onChange).toHaveBeenCalledWith('smart');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement V4EntdeckenTabs**

```tsx
'use client';

/**
 * V4EntdeckenTabs — segmented control switching between Filter and
 * Smart-Suche modes on /entdecken. Parent owns the current mode +
 * URL persistence; this atom is pure render.
 */

export type V4EntdeckenMode = 'filter' | 'smart';

interface V4EntdeckenTabsProps {
  current: V4EntdeckenMode;
  onChange: (next: V4EntdeckenMode) => void;
}

const TABS: { key: V4EntdeckenMode; label: string }[] = [
  { key: 'filter', label: 'Filter' },
  { key: 'smart',  label: 'Smart-Suche' },
];

export function V4EntdeckenTabs({ current, onChange }: V4EntdeckenTabsProps) {
  return (
    <div role="tablist" aria-label="Suchmodus" className="inline-flex p-1 rounded-full bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]">
      {TABS.map(tab => {
        const isActive = tab.key === current;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={
              'press-haptic px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ' +
              (isActive
                ? 'bg-[var(--v4-ink)] text-[#0a0a0c]'
                : 'text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]')
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Append to barrel** `src/components/Events/v4/index.ts`:

Read the existing file, then add at the bottom (after the `V4EventDetail` line):

```ts

// Phase 4 — atoms reused across /artists, /entdecken, /map
export { V4Toast, type V4ToastKind } from './V4Toast';
export { V4FilterChips, FILTER_CHIPS, type V4FilterChipKey } from './V4FilterChips';
export { V4SortRow, SORT_OPTIONS, type V4SortKey } from './V4SortRow';
export { V4EntdeckenTabs, type V4EntdeckenMode } from './V4EntdeckenTabs';
```

- [ ] **Step 5: Run → 3/3 pass + TS clean**

Run: `npm test -- src/__tests__/components/events/v4/V4EntdeckenTabs.test.tsx`
Run: `npx tsc --noEmit 2>&1 | grep "Events/v4" || echo OK`

- [ ] **Step 6: Commit**

```bash
git add src/components/Events/v4/V4EntdeckenTabs.tsx src/__tests__/components/events/v4/V4EntdeckenTabs.test.tsx src/components/Events/v4/index.ts
git commit -m "feat(v4): V4EntdeckenTabs atom + barrel exports for Phase-4 atoms"
```

---

## Task 5: V4ArtistsHero (RSC)

**Files:**
- Create: `src/components/Artists/v4/V4ArtistsHero.tsx`
- Test: `src/__tests__/components/artists/v4/V4ArtistsHero.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4ArtistsHero } from '@/components/Artists/v4/V4ArtistsHero';

describe('V4ArtistsHero', () => {
  it('renders eyebrow + headline + subtitle', () => {
    render(<V4ArtistsHero/>);
    expect(screen.getByText(/lieblingskünstler · such & folge/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/konzerte, open airs und festival-slots/i)).toBeInTheDocument();
  });

  it('headline contains "Such einen Künstler"', () => {
    render(<V4ArtistsHero/>);
    expect(screen.getByText(/such einen künstler/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```tsx
/**
 * V4ArtistsHero — RSC hero for /artists. Eyebrow + headline (Inter +
 * Fraunces italic accent) + subtitle. No search input here — the
 * V4ArtistSearchResult component below owns the input.
 */

export function V4ArtistsHero() {
  return (
    <section className="border-b border-[var(--v4-hairline-1)] py-8 md:py-16">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14">
        <div className="max-w-[920px]">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3.5 md:mb-5">
            Lieblingskünstler · Such &amp; Folge
          </p>
          <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06]" style={{ textWrap: 'balance' }}>
            Such einen Künstler.{' '}
            <span style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 300 }}>
              Wir sagen Bescheid,
            </span>{' '}
            wenn er in Österreich spielt.
          </h1>
          <p className="text-[14px] md:text-[15.5px] text-[var(--v4-ink-70)] mt-3.5 md:mt-5 max-w-[600px] leading-[1.55]">
            Konzerte, Open Airs und Festival-Slots — alles drin.
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run → 2/2 pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/Artists/v4/V4ArtistsHero.tsx src/__tests__/components/artists/v4/V4ArtistsHero.test.tsx
git commit -m "feat(v4): V4ArtistsHero for /artists (Phase 4)"
```

---

## Task 6: V4ArtistSearchResult (state machine, TDD)

**Files:**
- Create: `src/components/Artists/v4/V4ArtistSearchResult.tsx`
- Test: `src/__tests__/components/artists/v4/V4ArtistSearchResult.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { V4ArtistSearchResult } from '@/components/Artists/v4/V4ArtistSearchResult';

// Stable global fetch mock
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('@/lib/supabase/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'a@b.c' }, loading: false }),
}));

describe('V4ArtistSearchResult', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('renders idle hint with empty query', () => {
    render(<V4ArtistSearchResult/>);
    expect(screen.getByPlaceholderText(/artist, band oder dj suchen/i)).toBeInTheDocument();
  });

  it('runs search on submit and shows result card', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ artists: [{ id: 'a1', name: 'Bilderbuch', genres: ['austropop'], image_url: null, spotify_artist_id: 's1' }] }),
    });
    render(<V4ArtistSearchResult/>);
    const input = screen.getByPlaceholderText(/artist, band oder dj suchen/i);
    fireEvent.change(input, { target: { value: 'bilderbuch' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText('Bilderbuch')).toBeInTheDocument();
    });
  });

  it('shows empty-state when search returns no results', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ artists: [] }) });
    render(<V4ArtistSearchResult/>);
    const input = screen.getByPlaceholderText(/artist, band oder dj suchen/i);
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/keine künstler gefunden/i)).toBeInTheDocument();
    });
  });

  it('Follow click POSTs to /api/artists/follow and shows toast', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ artists: [{ id: 'a1', name: 'Bilderbuch', genres: ['austropop'], image_url: null, spotify_artist_id: 's1' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<V4ArtistSearchResult/>);
    const input = screen.getByPlaceholderText(/artist, band oder dj suchen/i);
    fireEvent.change(input, { target: { value: 'bilderbuch' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => screen.getByText('Bilderbuch'));

    fireEvent.click(screen.getByRole('button', { name: /^folgen$/i }));
    await waitFor(() => {
      expect(screen.getByText(/du folgst jetzt bilderbuch/i)).toBeInTheDocument();
    });
  });

  it('shows error on failed search', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    render(<V4ArtistSearchResult/>);
    const input = screen.getByPlaceholderText(/artist, band oder dj suchen/i);
    fireEvent.change(input, { target: { value: 'bilderbuch' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/suche fehlgeschlagen/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```tsx
'use client';

/**
 * V4ArtistSearchResult — primary follow-funnel on /artists.
 *
 * State machine:
 *   idle            → input only
 *   searching       → spinner while POST /api/artists/search
 *   results         → list of result cards (search returned ≥1)
 *   empty           → "Keine Künstler gefunden"
 *   error           → inline error with retry
 *
 * Follow click → POST /api/artists/follow then mount V4Toast.
 * Anon-user-follow redirect to /auth/login is handled at the API level
 * (returns 401); we catch it and redirect client-side.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { V4Toast } from '@/components/Events/v4';

interface ArtistResult {
  id: string;
  name: string;
  genres: string[] | null;
  image_url: string | null;
  spotify_artist_id: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'results'; results: ArtistResult[]; query: string }
  | { kind: 'empty'; query: string }
  | { kind: 'error'; message: string };

export function V4ArtistSearchResult() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  async function runSearch(q: string) {
    setState({ kind: 'searching' });
    try {
      const res = await fetch('/api/artists/search?q=' + encodeURIComponent(q));
      if (!res.ok) {
        setState({ kind: 'error', message: 'Suche fehlgeschlagen — probier es nochmal.' });
        return;
      }
      const data = await res.json();
      const results: ArtistResult[] = data.artists ?? [];
      if (results.length === 0) {
        setState({ kind: 'empty', query: q });
      } else {
        setState({ kind: 'results', results, query: q });
      }
    } catch {
      setState({ kind: 'error', message: 'Netzwerkfehler — probier es nochmal.' });
    }
  }

  async function follow(artist: ArtistResult) {
    if (!user) {
      router.push(`/auth/login?next=/artists?q=${encodeURIComponent(artist.name)}`);
      return;
    }
    try {
      const res = await fetch('/api/artists/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_name: artist.name,
          spotify_artist_id: artist.spotify_artist_id,
          spotify_image_url: artist.image_url,
        }),
      });
      if (!res.ok) {
        setToast(null);
        return;
      }
      setFollowed(prev => new Set(prev).add(artist.id));
      setToast(`Du folgst jetzt ${artist.name}. Wir benachrichtigen dich bei Österreich-Terminen.`);
    } catch {
      // silent — UI stays unchanged
    }
  }

  return (
    <div data-v4-artist-search>
      <form
        onSubmit={e => { e.preventDefault(); if (query.trim()) runSearch(query.trim()); }}
        className="mb-6"
      >
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Artist, Band oder DJ suchen …"
          className="w-full px-5 py-4 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-base placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)] transition-colors"
        />
      </form>

      {state.kind === 'searching' && (
        <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Suche läuft …</div>
      )}

      {state.kind === 'error' && (
        <div className="px-4 py-3 rounded-xl bg-[rgba(198,112,121,0.10)] border border-[rgba(198,112,121,0.30)] text-[var(--v4-alert)] text-sm">
          {state.message}
        </div>
      )}

      {state.kind === 'empty' && (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">Keine Künstler gefunden für „{state.query}".</p>
          <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Anderen Namen probieren?</p>
        </div>
      )}

      {state.kind === 'results' && (
        <div className="flex flex-col gap-3">
          {state.results.map(artist => {
            const isFollowed = followed.has(artist.id);
            return (
              <div key={artist.id} className="rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-5 flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] flex items-center justify-center text-[var(--v4-ink)] overflow-hidden flex-shrink-0"
                  style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontSize: 28 }}
                >
                  {artist.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover"/>
                  ) : artist.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-bold text-[var(--v4-ink)] tracking-[-0.015em]">{artist.name}</div>
                  {artist.genres && artist.genres.length > 0 && (
                    <div className="text-[12.5px] text-[var(--v4-ink-50)] mt-0.5">{artist.genres.slice(0, 3).join(' · ')}</div>
                  )}
                </div>
                {isFollowed ? (
                  <button
                    type="button"
                    disabled
                    className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink-70)]"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    Folgst du
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => follow(artist)}
                    className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                    Folgen
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50">
          <V4Toast kind="match" duration={6000} onDismiss={() => setToast(null)}>
            {toast}
          </V4Toast>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run → 5/5 pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/Artists/v4/V4ArtistSearchResult.tsx src/__tests__/components/artists/v4/V4ArtistSearchResult.test.tsx
git commit -m "feat(v4): V4ArtistSearchResult with follow state-machine + toast (Phase 4)"
```

---

## Task 7: V4FollowedArtistsGrid + V4MatchingEvents (TDD bundled)

**Files:**
- Create: `src/components/Artists/v4/V4FollowedArtistsGrid.tsx`
- Create: `src/components/Artists/v4/V4MatchingEvents.tsx`
- Test: `src/__tests__/components/artists/v4/V4FollowedArtistsGrid.test.tsx`
- Test: `src/__tests__/components/artists/v4/V4MatchingEvents.test.tsx`

- [ ] **Step 1: Write both tests**

`V4FollowedArtistsGrid.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FollowedArtistsGrid } from '@/components/Artists/v4/V4FollowedArtistsGrid';

describe('V4FollowedArtistsGrid', () => {
  const artists = [
    { id: '1', artist_name: 'Bilderbuch', artist_name_normalized: 'bilderbuch', spotify_image_url: null, upcoming_matches: 2 },
    { id: '2', artist_name: 'Wanda',      artist_name_normalized: 'wanda',      spotify_image_url: null, upcoming_matches: 0 },
  ];

  it('renders each artist card', () => {
    render(<V4FollowedArtistsGrid artists={artists}/>);
    expect(screen.getByText('Bilderbuch')).toBeInTheDocument();
    expect(screen.getByText('Wanda')).toBeInTheDocument();
  });

  it('shows upcoming match count', () => {
    render(<V4FollowedArtistsGrid artists={artists}/>);
    expect(screen.getByText(/2 kommende auftritte/i)).toBeInTheDocument();
  });

  it('shows "wir bleiben dran" fallback when 0 matches', () => {
    render(<V4FollowedArtistsGrid artists={artists}/>);
    expect(screen.getByText(/wir bleiben dran/i)).toBeInTheDocument();
  });

  it('empty-state when artists list is empty', () => {
    render(<V4FollowedArtistsGrid artists={[]}/>);
    expect(screen.getByText(/such einen künstler oben/i)).toBeInTheDocument();
  });
});
```

`V4MatchingEvents.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MatchingEvents } from '@/components/Artists/v4/V4MatchingEvents';

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

describe('V4MatchingEvents', () => {
  const matches = [
    {
      id: 'e1', slug: 'bilderbuch-arena', title: 'Arena Wien',
      start_date: '2026-09-15T20:00:00Z', location_name: 'Arena',
      image_url: 'https://x/a.jpg', ticket_url: 'https://eventim/x',
      bundesland: 'Wien', price_text: '€ 48,00',
      matched_artist: 'Bilderbuch', match_kind: 'match' as const,
    },
  ];

  it('renders matched event with personalized copy', () => {
    render(<V4MatchingEvents events={matches}/>);
    expect(screen.getByText(/du folgst bilderbuch/i)).toBeInTheDocument();
    expect(screen.getByText('Arena Wien')).toBeInTheDocument();
  });

  it('empty-state when no matches', () => {
    render(<V4MatchingEvents events={[]}/>);
    expect(screen.getByText(/wir warten auf erste auftritte/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run both → fail.**

- [ ] **Step 3: Implement V4FollowedArtistsGrid**

```tsx
/**
 * V4FollowedArtistsGrid — 2-column grid (1-col mobile) showing the user's
 * followed artists with upcoming-match counts. Pure render; data is
 * pre-aggregated server-side by V4ArtistsPageClient.
 */

export interface FollowedArtistWithMatches {
  id: string;
  artist_name: string;
  artist_name_normalized: string;
  spotify_image_url: string | null;
  upcoming_matches: number;
}

interface V4FollowedArtistsGridProps {
  artists: FollowedArtistWithMatches[];
}

export function V4FollowedArtistsGrid({ artists }: V4FollowedArtistsGridProps) {
  if (artists.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Du folgst noch keinem Künstler.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Such einen Künstler oben — wir benachrichtigen dich bei Österreich-Terminen.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {artists.map(a => (
        <div key={a.id} className="rounded-2xl border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)] p-3.5 flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-full bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] flex items-center justify-center text-[var(--v4-ink)] overflow-hidden flex-shrink-0"
            style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontSize: 19 }}
          >
            {a.spotify_image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={a.spotify_image_url} alt={a.artist_name} className="w-full h-full object-cover"/>
            ) : a.artist_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-[var(--v4-ink)] tracking-[-0.005em]">{a.artist_name}</div>
            {a.upcoming_matches > 0 ? (
              <div className="text-[11.5px] mt-1 font-semibold text-[var(--v4-match)]">
                {a.upcoming_matches} kommend{a.upcoming_matches === 1 ? 'er' : 'e'} Auftritt{a.upcoming_matches === 1 ? '' : 'e'}
              </div>
            ) : (
              <div className="text-[11.5px] text-[var(--v4-ink-50)] mt-1">Kein Termin · wir bleiben dran</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement V4MatchingEvents**

```tsx
/**
 * V4MatchingEvents — gold-accent card list of upcoming events that
 * match the user's followed artists. Each card mirrors the v4 mockup's
 * "{Artist} spielt bei {Event}" copy plus a ticket-link or plan-link.
 */

import Link from 'next/link';
import Image from 'next/image';

export interface ArtistMatchEvent {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  location_name: string | null;
  bundesland: string | null;
  image_url: string | null;
  ticket_url: string | null;
  price_text: string | null;
  matched_artist: string;
  match_kind: 'match' | 'lineup';
}

interface V4MatchingEventsProps {
  events: ArtistMatchEvent[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
}

export function V4MatchingEvents({ events }: V4MatchingEventsProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Wir warten auf erste Auftritte.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Sobald deine Künstler in Österreich spielen, taucht es hier auf.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {events.map(ev => {
        const slug = ev.slug ?? ev.id;
        const isFestival = ev.match_kind === 'lineup';
        return (
          <Link
            key={ev.id}
            href={`/events/${slug}`}
            className="press-haptic relative flex gap-3.5 rounded-2xl border border-[rgba(245,185,66,0.34)] bg-[var(--v4-surface-elevated)] p-4 overflow-hidden hover:border-[rgba(245,185,66,0.5)] transition-colors"
          >
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--v4-match)]"/>
            <div className="w-20 aspect-square rounded-xl overflow-hidden bg-[var(--v4-surface)] border border-[var(--v4-hairline-1)] flex-shrink-0 relative">
              {ev.image_url ? (
                <Image src={ev.image_url} alt={ev.title} fill sizes="80px" style={{ objectFit: 'cover' }}/>
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--v4-ink-30)] text-center px-1">{ev.title.slice(0, 24)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[var(--v4-ink)] leading-tight tracking-[-0.015em]">
                <span className="text-[var(--v4-match)]">{ev.matched_artist}</span>
                <span className="text-[var(--v4-ink-70)] font-medium"> {isFestival ? 'im Line-up bei' : 'spielt bei'}</span>{' '}
                {ev.title}
              </p>
              <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">
                {formatDate(ev.start_date)}
                {ev.location_name && ` · ${ev.location_name}`}
                {ev.bundesland && ` · ${ev.bundesland}`}
              </p>
              {ev.ticket_url && ev.price_text && (
                <span className="inline-flex items-center gap-1 mt-2 text-[11.5px] font-semibold text-[var(--v4-ticket)]">
                  Ticket ab {ev.price_text}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Run both → 4/4 + 2/2 pass.**

- [ ] **Step 6: Commit**

```bash
git add src/components/Artists/v4/V4FollowedArtistsGrid.tsx src/components/Artists/v4/V4MatchingEvents.tsx src/__tests__/components/artists/v4/V4FollowedArtistsGrid.test.tsx src/__tests__/components/artists/v4/V4MatchingEvents.test.tsx
git commit -m "feat(v4): V4FollowedArtistsGrid + V4MatchingEvents for /artists (Phase 4)"
```

---

## Task 8: V4ArtistsPageClient + barrel + swap import in /artists/page.tsx

**Files:**
- Create: `src/app/artists/V4ArtistsPageClient.tsx`
- Create: `src/components/Artists/v4/index.ts`
- Modify: `src/app/artists/page.tsx`

- [ ] **Step 1: Create v4 artists barrel**

`src/components/Artists/v4/index.ts`:

```ts
export { V4ArtistsHero } from './V4ArtistsHero';
export { V4ArtistSearchResult } from './V4ArtistSearchResult';
export { V4FollowedArtistsGrid, type FollowedArtistWithMatches } from './V4FollowedArtistsGrid';
export { V4MatchingEvents, type ArtistMatchEvent } from './V4MatchingEvents';
```

- [ ] **Step 2: Implement V4ArtistsPageClient**

`src/app/artists/V4ArtistsPageClient.tsx`:

```tsx
'use client';

/**
 * V4ArtistsPageClient — v4 redesign of /artists.
 *
 * Loads followed-artists + matched-events client-side via existing
 * /api/artists/following and /api/artists/events endpoints. Pre-existing
 * AddArtistsPanel + PopularArtistsSuggestions render below, restyled.
 *
 * Auth: anon users still see the hero + search input. Follow click
 * redirects them to /auth/login?next=. Followed-grid + matches show
 * empty-states when no user / no data.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import {
  V4ArtistsHero,
  V4ArtistSearchResult,
  V4FollowedArtistsGrid,
  V4MatchingEvents,
  type FollowedArtistWithMatches,
  type ArtistMatchEvent,
} from '@/components/Artists/v4';
import { AddArtistsPanel } from '@/components/Artists/AddArtistsPanel';

export function V4ArtistsPageClient() {
  const { user, loading } = useAuth();
  const [followed, setFollowed] = useState<FollowedArtistWithMatches[]>([]);
  const [matches, setMatches] = useState<ArtistMatchEvent[]>([]);

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;

    (async () => {
      const [followingRes, eventsRes] = await Promise.all([
        fetch('/api/artists/following?limit=50'),
        fetch('/api/artists/events?limit=20'),
      ]);

      if (!alive) return;

      if (followingRes.ok) {
        const data = await followingRes.json();
        const artists = (data.artists ?? []) as Array<{
          id: string;
          artist_name: string;
          artist_name_normalized: string;
          spotify_image_url: string | null;
        }>;
        const countByArtist = new Map<string, number>();
        if (eventsRes.ok) {
          const evData = await eventsRes.json();
          for (const ev of (evData.events ?? [])) {
            for (const ma of (ev.matched_artists ?? [])) {
              const k = (ma.name as string).toLowerCase();
              countByArtist.set(k, (countByArtist.get(k) ?? 0) + 1);
            }
          }
        }
        setFollowed(artists.map(a => ({
          ...a,
          upcoming_matches: countByArtist.get(a.artist_name.toLowerCase()) ?? 0,
        })));
      }

      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        const mapped: ArtistMatchEvent[] = (evData.events ?? []).map((ev: Record<string, unknown>) => {
          const matched = (ev.matched_artists ?? []) as Array<{ name: string; match_source: string }>;
          const lineupHit = matched.find(m => m.match_source === 'lineup');
          const first = matched[0];
          return {
            id: ev.id as string,
            slug: (ev.slug as string | null) ?? null,
            title: ev.title as string,
            start_date: ev.start_date as string,
            location_name: (ev.location_name as string | null) ?? null,
            bundesland: (ev.bundesland as string | null) ?? null,
            image_url: (ev.image_url as string | null) ?? null,
            ticket_url: (ev.ticket_url as string | null) ?? null,
            price_text: (ev.price_text as string | null) ?? null,
            matched_artist: (lineupHit?.name ?? first?.name ?? '') as string,
            match_kind: (lineupHit ? 'lineup' : 'match'),
          };
        });
        setMatches(mapped);
      }
    })();

    return () => { alive = false; };
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4ArtistsHero/>

      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-8 md:py-12 pb-24">
        <div className="mb-10">
          <V4ArtistSearchResult/>
        </div>

        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 md:gap-12">
            <section>
              <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--v4-ink)] mb-4">
                Gefundene Auftritte in Österreich
              </h2>
              <V4MatchingEvents events={matches}/>
            </section>
            <section>
              <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--v4-ink)] mb-4">
                Deine Lieblingskünstler · {followed.length}
              </h2>
              <V4FollowedArtistsGrid artists={followed}/>
            </section>
          </div>
        )}

        {user && (
          <div className="mt-12 pt-8 border-t border-[var(--v4-hairline-1)]">
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--v4-ink)] mb-4">
              Künstler hinzufügen
            </h2>
            <AddArtistsPanel/>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Swap import in `src/app/artists/page.tsx`**

Read the existing page.tsx first. Then replace the import + JSX usage. Expected: `import { ArtistsPageClient } from './ArtistsPageClient'` line replaced; `<ArtistsPageClient />` replaced with `<V4ArtistsPageClient />`.

Edit:
- Replace `import { ArtistsPageClient } from './ArtistsPageClient';` with `import { V4ArtistsPageClient } from './V4ArtistsPageClient';`
- Replace `<ArtistsPageClient />` with `<V4ArtistsPageClient />`

- [ ] **Step 4: TypeScript + build**

Run: `npx tsc --noEmit 2>&1 | grep -E "V4ArtistsPage|Artists/v4" | head -5 || echo OK`
Run: `npm run build 2>&1 | tail -5`

Build should succeed.

- [ ] **Step 5: Commit**

```bash
git add src/components/Artists/v4/index.ts src/app/artists/V4ArtistsPageClient.tsx src/app/artists/page.tsx
git commit -m "feat(v4): wire V4ArtistsPageClient into /artists route (Phase 4)

Existing ArtistsPageClient.tsx (428 LOC) stays on disk but no longer
mounted. AddArtistsPanel (Spotify-Import) preserved as inner component
inside the new v4 layout."
```

---

## Task 9: V4EntdeckenHero (RSC)

**Files:**
- Create: `src/components/Discover/v4/V4EntdeckenHero.tsx`
- Test: `src/__tests__/components/discover/v4/V4EntdeckenHero.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EntdeckenHero } from '@/components/Discover/v4/V4EntdeckenHero';

describe('V4EntdeckenHero', () => {
  it('renders eyebrow + headline + sub', () => {
    render(<V4EntdeckenHero mode="filter" onModeChange={vi.fn()}/>);
    expect(screen.getByText(/entdecken/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('mounts V4EntdeckenTabs', () => {
    render(<V4EntdeckenHero mode="filter" onModeChange={vi.fn()}/>);
    expect(screen.getByRole('tab', { name: /filter/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /smart-suche/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```tsx
'use client';

import { V4EntdeckenTabs, type V4EntdeckenMode } from '@/components/Events/v4';

interface V4EntdeckenHeroProps {
  mode: V4EntdeckenMode;
  onModeChange: (next: V4EntdeckenMode) => void;
}

export function V4EntdeckenHero({ mode, onModeChange }: V4EntdeckenHeroProps) {
  return (
    <section className="py-6 md:py-10">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14">
        <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Entdecken</p>
        <h1 className="m-0 text-[30px] md:text-[38px] font-bold tracking-[-0.03em] text-[var(--v4-ink)] leading-[1.05]">
          Was läuft{' '}
          <span style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 300 }}>
            diese Woche?
          </span>
        </h1>
        <p className="text-[14px] md:text-[15px] text-[var(--v4-ink-70)] leading-[1.55] mt-3 mb-6 max-w-[620px]">
          Filter nach Tickets, Künstlern, Wochenende oder Genre — oder beschreib in Smart-Suche frei was du willst.
        </p>
        <V4EntdeckenTabs current={mode} onChange={onModeChange}/>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run → 2/2 pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/Discover/v4/V4EntdeckenHero.tsx src/__tests__/components/discover/v4/V4EntdeckenHero.test.tsx
git commit -m "feat(v4): V4EntdeckenHero with mode tabs (Phase 4)"
```

---

## Task 10: V4EntdeckenFilterMode (Client, TDD)

**Files:**
- Create: `src/components/Discover/v4/V4EntdeckenFilterMode.tsx`
- Test: `src/__tests__/components/discover/v4/V4EntdeckenFilterMode.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { V4EntdeckenFilterMode } from '@/components/Discover/v4/V4EntdeckenFilterMode';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, priority, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('V4EntdeckenFilterMode', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('fetches events on mount with active chip filters', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], total: 0 }),
    });
    render(<V4EntdeckenFilterMode activeChips={new Set(['tickets'])} sort="score" onChipsChange={vi.fn()} onSortChange={vi.fn()}/>);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/events/);
  });

  it('renders chips + sort row', () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], total: 0 }) });
    render(<V4EntdeckenFilterMode activeChips={new Set()} sort="score" onChipsChange={vi.fn()} onSortChange={vi.fn()}/>);
    expect(screen.getByRole('button', { name: /tickets verfügbar/i })).toBeInTheDocument();
    expect(screen.getByText(/sortieren/i)).toBeInTheDocument();
  });

  it('shows empty-state on 0 results', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [], total: 0 }) });
    render(<V4EntdeckenFilterMode activeChips={new Set()} sort="score" onChipsChange={vi.fn()} onSortChange={vi.fn()}/>);
    await waitFor(() => {
      expect(screen.getByText(/keine events passen/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```tsx
'use client';

/**
 * V4EntdeckenFilterMode — chip+sort+grid mode for /entdecken.
 *
 * Maps URL-state (active chips, sort) into /api/events query params and
 * renders V4CardV cards. Parent owns chip+sort state for URL persistence.
 *
 * Chip-to-API-param mapping (best-effort with current /api/events):
 *   tickets   → hasTicket=true
 *   free      → freeOnly=true
 *   doorsale  → priceFlag=abendkasse
 *   today     → date=today
 *   weekend   → date=weekend
 *   concerts  → category=music
 *   festivals → category=festival
 *   nearby    → (would need geolocation; Phase-4 sends nearby=true as a hint
 *               and lets the API fall back to relevance if not supported)
 *   mine      → matchedOnly=true (requires auth; falls back to all if anon)
 */

import { useEffect, useState } from 'react';
import {
  V4FilterChips, type V4FilterChipKey,
  V4SortRow, type V4SortKey,
  V4CardV,
} from '@/components/Events/v4';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';

interface V4EntdeckenFilterModeProps {
  activeChips: Set<string>;
  sort: V4SortKey;
  onChipsChange: (next: Set<string>) => void;
  onSortChange: (next: V4SortKey) => void;
}

function chipsToParams(chips: Set<string>): URLSearchParams {
  const p = new URLSearchParams();
  if (chips.has('tickets'))  p.set('hasTicket', 'true');
  if (chips.has('free'))     p.set('freeOnly', 'true');
  if (chips.has('doorsale')) p.set('priceFlag', 'abendkasse');
  if (chips.has('today'))    p.set('date', 'today');
  if (chips.has('weekend'))  p.set('date', 'weekend');
  if (chips.has('concerts')) p.set('category', 'music');
  if (chips.has('festivals')) p.set('category', 'festival');
  return p;
}

export function V4EntdeckenFilterMode({ activeChips, sort, onChipsChange, onSortChange }: V4EntdeckenFilterModeProps) {
  const [events, setEvents] = useState<Array<Event & { state: V4EventState }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = chipsToParams(activeChips);
    params.set('sort', sort);
    params.set('limit', '24');

    fetch(`/api/events?${params.toString()}`)
      .then(r => r.ok ? r.json() : { events: [], total: 0 })
      .then(data => {
        if (!alive) return;
        const evs = (data.events ?? []) as Event[];
        // Anon context for state derivation — no follows / saves available here.
        const ctx = {
          savedEventIds: new Set<string>(),
          followedArtistIds: new Set<string>(),
          artistMatchEventIds: new Set<string>(),
          lineupMatchEventIds: new Set<string>(),
        };
        setEvents(evs.map(e => ({ ...e, state: deriveEventState(e, ctx) })));
        setTotal(data.total ?? evs.length);
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [activeChips, sort]);

  function toggleChip(key: V4FilterChipKey) {
    const next = new Set(activeChips);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChipsChange(next);
  }

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-20">
      <div className="mt-1 mb-5">
        <V4FilterChips active={activeChips} onToggle={toggleChip}/>
      </div>

      <div className="pb-3 mb-5 border-b border-[var(--v4-hairline-1)]">
        <V4SortRow current={sort} total={total} onChange={onSortChange}/>
      </div>

      {loading ? (
        <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Lade Events …</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-8 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">Keine Events passen zu deinen Filtern.</p>
          <button
            type="button"
            onClick={() => onChipsChange(new Set())}
            className="press-haptic mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]"
          >
            Filter zurücksetzen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {events.map(ev => <V4CardV key={ev.id} event={ev}/>)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run → 3/3 pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/Discover/v4/V4EntdeckenFilterMode.tsx src/__tests__/components/discover/v4/V4EntdeckenFilterMode.test.tsx
git commit -m "feat(v4): V4EntdeckenFilterMode — chips + sort + grid (Phase 4)"
```

---

## Task 11: V4EntdeckenSmartMode (extract NLP + restyle, TDD)

**Files:**
- Create: `src/components/Discover/v4/V4EntdeckenSmartMode.tsx`
- Test: `src/__tests__/components/discover/v4/V4EntdeckenSmartMode.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { V4EntdeckenSmartMode } from '@/components/Discover/v4/V4EntdeckenSmartMode';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) =>
    <a href={href} {...rest}>{children}</a>,
}));

describe('V4EntdeckenSmartMode', () => {
  beforeEach(() => { fetchMock.mockReset(); });

  it('renders search input + samples', () => {
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    expect(screen.getByPlaceholderText(/was hast du vor/i)).toBeInTheDocument();
    expect(screen.getByText(/probier mal/i)).toBeInTheDocument();
  });

  it('runs semantic search and shows result count', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        query: 'test',
        parsed: { embedded_text: 'test', after_date: null, before_date: null, max_price_tier: null, signals: [] },
        matches: [
          { id: 'm1', title: 'Event 1', start_date: '2026-06-15', _similarity: 0.95, slug: null, location_name: null, category: null, tags: null, image_url: null, price_text: null, price_tier: null, description: null, audience: null, vibe: null, occasion_tags: null, is_student_friendly: null, is_family_friendly: null }
        ],
        count: 1,
      }),
    });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    fireEvent.change(screen.getByPlaceholderText(/was hast du vor/i), { target: { value: 'test query' } });
    fireEvent.submit(screen.getByPlaceholderText(/was hast du vor/i).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/1 treffer/i)).toBeInTheDocument();
    });
  });

  it('shows empty-state on 0 results', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ query: 'x', parsed: { embedded_text: 'x', after_date: null, before_date: null, max_price_tier: null, signals: [] }, matches: [], count: 0 }),
    });
    render(<V4EntdeckenSmartMode initialQuery=""/>);
    fireEvent.change(screen.getByPlaceholderText(/was hast du vor/i), { target: { value: 'x' } });
    fireEvent.submit(screen.getByPlaceholderText(/was hast du vor/i).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/keine treffer/i)).toBeInTheDocument();
    });
  });

  it('runs initial search when initialQuery provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ query: 'preset', parsed: { embedded_text: 'preset', after_date: null, before_date: null, max_price_tier: null, signals: [] }, matches: [], count: 0 }),
    });
    render(<V4EntdeckenSmartMode initialQuery="preset"/>);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body ?? '{}'));
    expect(body.query).toBe('preset');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**

```tsx
'use client';

/**
 * V4EntdeckenSmartMode — natural-language semantic search mode.
 *
 * Extracted from the original /entdecken/page.tsx (275 LOC) and restyled
 * in v4. The actual /api/search/semantic NLP backend is unchanged — we
 * just wrap it in v4 tokens and switch result cards.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

interface SearchMatch {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  location_name: string | null;
  category: string | null;
  tags: string[] | null;
  image_url: string | null;
  price_text: string | null;
  price_tier: string | null;
  slug: string | null;
  audience: string[] | null;
  vibe: string[] | null;
  occasion_tags: string[] | null;
  is_student_friendly: boolean | null;
  is_family_friendly: boolean | null;
  _similarity: number;
  postal_code?: string | null;
  address?: string | null;
  bundesland?: string | null;
}

interface SearchResponse {
  query: string;
  parsed: {
    embedded_text: string;
    after_date: string | null;
    before_date: string | null;
    max_price_tier: string | null;
    signals: string[];
  };
  matches: SearchMatch[];
  count: number;
}

const SAMPLE_QUERIES = [
  'Ich bin Student und will heute abend billig saufen gehen',
  'Romantisches Date für morgen',
  'Gratis Familienausflug am Wochenende',
  'Kostenloses Kulturprogramm heute',
  'Techno-Party am Wochenende',
  'Entspannter Afterwork-Drink',
];

interface V4EntdeckenSmartModeProps {
  initialQuery?: string;
}

export function V4EntdeckenSmartMode({ initialQuery = '' }: V4EntdeckenSmartModeProps) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(q: string) {
    setQuery(q);
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 24 }),
      });
      if (!resp.ok) {
        setError(`Suche fehlgeschlagen (${resp.status})`);
        setLoading(false);
        return;
      }
      const data: SearchResponse = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQuery && !result && !loading) {
      runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-20">
      <form
        onSubmit={e => { e.preventDefault(); if (query.trim()) runSearch(query.trim()); }}
        className="mt-2 mb-6"
      >
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Was hast du vor? Tipp ein in Alltagssprache …"
            className="w-full px-5 py-4 pr-28 rounded-2xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)]"
            autoFocus={!initialQuery}
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="press-haptic absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '…' : 'Suchen'}
          </button>
        </div>
      </form>

      {!result && !loading && (
        <div className="mb-8">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Probier mal:</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUERIES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => runSearch(s)}
                className="press-haptic text-left px-3 py-2 rounded-lg text-[12px] text-[var(--v4-ink-70)] bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] hover:text-[var(--v4-ink)]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-[rgba(198,112,121,0.10)] border border-[rgba(198,112,121,0.30)] text-[var(--v4-alert)] text-sm">
          {error}
        </div>
      )}

      {loading && <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Suche läuft …</div>}

      {result && !loading && result.count === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-8 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">Keine Treffer für diese Suche.</p>
          <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Anderes Keyword probieren? Oder Zeitraum erweitern?</p>
        </div>
      )}

      {result && !loading && result.count > 0 && (
        <>
          <p className="text-[12px] text-[var(--v4-ink-50)] mb-4">{result.count} Treffer — sortiert nach Relevanz</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.matches.map(ev => (
              <Link
                key={ev.id}
                href={buildEventUrlV2(ev)}
                className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
              >
                {ev.image_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={ev.image_url} alt="" className="w-full aspect-[16/9] object-cover" loading="lazy"/>
                )}
                <div className="p-4 flex flex-col gap-2">
                  <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">{formatDate(ev.start_date)}</p>
                  <h3 className="text-[15px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-2">{ev.title}</h3>
                  {ev.location_name && <p className="text-[12.5px] text-[var(--v4-ink-70)] line-clamp-1">{ev.location_name}</p>}
                  <p className="text-[10.5px] text-[var(--v4-ink-30)] mt-auto">Relevanz {(ev._similarity * 100).toFixed(0)}%</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run → 4/4 pass.**

- [ ] **Step 5: Commit**

```bash
git add src/components/Discover/v4/V4EntdeckenSmartMode.tsx src/__tests__/components/discover/v4/V4EntdeckenSmartMode.test.tsx
git commit -m "feat(v4): V4EntdeckenSmartMode — NLP search extracted + v4-styled (Phase 4)"
```

---

## Task 12: /entdecken page.tsx rewrite as mode orchestrator

**Files:**
- Modify: `src/app/entdecken/page.tsx` (full rewrite, current 275 LOC → ~80 LOC)
- Create: `src/components/Discover/v4/index.ts`

- [ ] **Step 1: Create Discover barrel**

`src/components/Discover/v4/index.ts`:

```ts
export { V4EntdeckenHero } from './V4EntdeckenHero';
export { V4EntdeckenFilterMode } from './V4EntdeckenFilterMode';
export { V4EntdeckenSmartMode } from './V4EntdeckenSmartMode';
```

- [ ] **Step 2: Rewrite page.tsx**

Replace entire content of `src/app/entdecken/page.tsx` with:

```tsx
'use client';

/**
 * /entdecken — Dual-mode discovery page (Phase 4).
 *
 * Mode is persisted in the URL via ?mode=filter|smart. First visit
 * default = filter. Filter mode owns chips (?chip=) and sort (?sort=).
 * Smart mode owns the query (?q=).
 */

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  V4EntdeckenHero,
  V4EntdeckenFilterMode,
  V4EntdeckenSmartMode,
} from '@/components/Discover/v4';
import { type V4EntdeckenMode, type V4SortKey } from '@/components/Events/v4';

function EntdeckenInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<V4EntdeckenMode>(
    (search.get('mode') === 'smart' ? 'smart' : 'filter')
  );
  const [chips, setChips] = useState<Set<string>>(
    new Set(((search.get('chip') ?? '').split(',').filter(Boolean)))
  );
  const [sort, setSort] = useState<V4SortKey>(
    (search.get('sort') as V4SortKey) ?? 'score'
  );
  const initialQuery = search.get('q') ?? '';

  // Mirror state back into URL for deep-link / share-link parity.
  useEffect(() => {
    const next = new URLSearchParams();
    next.set('mode', mode);
    if (mode === 'filter') {
      if (chips.size > 0) next.set('chip', Array.from(chips).join(','));
      if (sort !== 'score') next.set('sort', sort);
    } else if (initialQuery) {
      next.set('q', initialQuery);
    }
    const qs = next.toString();
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chips, sort]);

  const onChipsChange = useCallback((next: Set<string>) => { setChips(next); }, []);
  const onSortChange = useCallback((next: V4SortKey) => { setSort(next); }, []);
  const onModeChange = useCallback((next: V4EntdeckenMode) => { setMode(next); }, []);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4EntdeckenHero mode={mode} onModeChange={onModeChange}/>
      {mode === 'filter' ? (
        <V4EntdeckenFilterMode
          activeChips={chips}
          sort={sort}
          onChipsChange={onChipsChange}
          onSortChange={onSortChange}
        />
      ) : (
        <V4EntdeckenSmartMode initialQuery={initialQuery}/>
      )}
    </div>
  );
}

export default function EntdeckenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--v4-surface)]"/>}>
      <EntdeckenInner/>
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify TypeScript + build**

Run: `npx tsc --noEmit 2>&1 | grep entdecken | head -3 || echo OK`
Run: `npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/Discover/v4/index.ts src/app/entdecken/page.tsx
git commit -m "feat(v4): /entdecken dual-mode tabs — filter (default) + smart-search (Phase 4)

URL-persisted via ?mode=filter|smart, ?chip=, ?sort=, ?q=. Both modes
use the existing /api/events and /api/search/semantic backends
unchanged."
```

---

## Task 13: V4MapHeader + V4MarkerLegend + V4MapFilterChipsOverlay (RSC bundle)

**Files:**
- Create: `src/components/Map/v4/V4MapHeader.tsx`
- Create: `src/components/Map/v4/V4MarkerLegend.tsx`
- Create: `src/components/Map/v4/V4MapFilterChipsOverlay.tsx`
- Create: `src/components/Map/v4/index.ts`
- Test: `src/__tests__/components/map/v4/V4MapHeader.test.tsx`
- Test: `src/__tests__/components/map/v4/V4MarkerLegend.test.tsx`
- Test: `src/__tests__/components/map/v4/V4MapFilterChipsOverlay.test.tsx`

- [ ] **Step 1: Write all 3 tests**

`V4MapHeader.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MapHeader } from '@/components/Map/v4/V4MapHeader';

describe('V4MapHeader', () => {
  it('renders eyebrow and H1', () => {
    render(<V4MapHeader/>);
    expect(screen.getByText(/karte/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /events auf der karte/i })).toBeInTheDocument();
  });
});
```

`V4MarkerLegend.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MarkerLegend } from '@/components/Map/v4/V4MarkerLegend';

describe('V4MarkerLegend', () => {
  it('shows all 4 marker categories as text labels', () => {
    render(<V4MarkerLegend/>);
    expect(screen.getByText(/tickets verfügbar/i)).toBeInTheDocument();
    expect(screen.getByText(/künstler im line-up/i)).toBeInTheDocument();
    expect(screen.getByText(/in deinem plan/i)).toBeInTheDocument();
    expect(screen.getByText(/kein online-verkauf/i)).toBeInTheDocument();
  });
});
```

`V4MapFilterChipsOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MapFilterChipsOverlay } from '@/components/Map/v4/V4MapFilterChipsOverlay';

describe('V4MapFilterChipsOverlay', () => {
  it('renders 4 essential map chips', () => {
    render(<V4MapFilterChipsOverlay active={new Set()} onToggle={vi.fn()}/>);
    expect(screen.getByRole('button', { name: /tickets verfügbar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gratis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /heute/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /konzerte/i })).toBeInTheDocument();
  });

  it('toggling chip calls onToggle with key', () => {
    const onToggle = vi.fn();
    render(<V4MapFilterChipsOverlay active={new Set()} onToggle={onToggle}/>);
    screen.getByRole('button', { name: /tickets verfügbar/i }).click();
    expect(onToggle).toHaveBeenCalledWith('tickets');
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement V4MapHeader**

```tsx
/**
 * V4MapHeader — sticky-top v4-style page header above the Mapbox
 * container on /map. Pure RSC.
 */

export function V4MapHeader() {
  return (
    <div className="relative z-10 border-b border-[var(--v4-hairline-1)] bg-[var(--v4-surface)]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-4 md:py-5">
        <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-1.5">Karte</p>
        <h1 className="m-0 text-[22px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] leading-[1.1]">
          Events auf der Karte.
        </h1>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement V4MarkerLegend**

```tsx
/**
 * V4MarkerLegend — small floating legend panel for /map's marker
 * color system. Color never alone — every dot has a text label.
 * Mount it as an absolute-positioned child of the Mapbox container.
 */

const ITEMS = [
  { color: 'var(--v4-ticket)', label: 'Tickets verfügbar' },
  { color: 'var(--v4-match)',  label: 'Künstler im Line-up' },
  { color: 'var(--v4-go)',     label: 'In deinem Plan' },
  { color: 'var(--v4-ink-50)', label: 'Kein Online-Verkauf bekannt' },
];

export function V4MarkerLegend() {
  return (
    <div
      data-v4-marker-legend
      className="absolute bottom-4 left-4 px-3.5 py-2.5 rounded-xl bg-[rgba(10,10,12,0.85)] backdrop-blur border border-[var(--v4-hairline-2)] flex gap-3.5 flex-wrap text-[11px] text-[var(--v4-ink-70)] pointer-events-none"
    >
      {ITEMS.map(item => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: item.color }} aria-hidden="true"/>
          {item.label}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement V4MapFilterChipsOverlay**

```tsx
'use client';

/**
 * V4MapFilterChipsOverlay — horizontal-scrollable chip row above the
 * Mapbox container. Subset of FILTER_CHIPS — only the 4 simplest
 * (Tickets / Gratis / Heute / Konzerte) for surface restraint.
 */

const MAP_CHIPS = [
  { key: 'tickets',   label: 'Tickets verfügbar' },
  { key: 'free',      label: 'Gratis' },
  { key: 'today',     label: 'Heute' },
  { key: 'concerts',  label: 'Konzerte' },
] as const;

interface V4MapFilterChipsOverlayProps {
  active: Set<string>;
  onToggle: (key: string) => void;
}

export function V4MapFilterChipsOverlay({ active, onToggle }: V4MapFilterChipsOverlayProps) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-[calc(100%-24px)] overflow-x-auto thin-scroll">
      <div className="flex gap-2 px-3 py-2 rounded-full bg-[rgba(10,10,12,0.85)] backdrop-blur border border-[var(--v4-hairline-2)] whitespace-nowrap">
        {MAP_CHIPS.map(chip => {
          const isActive = active.has(chip.key);
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onToggle(chip.key)}
              data-active={isActive}
              className={
                'press-haptic px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ' +
                (isActive
                  ? 'bg-[rgba(212,184,150,0.18)] text-[var(--v4-ticket)] border border-[rgba(212,184,150,0.40)]'
                  : 'text-[var(--v4-ink-70)] border border-transparent hover:text-[var(--v4-ink)]')
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create Map v4 barrel** `src/components/Map/v4/index.ts`:

```ts
export { V4MapHeader } from './V4MapHeader';
export { V4MarkerLegend } from './V4MarkerLegend';
export { V4MapFilterChipsOverlay } from './V4MapFilterChipsOverlay';
```

- [ ] **Step 7: Run → 1/1 + 1/1 + 2/2 pass.**

- [ ] **Step 8: Commit**

```bash
git add src/components/Map/v4/ src/__tests__/components/map/v4/
git commit -m "feat(v4): Map chrome — V4MapHeader, V4MarkerLegend, V4MapFilterChipsOverlay (Phase 4)"
```

---

## Task 14: Mount Map v4 components in /map/page.tsx (additive)

**Files:**
- Modify: `src/app/map/page.tsx`

- [ ] **Step 1: Read current map page**

Run: `head -50 src/app/map/page.tsx` and `grep -nE "^export default|<EventMap|return \(" src/app/map/page.tsx | head -10` to find the JSX root.

- [ ] **Step 2: Additive mounts only**

In `src/app/map/page.tsx`:

**Edit A — Add import** (in the import block, after existing imports):

```tsx
import { V4MapHeader, V4MarkerLegend, V4MapFilterChipsOverlay } from '@/components/Map/v4';
```

**Edit B — Add Map chip state** near other useState declarations:

```tsx
const [mapChips, setMapChips] = useState<Set<string>>(new Set());
```

Toggle handler near other handlers:

```tsx
const toggleMapChip = (key: string) => {
  setMapChips(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
};
```

**Edit C — Update return JSX.**

The current `/map/page.tsx` returns a div containing the Mapbox container. Find the outer return JSX block (around line 700+). Wrap with V4MapHeader at top, and inside the Mapbox container parent, add V4MapFilterChipsOverlay + V4MarkerLegend as positioned children.

Concrete pattern (exact line locations depend on the existing layout; use this as a template):

```tsx
return (
  <div className="h-screen flex flex-col bg-[var(--v4-surface)]">
    <V4MapHeader/>
    <div className="relative flex-1">
      <V4MapFilterChipsOverlay active={mapChips} onToggle={toggleMapChip}/>
      {/* … existing Mapbox container … */}
      <V4MarkerLegend/>
    </div>
    {/* … existing FilterDrawer … */}
  </div>
);
```

If the existing structure differs (the file is 755 LOC), preserve all existing JSX and just add the V4 components in the right slots. The key rule: **do not modify the Mapbox component itself, the marker logic, or the filter state machine**. Add only.

**Edit D — Use the chip filter (best-effort).** If the existing Map has an `EventFilters` state, mirror Map chips into it where the schema supports it. If not, leave the chips visual-only for Phase 4 (they at least communicate the available filters); deeper wiring is a follow-up.

- [ ] **Step 3: Build verification**

Run: `npm run build 2>&1 | tail -10`

Build should succeed.

- [ ] **Step 4: Commit**

```bash
git add src/app/map/page.tsx
git commit -m "feat(v4): mount V4MapHeader + Filter-Chips-Overlay + MarkerLegend on /map (Phase 4)

Additive only — Mapbox-GL core, marker rendering, FilterDrawer state
machine are unchanged. Chip toggling is local map-state for Phase 4;
deeper wiring into event-query filters is a follow-up if needed."
```

---

## Task 15: Run full v4-suite + EventDetailV2-not-imported check + Push + PR

**Files:** none (verification only)

- [ ] **Step 1: Full v4 tests**

Run: `npm test -- src/__tests__/components/events/v4/ src/__tests__/components/v4/ src/__tests__/components/artists/v4/ src/__tests__/components/discover/v4/ src/__tests__/components/map/v4/ src/__tests__/lib/v4/ 2>&1 | tail -8`

Expected: All ~150 tests green across Phase 1+2+3+4.

- [ ] **Step 2: TypeScript clean for v4 surfaces**

Run: `npx tsc --noEmit 2>&1 | grep -E "v4/|/v4 " | head -10 || echo "OK clean"`

Expected: empty output (pre-existing TS errors in unrelated test files like `normalize-date.test.ts` are unrelated).

- [ ] **Step 3: Production build**

Run: `npm run build 2>&1 | tail -15`

Expected: clean compile, CSP postbuild verify pass, ISR markers for `/`, `/entdecken`, `/artists`, `/map` intact.

- [ ] **Step 4: Verify ArtistsPageClient.tsx no longer imported in production**

Run: `grep -rn "from './ArtistsPageClient'" src/ 2>/dev/null | grep -v __tests__`

Expected: no output. (File stays on disk, just no longer mounted.)

- [ ] **Step 5: Push branch**

```bash
git push -u origin claude/v4-phase-4-artists-entdecken-map
```

- [ ] **Step 6: Open PR**

```bash
gh pr create --base master --title "v4 Redesign Phase 4 — Künstler + Entdecken-DualMode + Map-Polish" --body "$(cat <<'EOF'
## Summary

Phase 4/5 des v4-Redesigns. Drei Surfaces:

- **/artists** — full v4-Redesign mit Hero, Search-with-Follow (V4ArtistSearchResult state machine), post-follow V4Toast, V4FollowedArtistsGrid mit match-counts, V4MatchingEvents gold-accent Liste. Existing AddArtistsPanel (Spotify-Import) preserved as inner component. Old ArtistsPageClient.tsx (428 LOC) bleibt auf der Platte aber nicht mehr gemountet.
- **/entdecken** — Dual-Mode mit URL-persistierten Tabs zwischen Filter (V4FilterChips + V4SortRow + Grid, default) und Smart-Suche (existing NLP semantic search, restyled). Beide Modi nutzen /api/events bzw. /api/search/semantic unverändert.
- **/map** — additive v4-Chrome: V4MapHeader, V4MapFilterChipsOverlay über der Karte, V4MarkerLegend unten-links. Mapbox-GL Core unangetastet.

**Atoms** (reusable cross-surface): V4Toast, V4FilterChips, V4SortRow, V4EntdeckenTabs — alle unter `src/components/Events/v4/`.

**Tests:** ~50 neue Specs auf Phase 4. Gesamt v4-Suite (Phase 1+2+3+4) ≈ 150 Tests grün.

**Spec / Plan:**
- `docs/superpowers/specs/2026-05-14-v4-phase-4-artists-entdecken-map-design.md`
- `docs/superpowers/plans/2026-05-14-v4-phase-4-artists-entdecken-map.md`

**Out-of-Scope:** Plan-Wizard (Phase 5), Auth-Modals (Phase 5), Friends-Avatars (Phase 5), `EventDetailV2.tsx` Cleanup, Mapbox-Refactor.

## Test plan

- [ ] Vercel preview `/artists`: Hero + Search rendert; Such "bilderbuch" → Result-Card + Follow-Button erscheint
- [ ] Follow-Click anon → Redirect zu /auth/login?next=/artists?q=...
- [ ] Follow-Click authed → V4Toast erscheint mit Artist-Namen
- [ ] Empty-State zeigt sich bei 0 Treffern ("Keine Künstler gefunden")
- [ ] Followed-Grid + Matching-Events laden für eingeloggten User
- [ ] AddArtistsPanel (Spotify-Import) funktioniert unter neuem Layout
- [ ] `/entdecken` Default-Mode = Filter, Chips + Sort sichtbar
- [ ] Tab-Switch zu Smart-Suche → existing NLP search aktiv mit Beispielen
- [ ] URL aktualisiert mit `?mode=`, `?chip=`, `?q=` korrekt
- [ ] Deep-Link `/entdecken?mode=smart&q=test` öffnet smart mode mit initial query
- [ ] `/map` zeigt v4-Header oben, Chips-Overlay über Karte, Marker-Legend unten-links
- [ ] Mapbox-Interaktion, FilterDrawer, alle bestehenden Map-Features funktionieren wie vor Phase 4

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: Report PR URL.**

---

## Acceptance Criteria (from Spec §7)

- [ ] `/artists` v4-Hero + Search-Result + Followed-Grid + Matches-Liste
- [ ] Follow anon → `/auth/login?next=...`
- [ ] Follow authed → V4Toast erscheint
- [ ] Spotify-Import (AddArtistsPanel) weiterhin funktional
- [ ] `/entdecken?mode=filter` zeigt V4FilterChips + V4SortRow + V4CardV-Grid
- [ ] `/entdecken?mode=smart` zeigt NLP-Textarea + Beispiele wie bisher
- [ ] Tab-Switch ohne Page-Reload, URL aktualisiert via `router.replace`
- [ ] Aktive Filter-Chips persistent in URL
- [ ] `/map` zeigt v4-Header + Chips-Overlay + Marker-Legend
- [ ] Mapbox-Interaktivität unverändert
- [ ] `npm run build` durchläuft
- [ ] v4 Vitest Suite ≥ 150 Tests grün
