/**
 * V4EventDetail — top-level v4 event detail composition.
 *
 * RSC. Caller (the route page.tsx) provides a pre-derived V4EventState
 * plus optional ticket fields. We compose hero + content + side-box + mobile
 * sticky-bar. Layout is two-col on desktop, single column on mobile with
 * the sticky-bar fixed at bottom.
 */

import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4EventDetailHero } from './V4EventDetailHero';
import { V4EventDetailContent } from './V4EventDetailContent';
import { V4SideBox } from './V4SideBox';
import { V4MobileStickyBar } from './V4MobileStickyBar';

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

export function V4EventDetail({
  event, state,
  provider, priceFrom, priceAtDoor, artistName,
  similar,
}: V4EventDetailProps) {
  const ticketUrl = event.ticket_url ?? undefined;

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
        />

        <aside className="order-first md:order-last md:sticky md:top-[88px] md:self-start">
          <V4SideBox
            state={state}
            provider={provider}
            priceFrom={priceFrom}
            ticketUrl={ticketUrl}
            priceAtDoor={priceAtDoor}
            artistName={artistName}
          />
        </aside>
      </div>

      <V4MobileStickyBar
        state={state}
        provider={provider}
        priceFrom={priceFrom}
        ticketUrl={ticketUrl}
        priceAtDoor={priceAtDoor}
      />
    </div>
  );
}
