'use client';

/**
 * V4PlanCard — Designer-aligned Plan-Karte für /saved.
 *
 * Layout:
 *   [Datums-Box]  [Plan-Name + Eyebrow]                 [Plan öffnen →]
 *                 [N Events]
 *                 [Tickets-Badge] [Anreise-Badge] [Unterkunft-Badge] [Reminder-Badge]
 *
 * Status-Badges nutzen V4Status (Icon + Label, nie Farbe alone — a11y).
 * Eyebrow = Plan-Datum als kompakte Zeile.
 */

import Link from 'next/link';
import type { Plan } from '@/types/plans';
import { V4Status, type V4StatusKind } from '@/components/Events/v4';

interface Props {
  plan: Plan;
  eventCount: number;
  previewTitles?: string[];   // up to 2
}

function pickKind(s: Plan['tickets_status']): V4StatusKind {
  switch (s) {
    case 'done':  return 'done';
    case 'skip':  return 'skip';
    case 'later': return 'later';
    case 'open':
    default:      return 'open';
  }
}

function shortStatusLabel(s: Plan['tickets_status']): string {
  switch (s) {
    case 'done':  return 'erledigt';
    case 'skip':  return 'nicht nötig';
    case 'later': return 'später';
    case 'open':
    default:      return 'offen';
  }
}

export function V4PlanCard({ plan, eventCount, previewTitles = [] }: Props) {
  const d = new Date(plan.plan_date);
  const dow = d.toLocaleDateString('de-AT', { weekday: 'short' });
  const day = d.toLocaleDateString('de-AT', { day: 'numeric' });
  const mon = d.toLocaleDateString('de-AT', { month: 'short' });

  const remindersCount = [plan.reminder_7d, plan.reminder_1d, plan.reminder_3h].filter(Boolean).length;

  return (
    <Link
      href={`/plan/${plan.id}`}
      className="press-haptic group flex gap-4 rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-4 md:p-5 hover:border-[var(--v4-hairline-3)] transition-colors"
      data-track="plan_card"
    >
      {/* Boarding-pass Datums-Box */}
      <div className="w-[78px] flex-shrink-0 rounded-xl bg-[var(--v4-surface)] border border-[var(--v4-hairline-1)] flex flex-col items-center justify-center py-3 px-2">
        <span className="text-[9.5px] uppercase tracking-[0.14em] font-semibold text-[var(--v4-ink-50)]">{dow}</span>
        <span className="text-[24px] font-bold tracking-[-0.02em] text-[var(--v4-ink)] leading-none mt-1" style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>{day}</span>
        <span className="text-[9.5px] uppercase tracking-[0.14em] font-semibold text-[var(--v4-ink-50)] mt-1">{mon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] md:text-[16px] font-bold text-[var(--v4-ink)] tracking-[-0.02em] leading-tight line-clamp-2">{plan.name}</h3>
        <p className="text-[11.5px] text-[var(--v4-ink-50)] mt-1.5">
          {eventCount} Event{eventCount === 1 ? '' : 's'}
          {previewTitles[0] && (
            <span className="text-[var(--v4-ink-70)]"> · {previewTitles[0]}</span>
          )}
        </p>

        {/* Status-Badges — designer-aligned */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <V4Status
            kind={pickKind(plan.tickets_status)}
            label={`Tickets: ${shortStatusLabel(plan.tickets_status)}`}
          />
          <V4Status
            kind={plan.arrival_mode ? 'plan' : pickKind(plan.arrival_status)}
            label={`Anreise: ${plan.arrival_mode ? arrivalLabel(plan.arrival_mode) : shortStatusLabel(plan.arrival_status)}`}
          />
          {plan.accommodation_status !== 'skip' && (plan.accommodation_status === 'done' || plan.accommodation_city) && (
            <V4Status
              kind={pickKind(plan.accommodation_status)}
              label={`Hotel: ${shortStatusLabel(plan.accommodation_status)}`}
            />
          )}
          <V4Status
            kind={remindersCount > 0 ? 'done' : 'skip'}
            label={remindersCount > 0 ? `${remindersCount} Reminder` : 'Keine Reminder'}
          />
        </div>
      </div>

      <div className="hidden md:flex items-center flex-shrink-0">
        <span className="text-[12px] font-semibold text-[var(--v4-ink-50)] group-hover:text-[var(--v4-ink)] flex items-center gap-1">
          Öffnen
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </span>
      </div>
    </Link>
  );
}

function arrivalLabel(mode: NonNullable<Plan['arrival_mode']>): string {
  switch (mode) {
    case 'auto':    return 'Auto';
    case 'oeffis':  return 'Öffis';
    case 'fuss':    return 'zu Fuß';
    case 'fahrrad': return 'Fahrrad';
  }
}
