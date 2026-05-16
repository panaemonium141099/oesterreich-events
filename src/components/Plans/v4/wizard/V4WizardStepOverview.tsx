'use client';

/**
 * Step 05 · Übersicht — "Dein Abendplan"
 *
 * NICHT "Boardkarte" laut Designer-Brief.
 * Zeigt finale Plan-Karte mit Header-Strip (Plan · Datum · Personen)
 * und Status-Rows für Tickets / Anreise / Unterkunft / Reminder.
 */

import type { Event } from '@/types/events';
import type { PlanItemStatus, ArrivalMode } from '@/types/plans';
import { V4WizardHead } from './V4WizardShared';
import { V4Status, type V4StatusKind } from '@/components/Events/v4';

interface Props {
  event: Event;
  planName: string;
  planDate: string;
  note: string;
  tickets_status: PlanItemStatus;
  arrival_status: PlanItemStatus;
  arrival_mode: ArrivalMode | null;
  arrival_from: string;
  accommodation_status: PlanItemStatus;
  accommodation_city: string;
  reminder_7d: boolean;
  reminder_1d: boolean;
  reminder_3h: boolean;
}

const MODE_LABELS: Record<ArrivalMode, string> = {
  auto:    'Auto',
  oeffis:  'Öffis',
  fuss:    'Zu Fuß',
  fahrrad: 'Fahrrad',
};

function statusToKind(s: PlanItemStatus, hasContent: boolean): { kind: V4StatusKind; label: string } {
  switch (s) {
    case 'done':  return { kind: 'done',  label: 'Erledigt' };
    case 'skip':  return { kind: 'skip',  label: 'Nicht nötig' };
    case 'later': return { kind: 'later', label: 'Später' };
    case 'open':
    default:
      return hasContent ? { kind: 'plan', label: 'Geplant' } : { kind: 'open', label: 'Offen' };
  }
}

export function V4WizardStepOverview({
  event, planName, planDate, note,
  tickets_status, arrival_status, arrival_mode, arrival_from,
  accommodation_status, accommodation_city,
  reminder_7d, reminder_1d, reminder_3h,
}: Props) {
  const reminderCount = [reminder_7d, reminder_1d, reminder_3h].filter(Boolean).length;
  const reminderActive = reminderCount > 0;

  const ticketBadge = statusToKind(tickets_status, true);
  const arrivalBadge = statusToKind(arrival_status, !!arrival_mode);
  const accBadge = statusToKind(accommodation_status, accommodation_city.trim().length > 0);
  const reminderBadge: { kind: V4StatusKind; label: string } = reminderActive
    ? { kind: 'done', label: `${reminderCount} aktiv` }
    : { kind: 'skip', label: 'Keine' };

  return (
    <div>
      <V4WizardHead
        eyebrow="Schritt 05 · Übersicht"
        title="Dein Abendplan."
        sub="Speichere den Plan — du findest ihn jederzeit unter „Meine Pläne“."
      />

      <div className="rounded-2xl overflow-hidden bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)]">
        {/* Header-Strip */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--v4-hairline-1)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--v4-ink)]">Plan</span>
            <span className="block h-3 w-px bg-[var(--v4-hairline-3)]"/>
            <span className="text-[11.5px] text-[var(--v4-ink-50)] tracking-[0.04em] truncate">{formatLongDate(planDate)}</span>
          </div>
          <span className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] flex-shrink-0 ml-3">{planName || 'Mein Plan'}</span>
        </div>

        {/* Event */}
        <div className="p-5">
          <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-match)] mb-2">Event</p>
          <p className="text-[20px] md:text-[22px] font-bold tracking-[-0.02em] text-[var(--v4-ink)] leading-tight">{event.title}</p>
          <p className="text-[12.5px] text-[var(--v4-ink-70)] mt-1.5">
            {[event.location_name, event.bundesland, formatShort(event.start_date)].filter(Boolean).join(' · ')}
          </p>

          {/* Status-Rows */}
          <div className="mt-5">
            <Row
              icon={<IconTicket/>}
              label="Tickets"
              value={ticketStatusDesc(tickets_status)}
              badge={ticketBadge}
            />
            <Row
              icon={<IconNav/>}
              label="Anreise"
              value={arrivalDesc(arrival_mode, arrival_from)}
              badge={arrivalBadge}
            />
            <Row
              icon={<IconBed/>}
              label="Unterkunft"
              value={accommodationDesc(accommodation_status, accommodation_city)}
              badge={accBadge}
            />
            <Row
              icon={<IconBell/>}
              label="Reminder"
              value={reminderDesc(reminder_7d, reminder_1d, reminder_3h)}
              badge={reminderBadge}
              last
            />
          </div>

          {note.trim() && (
            <div className="mt-5 p-3.5 rounded-xl bg-[var(--v4-surface-inset)] border border-[var(--v4-hairline-1)]">
              <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] mb-1.5">Notiz</p>
              <p className="text-[13px] text-[var(--v4-ink)] leading-relaxed whitespace-pre-wrap">{note.trim()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-Komponenten
// ─────────────────────────────────────────────────────────────

interface RowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge: { kind: V4StatusKind; label: string };
  last?: boolean;
}

function Row({ icon, label, value, badge, last }: RowProps) {
  return (
    <div className={`flex items-center gap-3 py-3 ${last ? '' : 'border-b border-[var(--v4-hairline-1)]'}`}>
      <span className="w-8 h-8 rounded-lg bg-[var(--v4-surface-inset)] border border-[var(--v4-hairline-1)] text-[var(--v4-ink-70)] flex items-center justify-center flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--v4-ink)] leading-tight">{label}</p>
        <p className="text-[11.5px] text-[var(--v4-ink-50)] mt-0.5 truncate">{value}</p>
      </div>
      <V4Status kind={badge.kind} label={badge.label}/>
    </div>
  );
}

// ─── Description helpers ─────────────────────────────────────

function ticketStatusDesc(s: PlanItemStatus): string {
  switch (s) {
    case 'done':  return 'Schon gekauft';
    case 'skip':  return 'Kein Ticket nötig';
    case 'later': return 'Später entscheiden';
    case 'open':
    default:      return 'Beim Anbieter sichern';
  }
}

function arrivalDesc(mode: ArrivalMode | null, from: string): string {
  if (!mode) return 'Noch nicht festgelegt';
  const modeLabel = MODE_LABELS[mode];
  if (from.trim()) return `${modeLabel} · von ${from.trim()}`;
  return modeLabel;
}

function accommodationDesc(status: PlanItemStatus, city: string): string {
  if (status === 'skip') return 'Keine Übernachtung';
  if (status === 'done' && city.trim()) return `Schon gebucht · ${city.trim()}`;
  if (city.trim()) return `Hotels in ${city.trim()} · booking.com`;
  return 'Noch nicht festgelegt';
}

function reminderDesc(r7: boolean, r1: boolean, r3: boolean): string {
  const parts: string[] = [];
  if (r7) parts.push('7 Tage');
  if (r1) parts.push('1 Tag');
  if (r3) parts.push('3 Std');
  return parts.length ? parts.join(' · ') + ' vorher' : 'Keine Erinnerung';
}

// ─── Date helpers ────────────────────────────────────────────

function formatLongDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

function formatShort(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('de-AT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// ─── Icons (inline) ──────────────────────────────────────────

function IconTicket() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="13" y1="5" x2="13" y2="19"/>
    </svg>
  );
}
function IconNav() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11"/>
    </svg>
  );
}
function IconBed() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
