# v4 Phase 4.1 — /entdecken List-Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verschiebe die `EventListView` + `FilterDrawer` aus `/map` als
Default-Tab nach `/entdecken`. Filter/Sort-Logik 1:1 erhalten via geteiltem
`useFilteredEvents`-Hook. `/map` reduziert sich auf reine Karte.

**Architektur:** Extract der Daten-Pipeline (fetchEventsProgressive +
client-side filtering + bundesland state) aus `src/app/map/page.tsx` in einen
neuen Hook `src/lib/v4/use-filtered-events.ts`. Beide Pages konsumieren ihn.

**Spec:** `docs/superpowers/specs/2026-05-15-v4-phase-4-1-entdecken-list-mode-design.md`

**Branch:** `claude/v4-phase-4-1-entdecken-list-mode` (forked from master nach Phase-4-Merge)

---

## File Structure

**Create:**
- `src/lib/v4/use-filtered-events.ts` — neuer Hook (~250 LOC extrahiert aus map/page.tsx)
- `src/components/Discover/v4/V4EntdeckenListMode.tsx` — neuer Mode für /entdecken

**Modify:**
- `src/components/Events/v4/V4EntdeckenTabs.tsx` — mode `'list' | 'smart'`, default 'list'
- `src/components/Discover/v4/V4EntdeckenHero.tsx` — Tab-Label "Liste", aktualisierte Subline
- `src/components/Discover/v4/index.ts` — V4EntdeckenListMode export
- `src/app/entdecken/page.tsx` — Mode-Mapping (legacy `?mode=filter` → 'list')
- `src/app/map/page.tsx` — ViewToggle/EventListView raus, nutze Hook

**Untouched:**
- `src/components/MapV3/EventListView.tsx` — 1:1 unverändert
- `src/components/MapV3/FilterDrawer.tsx` — 1:1 unverändert
- `src/components/MapV3/ViewToggle.tsx` — bleibt auf der Platte, nicht mehr gemountet
- `/api/events` route
- Mapbox-GL Init, Marker-Logic
- V4EntdeckenFilterMode (bleibt für Phase 5)

---

## Task 1: Extract data-pipeline into useFilteredEvents hook

**Files:**
- Create: `src/lib/v4/use-filtered-events.ts`

- [ ] **Step 1: Read full map/page.tsx**

Lies `src/app/map/page.tsx` komplett. Identifiziere die Daten-Pipeline:
- Imports needed by the hook (Event, EventFilters, types, bundeslandToId,
  loadFiltersCache/writeCache, district utilities, etc.)
- State: `filters`, `bundeslandIds`, `allEvents`, `loading`,
  `backgroundLoading`, `apiTotalCount`, `bundesland`
- `buildParams` callback
- `fetchEventsProgressive` callback
- `useEffect` for fetch trigger
- Memos: `bundeslandEvents`, `dedupedEvents`, `finalEvents`,
  `categoryCounts`, `totalMatchCount`, `scopeLabel`
- Cache helpers: `loadFiltersCache`, `writeCache`, `abortRef`

- [ ] **Step 2: Copy the pipeline 1:1 into the hook**

```tsx
// src/lib/v4/use-filtered-events.ts
'use client';

/**
 * useFilteredEvents — shared data-pipeline hook für /map und /entdecken.
 *
 * Extracted 1:1 aus src/app/map/page.tsx (Phase 4.1). Filter/Fetch/Cache
 * Logic bleibt unverändert; beide Pages konsumieren denselben Hook damit
 * Map-Marker und Entdecken-Liste exakt dieselbe Event-Menge zeigen.
 *
 * Verwendung:
 *   const {
 *     filters, setFilters, bundeslandIds, setBundeslandIds,
 *     finalEvents, loading, backgroundLoading,
 *     totalMatchCount, apiTotalCount, categoryCounts, scopeLabel, bundesland,
 *   } = useFilteredEvents(initialBundeslandId);
 *
 * Der Hook ist self-contained — alle State + Effects leben drinnen.
 * Page-spezifisches (selectedEvent, userLocation, dynamicFlyTo, etc.)
 * bleibt in der Page.
 */

// [Hier kommt der gesamte extrahierte Block aus map/page.tsx —
//  alle imports + state hooks + effects + memos, identisch.
//  Implementer kopiert ihn aus map/page.tsx Zeilen ~159–460 und
//  packt ihn in den Hook-Body.]

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Event, EventFilters, Bundesland } from '@/types/events';
// ... weitere imports aus map/page.tsx — der implementer übernimmt sie
//     vollständig.

interface UseFilteredEventsReturn {
  filters: EventFilters;
  setFilters: React.Dispatch<React.SetStateAction<EventFilters>>;
  bundeslandIds: string[];
  setBundeslandIds: React.Dispatch<React.SetStateAction<string[]>>;
  allEvents: Event[];
  finalEvents: Event[];
  loading: boolean;
  backgroundLoading: boolean;
  apiTotalCount: number | null;
  totalMatchCount: number;
  categoryCounts: Record<string, number>;
  scopeLabel: string;
  bundesland: Bundesland;
}

export function useFilteredEvents(initialBundeslandId?: string): UseFilteredEventsReturn {
  // [exact extract from map/page.tsx — state + useEffect + useCallback + useMemo]
  // ... siehe Implementer-Step
  // return { filters, setFilters, ... };
}
```

- [ ] **Step 3: TypeScript check the hook**

```bash
npx tsc --noEmit 2>&1 | grep "use-filtered-events" | head -5 || echo OK
```

Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/lib/v4/use-filtered-events.ts
git commit -m "feat(v4): extract useFilteredEvents hook from /map data-pipeline (Phase 4.1)

1:1 extract — filters/bundeslandIds/allEvents/finalEvents/categoryCounts
+ fetchEventsProgressive + cache + abort-guard wandern aus map/page.tsx
in einen wiederverwendbaren Hook. Verhalten unverändert; nur Container."
```

---

## Task 2: Wire map/page.tsx auf den neuen Hook um

**Files:**
- Modify: `src/app/map/page.tsx`

- [ ] **Step 1: Ersetze die extrahierte Pipeline durch einen Hook-Call**

Im Map-Page:
- Lösche alle State-Hooks für `filters`, `bundeslandIds`, `allEvents`,
  `loading`, `backgroundLoading`, `apiTotalCount`, `bundesland`
- Lösche `buildParams`, `fetchEventsProgressive`, `abortRef`,
  `loadFiltersCache`/`writeCache`-Helpers (falls inline)
- Lösche die Memos `bundeslandEvents`, `dedupedEvents`, `finalEvents`,
  `categoryCounts`, `totalMatchCount`, `scopeLabel`
- Lösche den Fetch-Trigger-`useEffect`

Füge dafür ganz oben in der Component-Function ein:

```tsx
const {
  filters, setFilters,
  bundeslandIds, setBundeslandIds,
  finalEvents, loading, backgroundLoading,
  apiTotalCount, totalMatchCount, categoryCounts, scopeLabel,
  bundesland,
} = useFilteredEvents(initialBundeslandIds[0] === 'all' ? undefined : initialBundeslandIds[0]);
```

- [ ] **Step 2: Map-spezifischen Page-State BEHALTEN**
- `selectedEvent`, `hoveredEventId`, `userLocation`, `dynamicFlyTo`,
  `hasUrlContext`, `filterOpen`, `view`, `mapChips` — alles unverändert.

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -15
```

Build muss durchlaufen, CSP postbuild grün.

- [ ] **Step 4: Commit**

```bash
git add src/app/map/page.tsx
git commit -m "refactor(v4): map/page.tsx nutzt useFilteredEvents hook (Phase 4.1)

Daten-Pipeline State + Effects wandern in den Hook. Map-spezifischer
State (selectedEvent, userLocation, flyto) bleibt page-lokal.
Verhalten unverändert."
```

---

## Task 3: V4EntdeckenTabs auf 'list' | 'smart' umstellen

**Files:**
- Modify: `src/components/Events/v4/V4EntdeckenTabs.tsx`
- Modify: `src/__tests__/components/events/v4/V4EntdeckenTabs.test.tsx`

- [ ] **Step 1: Test update**

Ersetze die Tests so dass 'list' / 'smart' geprüft werden (statt 'filter' / 'smart').

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EntdeckenTabs } from '@/components/Events/v4/V4EntdeckenTabs';

describe('V4EntdeckenTabs', () => {
  it('renders both tabs (list, smart)', () => {
    render(<V4EntdeckenTabs current="list" onChange={() => {}}/>);
    expect(screen.getByRole('tab', { name: /liste/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /smart-suche/i })).toBeInTheDocument();
  });

  it('marks current tab aria-selected', () => {
    render(<V4EntdeckenTabs current="smart" onChange={() => {}}/>);
    expect(screen.getByRole('tab', { name: /smart-suche/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /liste/i }).getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange with the other mode', () => {
    const onChange = vi.fn();
    render(<V4EntdeckenTabs current="list" onChange={onChange}/>);
    screen.getByRole('tab', { name: /smart-suche/i }).click();
    expect(onChange).toHaveBeenCalledWith('smart');
  });
});
```

- [ ] **Step 2: Run → fail**

- [ ] **Step 3: Component update**

```tsx
'use client';

export type V4EntdeckenMode = 'list' | 'smart';

interface V4EntdeckenTabsProps {
  current: V4EntdeckenMode;
  onChange: (next: V4EntdeckenMode) => void;
}

const TABS: { key: V4EntdeckenMode; label: string }[] = [
  { key: 'list',  label: 'Liste' },
  { key: 'smart', label: 'Smart-Suche' },
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

- [ ] **Step 4: Run → 3/3 pass**

- [ ] **Step 5: Commit**

```bash
git add src/components/Events/v4/V4EntdeckenTabs.tsx src/__tests__/components/events/v4/V4EntdeckenTabs.test.tsx
git commit -m "feat(v4): V4EntdeckenTabs mode 'list' (default) | 'smart' (Phase 4.1)"
```

---

## Task 4: V4EntdeckenHero Subline + Tab-Label anpassen

**Files:**
- Modify: `src/components/Discover/v4/V4EntdeckenHero.tsx`

Nur die Subline ändern (Tabs werden von V4EntdeckenTabs gestellt):

```tsx
// VORHER
<p className="text-[14px] md:text-[15px] text-[var(--v4-ink-70)] leading-[1.55] mt-3 mb-6 max-w-[620px]">
  Filter nach Tickets, Künstlern, Wochenende oder Genre — oder beschreib in Smart-Suche frei was du willst.
</p>

// NACHHER
<p className="text-[14px] md:text-[15px] text-[var(--v4-ink-70)] leading-[1.55] mt-3 mb-6 max-w-[620px]">
  Filter nach Datum, Region und Kategorie — oder beschreib in Smart-Suche frei was du willst.
</p>
```

Test-File `V4EntdeckenHero.test.tsx` muss nicht angepasst werden — die assertions checken nur die Existenz der Tabs/Heading.

- [ ] **Step 1: Edit Subline**
- [ ] **Step 2: Run V4EntdeckenHero tests → 2/2 pass**

```bash
npm test -- src/__tests__/components/discover/v4/V4EntdeckenHero.test.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Discover/v4/V4EntdeckenHero.tsx
git commit -m "feat(v4): V4EntdeckenHero subline für list+smart Modi (Phase 4.1)"
```

---

## Task 5: V4EntdeckenListMode — wrapper mit EventListView + FilterDrawer

**Files:**
- Create: `src/components/Discover/v4/V4EntdeckenListMode.tsx`
- Modify: `src/components/Discover/v4/index.ts`

- [ ] **Step 1: Implement V4EntdeckenListMode**

```tsx
'use client';

/**
 * V4EntdeckenListMode — Default-Tab auf /entdecken (Phase 4.1).
 *
 * Verwendet die EXAKT gleichen Komponenten wie /map heute:
 *   - useFilteredEvents() — Daten + Filter-State
 *   - <EventListView/>   — Liste mit Sort + Infinite-Scroll
 *   - <FilterDrawer/>    — Wann / Region / Kategorie / Mit wem / Preis
 *
 * Filter-Verhalten ist 1:1 identisch zum heutigen /map?view=list.
 */

import { useState } from 'react';
import { EventListView } from '@/components/MapV3/EventListView';
import { FilterDrawer } from '@/components/MapV3/FilterDrawer';
import { EventDetail } from '@/components/Events/EventDetail';
import { useFilteredEvents } from '@/lib/v4/use-filtered-events';
import type { Event } from '@/types/events';

interface V4EntdeckenListModeProps {
  initialBundeslandId?: string;
}

export function V4EntdeckenListMode({ initialBundeslandId }: V4EntdeckenListModeProps) {
  const {
    filters, setFilters,
    bundeslandIds, setBundeslandIds,
    finalEvents, loading,
    totalMatchCount, categoryCounts, scopeLabel,
  } = useFilteredEvents(initialBundeslandId);

  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-20">
      {/* Action-Bar: Filter-Button + Result-Count */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="text-[13px] text-[var(--v4-ink-70)]">
          <b className="text-[var(--v4-ink)] font-bold">{totalMatchCount}</b> Events
          {scopeLabel !== 'Österreich' && (
            <span className="text-[var(--v4-ink-50)]"> · {scopeLabel}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="press-haptic inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] text-[13px] font-semibold text-[var(--v4-ink)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="7" y1="12" x2="17" y2="12"/>
            <line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          Filter
        </button>
      </div>

      {/* Liste — exakt wie auf /map heute */}
      <EventListView
        events={finalEvents}
        loading={loading}
        totalCount={totalMatchCount}
        scopeLabel={scopeLabel}
      />

      {/* Filter-Drawer — exakt wie auf /map heute */}
      <FilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        bundeslandIds={bundeslandIds}
        onBundeslandIdsChange={setBundeslandIds}
        resultCount={totalMatchCount}
        categoryCounts={categoryCounts}
      />

      {/* Event-Detail Modal */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          eveningMode={false}
          onTagClick={(tag) => {
            setFilters((prev) => ({ ...prev, tags: [tag], category: undefined }));
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}
```

**Wichtig:** Schau dir die echten Imports/Default-Props/Signaturen von
`EventListView`, `FilterDrawer`, `EventDetail` an bevor du committest —
falls eine Prop anders heißt, passe es an. Aber ändere KEIN Verhalten.

- [ ] **Step 2: Discover-Barrel erweitern**

`src/components/Discover/v4/index.ts`:

```ts
export { V4EntdeckenHero } from './V4EntdeckenHero';
export { V4EntdeckenFilterMode } from './V4EntdeckenFilterMode';
export { V4EntdeckenSmartMode } from './V4EntdeckenSmartMode';
export { V4EntdeckenListMode } from './V4EntdeckenListMode';
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "V4EntdeckenListMode|Discover/v4" | head -5 || echo OK
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Discover/v4/V4EntdeckenListMode.tsx src/components/Discover/v4/index.ts
git commit -m "feat(v4): V4EntdeckenListMode wrapper für EventListView + FilterDrawer (Phase 4.1)"
```

---

## Task 6: /entdecken/page.tsx — Mode-Mapping anpassen

**Files:**
- Modify: `src/app/entdecken/page.tsx`

- [ ] **Step 1: Komplett-Replace**

```tsx
'use client';

/**
 * /entdecken — Dual-mode discovery page (Phase 4.1).
 *
 * Mode is persisted in the URL via ?mode=list|smart. First visit
 * default = list. Legacy mode=filter is silently mapped to list.
 */

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  V4EntdeckenHero,
  V4EntdeckenListMode,
  V4EntdeckenSmartMode,
} from '@/components/Discover/v4';
import { type V4EntdeckenMode } from '@/components/Events/v4';

function resolveMode(raw: string | null): V4EntdeckenMode {
  if (raw === 'smart') return 'smart';
  // 'filter' (Phase 4 legacy) und alles andere → 'list'.
  return 'list';
}

function EntdeckenInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<V4EntdeckenMode>(resolveMode(search.get('mode')));
  const initialQuery = search.get('q') ?? '';
  const initialBl = search.get('bl') ?? undefined;

  // Mirror mode back into URL — leave list-Modus default unparametrisiert
  // damit /entdecken eine saubere URL hat.
  useEffect(() => {
    const next = new URLSearchParams();
    if (mode === 'smart') {
      next.set('mode', 'smart');
      if (initialQuery) next.set('q', initialQuery);
    }
    const qs = next.toString();
    router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onModeChange = useCallback((next: V4EntdeckenMode) => { setMode(next); }, []);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4EntdeckenHero mode={mode} onModeChange={onModeChange}/>
      {mode === 'list' ? (
        <V4EntdeckenListMode initialBundeslandId={initialBl}/>
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

- [ ] **Step 2: Build & TS check**

```bash
npx tsc --noEmit 2>&1 | grep "entdecken" | head -5 || echo OK
npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/app/entdecken/page.tsx
git commit -m "feat(v4): /entdecken default-tab = Liste; legacy filter→list (Phase 4.1)"
```

---

## Task 7: /map — ViewToggle + EventListView mount entfernen

**Files:**
- Modify: `src/app/map/page.tsx`

- [ ] **Step 1: ViewToggle-Imports + Mounts entfernen**

In `src/app/map/page.tsx`:
- Lösche `import { ViewToggle } from '@/components/MapV3/ViewToggle'`
- Lösche die zwei `<ViewToggle …/>` JSX-Mounts (mobile + desktop, ~Z. 596 + Z. 608)
- Lösche den `view`-State + die zwei `useEffect`-Stellen die `view` in die
  URL syncen / aus der URL lesen
- Lösche den `{view === 'list' && …}` JSX-Block mit `<EventListView/>` (Z. 712–724)
- Lösche das `<EventListView>`-Import

- [ ] **Step 2: Legacy-URL-Migration für `?view=list`**

Bei `useEffect`-Mount auf /map: wenn `searchParams.get('view') === 'list'`,
push zu `/entdecken?mode=list`.

```tsx
useEffect(() => {
  if (searchParams.get('view') === 'list') {
    router.replace('/entdecken?mode=list');
  }
}, []);
```

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -15
```

Build muss grün sein. CSP postbuild grün.

- [ ] **Step 4: Commit**

```bash
git add src/app/map/page.tsx
git commit -m "refactor(v4): /map verliert ViewToggle + Liste — pure Map (Phase 4.1)

EventListView wandert nach /entdecken. /map?view=list redirected
zu /entdecken?mode=list für Backwards-Compat. Mapbox-GL Core, Marker,
FilterDrawer unangetastet."
```

---

## Task 8: Verification + Push + PR

**Files:** keine

- [ ] **Step 1: Full v4-Suite**

```bash
npm test -- src/__tests__/components/events/v4/ src/__tests__/components/v4/ src/__tests__/components/artists/v4/ src/__tests__/components/discover/v4/ src/__tests__/components/map/v4/ src/__tests__/lib/v4/ 2>&1 | tail -8
```

Expected: ≥166 Tests grün (Phase 4 baseline) + 0 regressions.

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -10
```

CSP postbuild grün.

- [ ] **Step 3: Push**

```bash
git push -u origin claude/v4-phase-4-1-entdecken-list-mode
```

- [ ] **Step 4: PR**

```bash
gh pr create --base master --title "v4 Phase 4.1 — /entdecken List-Mode (Map → Entdecken extract)" --body "$(cat <<'EOF'
## Summary

UX-Pivot nach Phase 4: die bewährte EventListView + FilterDrawer aus /map
wandert als Default-Tab nach /entdecken. /map wird zur reinen Karte.

Filter+Fetch+Sort-Logik bleibt 1:1 identisch — extracted in einen
geteilten Hook \`useFilteredEvents\` den beide Pages konsumieren.

- **/entdecken?mode=list** (default) — EventListView + FilterDrawer
- **/entdecken?mode=smart** — bleibt NLP-Suche aus Phase 4
- **/map** — nur Karte, kein ViewToggle, keine Liste
- **Backwards-Compat:** \`?mode=filter\` (Phase-4-legacy) → list,
  \`/map?view=list\` → /entdecken?mode=list (client-side redirect)

**Untouched:** EventListView, FilterDrawer, /api/events, Mapbox-GL Core.

## Test plan
- [ ] /entdecken (default) zeigt Liste + Filter-Button
- [ ] Filter-Drawer öffnet, alle 5 Filter-Sektionen funktionieren wie auf /map
- [ ] Sort-Tabs (Datum/Distanz/Score) + Infinite-Scroll funktionieren
- [ ] /entdecken?mode=smart zeigt NLP-Suche unverändert
- [ ] /map zeigt nur Karte, kein Toggle
- [ ] /map?view=list redirected zu /entdecken?mode=list
- [ ] /entdecken?mode=filter wird zu list (silent)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Report PR URL**

---

## Acceptance Criteria (from Spec §8)

- [ ] /entdecken default-mode = Liste; Filter-Button öffnet FilterDrawer
- [ ] FilterDrawer-Filterung funktioniert wie heute auf /map
- [ ] Sort-Tabs + Infinite-Scroll funktionieren wie heute
- [ ] /entdecken?mode=smart unverändert
- [ ] Deep-Link /entdecken?mode=list&bl=burgenland funktioniert
- [ ] /map ohne ViewToggle/Liste, nur Karte
- [ ] /map?view=list → redirect zu /entdecken?mode=list
- [ ] Legacy mode=filter → list (silent)
- [ ] npm run build grün, CSP postbuild OK
- [ ] v4-Vitest Suite ≥ 166 Tests grün
