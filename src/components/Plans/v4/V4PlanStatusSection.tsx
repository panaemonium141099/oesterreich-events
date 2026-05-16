'use client';

/**
 * V4PlanStatusSection — Designer-aligned Status-Rows für /plan/[id].
 *
 * Spiegelt den Wizard-Übersicht-Step. Zeigt Tickets / Anreise /
 * Unterkunft / Reminder mit Live-Deep-Links (ÖBB + booking.com).
 */

import type { PlanWithEvents, PlanItemStatus, ArrivalMode } from '@/types/plans';
import { V4Status, type V4StatusKind } from '@/components/Events/v4';
import { buildOebbScottyUrl, buildBookingUrl } from '@/lib/plans/deep-links';

interface Props {
  plan: PlanWithEvents;
}

const MODE_LABELS: Record<ArrivalMode, string> = {
  auto: 'Auto', oeffis: 'Öffis', fuss: 'Zu Fuß', fahrrad: 'Fahrrad',
};

function statusBadge(s: PlanItemStatus, hasContent: boolean): { kind: V4StatusKind; label: string } {
  switch (s) {
    case 'done':  return { kind: 'done',  label: 'Erledigt' };
    case 'skip':  return { kind: 'skip',  label: 'Nicht nötig' };
    case 'later': return { kind: 'later', label: 'Später' };
    case 'open':
    default:
      return hasContent ? { kind: 'plan', label: 'Geplant' } : { kind: 'open', label: 'Offen' };
  }
}

export function V4PlanStatusSection({ plan }: Props) {
  const firstEvent = plan.events[0];
  const reminders = [plan.reminder_7d, plan.reminder_1d, plan.reminder_3h].filter(Boolean).length;
  const reminderBadge: { kind: V4StatusKind; label: string } = reminders > 0
    ? { kind: 'done', label: `${reminders} aktiv` }
    : { kind: 'skip', label: 'Keine' };

  // Deep-Links
  const oebbUrl = firstEvent && plan.arrival_mode === 'oeffis'
    ? buildOebbScottyUrl(firstEvent, plan.arrival_from, plan.plan_date)
    : null;
  const bookingUrl = (plan.accommodation_status !== 'skip' && plan.accommodation_city)
    ? buildBookingUrl(plan.accommodation_city, plan.plan_date, 1)
    : null;

  return (
    <section className="rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] overflow-hidden mb-6">
      <div className="px-4 md:px-5 py-3 border-b border-[var(--v4-hairline-1)] flex items-center justify-between">
        <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Plan-Status</p>
      </div>
      <div className="px-4 md:px-5 py-1 md:py-2">
        <Row
          label="Tickets"
          value={ticketDesc(plan.tickets_status)}
          badge={statusBadge(plan.tickets_status, true)}
        />
        <Row
          label="Anreise"
          value={arrivalDesc(plan.arrival_mode, plan.arrival_from)}
          badge={statusBadge(plan.arrival_status, !!plan.arrival_mode)}
          action={oebbUrl ? { label: 'Route bei ÖBB', href: oebbUrl } : undefined}
        />
        <Row
          label="Unterkunft"
          value={accommodationDesc(plan.accommodation_status, plan.accommodation_city)}
          badge={statusBadge(plan.accommodation_status, !!plan.accommodation_city)}
          action={bookingUrl ? { label: 'Hotels bei booking.com', href: bookingUrl } : undefined}
        />
        <Row
          label="Reminder"
          value={reminderDesc(plan.reminder_7d, plan.reminder_1d, plan.reminder_3h)}
          badge={reminderBadge}
          last
        />
      </div>
    </section>
  );
}

interface RowProps {
  label: string;
  value: string;
  badge: { kind: V4StatusKind; label: string };
  action?: { label: string; href: string };
  last?: boolean;
}

function Row({ label, value, badge, action, last }: RowProps) {
  return (
    <div className={`flex items-center gap-3 py-3 ${last ? '' : 'border-b border-[var(--v4-hairline-1)]'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--v4-ink)] leading-tight">{label}</p>
        <p className="text-[11.5px] text-[var(--v4-ink-70)] mt-0.5 truncate">{value}</p>
      </div>
      {action && (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className="press-haptic hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[11.5px] font-semibold flex-shrink-0"
        >
          {action.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
          </svg>
        </a>
      )}
      <V4Status kind={badge.kind} label={badge.label}/>
    </div>
  );
}

function ticketDesc(s: PlanItemStatus): string {
  switch (s) {
    case 'done':  return 'Schon gekauft';
    case 'skip':  return 'Kein Ticket nötig';
    case 'later': return 'Später entscheiden';
    case 'open':
    default:      return 'Beim Anbieter sichern';
  }
}

function arrivalDesc(mode: ArrivalMode | null, from: string | null): string {
  if (!mode) return 'Noch nicht festgelegt';
  const label = MODE_LABELS[mode];
  if (from?.trim()) return `${label} · von ${from.trim()}`;
  return label;
}

function accommodationDesc(status: PlanItemStatus, city: string | null): string {
  if (status === 'skip') return 'Keine Übernachtung';
  if (status === 'done' && city?.trim()) return `Schon gebucht · ${city.trim()}`;
  if (city?.trim()) return `Hotels in ${city.trim()}`;
  return 'Noch nicht festgelegt';
}

function reminderDesc(r7: boolean, r1: boolean, r3: boolean): string {
  const parts: string[] = [];
  if (r7) parts.push('7 Tage');
  if (r1) parts.push('1 Tag');
  if (r3) parts.push('3 Std');
  return parts.length ? parts.join(' · ') + ' vorher' : 'Keine Erinnerung';
}
