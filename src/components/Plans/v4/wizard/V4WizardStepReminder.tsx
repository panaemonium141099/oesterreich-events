'use client';

/**
 * Step 04 · Reminder
 *
 * Drei Toggle-Rows nach Designer-Spec:
 *   - 7 Tage vorher  — "Wetter & Anfahrt prüfen"
 *   - 1 Tag vorher   — "Letzter Call · alles da?"
 *   - 3 Stunden vorher — "Aufbrechen · Route öffnen"
 *
 * Plus Info-Card mit a11y-Bell-Icon: "Reminder kommen per Mail."
 */

import { V4WizardEventSummary, V4WizardHead, V4WizardToggle } from './V4WizardShared';
import type { Event } from '@/types/events';

interface Props {
  event: Event;
  reminder_7d: boolean;
  reminder_1d: boolean;
  reminder_3h: boolean;
  onReminder: (key: 'reminder_7d' | 'reminder_1d' | 'reminder_3h', next: boolean) => void;
}

export function V4WizardStepReminder({ event, reminder_7d, reminder_1d, reminder_3h, onReminder }: Props) {
  const noneOn = !reminder_7d && !reminder_1d && !reminder_3h;
  return (
    <div>
      <V4WizardEventSummary event={event} compact/>
      <V4WizardHead
        eyebrow="Schritt 04 · Reminder"
        title="Wann sollen wir euch erinnern?"
        sub="Reminder helfen dir, Tickets, Anreise und Treffpunkt nicht zu vergessen."
      />

      <div className="flex flex-col">
        <V4WizardToggle
          label="7 Tage vorher"
          sub="Wetter & Anfahrt prüfen"
          on={reminder_7d}
          onChange={v => onReminder('reminder_7d', v)}
        />
        <V4WizardToggle
          label="1 Tag vorher"
          sub="Letzter Call · alles da?"
          on={reminder_1d}
          onChange={v => onReminder('reminder_1d', v)}
        />
        <V4WizardToggle
          label="3 Stunden vorher"
          sub="Aufbrechen · Route öffnen"
          on={reminder_3h}
          onChange={v => onReminder('reminder_3h', v)}
          last
        />
      </div>

      {/* Info / Banner */}
      <div className="mt-5 flex items-start gap-3 px-3.5 py-3 rounded-xl bg-[color-mix(in_oklab,var(--v4-match)_8%,var(--v4-surface-elevated))] border border-[var(--v4-match)]/25">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--v4-match)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <p className="text-[12.5px] text-[var(--v4-ink)] leading-relaxed">
          {noneOn
            ? 'Keine Erinnerung — du planst selbst. Du kannst das jederzeit ändern.'
            : 'Reminder kommen als Push & Mail. Du kannst sie pro Plan anpassen — keine Notification-Wand.'}
        </p>
      </div>

      <p className="mt-3 text-[11.5px] text-[var(--v4-ink-50)] leading-relaxed">
        Event-Datum: {formatEventDate(event.start_date)} — wir rechnen die Reminder-Zeiten daraus.
      </p>
    </div>
  );
}

function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}
