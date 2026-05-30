'use client';

/**
 * V4EventDetail — top-level v4 event detail composition.
 *
 * Client component (Phase 5): owns planSheetOpen state to mount the
 * V4PlanWizard sheet overlay when the user clicks any "Abend planen"
 * or "Plan öffnen" CTA. The wizard is prefilled with the current event.
 *
 * Caller (the route page.tsx) provides a pre-derived V4EventState
 * plus optional ticket fields. Layout is two-col on desktop, single
 * column on mobile with the sticky-bar fixed at bottom.
 *
 * Personal overlay (saved / artist-match / lineup-match badges + the
 * matched artist name on V4TicketBox) is loaded client-side from
 * /api/events/[id]/personal-context after hydration. Calling cookies()
 * during the static prerender pass of the ISR-cached event detail page
 * would throw "Page changed from static to dynamic at runtime" — see
 * the route handler at src/app/api/events/[id]/personal-context/route.ts.
 */

import { useEffect, useState } from 'react';
import type { Event } from '@/types/events';
import type { DeriveCtx, V4EventState } from '@/lib/v4/derive-event-state';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import { isLocationApproximate, isLocationTrusted } from '@/lib/utils/location-trust';
import { V4EventDetailHero } from './V4EventDetailHero';
import { V4EventDetailContent } from './V4EventDetailContent';
import { V4SideBox } from './V4SideBox';
import { V4MobileStickyBar } from './V4MobileStickyBar';
import { V4PlanWizard } from '@/components/Plans/v4';

interface V4EventDetailProps {
  event: Event;
  state: V4EventState;
  provider?: string;
  priceFrom?: string;
  priceAtDoor?: string;
  artistName?: string;
  /** Pre-rendered similar-events grid; mounted under #similar-events anchor. */
  similar?: React.ReactNode;
}

interface PersonalContextResponse {
  signedIn: boolean;
  saved?: boolean;
  artistMatch?: boolean;
  lineupMatch?: boolean;
  matchedArtistName?: string;
}

export function V4EventDetail({
  event, state: initialState,
  provider, priceFrom, priceAtDoor, artistName: initialArtistName,
  similar,
}: V4EventDetailProps) {
  const ticketUrl = event.ticket_url ?? undefined;
  // Gate the Route affordance: only emit a Maps URL when the coordinates are
  // trustworthy (specific address OR venue-level geocoding confidence). For the
  // ~30% of events that sit on a town/gemeinde-center fallback coord, we pass
  // `locationApprox=true` instead so the side-box renders an "Ortsangabe
  // ungefähr" pill — never a routing link that would send users into the void.
  const coordsTrusted = isLocationTrusted(event);
  const coordsApproximate = isLocationApproximate(event);
  const mapsUrl = coordsTrusted
    ? `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
    : undefined;
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [state, setState] = useState<V4EventState>(initialState);
  const [artistName, setArtistName] = useState<string | undefined>(initialArtistName);

  // Personal overlay: the server-rendered HTML reflects the anon view
  // (no badges, no matched artist) so the page stays ISR-cacheable.
  // After hydration we fetch the authed context and re-derive state.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${event.id}/personal-context`, { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<PersonalContextResponse> : null)
      .then(ctx => {
        if (cancelled || !ctx || !ctx.signedIn) return;
        const derivedCtx: DeriveCtx = {
          savedEventIds: ctx.saved ? new Set([event.id]) : new Set(),
          followedArtistIds: new Set(),
          artistMatchEventIds: ctx.artistMatch ? new Set([event.id]) : new Set(),
          lineupMatchEventIds: ctx.lineupMatch ? new Set([event.id]) : new Set(),
        };
        setState(deriveEventState(event, derivedCtx));
        if (ctx.matchedArtistName) setArtistName(ctx.matchedArtistName);
      })
      .catch(() => { /* swallow — anon state is the safe fallback */ });
    return () => { cancelled = true; };
  }, [event]);

  return (
    <div className="bg-[var(--v4-surface)] min-h-screen">
      <V4EventDetailHero
        title={event.title}
        startDate={event.start_date}
        locationName={event.location_name}
        city={event.bundesland}
        imageUrl={event.image_url}
      />

      <div className="max-w-[1180px] mx-auto px-5 md:px-14 py-8 md:py-12 grid grid-cols-1 md:grid-cols-[1fr_400px] gap-8 md:gap-12 pb-[120px] md:pb-12">
        <V4EventDetailContent
          description={event.description}
          tags={event.tags}
          hasSimilar={Boolean(similar)}
          similarChildren={similar}
          sourceName={event.source_name}
          sourceUrl={event.source_url}
        />

        <aside className="order-first md:order-last md:sticky md:top-[88px] md:self-start">
          <V4SideBox
            eventId={event.id}
            state={state}
            provider={provider}
            priceFrom={priceFrom}
            ticketUrl={ticketUrl}
            priceAtDoor={priceAtDoor}
            artistName={artistName}
            mapsUrl={mapsUrl}
            locationApprox={coordsApproximate}
            onPlanClick={() => setPlanSheetOpen(true)}
            priceText={event.price_text}
            priceMin={event.price_min}
            priceMax={event.price_max}
            priceTier={event.price_tier}
          />
        </aside>
      </div>

      <V4MobileStickyBar
        state={state}
        provider={provider}
        priceFrom={priceFrom}
        ticketUrl={ticketUrl}
        priceAtDoor={priceAtDoor}
        onPlanClick={() => setPlanSheetOpen(true)}
      />

      {planSheetOpen && (
        <V4PlanWizard
          mode="sheet"
          initialEvent={event}
          onClose={() => setPlanSheetOpen(false)}
        />
      )}
    </div>
  );
}
