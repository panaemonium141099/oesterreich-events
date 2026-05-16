'use client';

import { useEffect } from 'react';
import { V4DatePicker } from '@/components/Events/v4';
import type { WizardState } from './V4PlanWizard';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

export function V4PlanWizardStep1({ state, update }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // Wenn schon Events im Plan sind, ist das Datum durch das früheste
  // Event bestimmt — manuell editieren würde keinen Sinn machen.
  // Stattdessen zeigen wir das Datum als read-only Info-Card an.
  const hasEvents = state.events.length > 0;
  const derivedDate = hasEvents
    ? state.events
        .map(e => (e.start_date || '').slice(0, 10))
        .filter(Boolean)
        .sort()[0] ?? state.plan_date
    : state.plan_date;

  // Sync derived date back into state — als useEffect, damit kein
  // re-render-loop entsteht.
  useEffect(() => {
    if (hasEvents && derivedDate !== state.plan_date) {
      update({ plan_date: derivedDate });
    }
  }, [hasEvents, derivedDate, state.plan_date, update]);

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
      {hasEvents ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Datum</span>
          <div className="px-4 py-3 rounded-xl bg-[var(--v4-surface-inset)] border border-[var(--v4-hairline-1)] text-[var(--v4-ink)] text-[15px]">
            {new Date(derivedDate).toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <p className="text-[11.5px] text-[var(--v4-ink-50)]">Wird von deinen Events bestimmt — kann in Step 2 geändert werden indem du Events tauschst.</p>
        </div>
      ) : (
        <V4DatePicker
          label="Datum"
          value={state.plan_date}
          min={today}
          onChange={d => update({ plan_date: d })}
        />
      )}
    </div>
  );
}
