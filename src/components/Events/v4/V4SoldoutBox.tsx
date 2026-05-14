/**
 * V4SoldoutBox — restrained red side-box when tickets are sold out.
 *
 * Doesn't shout. Pivots the user to similar events further down the
 * page (anchor link). Phase 3 reserves the soldout state visually;
 * actual derivation comes later when Eventim availability is wired.
 */

import { V4Badge } from './V4Badge';

export function V4SoldoutBox() {
  return (
    <div
      data-v4-side-box="soldout"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(198,112,121,0.40)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-alert)' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="soldout">Ausverkauft</V4Badge>
        <p className="mt-3.5 text-[15.5px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-[1.4]">
          Tickets sind aktuell vergriffen.
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          Wir zeigen dir ähnliche Events darunter — vielleicht ist was dabei.
        </p>

        <a
          href="#similar-events"
          className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]"
        >
          Ähnliche Events
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </a>
      </div>
    </div>
  );
}
