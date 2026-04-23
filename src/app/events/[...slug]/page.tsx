import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Event } from '@/types/events';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { extractCity } from '@/lib/utils/city';
import { buildEventUrl, buildEventUrlV2, extractShortId } from '@/lib/utils/slugify';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import { EventDetailActions } from '@/components/Events/EventDetailActions';
import { EventImage } from '@/components/Events/EventImage';
import { RelatedEvents } from '@/components/Events/RelatedEvents';

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
    return getEventBySlugAndDate(parsed.slug, parsed.date);
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

function buildLocationLink(
  derivedCity: string | null,
  bundesland: string | null,
): string | null {
  if (derivedCity && bundesland) {
    return `/map?city=${encodeURIComponent(derivedCity)}&bundesland=${encodeURIComponent(bundesland)}`;
  }
  if (bundesland) {
    return `/map?bundesland=${encodeURIComponent(bundesland)}`;
  }
  return null;
}

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

  // 301 Redirect duplicates to their primary event FIRST — otherwise a
  // duplicate with a populated slug would first bounce to its own canonical
  // slug-URL and only then to the primary. One hop instead of two keeps
  // reminders/emails pointing straight at the canonical row.
  if (event.publish_status === 'duplicate' && event.duplicate_of) {
    redirect(`/events/${event.duplicate_of}`);
  }

  // Hide suppressed/needs_review events from public access
  if (event.publish_status === 'needs_review' || event.publish_status === 'suppressed') {
    notFound();
  }

  // 301 Redirect to canonical V2 URL whenever the current path isn't canonical.
  //
  // Covers three classes of non-canonical hits:
  //   1. Legacy 1-segment URLs `/events/{shortId}-{slug}` (old sitemap entries,
  //      Google index, email links, bookmarks) → /events/{plz}-{ort}/{slug}-{shortId}
  //   2. Full-UUID URLs `/events/641d90c0-7a97-4561-ab39-e9f4c191ca79` →
  //      canonical V2 form
  //   3. V2 URLs with the wrong prefix (user typed /events/1010-wien/... for an
  //      event that's actually in Eisenstadt) → canonical /events/7000-eisenstadt/...
  //
  // All three produce a single 301 hop so Google consolidates signal on the
  // V2 canonical URL. One redirect, not a chain.
  const canonicalPath = buildEventUrlV2(event);
  const currentPath = `/events/${slugArr.join('/')}`;
  if (currentPath !== canonicalPath) {
    redirect(canonicalPath);
  }

  // Load venue data if event has a venue_id
  const venue = event.venue_id ? await getVenue(event.venue_id) : null;

  // Derive city for Follow-City button and links
  const derivedCity = extractCity(
    { address: event.address, bundesland: event.bundesland },
    venue?.city,
  );

  // Only emit JSON-LD for fully published events (skip low confidence)
  const jsonLd = event.publish_status !== 'published_low_confidence' ? buildJsonLd(event) : null;
  const startTime = formatTime(event.start_date);
  const endTime = event.end_date ? formatTime(event.end_date) : null;
  const locationLink = buildLocationLink(derivedCity, event.bundesland);

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      <main className="min-h-screen bg-surface text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <EventDetailActions
            eventId={event.id}
            eventTitle={event.title}
            eventSlug={event.slug}
            city={derivedCity}
            bundesland={event.bundesland}
            venueId={event.venue_id}
            venueName={venue?.name}
            startDate={event.start_date}
          />

          <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-6">
            <EventImage
              src={event.image_url}
              category={event.category}
              title={event.title}
              alt={event.title}
              className="w-full h-full"
              wrapperClassName="w-full h-full"
              loading="eager"
              fetchPriority="high"
            />
          </div>

          <div className="space-y-4">
            {event.category && (
              <span className="inline-block bg-indigo-600/30 text-indigo-300 text-xs font-medium px-3 py-1 rounded-full border border-indigo-500/30">
                {event.category}
              </span>
            )}

            <h1 className="text-3xl font-bold leading-tight">{event.title}</h1>

            <div className="flex flex-col gap-2 text-gray-300">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">&#128197;</span>
                <span>
                  {formatDateLong(event.start_date)}
                  {startTime && ` um ${startTime}`}
                  {endTime && ` bis ${endTime}`}
                </span>
              </div>

              {(event.location_name || event.address) && (
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">&#128205;</span>
                  <span>
                    {/* Venue link */}
                    {venue && event.venue_id ? (
                      <Link
                        href={`/venues/${event.venue_id}`}
                        className="hover:text-white underline underline-offset-2 decoration-white/30 transition-colors"
                      >
                        {venue.name}
                      </Link>
                    ) : (
                      event.location_name
                    )}
                    {/* City/region link */}
                    {event.address && (
                      <>
                        {(venue || event.location_name) && ', '}
                        {locationLink ? (
                          <Link
                            href={locationLink}
                            className="hover:text-white underline underline-offset-2 decoration-white/30 transition-colors"
                          >
                            {event.address}
                          </Link>
                        ) : (
                          event.address
                        )}
                      </>
                    )}
                  </span>
                </div>
              )}

              {event.price_text && (
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">&#127881;</span>
                  <span>{event.price_text}</span>
                </div>
              )}

              {event.organizer && (
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">&#128101;</span>
                  <span>{event.organizer}</span>
                </div>
              )}
            </div>

            {event.description && (
              <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            )}

            {event.tags && event.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-4">
              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Zur Veranstaltung
                </a>
              )}
              {event.ticket_url && (
                <a
                  href={event.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Tickets kaufen
                </a>
              )}
            </div>
          </div>

          {/* Related Events */}
          <RelatedEvents eventId={event.id} />
        </div>
      </main>
    </>
  );
}
