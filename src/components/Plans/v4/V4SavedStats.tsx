'use client';

/**
 * V4SavedStats — Stats-Tiles für /saved nach Designer-Spec.
 *
 *   • Anstehende Pläne — count upcoming plans
 *   • Tickets offen    — count plans with tickets_status='open'
 *   • Anreise offen    — count plans with arrival_status='open' AND no mode
 *   • Reminder aktiv   — count plans with mind. 1 active reminder
 */

import type { Plan } from '@/types/plans';

interface Props {
  plans: Plan[];
}

function statsFromPlans(plans: Plan[]) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = plans.filter(p => p.plan_date >= today);
  return {
    upcoming: upcoming.length,
    ticketsOpen: upcoming.filter(p => p.tickets_status === 'open').length,
    arrivalOpen: upcoming.filter(p => p.arrival_status === 'open' && !p.arrival_mode).length,
    remindersActive: upcoming.filter(p => p.reminder_7d || p.reminder_1d || p.reminder_3h).length,
    total: upcoming.length,
  };
}

export function V4SavedStats({ plans }: Props) {
  const s = statsFromPlans(plans);
  const tiles = [
    { label: 'Anstehende Pläne', value: s.upcoming, sub: 'gesamt' },
    { label: 'Tickets offen',    value: s.ticketsOpen, sub: s.ticketsOpen ? 'noch nicht gesichert' : 'alle sortiert', accent: 'var(--v4-ticket)' },
    { label: 'Anreise offen',    value: s.arrivalOpen, sub: s.arrivalOpen ? 'Mode noch nicht gesetzt' : 'überall geplant' },
    { label: 'Reminder aktiv',   value: s.remindersActive, sub: `von ${Math.max(s.total, s.remindersActive)} Plänen`, accent: 'var(--v4-go)' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--v4-hairline-1)] rounded-2xl overflow-hidden">
      {tiles.map(t => (
        <div key={t.label} className="bg-[var(--v4-surface-elevated)] p-4 md:p-5">
          <p className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[var(--v4-ink-50)]">{t.label}</p>
          <p
            className="text-[26px] md:text-[28px] font-bold tracking-[-0.025em] leading-none mt-2"
            style={{ color: t.accent || 'var(--v4-ink)' }}
          >{t.value}</p>
          <p className="text-[11px] text-[var(--v4-ink-50)] mt-2">{t.sub}</p>
        </div>
      ))}
    </div>
  );
}
