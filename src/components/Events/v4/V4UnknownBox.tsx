/**
 * V4UnknownBox — side-box when we can't infer a ticket path (no
 * online shop known, no free/doorsale flag). Neutral hairline border;
 * pivots to Merken + Route.
 */

import { V4Badge } from './V4Badge';

export function V4UnknownBox() {
  return (
    <div
      data-v4-side-box="unknown"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]"
    >
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="unknown">Kein Online-Verkauf bekannt</V4Badge>
        <p className="mt-3.5 text-[15.5px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-[1.4]">
          Wir kennen keinen Ticketshop für dieses Event.
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          Wenn du hin willst, merken wir es — Anreise &amp; Reminder gehen trotzdem.
        </p>

        <div className="mt-[18px] flex flex-col gap-2">
          <a
            href="/saved"
            data-track="event_saved"
            className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Merken
          </a>
          <a
            href="#route"
            data-track="route_opened"
            className="press-haptic flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]"
          >
            Route öffnen
          </a>
        </div>
      </div>
    </div>
  );
}
