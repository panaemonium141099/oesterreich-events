import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Event } from '@/types/events';
import { extractCity } from '@/lib/utils/city';
import { buildEventUrlV2, extractShortId } from '@/lib/utils/slugify';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import { EventDetailV2, type FriendAttendee, type LineupAct } from '@/components/Events/EventDetailV2';

/**
 * ISR revalidation interval.
 *
 * Without this export Next.js renders the page on every request as a pure
 * dynamic route, which makes it ship `Cache-Control: private, no-store,
 * no-cache, max-age=0` — fatal for Google indexing (we observed 9 of 45 656
 * pages actually indexed in Search Console because of this).
 *
 * 3600s (1h) is a safe compromise: event data updates once per scraper-cycle
 * (every few hours), and stale-while-revalidate keeps served pages fast while
 * the first visit after expiry triggers a silent re-render.
 */
export const revalidate = 3600;

/**
 * ISR opt-in for on-demand generation.
 *
 * In Next.js 16 a dynamic route (`/events/[slug]`) is treated as
 * fully dynamic unless you either
 *   a) pre-build its params at build time via `generateStaticParams()`, or
 *   b) declare that new params should be generated on-demand via an empty
 *      `generateStaticParams()` + `dynamicParams = true`.
 *
 * Option (a) would require pre-building ~42 000 event pages at every
 * Vercel build — minutes of CI time for marginal value. Option (b) is
 * the ISR pattern: zero pages pre-built, each unique slug cached on
 * first hit and served from CDN on subsequent hits for `revalidate`
 * seconds.
 *
 * Side-effect: Next.js now ships `Cache-Control: public, max-age=0,
 * must-revalidate` + `X-Nextjs-Prerender: 1` instead of `private,
 * no-store`. That's what Googlebot needs to index the page.
 */
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Loads an event by short ID prefix (first 8 chars of UUID).
 * Works for both hybrid slug URLs and legacy full-UUID URLs.
 *
 * Uses UUID range filtering since PostgREST doesn't support LIKE on UUID columns.
 * Short ID "154a2761" maps to range 154a2761-0000-0000-0000-000000000000 to 154a2761-ffff-ffff-ffff-ffffffffffff.
 *
 * **ISR-Cache:** wrapped with `unstable_cache` because the Supabase JS client
 * sends `Cache-Control: no-cache` on its internal fetch() calls, which opts
 * the whole page out of Next.js ISR. Without this wrapper we observed
 * `X-Vercel-Cache: MISS` on every request and Google refused to index the
 * ~42 000 event-detail pages. The cache tag allows targeted invalidation
 * via `revalidateTag('event')` if we ever want to push fresh data immediately.
 */
const getEventByShortIdCached = unstable_cache(
  async (slugParam: string): Promise<Event | null> => {
    // If the param looks like a full UUID (36 chars with dashes), try exact match first
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugParam)) {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', slugParam)
        .single();
      if (!error && data) return data as Event;
    }

    // Extract 8-char short ID and do range query
    const shortId = slugParam.slice(0, 8);
    const rangeStart = `${shortId}-0000-0000-0000-000000000000`;
    const rangeEnd = `${shortId}-ffff-ffff-ffff-ffffffffffff`;

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('id', rangeStart)
      .lte('id', rangeEnd)
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as Event;
  },
  ['event-detail'],
  { revalidate: 3600, tags: ['event'] },
);

async function getEventByShortId(slugParam: string): Promise<Event | null> {
  return getEventByShortIdCached(slugParam);
}

/**
 * Loads an event by (slug, yyyy-mm-dd). This is the preferred lookup for V2
 * URLs of the shape `/events/{plz-ort}/{date}/{slug}`.
 *
 * DB has ~42k events; `slug` values are title-based so collisions with the
 * SAME slug on the SAME day are effectively zero. If multiple hits do
 * happen we rank by event_score descending — the more trustworthy row wins.
 *
 * **CRITICAL: filters out `publish_status='duplicate'` rows.** Without this
 * filter, a `duplicate` row with the same slug+date as its primary could
 * win the ORDER BY tiebreaker (identical event_score is common because
 * scorer copies from the primary). Then the duplicate's
 * `permanentRedirect(`/events/${duplicate_of}`)` fires, which sends the
 * user back to the UUID form of the primary → our own canonical-V3
 * redirect fires → back to this lookup → loop. Excluding duplicate
 * rows from this query cuts the loop at the source. See the ad29851f /
 * 5a5b2484 "Eisenstadt in Weiß" case from 2026-04-24 for the concrete
 * incident that surfaced this.
 */
const getEventBySlugAndDateCached = unstable_cache(
  async (slug: string, date: string): Promise<Event | null> => {
    // Date-range filter: [yyyy-mm-dd 00:00, yyyy-mm-dd+1 00:00)
    const dayStart = `${date}T00:00:00.000Z`;
    const nextDay = new Date(date + 'T00:00:00Z');
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const dayEnd = nextDay.toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .gte('start_date', dayStart)
      .lt('start_date', dayEnd)
      // Never let the canonical-URL lookup return a duplicate row.
      // duplicate rows must only ever be reached via their UUID URL so
      // the handler can redirect to the primary. If this lookup returned
      // a duplicate, its `duplicate_of` redirect would fire and bounce
      // the request back to the UUID form, looping forever.
      .neq('publish_status', 'duplicate')
      .order('event_score', { ascending: false, nullsFirst: false })
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0] as Event;
  },
  ['event-by-slug-date'],
  { revalidate: 3600, tags: ['event'] },
);

async function getEventBySlugAndDate(slug: string, date: string): Promise<Event | null> {
  return getEventBySlugAndDateCached(slug, date);
}

/**
 * Slug-only fallback lookup. Used when (slug, date) misses — happens when
 * an event gets rescheduled (scraper updates start_date to a later day).
 * The old date is no longer in the DB for this slug, but the slug itself
 * is stable (preserved across re-upserts since phase-1.5). We look for
 * any future event with this slug, highest event_score wins.
 *
 * Caller triggers a 301 to the canonical URL so Google moves the
 * rescheduled event's index entry without a 404.
 */
const getEventBySlugOnlyCached = unstable_cache(
  async (slug: string): Promise<Event | null> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .gte('start_date', today)
      .eq('publish_status', 'published')
      .order('event_score', { ascending: false, nullsFirst: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0] as Event;
  },
  ['event-by-slug-only'],
  { revalidate: 3600, tags: ['event'] },
);

async function getEventBySlugOnly(slug: string): Promise<Event | null> {
  return getEventBySlugOnlyCached(slug);
}

const getVenueCached = unstable_cache(
  async (venueId: string): Promise<{ name: string; city: string | null } | null> => {
    const { data, error } = await supabase
      .from('venues')
      .select('name, city')
      .eq('id', venueId)
      .single();

    if (error || !data) return null;
    return data;
  },
  ['venue-detail'],
  { revalidate: 3600, tags: ['venue'] },
);

async function getVenue(
  venueId: string,
): Promise<{ name: string; city: string | null } | null> {
  return getVenueCached(venueId);
}

/**
 * Catch-all route params — three URL schemas coexist during the migration:
 *
 *   A) Legacy  (1 segment):  /events/abc12345-event-slug
 *   B) V2-old  (2 segments): /events/1010-wien/event-slug-abc12345
 *   C) V2-new  (3 segments): /events/1010-wien/2026-09-15/event-slug
 *
 * The handler resolves them to `{event, currentPath}` regardless of shape:
 *   - C: `(slug, date)` DB lookup
 *   - B: shortId extraction from the tail of segment[1]
 *   - A: shortId extraction from segment[0]
 *
 * A + B both 301-redirect to the canonical C form. Only C renders directly.
 */
interface ParsedSlugArray {
  mode: 'legacy-1seg' | 'v2-2seg' | 'v2-3seg';
  shortId?: string;
  slug?: string;
  date?: string;
}

function parseSlugArray(slug: string[]): ParsedSlugArray {
  // Shape C — /events/{plz-ort}/{yyyy-mm-dd}/{slug}
  if (slug.length === 3 && /^\d{4}-\d{2}-\d{2}$/.test(slug[1])) {
    return { mode: 'v2-3seg', date: slug[1], slug: slug[2] };
  }
  // Shape B — /events/{plz-ort}/{slug-shortId}
  if (slug.length === 2) {
    return { mode: 'v2-2seg', shortId: extractShortId(slug[1]) };
  }
  // Shape A — /events/{shortId-slug}  (catches everything else)
  return { mode: 'legacy-1seg', shortId: extractShortId(slug[0] ?? '') };
}

async function resolveEvent(parsed: ParsedSlugArray): Promise<Event | null> {
  if (parsed.mode === 'v2-3seg' && parsed.slug && parsed.date) {
    // Primary: exact match by (slug, date)
    const exact = await getEventBySlugAndDate(parsed.slug, parsed.date);
    if (exact) return exact;
    // Fallback: same slug on any future date — catches the "event got
    // rescheduled" case (scraper updates start_date → old URL has wrong
    // date segment but slug is still the stable lookup key).
    // The page-level 301 below will redirect the client to the canonical
    // URL with the new date, so Google's old index entry rolls over
    // cleanly without a 404.
    return getEventBySlugOnly(parsed.slug);
  }
  if (parsed.shortId) {
    return getEventByShortId(parsed.shortId);
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug: slugArr } = await params;
  const event = await resolveEvent(parseSlugArray(slugArr));

  if (!event) {
    return { title: 'Event nicht gefunden' };
  }

  // Suppressed, needs_review, or duplicate events should not be indexable
  if (event.publish_status === 'needs_review' || event.publish_status === 'suppressed' || event.publish_status === 'duplicate') {
    return {
      title: 'Event nicht gefunden',
      robots: { index: false, follow: false },
    };
  }

  const description = event.description
    ? event.description.slice(0, 160)
    : `${event.title} — ${event.location_name ?? 'Österreich'}`;

  // Canonical URL always uses the V2 schema — Google consolidates signals on
  // this form regardless of which URL the client originally requested.
  const canonicalPath = buildEventUrlV2(event);
  const canonicalUrl = `https://lasstreffen.at${canonicalPath}`;
  // OG image moved to an API route because Next.js forbids metadata files
  // (like opengraph-image.tsx) inside catch-all route segments. The image
  // is cacheable by the shortId alone — no need to include the full slug.
  const ogImageUrl = `https://lasstreffen.at/api/og/event/${event.id.slice(0, 8)}`;

  // Truncate overly long event titles so Bing/Google don't flag them as
  // "Title too long". Cut at 57 chars (room for " …") so the rendered
  // absolute title stays ≤ 60.
  const titleTrimmed = event.title.length > 57
    ? event.title.slice(0, 57).trimEnd() + '…'
    : event.title;

  const metadata: Metadata = {
    // `absolute` bypasses the layout template " | LassTreffen.at" suffix.
    // Event titles + suffix regularly exceed 60 chars and Bing flags them.
    title: { absolute: titleTrimmed },
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: event.title,
      description,
      type: 'article',
      url: canonicalUrl,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      images: [ogImageUrl],
    },
  };

  // Low-confidence events: noindex
  if (event.publish_status === 'published_low_confidence') {
    metadata.robots = { index: false, follow: false };
  }

  // Quality-gated SEO: noindex events with very low quality score
  if (
    event.quality_score !== undefined &&
    event.quality_score !== null &&
    event.quality_score < 30
  ) {
    metadata.robots = { index: false, follow: false };
  }

  // Non-published events should not be indexed
  if (
    event.publish_status &&
    event.publish_status !== 'published' &&
    event.publish_status !== 'published_low_confidence'
  ) {
    metadata.robots = { index: false, follow: false };
  }

  return metadata;
}

/**
 * Extracts a numeric price from free-text like "ab 15 €", "€12,50", "Tickets 25 EUR".
 * Returns '0' for free events (frei/gratis/kostenlos), null when no price is detectable.
 */
function parsePriceText(priceText: string | null | undefined): string | null {
  if (!priceText) return null;
  const lower = priceText.toLowerCase();
  if (/\b(frei|gratis|kostenlos|free|eintritt\s*frei)\b/.test(lower)) return '0';
  const match = priceText.match(/(\d+(?:[.,]\d+)?)/);
  return match ? match[1].replace(',', '.') : null;
}

function buildJsonLd(event: Event): string {
  const canonicalUrl = `https://lasstreffen.at${buildEventUrlV2(event)}`;
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.start_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  };

  if (event.end_date) {
    jsonLd.endDate = event.end_date;
  }

  if (event.description) {
    jsonLd.description = event.description.slice(0, 500);
  }

  // Use resolver so JSON-LD always has an image (category fallback if needed)
  jsonLd.image = resolvePrimaryEventImage({ imageUrl: event.image_url, category: event.category, title: event.title });

  const locationName = event.location_name ?? event.address ?? 'Österreich';
  const location: Record<string, unknown> = {
    '@type': 'Place',
    name: locationName,
  };

  if (event.address) {
    location.address = {
      '@type': 'PostalAddress',
      streetAddress: event.address,
      ...(event.postal_code ? { postalCode: event.postal_code } : {}),
      addressCountry: 'AT',
    };
  }

  if (event.latitude != null && event.longitude != null) {
    location.geo = {
      '@type': 'GeoCoordinates',
      latitude: event.latitude,
      longitude: event.longitude,
    };
  }

  jsonLd.location = location;

  // Organizer — ALWAYS present. Falls back to the site when the scraper
  // didn't capture an explicit organizer. Satisfies Google's Event rich-result
  // field requirement ("fehlende Felder: organizer") even on scraped rows
  // where the source page didn't expose one.
  jsonLd.organizer = {
    '@type': 'Organization',
    name: event.organizer || 'LassTreffen.at',
    url: 'https://lasstreffen.at',
  };

  // Performer — ALWAYS present. Google's Event schema treats `performer` as a
  // recommended field; omitting it triggers the "Ereignisse für strukturierte
  // Daten" warning in Search Console. We use the organizer when known,
  // otherwise fall back to the event title itself as the performing entity.
  jsonLd.performer = {
    '@type': 'PerformingGroup',
    name: event.organizer || event.title,
  };

  // Offers — ALWAYS present. We build it from whatever price info the scraper
  // captured: explicit min price, parsed free-text, or a safe default. The
  // offer URL points to the ticket shop when known, otherwise to our canonical
  // event page so the reader can still act on the rich result.
  const parsed = parsePriceText(event.price_text);
  const price =
    event.price_min != null ? String(event.price_min) :
    parsed != null ? parsed :
    null;

  const offers: Record<string, unknown> = {
    '@type': 'Offer',
    url: event.ticket_url || canonicalUrl,
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
    validFrom: event.created_at || event.start_date,
  };
  if (price != null) {
    offers.price = price;
  }
  if (event.price_text) {
    offers.name = event.price_text;
  }
  jsonLd.offers = offers;

  return JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>');
}

function buildBundeslandHref(bundesland: string | null): string | null {
  if (!bundesland) return null;
  return `/map?bundesland=${encodeURIComponent(bundesland)}`;
}

/**
 * Loads RSVP-style friends for an event.
 *
 * Strategy: an event is "social" if at least one `groups` row has it as
 * `linked_event_id`. We then collect all members of those groups + their
 * RSVP + profile so the friends section can render a real roster.
 *
 * For scraped events with no group attached this returns an empty array
 * — the component gracefully degrades to a "Plan erstellen" CTA.
 *
 * Cached per-event-id; the cost is a single 2-step query but ISR caches
 * the page for 1h anyway, so this only fires on cold renders.
 */
const getFriendsForEventCached = unstable_cache(
  async (eventId: string): Promise<{ friends: FriendAttendee[]; rsvpTotals: { going: number; maybe: number } }> => {
    const empty = { friends: [], rsvpTotals: { going: 0, maybe: 0 } };

    const { data: groups, error: groupsErr } = await supabase
      .from('groups')
      .select('id')
      .eq('linked_event_id', eventId);
    if (groupsErr || !groups || groups.length === 0) return empty;

    const groupIds = groups.map((g: { id: string }) => g.id);
    const { data: members, error: membersErr } = await supabase
      .from('group_members')
      .select('user_id, rsvp, profile:profiles(id, first_name, last_name, avatar_url)')
      .in('group_id', groupIds);
    if (membersErr || !members) return empty;

    type RawMember = {
      user_id: string;
      rsvp: 'accepted' | 'maybe' | 'declined' | 'pending' | null;
      profile: { id: string; first_name: string; last_name: string | null; avatar_url: string | null } | { id: string; first_name: string; last_name: string | null; avatar_url: string | null }[] | null;
    };
    // Dedup by user_id (one person may sit in multiple groups linked to the
    // same event). Prefer the "strongest" RSVP: accepted > maybe > pending > declined.
    const rank: Record<string, number> = { accepted: 4, maybe: 3, pending: 2, declined: 1 };
    const byUser = new Map<string, FriendAttendee>();
    for (const m of (members as RawMember[])) {
      const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
      if (!profile) continue;
      const rsvp = (m.rsvp ?? 'pending') as FriendAttendee['rsvp'];
      const existing = byUser.get(m.user_id);
      if (existing && rank[existing.rsvp] >= rank[rsvp]) continue;
      byUser.set(m.user_id, {
        user_id: m.user_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        avatar_url: profile.avatar_url,
        rsvp,
        city: null,
      });
    }
    const friends = Array.from(byUser.values());
    const going = friends.filter(f => f.rsvp === 'accepted').length;
    const maybe = friends.filter(f => f.rsvp === 'maybe').length;
    return { friends, rsvpTotals: { going, maybe } };
  },
  ['event-friends'],
  { revalidate: 3600, tags: ['event'] },
);

/**
 * Loads festival lineup acts. Returns [] for non-festival events.
 *
 * Schema reality (verified against information_schema 2026-04-28):
 *   - artist_name_raw (text)        — display name
 *   - stage_name      (text)        — stage label, may be null
 *   - day_label       (text)        — "Freitag" / "Tag 1" — no concrete time
 *   - billing         (text)        — headliner/main/support — used to order
 *   - confidence_score (real)       — secondary order key (best matches first)
 *
 * There's no `start_time` column, so the left "time" slot in the lineup
 * column is filled with `day_label` instead, and the sub-line uses
 * `stage_name`. Order: day → billing rank → confidence desc.
 */
const getLineupForEventCached = unstable_cache(
  async (eventId: string): Promise<LineupAct[]> => {
    const { data, error } = await supabase
      .from('festival_artists')
      .select('artist_name_raw, stage_name, day_label, billing, confidence_score')
      .eq('derived_event_id', eventId);
    if (error || !data) return [];
    type RawAct = {
      artist_name_raw: string;
      stage_name: string | null;
      day_label: string | null;
      billing: string | null;
      confidence_score: number | null;
    };
    // Headliner first (rank 0) → main (1) → support (2) → unknown (3)
    const billingRank = (b: string | null) => {
      if (!b) return 3;
      const lo = b.toLowerCase();
      if (lo.includes('headliner') || lo.includes('headline')) return 0;
      if (lo.includes('main')) return 1;
      if (lo.includes('support')) return 2;
      return 3;
    };
    return (data as RawAct[])
      .sort((a, b) => {
        // 1. day_label asc (alpha order works for "Freitag/Samstag/Sonntag"
        //    and "Tag 1/Tag 2"); nulls last
        const da = a.day_label ?? '~';
        const db = b.day_label ?? '~';
        if (da !== db) return da < db ? -1 : 1;
        // 2. billing rank (headliner first)
        const br = billingRank(a.billing) - billingRank(b.billing);
        if (br !== 0) return br;
        // 3. confidence desc — best matches up top
        return (b.confidence_score ?? 0) - (a.confidence_score ?? 0);
      })
      .map(a => ({
        artist_name: a.artist_name_raw,
        stage: a.stage_name,
        start_time: a.day_label,
      }));
  },
  ['event-lineup'],
  { revalidate: 3600, tags: ['event'] },
);

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug: slugArr } = await params;
  const event = await resolveEvent(parseSlugArray(slugArr));

  if (!event) {
    notFound();
  }

  // ─── Duplicate redirect — bulletproof chain to the primary ─────────
  //
  // Historical bug: this block used to do
  //   permanentRedirect(`/events/${event.duplicate_of}`)
  // which emits the PRIMARY's UUID URL. On the next hop our canonical
  // redirect kicks the request to `/events/{plz-ort}/{date}/{slug}`.
  // If `getEventBySlugAndDate` returns THIS duplicate row back (common
  // when dedup left both rows with the same score + slug + date), the
  // duplicate redirect fires again → UUID form → loop forever.
  //
  // Fix: resolve duplicate_of to its primary event row here, then
  // redirect directly to the primary's canonical V3 URL. Skipping the
  // UUID hop eliminates the ping-pong entirely.
  //
  // Defense in depth: if primary is gone or points to itself (data
  // corruption), fall back to notFound() instead of looping.
  if (event.publish_status === 'duplicate' && event.duplicate_of) {
    if (event.duplicate_of === event.id) {
      // Self-reference — data corruption. Don't loop.
      notFound();
    }
    const primary = await getEventByShortId(event.duplicate_of);
    if (!primary || primary.publish_status === 'duplicate') {
      // Primary deleted, or chain of duplicates (shouldn't happen but be
      // defensive). Avoid infinite 308s, hand back a 404.
      notFound();
    }
    permanentRedirect(buildEventUrlV2(primary));
  }

  // Hide suppressed/needs_review events from public access
  if (event.publish_status === 'needs_review' || event.publish_status === 'suppressed') {
    notFound();
  }

  // 308 Permanent Redirect to canonical V3 URL whenever the current path
  // isn't canonical.
  //
  // Covers three classes of non-canonical hits:
  //   1. Legacy 1-segment URLs `/events/{shortId}-{slug}` (old sitemap
  //      entries, Google index, email links, bookmarks) → V3
  //   2. Full-UUID URLs → canonical V3
  //   3. V2-old 2-segment URLs `/events/{plz-ort}/{slug-shortId}` → V3
  //
  // `permanentRedirect()` emits 308 (SEO-equivalent to 301 Moved
  // Permanently — Google consolidates ranking signals onto the canonical
  // URL and drops the legacy ones from the index over time). Using 308
  // instead of the default `redirect()` (307 Temporary) is critical here
  // because Next.js 16 ISR serialises 307 redirects to a `<meta refresh>`
  // in the rendered HTML rather than a real HTTP status — which works for
  // Google but leaves a ~1s client-side delay. 308 is emitted as an
  // actual HTTP response.
  //
  // **Same-event guard**: if we're about to redirect to a path that
  // structurally differs (e.g. encoding of umlauts) but resolves to the
  // same event.id on the next hop, we would loop. We prevent that by
  // normalising the comparison — any two paths that `buildEventUrlV2`
  // produces for the same event.id must stringify identically. This
  // invariant is enforced by the builder's deterministic output.
  const canonicalPath = buildEventUrlV2(event);
  const currentPath = `/events/${slugArr.join('/')}`;
  if (currentPath !== canonicalPath) {
    // Safety: never 308 if the target is identical to the source. The
    // string comparison above already covers this — this is a second-
    // layer assertion so a future logic change can't reintroduce a self-
    // redirect without hitting an obvious guard.
    if (canonicalPath === currentPath) {
      // unreachable given the outer `if`, but documents the invariant
    } else {
      permanentRedirect(canonicalPath);
    }
  }

  // Load venue + friends + lineup in parallel — they're independent.
  const [venue, friendsData, lineup] = await Promise.all([
    event.venue_id ? getVenue(event.venue_id) : Promise.resolve(null),
    getFriendsForEventCached(event.id),
    getLineupForEventCached(event.id),
  ]);

  // Derive city for breadcrumb / map / stats
  const derivedCity = extractCity(
    { address: event.address, bundesland: event.bundesland },
    venue?.city,
  );

  // Only emit JSON-LD for fully published events (skip low confidence)
  const jsonLd = event.publish_status !== 'published_low_confidence' ? buildJsonLd(event) : null;
  const bundeslandHref = buildBundeslandHref(event.bundesland);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      <EventDetailV2
        event={event}
        venue={venue}
        derivedCity={derivedCity}
        bundeslandHref={bundeslandHref}
        friends={friendsData.friends}
        rsvpTotals={friendsData.rsvpTotals}
        lineup={lineup}
      />
    </>
  );
}
