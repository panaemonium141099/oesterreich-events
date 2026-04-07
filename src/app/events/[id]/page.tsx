import { notFound, redirect } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Event } from '@/types/events';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { EventDetailActions } from '@/components/Events/EventDetailActions';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getEvent(id: string): Promise<Event | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Event;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(id);

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

  const metadata: Metadata = {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'article',
      ...(event.image_url ? { images: [{ url: event.image_url }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      ...(event.image_url ? { images: [event.image_url] } : {}),
    },
  };

  // Low-confidence events: noindex to prevent thin/low-quality content in search
  if (event.publish_status === 'published_low_confidence') {
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

  if (event.image_url) {
    jsonLd.image = event.image_url;
  }

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

  // XSS-sanitize: escape </script> sequences
  return JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>');
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event) {
    notFound();
  }

  // 301 Redirect duplicates to their primary event
  if (event.publish_status === 'duplicate' && event.duplicate_of) {
    redirect(`/events/${event.duplicate_of}`);
  }

  // Hide suppressed/needs_review events from public access
  if (event.publish_status === 'needs_review' || event.publish_status === 'suppressed') {
    notFound();
  }

  // Only emit JSON-LD for fully published events (skip low confidence)
  const jsonLd = event.publish_status !== 'published_low_confidence' ? buildJsonLd(event) : null;
  const startTime = formatTime(event.start_date);
  const endTime = event.end_date ? formatTime(event.end_date) : null;

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
          <EventDetailActions eventId={event.id} eventTitle={event.title} />

          {event.image_url && (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-6">
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
          )}

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
                    {event.location_name}
                    {event.location_name && event.address && ', '}
                    {event.address}
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
        </div>
      </main>
    </>
  );
}
