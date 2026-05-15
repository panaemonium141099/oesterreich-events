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
