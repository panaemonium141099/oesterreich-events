/**
 * V4FreeBox — side-box when state === 'free'.
 *
 * No ticket purchase path; pivots to planning. Green accent stripe +
 * "Abend planen" CTA (links to /saved as Phase-3 stub for the future
 * Plan Wizard in Phase 5).
 */

import { V4Badge } from './V4Badge';

export function V4FreeBox() {
  return (
    <div
      data-v4-side-box="free"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(123,183,148,0.34)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-go)' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="free">Eintritt frei</V4Badge>
        <p className="mt-3.5 text-[16px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-tight">
          Plane deinen Abend und lass dich rechtzeitig erinnern.
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          Kein Ticket nötig. Wir merken Anreise und Reminder in deinem Plan.
        </p>

        <a
          href="/saved"
          data-track="plan_started"
          className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold"
        >
          Abend planen
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        <div className="mt-2.5 flex gap-2">
          <a href="/saved" className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Merken
          </a>
          <a href="#share" className="press-haptic inline-flex items-center justify-center px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)]" aria-label="Teilen">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </a>
        </div>
      </div>
    </div>
  );
}
