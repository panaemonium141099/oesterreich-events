'use client';

/**
 * Step 02 · Anreise
 *
 * Designer-Spec:
 *   - Free-text Eingabe "Von wo startet ihr?"
 *   - 4 Transport-Mode-Cards: Auto / Öffis / Zu Fuß / Fahrrad
 *   - Bei mode=oeffis: ÖBB Routenplaner-CTA (öffnet fahrplan.oebb.at)
 *   - Status "Schon geplant" als sekundärer Choice unten
 */

import type { Event } from '@/types/events';
import type { PlanItemStatus, ArrivalMode } from '@/types/plans';
import { V4WizardEventSummary, V4WizardHead, V4WizardModeCard } from './V4WizardShared';
import { buildOebbScottyUrl } from '@/lib/plans/deep-links';

interface Props {
  event: Event;
  planDate: string;
  status: PlanItemStatus;
  onStatus: (next: PlanItemStatus) => void;
  mode: ArrivalMode | null;
  onMode: (next: ArrivalMode | null) => void;
  from: string;
  onFrom: (next: string) => void;
}

const Icon = {
  Car: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>
      <circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>
    </svg>
  ),
  Train: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="16" rx="2"/>
      <path d="M4 11h16"/><path d="M12 3v8"/>
      <path d="M8 19l-2 3"/><path d="M16 19l2 3"/>
      <circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>
    </svg>
  ),
  Walk: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13" cy="4" r="2"/><path d="M15 22l-2-6-2 2v6"/><path d="M11 12l-2 2-2-3"/><path d="M13 10l3 2 3-3"/>
    </svg>
  ),
  Bike: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/>
      <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>
    </svg>
  ),
  Pin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
};

const MODES: { value: ArrivalMode; label: string; icon: () => React.ReactElement }[] = [
  { value: 'auto',    label: 'Auto',    icon: Icon.Car },
  { value: 'oeffis',  label: 'Öffis',   icon: Icon.Train },
  { value: 'fuss',    label: 'Zu Fuß',  icon: Icon.Walk },
  { value: 'fahrrad', label: 'Fahrrad', icon: Icon.Bike },
];

export function V4WizardStepArrival({ event, planDate, status, onStatus, mode, onMode, from, onFrom }: Props) {
  const oebbUrl = mode === 'oeffis' ? buildOebbScottyUrl(event, from || null, planDate) : null;

  return (
    <div>
      <V4WizardEventSummary event={event} compact/>
      <V4WizardHead
        eyebrow="Schritt 02 · Anreise"
        title="Wie kommt ihr hin?"
        sub="Wir merken die Anreise in deinem Plan. Die Verbindung öffnet sich im offiziellen Routenplaner."
      />

      {/* Startort */}
      <div>
        <label htmlFor="wizard-from" className="block text-[11.5px] uppercase tracking-[0.14em] font-semibold text-[var(--v4-ink-50)] mb-2">
          Von wo startet ihr?
        </label>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] focus-within:border-[var(--v4-hairline-3)]">
          <span className="text-[var(--v4-ink-70)] flex-shrink-0"><Icon.Pin/></span>
          <input
            id="wizard-from"
            type="text"
            value={from}
            onChange={e => onFrom(e.target.value)}
            placeholder="Z.B. Wien Hbf, Eisenstadt, …"
            className="flex-1 bg-transparent text-[14px] text-[var(--v4-ink)] placeholder-[var(--v4-ink-30)] focus:outline-none"
          />
        </div>
      </div>

      {/* Verkehrsmittel */}
      <div className="mt-5">
        <p className="text-[11.5px] uppercase tracking-[0.14em] font-semibold text-[var(--v4-ink-50)] mb-2">
          Verkehrsmittel
        </p>
        <div className="grid grid-cols-4 gap-2">
          {MODES.map(m => (
            <V4WizardModeCard
              key={m.value}
              icon={<m.icon/>}
              label={m.label}
              selected={mode === m.value}
              onClick={() => onMode(mode === m.value ? null : m.value)}
            />
          ))}
        </div>
      </div>

      {/* ÖBB-Routenplaner CTA wenn Öffis */}
      {mode === 'oeffis' && oebbUrl && (
        <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-1)]">
          <div className="flex flex-col flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--v4-ticket)]">ÖBB Scotty</p>
            <p className="text-[12.5px] text-[var(--v4-ink-70)] mt-1 line-clamp-1">
              {from ? `${from} → ` : 'Ziel: '}{event.location_name || event.bundesland || 'Veranstaltungsort'}
            </p>
          </div>
          <a
            href={oebbUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-track="wizard_oebb_route"
            className="press-haptic flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold flex-shrink-0"
          >
            Route öffnen
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
            </svg>
          </a>
        </div>
      )}

      <p className="mt-4 text-[11.5px] text-[var(--v4-ink-50)] leading-relaxed">
        Wir speichern Mode und Startpunkt. Den Kauf der Bahnverbindung erledigst du selbst bei der ÖBB.
      </p>

      {/* Sekundär: bereits geplant / überspringen */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onStatus(status === 'done' ? 'open' : 'done')}
          aria-pressed={status === 'done'}
          className={`press-haptic px-4 py-2 rounded-full text-[12.5px] font-semibold border ${
            status === 'done'
              ? 'border-[var(--v4-go)] text-[var(--v4-go)] bg-[color-mix(in_oklab,var(--v4-go)_10%,transparent)]'
              : 'border-[var(--v4-hairline-2)] text-[var(--v4-ink-70)] hover:border-[var(--v4-hairline-3)]'
          }`}
        >
          ✓ Anreise schon geplant
        </button>
        <button
          type="button"
          onClick={() => onStatus(status === 'skip' ? 'open' : 'skip')}
          aria-pressed={status === 'skip'}
          className={`press-haptic px-4 py-2 rounded-full text-[12.5px] font-semibold border ${
            status === 'skip'
              ? 'border-[var(--v4-ink)] text-[var(--v4-ink)] bg-[var(--v4-surface-inset)]'
              : 'border-[var(--v4-hairline-2)] text-[var(--v4-ink-70)] hover:border-[var(--v4-hairline-3)]'
          }`}
        >
          Überspringen
        </button>
      </div>
    </div>
  );
}
