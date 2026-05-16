'use client';

/**
 * V4WizardShared — Atoms für Designer-aligned Plan-Wizard (Phase 6).
 *
 *  - V4WizardEventSummary: kompakte Event-Karte, oben in jedem Step
 *  - V4WizardChoice: 3-Choice-Card (Tickets-Step)
 *  - V4WizardToggle: Reminder-Toggle
 *  - V4WizardModeCard: Transport-Mode-Card (Anreise-Step)
 *
 * Tokens kommen aus /globals.css (v4-*).
 */

import type { ReactNode } from 'react';
import type { Event } from '@/types/events';

// ─────────────────────────────────────────────────────────────
// Event-Summary — kompakt, oben in jedem Wizard-Step
// ─────────────────────────────────────────────────────────────
interface EventSummaryProps {
  event: Event;
  /** Wenn true: kein "Event ändern" Button (z.B. wenn fix vom Event-Detail). */
  compact?: boolean;
  onChange?: () => void;
}

function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'long' });
  } catch { return ''; }
}

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export function V4WizardEventSummary({ event, compact = false, onChange }: EventSummaryProps) {
  const date = formatEventDate(event.start_date);
  const time = formatEventTime(event.start_date);
  return (
    <div className="flex items-center gap-3 p-3.5 mb-6 rounded-2xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-1)]">
      <div
        className="w-16 h-16 flex-shrink-0 rounded-xl bg-cover bg-center bg-[var(--v4-surface-inset)]"
        style={event.image_url ? { backgroundImage: `url(${event.image_url})` } : undefined}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-[var(--v4-ink)] leading-tight tracking-[-0.015em] line-clamp-1">{event.title}</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1 line-clamp-1">
          {[date, time, event.location_name].filter(Boolean).join(' · ')}
        </p>
      </div>
      {!compact && onChange && (
        <button
          type="button"
          onClick={onChange}
          className="press-haptic text-[11.5px] font-semibold text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)] px-2.5 py-1.5 rounded-full"
        >
          Ändern
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Wizard-Head — Eyebrow + Title + optionaler Sub
// ─────────────────────────────────────────────────────────────
interface WizardHeadProps {
  eyebrow: string;
  title: string;
  sub?: string;
}

export function V4WizardHead({ eyebrow, title, sub }: WizardHeadProps) {
  return (
    <div className="mb-6">
      <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-2">{eyebrow}</p>
      <h2 className="text-[24px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] leading-tight">{title}</h2>
      {sub && <p className="text-[13.5px] text-[var(--v4-ink-70)] mt-3 leading-relaxed max-w-[540px]">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Choice-Card — Tickets-Step (Jetzt sichern / schon gekauft / später)
// ─────────────────────────────────────────────────────────────
interface ChoiceProps {
  icon: ReactNode;
  label: string;
  sub: string;
  selected?: boolean;
  /** Primary = Ticket-Akzent (gelb-orange). */
  primary?: boolean;
  onClick: () => void;
}

export function V4WizardChoice({ icon, label, sub, selected, primary, onClick }: ChoiceProps) {
  const bg = primary && !selected
    ? 'bg-[color-mix(in_oklab,var(--v4-ticket)_8%,var(--v4-surface-elevated))]'
    : selected
      ? 'bg-[color-mix(in_oklab,var(--v4-go)_10%,var(--v4-surface-elevated))]'
      : 'bg-[var(--v4-surface-elevated)]';
  const border = selected
    ? 'border-[var(--v4-go)]'
    : primary
      ? 'border-[var(--v4-ticket)]/30'
      : 'border-[var(--v4-hairline-2)]';
  const iconBg = primary
    ? 'bg-[var(--v4-ticket)] text-[#0a0a0c]'
    : 'bg-[var(--v4-surface-inset)] text-[var(--v4-ink-70)]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`press-haptic w-full flex items-center gap-3.5 p-4 rounded-xl border ${bg} ${border} text-left transition-colors hover:border-[var(--v4-hairline-3)]`}
    >
      <span className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-[var(--v4-ink)] leading-tight">{label}</span>
        <span className="block text-[12px] text-[var(--v4-ink-70)] mt-1 leading-relaxed">{sub}</span>
      </span>
      {selected && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v4-go)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Toggle-Row — Reminder-Step
// ─────────────────────────────────────────────────────────────
interface ToggleProps {
  label: string;
  sub: string;
  on: boolean;
  onChange: (next: boolean) => void;
  /** Wenn true: keine bottom border (letzte Row). */
  last?: boolean;
}

export function V4WizardToggle({ label, sub, on, onChange, last }: ToggleProps) {
  return (
    <label className={`flex items-center gap-3.5 py-4 cursor-pointer ${last ? '' : 'border-b border-[var(--v4-hairline-1)]'}`}>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-[var(--v4-ink)] leading-tight">{label}</span>
        <span className="block text-[11.5px] text-[var(--v4-ink-50)] mt-1">{sub}</span>
      </span>
      <span className="relative inline-block w-[38px] h-[22px]">
        <input
          type="checkbox"
          checked={on}
          onChange={e => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span
          aria-hidden="true"
          className={`block w-full h-full rounded-full transition-colors ${on ? 'bg-[var(--v4-go)]' : 'bg-[var(--v4-hairline-3)]'}`}
        />
        <span
          aria-hidden="true"
          className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-[left] ${on ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Mode-Card — Anreise-Step Transport-Auswahl
// ─────────────────────────────────────────────────────────────
interface ModeCardProps {
  icon: ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function V4WizardModeCard({ icon, label, selected, onClick }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`press-haptic flex flex-col items-center justify-center gap-2 py-3.5 px-2 rounded-xl border transition-colors ${
        selected
          ? 'bg-[color-mix(in_oklab,var(--v4-ticket)_10%,var(--v4-surface-elevated))] border-[var(--v4-ticket)]/40 text-[var(--v4-ticket)]'
          : 'bg-[var(--v4-surface-elevated)] border-[var(--v4-hairline-2)] text-[var(--v4-ink-70)] hover:border-[var(--v4-hairline-3)]'
      }`}
    >
      {icon}
      <span className={`text-[12.5px] font-semibold ${selected ? 'text-[var(--v4-ink)]' : 'text-[var(--v4-ink)]'}`}>{label}</span>
    </button>
  );
}
