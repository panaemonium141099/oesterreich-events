'use client';

/**
 * Step 03 · Unterkunft (User-requested addition — nicht im Designer,
 * aber im selben Stil wie Schritt 02 Anreise).
 *
 *   - Free-text Stadt (default: aus Event abgeleitet)
 *   - CTA "Hotels auf booking.com suchen" (öffnet booking.com searchresults)
 *   - Sekundär-Buttons: "Schon gebucht" / "Brauche ich nicht"
 *
 * Designer-konsistent: gleiche Layout-Tokens, gleiche Status-Logik,
 * gleiche Sprache wie Anreise-Step. KEINE Buchungs-API — der User
 * schließt den Hotel-Kauf bei booking.com selbst ab.
 */

import type { PlanItemStatus } from '@/types/plans';
import { V4WizardHead } from './V4WizardShared';
import { buildBookingUrl } from '@/lib/plans/deep-links';

interface Props {
  planDate: string;
  status: PlanItemStatus;
  onStatus: (next: PlanItemStatus) => void;
  city: string;
  onCity: (next: string) => void;
}

const Icon = {
  Pin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Bed: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
    </svg>
  ),
};

export function V4WizardStepAccommodation({ planDate, status, onStatus, city, onCity }: Props) {
  const bookingUrl = buildBookingUrl(city || null, planDate, 1);
  const ready = city.trim().length > 0 && status !== 'skip';

  return (
    <div>
      <V4WizardHead
        eyebrow="Schritt 03 · Unterkunft"
        title="Bleibt ihr über Nacht?"
        sub="Wir merken die Stadt in deinem Plan. Die Buchung erledigst du auf booking.com — kein Aufschlag."
      />

      {/* Stadt */}
      <div>
        <label htmlFor="wizard-acc-city" className="block text-[11.5px] uppercase tracking-[0.14em] font-semibold text-[var(--v4-ink-50)] mb-2">
          In welcher Stadt?
        </label>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] focus-within:border-[var(--v4-hairline-3)]">
          <span className="text-[var(--v4-ink-70)] flex-shrink-0"><Icon.Pin/></span>
          <input
            id="wizard-acc-city"
            type="text"
            value={city}
            onChange={e => onCity(e.target.value)}
            placeholder="Z.B. Eisenstadt, Wien, Graz, …"
            className="flex-1 bg-transparent text-[14px] text-[var(--v4-ink)] placeholder-[var(--v4-ink-30)] focus:outline-none"
          />
        </div>
        <p className="mt-2 text-[11.5px] text-[var(--v4-ink-50)]">
          Standardmäßig die Stadt deines Events — kannst du jederzeit ändern.
        </p>
      </div>

      {/* booking.com CTA */}
      {ready && (
        <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-1)]">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--v4-ticket)] text-[#0a0a0c] flex-shrink-0">
            <Icon.Bed/>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--v4-ticket)]">Booking.com</p>
            <p className="text-[12.5px] text-[var(--v4-ink-70)] mt-1 line-clamp-1">
              Hotels in {city.trim()} · Check-in {formatShortDate(planDate)}
            </p>
          </div>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-track="wizard_booking_open"
            className="press-haptic flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold flex-shrink-0"
          >
            Hotels suchen
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
            </svg>
          </a>
        </div>
      )}

      <p className="mt-4 text-[11.5px] text-[var(--v4-ink-50)] leading-relaxed">
        Wir öffnen booking.com mit deinem Datum vorausgefüllt — du wählst dein Hotel selbst.
      </p>

      {/* Sekundär: schon gebucht / brauche ich nicht */}
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
          ✓ Schon gebucht
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
          Brauche ich nicht
        </button>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
  } catch { return iso; }
}
