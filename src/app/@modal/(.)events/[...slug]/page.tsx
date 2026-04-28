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
import { extractCity } from '@/lib/utils/city';
import { EventDetailV2 } from '@/components/Events/EventDetailV2';
import { EventSheet } from '@/components/Events/EventSheet';
import {
  parseSlugArray,
  resolveEvent,
  getVenue,
  getFriendsForEvent,
  getLineupForEvent,
  buildBundeslandHref,
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

  const [venue, friendsData, lineup] = await Promise.all([
    event.venue_id ? getVenue(event.venue_id) : Promise.resolve(null),
    getFriendsForEvent(event.id),
    getLineupForEvent(event.id),
  ]);

  const derivedCity = extractCity(
    { address: event.address, bundesland: event.bundesland },
    venue?.city,
  );
  const bundeslandHref = buildBundeslandHref(event.bundesland);

  return (
    <EventSheet>
      <EventDetailV2
        event={event}
        venue={venue}
        derivedCity={derivedCity}
        bundeslandHref={bundeslandHref}
        friends={friendsData.friends}
        rsvpTotals={friendsData.rsvpTotals}
        lineup={lineup}
      />
    </EventSheet>
  );
}
