/**
 * V4MobileStickyBar — fixed bottom action bar on the event detail.
 *
 * Five state-variants compress the side-box message to a single
 * primary CTA + a short status tag. Rendered above V4TabBar (Phase 1)
 * by being lower in z-order; offset by 76px so the tab bar stays visible.
 *
 * The 'md:hidden' Tailwind class keeps it out of the desktop layout entirely.
 * When onPlanClick is provided, plan/open CTAs fire the callback instead of
 * navigating to /saved.
 */

import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4Badge } from './V4Badge';
import { V4SaveButton } from './V4SaveButton';

interface V4MobileStickyBarProps {
  state: V4EventState;
  /** Fürs echte Merken (V4SaveButton) — die alten <a href="/saved">-Shortcuts
   *  speicherten nichts (Mobile-Audit 2026-07-15). */
  eventId?: string;
  provider?: string;
  priceFrom?: string;
  ticketUrl?: string;
  priceAtDoor?: string;
  onPlanClick?: () => void;
}

export function V4MobileStickyBar({ state, eventId, provider, priceFrom, ticketUrl, priceAtDoor, onPlanClick }: V4MobileStickyBarProps) {
  return (
    <div
      data-v4-event-sticky={state}
      className="md:hidden fixed left-0 right-0 z-[22] flex items-center gap-3 px-4 py-3 border-t border-[var(--v4-hairline-2)] bg-[rgba(10,10,12,0.96)] backdrop-blur"
      style={{ bottom: 82 /* V4TabBar ist 81px hoch — 76 überlappte 5px */ }}
    >
      {state === 'ticket' || state === 'match' || state === 'lineup' ? (
        provider && priceFrom && ticketUrl ? (
          <>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--v4-ink-50)]">ab</span>
              <span className="text-[17px] font-bold tracking-[-0.015em] text-[var(--v4-ink)]">{priceFrom.replace(/^ab\s*/i,'')}</span>
            </div>
            <div className="flex-1"/>
            <a
              href={ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-track="ticket_click_mobile"
              className="press-haptic inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--v4-ticket)] text-[#1a1208] text-sm font-semibold"
            >
              Zu {provider}
            </a>
          </>
        ) : (
          <>
            <V4Badge kind="unknown">Kein Ticket bekannt</V4Badge>
            <div className="flex-1"/>
            {eventId
              ? <V4SaveButton eventId={eventId}/>
              : <a href="/saved" className="press-haptic px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]">Merken</a>}
          </>
        )
      ) : state === 'free' ? (
        <>
          <V4Badge kind="free">Eintritt frei</V4Badge>
          <div className="flex-1"/>
          {onPlanClick ? (
            <button type="button" onClick={onPlanClick} data-track="plan_started_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold">Abend planen</button>
          ) : (
            <a href="/saved" data-track="plan_started_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold">Abend planen</a>
          )}
        </>
      ) : state === 'doorsale' ? (
        <>
          <V4Badge kind="doorsale">{priceAtDoor ? `Abendkasse · ${priceAtDoor}` : 'Abendkasse'}</V4Badge>
          <div className="flex-1"/>
          {onPlanClick ? (
            <button type="button" onClick={onPlanClick} data-track="plan_started_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold">Abend planen</button>
          ) : (
            <a href="/saved" data-track="plan_started_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold">Abend planen</a>
          )}
        </>
      ) : state === 'inplan' ? (
        <>
          <V4Badge kind="inplan">In deinem Plan</V4Badge>
          <div className="flex-1"/>
          {onPlanClick ? (
            <button type="button" onClick={onPlanClick} data-track="plan_opened_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold">Plan öffnen</button>
          ) : (
            <a href="/saved" data-track="plan_opened_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold">Plan öffnen</a>
          )}
        </>
      ) : state === 'soldout' ? (
        <>
          <V4Badge kind="soldout">Ausverkauft</V4Badge>
          <div className="flex-1"/>
          <a href="#similar-events" className="press-haptic px-5 py-3 rounded-full border border-[var(--v4-hairline-3)] text-sm font-semibold text-[var(--v4-ink)]">Ähnliche Events</a>
        </>
      ) : (
        <>
          <V4Badge kind="unknown">Kein Ticket bekannt</V4Badge>
          <div className="flex-1"/>
          {eventId
            ? <V4SaveButton eventId={eventId}/>
            : <a href="/saved" data-track="event_saved_mobile" className="press-haptic px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold">Merken</a>}
        </>
      )}
    </div>
  );
}
