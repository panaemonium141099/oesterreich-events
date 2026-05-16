'use client';

/**
 * Step 01 · Tickets
 *
 * Drei Choices nach Designer-Spec:
 *   - "Jetzt Tickets sichern" → führt zum Anbieter (target=_blank)
 *   - "Schon gekauft" → tickets_status='done'
 *   - "Später entscheiden" → tickets_status='later'
 *
 * Wenn das Event als Free / kein Anbieter erkannt ist, zeigen wir
 * stattdessen einen Info-Block "Wir überspringen diesen Schritt"
 * und setzen tickets_status='skip' beim Weiter-Klick.
 */

import type { Event } from '@/types/events';
import type { PlanItemStatus } from '@/types/plans';
import { V4WizardEventSummary, V4WizardHead, V4WizardChoice } from './V4WizardShared';

interface Props {
  event: Event;
  status: PlanItemStatus;
  onStatus: (next: PlanItemStatus) => void;
  /** Hilfsinfo für Free-Events. */
  hasTicketProvider: boolean;
  ticketUrl?: string | null;
  providerName?: string | null;
}

const Icon = {
  Ticket: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
      <line x1="13" y1="5" x2="13" y2="19"/>
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Clock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
};

export function V4WizardStepTickets({ event, status, onStatus, hasTicketProvider, ticketUrl, providerName }: Props) {
  return (
    <div>
      <V4WizardEventSummary event={event} compact/>
      <V4WizardHead
        eyebrow="Schritt 01 · Tickets"
        title="Wie steht ihr bei den Tickets?"
        sub="Wir merken den Status in deinem Plan. Den Kauf erledigst du beim offiziellen Anbieter."
      />

      {hasTicketProvider ? (
        <div className="flex flex-col gap-2.5">
          {ticketUrl ? (
            <a
              href={ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onStatus('open')}
              data-track="wizard_ticket_external"
              className="press-haptic flex items-center gap-3.5 p-4 rounded-xl border bg-[color-mix(in_oklab,var(--v4-ticket)_8%,var(--v4-surface-elevated))] border-[var(--v4-ticket)]/30 text-left hover:border-[var(--v4-hairline-3)]"
            >
              <span className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-[var(--v4-ticket)] text-[#0a0a0c]"><Icon.Ticket/></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--v4-ink)] leading-tight">Jetzt Tickets sichern</span>
                <span className="block text-[12px] text-[var(--v4-ink-70)] mt-1 leading-relaxed">
                  Du wirst zum offiziellen Anbieter weitergeleitet{providerName ? ` (${providerName})` : ''}.
                </span>
              </span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--v4-ticket)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
              </svg>
            </a>
          ) : null}

          <V4WizardChoice
            icon={<Icon.Check/>}
            label="Schon gekauft"
            sub="Status: erledigt. Du brauchst diesen Schritt nicht mehr."
            selected={status === 'done'}
            onClick={() => onStatus('done')}
          />
          <V4WizardChoice
            icon={<Icon.Clock/>}
            label="Später entscheiden"
            sub="Du kannst den Ticketlink jederzeit aus deinem Plan öffnen."
            selected={status === 'later'}
            onClick={() => onStatus('later')}
          />
        </div>
      ) : (
        <div className="p-5 rounded-2xl border border-dashed border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)]">
          <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-[0.18em] font-semibold bg-[color-mix(in_oklab,var(--v4-go)_15%,transparent)] text-[var(--v4-go)] mb-3">Eintritt frei</span>
          <p className="text-[14px] font-semibold text-[var(--v4-ink)] leading-tight">Für dieses Event ist kein Ticket-Verkauf bekannt.</p>
          <p className="text-[12.5px] text-[var(--v4-ink-70)] mt-2 leading-relaxed">
            Wir überspringen diesen Schritt — du kannst direkt zur Anreise.
          </p>
          <button
            type="button"
            onClick={() => onStatus('skip')}
            data-track="wizard_ticket_skip"
            aria-pressed={status === 'skip'}
            className={`press-haptic mt-4 px-4 py-2 rounded-full text-[12.5px] font-semibold border ${
              status === 'skip'
                ? 'border-[var(--v4-go)] text-[var(--v4-go)] bg-[color-mix(in_oklab,var(--v4-go)_10%,transparent)]'
                : 'border-[var(--v4-hairline-2)] text-[var(--v4-ink-70)] hover:border-[var(--v4-hairline-3)]'
            }`}
          >
            Tickets überspringen
          </button>
        </div>
      )}
    </div>
  );
}
