# v4 Phase 5 — Plan-Wizard + Meine Pläne Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan-Wizard (3-Step, dual-mount Sheet/Page) + Plan-Detail-Page + Meine-Pläne-Übersicht. User kann von Event-Detail aus "Abend planen" → Sheet mit Event prefilled → speichern → später anschauen / editieren.

**Architektur:** Neue DB-Tabellen `plans` + `plan_items` mit RLS. REST API unter `/api/plans`. Komponenten unter `src/components/Plans/v4/`. Pages: `/plan/[id]`, `/plan/new`, `/saved` (rewrite).

**Spec:** `docs/superpowers/specs/2026-05-15-v4-phase-5-plan-wizard-meine-plaene-design.md`

**Branch:** `claude/v4-phase-5-plan-wizard-meine-plaene`

---

## File Structure

**Create — DB & API:**
- `supabase/migrations/20260515_phase5_plans.sql` — plans + plan_items + RLS
- `src/types/plans.ts` — TypeScript types Plan, PlanItem, PlanWithEvents
- `src/lib/plans/loaders.ts` — server-side data fetchers (getPlan, listPlans)
- `src/app/api/plans/route.ts` — POST (create), GET (list)
- `src/app/api/plans/[id]/route.ts` — GET (detail), PATCH (update), DELETE

**Create — Atoms:**
- `src/components/Events/v4/V4Stepper.tsx` — 3-step indicator
- `src/components/Events/v4/V4DatePicker.tsx` — minimal v4-styled date input

**Create — Plan-Komponenten:**
- `src/components/Plans/v4/V4PlanWizard.tsx` — dual-mount wizard root
- `src/components/Plans/v4/V4PlanWizardStep1.tsx` — Wann + Was (Datum + Name)
- `src/components/Plans/v4/V4PlanWizardStep2.tsx` — Events dazu (Such-Pill + Liste)
- `src/components/Plans/v4/V4PlanWizardStep3.tsx` — Notiz + Speichern
- `src/components/Plans/v4/V4PlanCard.tsx` — Liste-Card
- `src/components/Plans/v4/V4PlanHero.tsx` — Hero auf Plan-Detail
- `src/components/Plans/v4/V4PlanTimeline.tsx` — Timeline der Events
- `src/components/Plans/v4/V4PlansList.tsx` — Tabs + Grid für /saved
- `src/components/Plans/v4/index.ts` — Barrel

**Create — Pages:**
- `src/app/plan/[id]/page.tsx` — Plan-Detail (RSC)
- `src/app/plan/new/page.tsx` — Wizard standalone
- `src/app/saved/V4SavedPageClient.tsx` — neue v4 Client für /saved

**Modify:**
- `src/app/saved/page.tsx` — swap zu V4SavedPageClient
- `src/components/Events/v4/V4SideBox.tsx` (oder die Free/Ticket/InPlan-Variante) — "Abend planen" CTA öffnet Wizard-Sheet statt link auf /saved
- `src/lib/v4/derive-detail-context.ts` — plan_id für event falls vorhanden

**Untouched (per Spec):**
- Existing scoring, scraping, enrichment
- Event detail rendering außer SideBox-CTA
- Map / Karte / Künstler

---

## Task 1: DB Migration plans + plan_items + RLS

**Files:**
- Create: `supabase/migrations/20260515_phase5_plans.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- ─────────────────────────────────────────────────────────────────
-- Phase 5 — Plan-Wizard + Meine Pläne
-- ─────────────────────────────────────────────────────────────────

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  plan_date date not null,
  note text,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade not null,
  event_id uuid references events(id) not null,
  position int not null default 0,
  added_at timestamptz not null default now(),
  unique(plan_id, event_id)
);

create index if not exists idx_plans_user_date on plans(user_id, plan_date desc);
create index if not exists idx_plan_items_plan on plan_items(plan_id, position);

alter table plans enable row level security;
drop policy if exists "users own their plans" on plans;
create policy "users own their plans" on plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table plan_items enable row level security;
drop policy if exists "users own their plan_items via plan" on plan_items;
create policy "users own their plan_items via plan" on plan_items for all
  using (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));

-- Updated_at trigger
create or replace function plans_set_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists plans_set_updated_at_trg on plans;
create trigger plans_set_updated_at_trg before update on plans
  for each row execute function plans_set_updated_at();
```

- [ ] **Step 2: Migration via Supabase MCP applizieren**

Run via apply_migration tool against project booljdtrktpotsenbnut.

- [ ] **Step 3: Verify**

```sql
SELECT table_name FROM information_schema.tables WHERE table_name IN ('plans','plan_items');
SELECT polname FROM pg_policy WHERE polrelid IN ('plans'::regclass, 'plan_items'::regclass);
```

Expected: 2 tables, 2 policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260515_phase5_plans.sql
git commit -m "feat(db): plans + plan_items tables + RLS (Phase 5)"
```

---

## Task 2: Types + Server-side Loaders

**Files:**
- Create: `src/types/plans.ts`
- Create: `src/lib/plans/loaders.ts`

- [ ] **Step 1: Types**

```ts
// src/types/plans.ts
import type { Event } from './events';

export interface Plan {
  id: string;
  user_id: string;
  name: string;
  plan_date: string;          // ISO date
  note: string | null;
  visibility: 'private' | 'shared';
  created_at: string;
  updated_at: string;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  event_id: string;
  position: number;
  added_at: string;
}

export interface PlanWithEvents extends Plan {
  events: Event[];          // hydrated, sorted by position
  event_count: number;
}
```

- [ ] **Step 2: Loaders**

```ts
// src/lib/plans/loaders.ts
import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Plan, PlanWithEvents } from '@/types/plans';
import type { Event } from '@/types/events';

export async function listPlans(opts: {
  scope?: 'upcoming' | 'past';
  limit?: number;
} = {}): Promise<Plan[]> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase.from('plans').select('*').order('plan_date', { ascending: false });
  if (opts.scope === 'upcoming') q = q.gte('plan_date', today);
  if (opts.scope === 'past') q = q.lt('plan_date', today);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) {
    if (process.env.NODE_ENV === 'development') console.error('[listPlans]', error);
    return [];
  }
  return (data ?? []) as Plan[];
}

export async function getPlan(id: string): Promise<PlanWithEvents | null> {
  const supabase = await createServerSupabaseClient();
  const { data: plan } = await supabase.from('plans').select('*').eq('id', id).single();
  if (!plan) return null;
  const { data: items } = await supabase
    .from('plan_items')
    .select('event_id, position')
    .eq('plan_id', id)
    .order('position', { ascending: true });
  const eventIds = (items ?? []).map(it => it.event_id);
  if (eventIds.length === 0) {
    return { ...plan, events: [], event_count: 0 };
  }
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .in('id', eventIds);
  // preserve plan_items.position ordering
  const eventMap = new Map<string, Event>((events ?? []).map((e) => [e.id as string, e as Event]));
  const ordered = (items ?? [])
    .map(it => eventMap.get(it.event_id))
    .filter((e): e is Event => Boolean(e));
  return { ...plan, events: ordered, event_count: ordered.length };
}
```

- [ ] **Step 3: TS check + commit**

```bash
npx tsc --noEmit 2>&1 | grep "plans" | head -5 || echo OK
git add src/types/plans.ts src/lib/plans/loaders.ts
git commit -m "feat(plans): types + server-side loaders (Phase 5)"
```

---

## Task 3: API Routes

**Files:**
- Create: `src/app/api/plans/route.ts`
- Create: `src/app/api/plans/[id]/route.ts`

- [ ] **Step 1: Implement `/api/plans/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface CreatePlanBody {
  name?: string;
  plan_date?: string;     // ISO date YYYY-MM-DD
  note?: string | null;
  event_ids?: string[];
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let body: CreatePlanBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const name = (body.name || '').trim();
  const planDate = (body.plan_date || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!planDate || !/^\d{4}-\d{2}-\d{2}$/.test(planDate)) {
    return NextResponse.json({ error: 'plan_date YYYY-MM-DD required' }, { status: 400 });
  }

  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .insert({ user_id: user.id, name, plan_date: planDate, note: body.note ?? null })
    .select()
    .single();
  if (planErr || !plan) {
    return NextResponse.json({ error: planErr?.message ?? 'create failed' }, { status: 500 });
  }

  const eventIds = (body.event_ids ?? []).filter(Boolean);
  if (eventIds.length > 0) {
    const items = eventIds.map((event_id, i) => ({ plan_id: plan.id, event_id, position: i }));
    const { error: itemsErr } = await supabase.from('plan_items').insert(items);
    if (itemsErr && process.env.NODE_ENV === 'development') {
      console.error('[POST /api/plans] plan_items insert:', itemsErr);
    }
  }

  return NextResponse.json({ plan }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const scope = req.nextUrl.searchParams.get('scope');
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase.from('plans').select('*').order('plan_date', { ascending: false });
  if (scope === 'upcoming') q = q.gte('plan_date', today);
  if (scope === 'past') q = q.lt('plan_date', today);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}
```

- [ ] **Step 2: Implement `/api/plans/[id]/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { data: plan } = await supabase.from('plans').select('*').eq('id', id).single();
  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: items } = await supabase
    .from('plan_items')
    .select('event_id, position')
    .eq('plan_id', id)
    .order('position');
  return NextResponse.json({ plan, items: items ?? [] });
}

interface PatchBody {
  name?: string;
  plan_date?: string;
  note?: string | null;
  event_ids?: string[];
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let body: PatchBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name.trim();
  if (typeof body.plan_date === 'string') updates.plan_date = body.plan_date;
  if (body.note !== undefined) updates.note = body.note;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('plans').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body.event_ids)) {
    // Replace all items: delete + reinsert
    await supabase.from('plan_items').delete().eq('plan_id', id);
    if (body.event_ids.length > 0) {
      const items = body.event_ids.map((event_id, i) => ({ plan_id: id, event_id, position: i }));
      await supabase.from('plan_items').insert(items);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Build verify + commit**

```bash
npm run build 2>&1 | tail -5
git add src/app/api/plans/route.ts src/app/api/plans/[id]/route.ts
git commit -m "feat(api): /api/plans CRUD endpoints (Phase 5)"
```

---

## Task 4: V4Stepper atom (TDD)

**Files:**
- Create: `src/components/Events/v4/V4Stepper.tsx`
- Test: `src/__tests__/components/events/v4/V4Stepper.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4Stepper } from '@/components/Events/v4/V4Stepper';

describe('V4Stepper', () => {
  it('renders all step labels', () => {
    render(<V4Stepper current={1} steps={['Wann', 'Events', 'Notiz']}/>);
    expect(screen.getByText('Wann')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Notiz')).toBeInTheDocument();
  });

  it('marks current step active via data-active', () => {
    render(<V4Stepper current={2} steps={['A', 'B', 'C']}/>);
    const stepB = screen.getByText('B').closest('[data-step]');
    expect(stepB?.getAttribute('data-active')).toBe('true');
  });
});
```

- [ ] **Step 2: Implement**

```tsx
'use client';

interface V4StepperProps {
  current: number;          // 1-based
  steps: string[];
}

export function V4Stepper({ current, steps }: V4StepperProps) {
  return (
    <div className="flex items-center gap-2 mb-6" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={steps.length}>
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={i} data-step={stepNum} data-active={isActive} className="flex items-center gap-2">
            <div
              className={
                'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ' +
                (isActive
                  ? 'bg-[var(--v4-ink)] text-[#0a0a0c]'
                  : isDone
                  ? 'bg-[var(--v4-go)] text-[#0a0a0c]'
                  : 'border border-[var(--v4-hairline-3)] text-[var(--v4-ink-50)]')
              }
            >
              {isDone ? '✓' : stepNum}
            </div>
            <span className={
              'text-[12.5px] font-semibold ' +
              (isActive ? 'text-[var(--v4-ink)]' : 'text-[var(--v4-ink-50)]')
            }>
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className="w-6 h-px bg-[var(--v4-hairline-2)] mx-1" aria-hidden="true"/>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run → 2/2 pass + commit**

```bash
npm test -- src/__tests__/components/events/v4/V4Stepper.test.tsx
git add src/components/Events/v4/V4Stepper.tsx src/__tests__/components/events/v4/V4Stepper.test.tsx
git commit -m "feat(v4): V4Stepper atom für Wizard (Phase 5)"
```

---

## Task 5: V4DatePicker atom (TDD)

**Files:**
- Create: `src/components/Events/v4/V4DatePicker.tsx`
- Test: `src/__tests__/components/events/v4/V4DatePicker.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { V4DatePicker } from '@/components/Events/v4/V4DatePicker';

describe('V4DatePicker', () => {
  it('renders with initial value', () => {
    render(<V4DatePicker value="2026-06-15" onChange={() => {}} label="Datum"/>);
    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    expect(input.value).toBe('2026-06-15');
  });

  it('calls onChange with new ISO date', () => {
    const onChange = vi.fn();
    render(<V4DatePicker value="2026-06-15" onChange={onChange} label="Datum"/>);
    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-07-01' } });
    expect(onChange).toHaveBeenCalledWith('2026-07-01');
  });
});
```

- [ ] **Step 2: Implement**

```tsx
'use client';

interface V4DatePickerProps {
  value: string;          // ISO YYYY-MM-DD
  onChange: (next: string) => void;
  label: string;
  min?: string;
  max?: string;
}

export function V4DatePicker({ value, onChange, label, min, max }: V4DatePickerProps) {
  const id = `v4-date-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] focus:outline-none focus:border-[var(--v4-hairline-3)]"
      />
    </div>
  );
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/__tests__/components/events/v4/V4DatePicker.test.tsx
git add src/components/Events/v4/V4DatePicker.tsx src/__tests__/components/events/v4/V4DatePicker.test.tsx
git commit -m "feat(v4): V4DatePicker atom (Phase 5)"
```

---

## Task 6: V4PlanWizard root + state machine

**Files:**
- Create: `src/components/Plans/v4/V4PlanWizard.tsx`
- Create: `src/components/Plans/v4/index.ts`
- Test: `src/__tests__/components/plans/v4/V4PlanWizard.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { V4PlanWizard } from '@/components/Plans/v4/V4PlanWizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe('V4PlanWizard', () => {
  it('opens on Step 1 (Wann)', () => {
    render(<V4PlanWizard mode="page"/>);
    expect(screen.getByText(/wann/i)).toBeInTheDocument();
  });

  it('navigates Step 1 → Step 2 via "Weiter" button', () => {
    render(<V4PlanWizard mode="page"/>);
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    expect(screen.getByText(/events/i)).toBeInTheDocument();
  });

  it('Step 2 → Step 3 → Save calls POST /api/plans', () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ plan: { id: 'p1' } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<V4PlanWizard mode="page"/>);
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }));
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }));
    expect(fetchMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
'use client';

/**
 * V4PlanWizard — 3-Step Modal/Sheet zum Plan anlegen oder editieren.
 *
 * Dual-mount:
 *  - mode='sheet'   → wird OVER einer anderen Page als Overlay gemountet,
 *    schließt sich via onClose-Callback. Keine URL-Änderung.
 *  - mode='page'    → wird als ganze /plan/new Seite gemountet, redirected
 *    nach Save auf /plan/{id}.
 *
 * Optional initialEvent prefilled wenn von Event-Detail aus geöffnet.
 * Optional initialPlan wenn im Edit-Modus.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { V4Stepper } from '@/components/Events/v4';
import type { Event } from '@/types/events';
import type { Plan } from '@/types/plans';
import { V4PlanWizardStep1 } from './V4PlanWizardStep1';
import { V4PlanWizardStep2 } from './V4PlanWizardStep2';
import { V4PlanWizardStep3 } from './V4PlanWizardStep3';

export interface WizardState {
  name: string;
  plan_date: string;        // ISO YYYY-MM-DD
  note: string;
  events: Event[];
}

interface V4PlanWizardProps {
  mode: 'sheet' | 'page';
  initialEvent?: Event;
  initialPlan?: { id: string; state: WizardState };
  onClose?: () => void;     // only used in sheet mode
}

const STEPS = ['Wann', 'Events', 'Notiz'];

function defaultState(initialEvent?: Event): WizardState {
  const today = new Date().toISOString().slice(0, 10);
  if (initialEvent) {
    const eventDate = (initialEvent.start_date || '').slice(0, 10);
    const city = (initialEvent.location_name || initialEvent.bundesland || '').trim();
    return {
      name: city ? `Abend in ${city}` : `Plan rund um ${initialEvent.title}`,
      plan_date: eventDate || today,
      note: '',
      events: [initialEvent],
    };
  }
  return { name: '', plan_date: today, note: '', events: [] };
}

export function V4PlanWizard({ mode, initialEvent, initialPlan, onClose }: V4PlanWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(() =>
    initialPlan?.state ?? defaultState(initialEvent),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateState = useCallback((patch: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const url = initialPlan ? `/api/plans/${initialPlan.id}` : '/api/plans';
      const method = initialPlan ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: state.name.trim() || 'Mein Plan',
          plan_date: state.plan_date,
          note: state.note.trim() || null,
          event_ids: state.events.map(e => e.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Speichern fehlgeschlagen (${res.status})`);
        setSaving(false);
        return;
      }
      const data = await res.json();
      const planId = initialPlan?.id ?? data.plan?.id;
      if (mode === 'sheet' && onClose) {
        onClose();
        // Optional: redirect to plan-detail after closing the sheet
        if (planId) router.push(`/plan/${planId}`);
      } else if (planId) {
        router.push(`/plan/${planId}`);
      } else {
        router.push('/saved');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  const containerClass = mode === 'sheet'
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur p-4'
    : 'min-h-screen bg-[var(--v4-surface)]';
  const cardClass = mode === 'sheet'
    ? 'relative w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] shadow-2xl p-6 md:p-8'
    : 'max-w-[640px] mx-auto px-4 md:px-14 py-8 md:py-12';

  return (
    <div className={containerClass} onClick={mode === 'sheet' ? onClose : undefined}>
      <div className={cardClass} onClick={e => e.stopPropagation()}>
        {mode === 'sheet' && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="press-haptic absolute right-4 top-4 w-9 h-9 rounded-full flex items-center justify-center text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)] hover:bg-[var(--v4-surface-elevated)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}

        <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-2">{initialPlan ? 'Plan bearbeiten' : 'Neuer Plan'}</p>
        <h2 className="text-[24px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] mb-6 leading-tight">
          {step === 1 ? 'Wann ist der Abend?' : step === 2 ? 'Welche Events?' : 'Notiz dazu?'}
        </h2>

        <V4Stepper current={step} steps={STEPS}/>

        {step === 1 && (
          <V4PlanWizardStep1 state={state} update={updateState}/>
        )}
        {step === 2 && (
          <V4PlanWizardStep2 state={state} update={updateState}/>
        )}
        {step === 3 && (
          <V4PlanWizardStep3 state={state} update={updateState}/>
        )}

        {error && (
          <p className="mt-4 text-[13px] text-[var(--v4-alert)]">{error}</p>
        )}

        <div className="flex items-center justify-between gap-3 mt-8">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : (mode === 'sheet' ? onClose?.() : router.back())}
            className="press-haptic px-4 py-2.5 rounded-full border border-[var(--v4-hairline-2)] text-[13.5px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]"
          >
            {step > 1 ? 'Zurück' : 'Abbrechen'}
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13.5px] font-semibold"
            >
              Weiter
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="press-haptic px-5 py-2.5 rounded-full bg-[var(--v4-go)] text-[#0a0a0c] text-[13.5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Speichern …' : 'Speichern'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Barrel + Tests**

`src/components/Plans/v4/index.ts`:
```ts
export { V4PlanWizard, type WizardState } from './V4PlanWizard';
```

(more exports added as later tasks land)

- [ ] **Step 4: Run + commit**

(Tests will only fully pass after Step1-3 implementations land — but mock-out the children if needed. Implementer can adjust test scope to match what's implementable in this task.)

```bash
git add src/components/Plans/v4/V4PlanWizard.tsx src/components/Plans/v4/index.ts src/__tests__/components/plans/v4/V4PlanWizard.test.tsx
git commit -m "feat(v4): V4PlanWizard root + state machine (Phase 5)"
```

---

## Task 7: V4PlanWizardStep1 (Wann + Name)

**Files:**
- Create: `src/components/Plans/v4/V4PlanWizardStep1.tsx`
- Test: `src/__tests__/components/plans/v4/V4PlanWizardStep1.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { V4PlanWizardStep1 } from '@/components/Plans/v4/V4PlanWizardStep1';

describe('V4PlanWizardStep1', () => {
  it('renders name + date inputs', () => {
    const state = { name: 'Test', plan_date: '2026-06-15', note: '', events: [] };
    render(<V4PlanWizardStep1 state={state} update={() => {}}/>);
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Test');
    expect((screen.getByLabelText(/datum/i) as HTMLInputElement).value).toBe('2026-06-15');
  });

  it('emits update on name change', () => {
    const state = { name: '', plan_date: '2026-06-15', note: '', events: [] };
    const update = vi.fn();
    render(<V4PlanWizardStep1 state={state} update={update}/>);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'X' } });
    expect(update).toHaveBeenCalledWith({ name: 'X' });
  });
});
```

- [ ] **Step 2: Implement**

```tsx
'use client';

import { V4DatePicker } from '@/components/Events/v4';
import type { WizardState } from './V4PlanWizard';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

export function V4PlanWizardStep1({ state, update }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="plan-name" className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Name</label>
        <input
          id="plan-name"
          type="text"
          value={state.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="Z.B. Wochenende in Wien"
          className="w-full px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)]"
        />
      </div>
      <V4DatePicker
        label="Datum"
        value={state.plan_date}
        min={today}
        onChange={d => update({ plan_date: d })}
      />
    </div>
  );
}
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/__tests__/components/plans/v4/V4PlanWizardStep1.test.tsx
git add src/components/Plans/v4/V4PlanWizardStep1.tsx src/__tests__/components/plans/v4/V4PlanWizardStep1.test.tsx
git commit -m "feat(v4): V4PlanWizardStep1 — Name + Datum (Phase 5)"
```

---

## Task 8: V4PlanWizardStep2 (Events)

**Files:**
- Create: `src/components/Plans/v4/V4PlanWizardStep2.tsx`
- Test: `src/__tests__/components/plans/v4/V4PlanWizardStep2.test.tsx`

- [ ] **Step 1: Implement (with inline search + add)**

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { Event } from '@/types/events';
import type { WizardState } from './V4PlanWizard';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

interface EventOption {
  id: string; title: string; start_date: string; location_name: string | null;
}

export function V4PlanWizardStep2({ state, update }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EventOption[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: '8' });
        const res = await fetch(`/api/events?${params}`);
        const data = await res.json();
        if (alive) setResults((data.events ?? []).slice(0, 8));
      } finally { if (alive) setSearching(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  function addEvent(ev: EventOption) {
    if (state.events.find(e => e.id === ev.id)) return;
    update({ events: [...state.events, ev as unknown as Event] });
    setQuery('');
    setResults([]);
  }
  function removeEvent(id: string) {
    update({ events: state.events.filter(e => e.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Aktuelle Events im Plan */}
      {state.events.length > 0 && (
        <div className="flex flex-col gap-2">
          {state.events.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[var(--v4-ink)] truncate">{ev.title}</div>
                <div className="text-[12px] text-[var(--v4-ink-50)] truncate">
                  {new Date(ev.start_date).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {ev.location_name ? ` · ${ev.location_name}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => removeEvent(ev.id)} aria-label="Entfernen" className="press-haptic w-8 h-8 rounded-full flex items-center justify-center text-[var(--v4-ink-50)] hover:text-[var(--v4-alert)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Such-Pill */}
      <div className="flex flex-col gap-2">
        <label htmlFor="plan-event-search" className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Event suchen</label>
        <input
          id="plan-event-search"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Titel oder Künstler …"
          className="w-full px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)]"
        />
      </div>

      {searching && <div className="text-[12px] text-[var(--v4-ink-50)] animate-pulse">Suche läuft …</div>}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
          {results.map(ev => (
            <button
              key={ev.id}
              type="button"
              onClick={() => addEvent(ev)}
              className="press-haptic text-left px-3.5 py-2.5 rounded-lg bg-[var(--v4-surface-inset)] border border-transparent hover:border-[var(--v4-hairline-3)]"
            >
              <div className="text-[13.5px] font-semibold text-[var(--v4-ink)] truncate">{ev.title}</div>
              <div className="text-[11.5px] text-[var(--v4-ink-50)]">
                {new Date(ev.start_date).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })}
                {ev.location_name ? ` · ${ev.location_name}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {state.events.length === 0 && results.length === 0 && !query && (
        <p className="text-[12.5px] text-[var(--v4-ink-50)]">Optional — du kannst auch einen Plan ohne Events speichern.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Test minimal**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4PlanWizardStep2 } from '@/components/Plans/v4/V4PlanWizardStep2';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) }));

describe('V4PlanWizardStep2', () => {
  it('renders search input', () => {
    render(<V4PlanWizardStep2 state={{ name: '', plan_date: '2026-06-15', note: '', events: [] }} update={() => {}}/>);
    expect(screen.getByLabelText(/event suchen/i)).toBeInTheDocument();
  });

  it('lists already-added events with remove button', () => {
    const ev = { id: 'e1', title: 'Bilderbuch Live', start_date: '2026-06-15', location_name: 'Stadthalle' } as never;
    render(<V4PlanWizardStep2 state={{ name: '', plan_date: '2026-06-15', note: '', events: [ev] }} update={() => {}}/>);
    expect(screen.getByText(/bilderbuch live/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entfernen/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
git add src/components/Plans/v4/V4PlanWizardStep2.tsx src/__tests__/components/plans/v4/V4PlanWizardStep2.test.tsx
git commit -m "feat(v4): V4PlanWizardStep2 — Event-Suche + Add/Remove (Phase 5)"
```

---

## Task 9: V4PlanWizardStep3 (Notiz + final)

**Files:**
- Create: `src/components/Plans/v4/V4PlanWizardStep3.tsx`
- Test: `src/__tests__/components/plans/v4/V4PlanWizardStep3.test.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import type { WizardState } from './V4PlanWizard';

interface Props { state: WizardState; update: (patch: Partial<WizardState>) => void; }

export function V4PlanWizardStep3({ state, update }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="plan-note" className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Notiz (optional)</label>
        <textarea
          id="plan-note"
          value={state.note}
          onChange={e => update({ note: e.target.value })}
          placeholder="Z.B. Treffpunkt vorm Eingang, 18:00"
          rows={4}
          className="w-full px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[14px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)] resize-y min-h-[80px]"
        />
      </div>
      <div className="px-4 py-3 rounded-xl bg-[var(--v4-surface-inset)] border border-[var(--v4-hairline-1)]">
        <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] mb-1.5">Übersicht</p>
        <p className="text-[14px] text-[var(--v4-ink)] font-semibold">{state.name || '(Plan ohne Name)'}</p>
        <p className="text-[12.5px] text-[var(--v4-ink-70)]">
          {new Date(state.plan_date).toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}
          {state.events.length} Event{state.events.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test + commit**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4PlanWizardStep3 } from '@/components/Plans/v4/V4PlanWizardStep3';

describe('V4PlanWizardStep3', () => {
  it('renders note textarea + overview', () => {
    render(<V4PlanWizardStep3 state={{ name: 'My Plan', plan_date: '2026-06-15', note: 'hi', events: [] }} update={() => {}}/>);
    expect(screen.getByLabelText(/notiz/i)).toBeInTheDocument();
    expect(screen.getByText('My Plan')).toBeInTheDocument();
  });
});
```

```bash
git add src/components/Plans/v4/V4PlanWizardStep3.tsx src/__tests__/components/plans/v4/V4PlanWizardStep3.test.tsx
git commit -m "feat(v4): V4PlanWizardStep3 — Notiz + Übersicht (Phase 5)"
```

---

## Task 10: V4PlanCard, V4PlanHero, V4PlanTimeline atoms

**Files:**
- Create: `src/components/Plans/v4/V4PlanCard.tsx`
- Create: `src/components/Plans/v4/V4PlanHero.tsx`
- Create: `src/components/Plans/v4/V4PlanTimeline.tsx`
- Modify: `src/components/Plans/v4/index.ts` — add exports

- [ ] **Step 1: V4PlanCard (für Liste)**

```tsx
import Link from 'next/link';
import type { Plan } from '@/types/plans';

interface Props {
  plan: Plan;
  eventCount: number;
  previewTitles?: string[];   // up to 2
}

export function V4PlanCard({ plan, eventCount, previewTitles = [] }: Props) {
  const date = new Date(plan.plan_date).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Link href={`/plan/${plan.id}`} className="press-haptic group block rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-5 hover:border-[var(--v4-hairline-3)] transition-colors">
      <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] mb-1.5">{date}</p>
      <h3 className="text-[18px] font-bold text-[var(--v4-ink)] tracking-[-0.02em] mb-3 line-clamp-2">{plan.name}</h3>
      <p className="text-[12.5px] text-[var(--v4-ink-70)] mb-2">{eventCount} Event{eventCount === 1 ? '' : 's'}</p>
      {previewTitles.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {previewTitles.slice(0, 2).map((t, i) => (
            <li key={i} className="text-[12px] text-[var(--v4-ink-50)] truncate">· {t}</li>
          ))}
        </ul>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: V4PlanHero (für /plan/[id])**

```tsx
import type { PlanWithEvents } from '@/types/plans';
import { V4BackButton } from '@/components/Events/v4/V4BackButton';

export function V4PlanHero({ plan }: { plan: PlanWithEvents }) {
  const date = new Date(plan.plan_date).toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <section className="relative border-b border-[var(--v4-hairline-1)] py-10 md:py-16">
      <V4BackButton fallback="/saved" className="top-5 left-4 md:left-14"/>
      <div className="max-w-[1180px] mx-auto px-4 md:px-14">
        <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Mein Plan · {date}</p>
        <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06] mb-2" style={{ textWrap: 'balance' }}>
          {plan.name}
        </h1>
        <p className="text-[14px] md:text-[15px] text-[var(--v4-ink-70)]">
          {plan.event_count} Event{plan.event_count === 1 ? '' : 's'}{plan.note ? ' · mit Notiz' : ''}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: V4PlanTimeline**

```tsx
import Link from 'next/link';
import Image from 'next/image';
import type { Event } from '@/types/events';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

export function V4PlanTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Noch keine Events im Plan.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Klick auf „Bearbeiten" um Events dazu zu nehmen.</p>
      </div>
    );
  }
  return (
    <ol className="relative flex flex-col gap-4 pl-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-px before:bg-[var(--v4-hairline-3)]">
      {events.map(ev => {
        const date = new Date(ev.start_date).toLocaleString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return (
          <li key={ev.id} className="relative">
            <span className="absolute -left-[18px] top-3 w-3 h-3 rounded-full bg-[var(--v4-match)] border-2 border-[var(--v4-surface)]" aria-hidden="true"/>
            <Link href={buildEventUrlV2(ev)} className="press-haptic flex gap-3 rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-3.5 hover:border-[var(--v4-hairline-3)] transition-colors">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[var(--v4-surface-inset)] border border-[var(--v4-hairline-1)] flex-shrink-0">
                {ev.image_url ? (
                  <Image src={ev.image_url} alt="" fill sizes="80px" style={{ objectFit: 'cover' }}/>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--v4-ink-30)] px-1 text-center">{ev.title.slice(0, 24)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] mb-1">{date}</p>
                <h3 className="text-[15px] font-semibold text-[var(--v4-ink)] leading-tight tracking-[-0.015em] line-clamp-2">{ev.title}</h3>
                {ev.location_name && <p className="text-[12.5px] text-[var(--v4-ink-70)] mt-0.5 line-clamp-1">{ev.location_name}</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Barrel + commit**

`src/components/Plans/v4/index.ts`:
```ts
export { V4PlanWizard, type WizardState } from './V4PlanWizard';
export { V4PlanCard } from './V4PlanCard';
export { V4PlanHero } from './V4PlanHero';
export { V4PlanTimeline } from './V4PlanTimeline';
```

```bash
git add src/components/Plans/v4/V4PlanCard.tsx src/components/Plans/v4/V4PlanHero.tsx src/components/Plans/v4/V4PlanTimeline.tsx src/components/Plans/v4/index.ts
git commit -m "feat(v4): V4PlanCard + V4PlanHero + V4PlanTimeline (Phase 5)"
```

---

## Task 11: /plan/[id] page

**Files:**
- Create: `src/app/plan/[id]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { notFound } from 'next/navigation';
import { V4PlanHero, V4PlanTimeline } from '@/components/Plans/v4';
import { getPlan } from '@/lib/plans/loaders';

export const dynamic = 'force-dynamic';   // user-specific data, no caching

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPlan(id);
  if (!plan) notFound();

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4PlanHero plan={plan}/>
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-8 md:py-12">
        {plan.note && (
          <div className="rounded-2xl border border-[rgba(245,185,66,0.28)] bg-[rgba(245,185,66,0.06)] p-4 md:p-5 mb-6">
            <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-match)] mb-1.5">Notiz</p>
            <p className="text-[14px] leading-[1.55] text-[var(--v4-ink)] whitespace-pre-wrap">{plan.note}</p>
          </div>
        )}
        <V4PlanTimeline events={plan.events}/>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plan/[id]/page.tsx
git commit -m "feat(v4): /plan/[id] detail page (Phase 5)"
```

---

## Task 12: /plan/new page (Wizard standalone)

**Files:**
- Create: `src/app/plan/new/page.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { V4PlanWizard } from '@/components/Plans/v4';

function NewPlanInner() {
  const search = useSearchParams();
  const eventParam = search.get('event');
  // initialEvent prefill could be done via server-side hydrate of one
  // event but for now we don't pre-fetch — the user can search inside
  // the Step 2 if they want this event. Keep the page light.
  // (Future: if eventParam, fetch event and pass as initialEvent.)
  void eventParam;
  return <V4PlanWizard mode="page"/>;
}

export default function NewPlanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--v4-surface)]"/>}>
      <NewPlanInner/>
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/plan/new/page.tsx
git commit -m "feat(v4): /plan/new standalone wizard page (Phase 5)"
```

---

## Task 13: /saved page V4 rewrite — Meine Pläne

**Files:**
- Create: `src/app/saved/V4SavedPageClient.tsx`
- Modify: `src/app/saved/page.tsx`
- Create: `src/components/Plans/v4/V4PlansList.tsx`

- [ ] **Step 1: V4PlansList atom**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Plan } from '@/types/plans';
import { V4PlanCard } from './V4PlanCard';

interface Props {
  plans: Plan[];
  /** Optional per-plan event count + previews map. */
  meta?: Record<string, { count: number; previews: string[] }>;
}

export function V4PlansList({ plans, meta = {} }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const filtered = plans.filter(p =>
    tab === 'upcoming' ? p.plan_date >= today : p.plan_date < today,
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div role="tablist" aria-label="Plan-Filter" className="inline-flex p-1 rounded-full bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]">
          {(['upcoming', 'past'] as const).map(k => {
            const isActive = tab === k;
            const label = k === 'upcoming' ? 'Aktuelle Pläne' : 'Vergangene';
            return (
              <button key={k} role="tab" aria-selected={isActive} onClick={() => setTab(k)} className={'press-haptic px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ' + (isActive ? 'bg-[var(--v4-ink)] text-[#0a0a0c]' : 'text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]')}>{label}</button>
            );
          })}
        </div>
        <Link href="/plan/new" className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[13px] font-semibold">
          + Neuer Plan
        </Link>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-8 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">{tab === 'upcoming' ? 'Du hast noch keinen Plan für demnächst.' : 'Noch keine vergangenen Pläne.'}</p>
          {tab === 'upcoming' && (
            <Link href="/plan/new" className="press-haptic mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]">+ Ersten Plan anlegen</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(p => (
            <V4PlanCard key={p.id} plan={p} eventCount={meta[p.id]?.count ?? 0} previewTitles={meta[p.id]?.previews ?? []}/>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: V4SavedPageClient**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { V4PlansList } from '@/components/Plans/v4/V4PlansList';
import type { Plan } from '@/types/plans';

export function V4SavedPageClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/plans');
        if (res.ok) {
          const data = await res.json();
          if (alive) setPlans(data.plans ?? []);
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <section className="border-b border-[var(--v4-hairline-1)] py-8 md:py-14">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14">
          <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-3">Meine Pläne</p>
          <h1 className="m-0 text-[30px] md:text-[44px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.06]" style={{ textWrap: 'balance' }}>
            Was hast du dir{' '}
            <span style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 300 }}>vorgenommen?</span>
          </h1>
        </div>
      </section>
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-8 md:py-12">
        {loading ? (
          <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Lade Pläne …</div>
        ) : (
          <V4PlansList plans={plans}/>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: page.tsx swap**

Read existing `src/app/saved/page.tsx`. Replace its mount with `<V4SavedPageClient/>`. Existing old "saved events" logic may be kept on disk but UNMOUNTED.

```tsx
import { V4SavedPageClient } from './V4SavedPageClient';
export default function SavedPage() {
  return <V4SavedPageClient/>;
}
```

- [ ] **Step 4: Build + commit**

```bash
npm run build 2>&1 | tail -5
git add src/components/Plans/v4/V4PlansList.tsx src/app/saved/V4SavedPageClient.tsx src/app/saved/page.tsx
git commit -m "feat(v4): /saved rewrite — Meine Pläne mit Tabs (Phase 5)"
```

---

## Task 14: Event-Detail SideBox CTA opens Wizard Sheet

**Files:**
- Modify: `src/components/Events/v4/V4SideBox.tsx` (or wherever the "Abend planen" CTA is)
- Modify: appropriate state owner — likely V4EventDetail.tsx

- [ ] **Step 1: Find the existing "Abend planen" CTA**

Search: `grep -rn "Abend planen" src/components/Events/v4/`

- [ ] **Step 2: Lift state to wrapper or inline a sheet-trigger**

Pattern: ein `V4PlanSheetTrigger` Wrapper (oder direkt im V4EventDetail) hat `const [planOpen, setPlanOpen] = useState(false)` und rendert:
- Den CTA-Button (löst setPlanOpen(true))
- Conditional `<V4PlanWizard mode="sheet" initialEvent={event} onClose={() => setPlanOpen(false)}/>`

```tsx
// in V4EventDetail (already 'use client'), near the SideBox mount:
const [planSheetOpen, setPlanSheetOpen] = useState(false);
// pass onPlanClick={() => setPlanSheetOpen(true)} to V4SideBox / V4FreeBox / V4TicketBox
// at end, render conditional:
{planSheetOpen && (
  <V4PlanWizard mode="sheet" initialEvent={event} onClose={() => setPlanSheetOpen(false)}/>
)}
```

- [ ] **Step 3: SideBox CTAs use prop instead of fixed href**

Replace `href="/saved"` button with `<button onClick={onPlanClick}>`. Keep the same visuals.

- [ ] **Step 4: Build + commit**

```bash
git add src/components/Events/v4/*.tsx
git commit -m "feat(v4): Event-Detail 'Abend planen' CTA öffnet Plan-Wizard Sheet (Phase 5)"
```

---

## Task 15: Run full v4-suite + Push + PR

**Files:** none (verification)

- [ ] **Step 1: Full v4 tests**

```bash
npm test -- src/__tests__/components/events/v4/ src/__tests__/components/v4/ src/__tests__/components/artists/v4/ src/__tests__/components/discover/v4/ src/__tests__/components/map/v4/ src/__tests__/components/plans/v4/ src/__tests__/lib/v4/ 2>&1 | tail -8
```

Expected: all pass (~180+ tests).

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -10
```

CSP postbuild grün.

- [ ] **Step 3: Push**

```bash
git push -u origin claude/v4-phase-5-plan-wizard-meine-plaene
```

- [ ] **Step 4: PR**

```bash
gh pr create --base master --title "v4 Phase 5 — Plan-Wizard + Meine Pläne" --body "$(cat <<'EOF'
## Summary

Phase 5 schließt das v4-Redesign ab: User können Pläne anlegen, bearbeiten, ansehen.

- **Plan-Wizard** als 3-Step (Wann/Events/Notiz), dual-mount: Sheet über Event-Detail ODER full-page /plan/new
- **/plan/[id]** Plan-Detail mit Hero, Notiz-Card, Timeline der Events
- **/saved → Meine Pläne** v4-rewrite, Tabs (Aktuell/Vergangen) + Plan-Cards
- **DB-Schema:** plans + plan_items mit RLS, REST API unter /api/plans
- **Event-Detail Integration:** "Abend planen" CTA öffnet Wizard mit Event prefilled

## Test plan
- [ ] Von Event-Detail → "Abend planen" → Sheet öffnet mit Event drin → speichern → /plan/{id}
- [ ] /plan/new direkt → leerer Wizard → speichern
- [ ] /saved zeigt Pläne in Tabs, "+ Neuer Plan" CTA funktioniert
- [ ] /plan/{id} → Bearbeiten lädt Wizard mit State
- [ ] Löschen funktioniert
- [ ] Anon-User Redirect auf /auth/login bei API-Calls

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance (Spec §6)

- [ ] DB-Migration plans + plan_items + RLS live
- [ ] POST/GET/PATCH/DELETE /api/plans funktioniert
- [ ] V4PlanWizard 3-Step öffnet sich von Event-Detail "Abend planen"
- [ ] Wizard speichert Plan → redirect /plan/{id}
- [ ] /plan/{id} zeigt Plan-Detail
- [ ] /saved zeigt Plans-Liste mit Tabs
- [ ] V4-Tokens überall, dark theme konsistent
- [ ] `npm run build` grün
- [ ] V4-Test-Suite grün
