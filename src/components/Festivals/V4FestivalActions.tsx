'use client';

/**
 * V4FestivalActions — Merken / Abend planen / Route öffnen actions for
 * the festival detail sidebar.
 *
 * Mirrors what V4FreeBox + V4UnknownBox give the event detail page, so
 * a festival behaves consistently with a normal event: you can always
 * start a plan from here, regardless of whether tickets exist.
 *
 * When the festival is linked to a parent_event_id, that event is
 * passed to V4PlanWizard as the initial pick. Otherwise the wizard
 * opens on its event-picker step.
 */

import { useState } from 'react';
import type { Event } from '@/types/events';
import { V4PlanWizard } from '@/components/Plans/v4';

interface V4FestivalActionsProps {
  /** Optional parent event for prefilling the plan wizard. */
  parentEvent?: Event | null;
  /**
   * Prefill values used when the festival has no parent event — the
   * wizard skips its "Welches Event?" step and lands on Tickets with
   * the festival's name, date, and city already filled in.
   */
  prefill?: { name?: string; plan_date?: string; accommodation_city?: string };
  /** Google-Maps-Directions-URL — omitted means no Route button. */
  mapsUrl?: string | null;
}

export function V4FestivalActions({ parentEvent, prefill, mapsUrl }: V4FestivalActionsProps) {
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setPlanSheetOpen(true)}
        data-track="plan_started"
        className="press-haptic mt-2 flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold"
      >
        Abend planen
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

      <div className="flex gap-2">
        <a
          href="/saved"
          data-track="event_saved"
          className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Merken
        </a>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-track="route_opened"
            className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Route
          </a>
        )}
      </div>

      {planSheetOpen && (
        <V4PlanWizard
          mode="sheet"
          initialEvent={parentEvent ?? undefined}
          initialPrefill={parentEvent ? undefined : prefill}
          onClose={() => setPlanSheetOpen(false)}
        />
      )}
    </>
  );
}
