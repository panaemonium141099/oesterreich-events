/**
 * Intercepting route — `(.)events/[...slug]` inside the `@modal` slot.
 *
 * Renders only when the user soft-navigates to `/events/...` from a
 * sibling root-level route (most importantly `/map`, but also `/feed`,
 * `/saved`, `/`, etc.). The map (or whatever was rendering as
 * `children`) stays mounted; this page renders into the parallel
 * `@modal` slot above it as a sheet/drawer.
 *
 * On a hard nav (refresh, direct URL, share link) the modal slot
 * resolves to `app/@modal/default.tsx` (null) and the regular
 * `app/events/[...slug]/page.tsx` renders the full page instead.
 *
 * Both surfaces use the same data loaders from
 * `src/lib/events/event-detail-loaders.ts` so they can never drift.
 *
 * Sheet quirks:
 *   - we DON'T 308-redirect non-canonical URLs here. Redirects in an
 *     intercepted route would force the browser to follow the new URL,
 *     unmount the underlying page (= the map), and re-mount it on
 *     return — exactly the behaviour we're trying to avoid. The map
 *     bubble already builds canonical URLs via `buildEventUrlV2` so
 *     this code path only sees canonical-shaped paths in practice.
 *   - we DON'T emit JSON-LD. Google indexes the full event page (which
 *     does emit it). The sheet is a soft-UX surface for logged-in
 *     navigation; SEO tools never see it.
 *   - we DO show suppressed/duplicate events with a small banner —
 *     hiding them would be confusing if a stale group invite link
 *     resolves through here. (Out of scope today; for now we 404
 *     them inside the sheet too.)
 */

import { notFound } from 'next/navigation';
import { V4EventDetail } from '@/components/Events/v4';
import { V4RelatedEvents } from '@/components/Events/v4/V4RelatedEvents';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import { EventSheet } from '@/components/Events/EventSheet';
import { ModalShell } from '@/components/Layout/ModalShell';
import {
  parseSlugArray,
  resolveEvent,
  getVenue,
  getLineupForEvent,
} from '@/lib/events/event-detail-loaders';

export const revalidate = 3600;
export const dynamicParams = true;

export default async function InterceptedEventPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug: slugArr } = await params;
  const event = await resolveEvent(parseSlugArray(slugArr));

  // Sheet doesn't try to be clever with redirects (see header comment).
  // Treat anything not directly viewable as 404 inside the sheet — the
  // user can refresh to fall back to the full page handler which has
  // the redirect chains.
  if (
    !event ||
    event.publish_status === 'duplicate' ||
    event.publish_status === 'needs_review' ||
    event.publish_status === 'suppressed'
  ) {
    notFound();
  }

  // Personal context (saved/match overlay, matchedArtistName) is NOT
  // loaded server-side — same reason as the full-page handler: this
  // route uses ISR (`revalidate=3600`) and Next.js 16 throws "Page
  // changed from static to dynamic at runtime, reason: cookies" if a
  // dynamic API is touched during the static prerender pass.
  // V4EventDetail fetches the personal overlay client-side from
  // /api/events/[id]/personal-context.
  await Promise.all([
    event.venue_id ? getVenue(event.venue_id) : Promise.resolve(null),
    getLineupForEvent(event.id),
  ]);

  const state = deriveEventState(event, {
    savedEventIds: new Set(),
    followedArtistIds: new Set(),
    artistMatchEventIds: new Set(),
    lineupMatchEventIds: new Set(),
  });
  const provider = event.source_name ?? undefined;
  const priceFrom =
    event.price_min != null ? `€ ${event.price_min}` :
    event.price_text ?? undefined;
  const priceAtDoor = event.price_text ?? undefined;

  // fn-15.5 fix (round 2): the parallel `@modal` slot lives at root-
  // layout level alongside `children`, so it does NOT inherit the
  // authenticated route's AppShell (AuthProvider, SavedEvents, etc.).
  // Without ModalShell, opening an event sheet from /feed, /map, /saved,
  // etc. would render the modal with anon-fallback auth.
  return (
    <ModalShell>
      <EventSheet>
        <V4EventDetail
          event={event}
          state={state}
          provider={provider}
          priceFrom={priceFrom}
          priceAtDoor={priceAtDoor}
        />
        {/* Gleiche Sektion wie auf der Voll-Seite (app/events/[...slug]).
            Ohne sie sah kein in-App-Navigierender je „Ähnliche Events" —
            jede Soft-Navigation landet hier im Sheet, nur Hard-Loads
            (Google, F5) treffen die Voll-Seite. Die Related-Karten
            (/events/…) re-intercepten in dieses Sheet; die Hub-Links
            (/gemeinde, /{bundesland}, /entdecken) fängt EventSheet ab
            (Stuck-Slot-Quirk, siehe dort). */}
        <V4RelatedEvents event={event}/>
      </EventSheet>
    </ModalShell>
  );
}
