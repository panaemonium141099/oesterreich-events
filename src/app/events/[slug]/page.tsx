import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Event } from '@/types/events';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { extractCity } from '@/lib/utils/city';
import { buildEventUrl } from '@/lib/utils/slugify';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import { EventDetailActions } from '@/components/Events/EventDetailActions';
import { EventImage } from '@/components/Events/EventImage';
import { RelatedEvents } from '@/components/Events/RelatedEvents';

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
 */
async function getEventByShortId(slugParam: string): Promise<Event | null> {
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
}

async function getVenue(
  venueId: string,
): Promise<{ name: string; city: string | null } | null> {
  const { data, error } = await supabase
    .from('venues')
    .select('name, city')
    .eq('id', venueId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: slugParam } = await params;
  const event = await getEventByShortId(slugParam);

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

  const canonicalPath = buildEventUrl(event.id, event.slug);
  const canonicalUrl = `https://lasstreffen.at${canonicalPath}`;
  const ogImageUrl = `${canonicalUrl}/opengraph-image`;

  const metadata: Metadata = {
    title: event.title,
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

function buildJsonLd(event: Event): string {
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

  if (event.organizer) {
    jsonLd.organizer = {
      '@type': 'Organization',
      name: event.organizer,
    };
  }

  if (event.price_text) {
    jsonLd.offers = {
      '@type': 'Offer',
      name: event.price_text,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    };
  }

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
  params: Promise<{ slug: string }>;
}) {
  const { slug: slugParam } = await params;
  const event = await getEventByShortId(slugParam);

  if (!event) {
    notFound();
  }

  // 301 Redirect to canonical slug URL if current URL is not canonical
  const canonicalPath = buildEventUrl(event.id, event.slug);
  const currentPath = `/events/${slugParam}`;
  if (event.slug && currentPath !== canonicalPath) {
    redirect(canonicalPath);
  }

  // 301 Redirect duplicates to their primary event
  if (event.publish_status === 'duplicate' && event.duplicate_of) {
    redirect(`/events/${event.duplicate_of}`);
  }

  // Hide suppressed/needs_review events from public access
  if (event.publish_status === 'needs_review' || event.publish_status === 'suppressed') {
    notFound();
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
