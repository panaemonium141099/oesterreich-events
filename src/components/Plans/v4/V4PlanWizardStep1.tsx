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
