import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Event } from '@/types/events';
import { EventListCard } from '@/components/Events/EventListCard';
import { VenueDetail } from '@/components/Venues/VenueDetail';
import { SimilarVenues } from '@/components/Venues/SimilarVenues';
import { deOnlyAlternates } from '@/lib/seo/canonical';

export const revalidate = 3600;

const MIN_QUALITY = 40;

function getReadClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface VenueData {
  id: string;
  name: string;
  type: string;
  city: string | null;
  bundesland: string | null;
  address: string | null;
  postal_code: string | null;
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = getReadClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('name, type, city')
    .eq('id', id)
    .single();

  if (!venue) return { title: 'Venue nicht gefunden' };

  // Layout template already appends " | LassTreffen.at" — skip the manual suffix.
  const title = `${venue.name}${venue.city ? ` — ${venue.city}` : ''}`;
  const description = `Kommende Events bei ${venue.name}${venue.city ? ` in ${venue.city}` : ''}. Programm, Termine und Tickets.`;

  return {
    title,
    description,
    alternates: deOnlyAlternates(`/venues/${id}`),
    openGraph: { title, description },
    twitter: { card: 'summary', title, description },
  };
}

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getReadClient();
  const today = new Date().toISOString().split('T')[0];

  // 1. Load venue
  const { data: venue, error } = await supabase
    .from('venues')
    .select(
      'id, name, type, subtype, address, postal_code, city, bundesland, latitude, longitude, website, facebook_url, instagram_url',
    )
    .eq('id', id)
    .single();

  if (error || !venue) notFound();

  const venueData = venue as VenueData;

  // 2. Load upcoming events (chronological — Spielplan)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, count: totalEvents } = await (supabase.from('events') as any)
    .select(
      'id, title, description, start_date, end_date, location_name, address, bundesland, image_url, category, price_text, price_min, price_max, event_score, quality_score, venue_id',
      { count: 'exact' },
    )
    .eq('venue_id', id)
    .in('publish_status', ['published', 'published_low_confidence'])
    .gte('start_date', today)
    .gte('quality_score', MIN_QUALITY)
    .order('start_date', { ascending: true })
    .limit(20);

  // Availability check: 404 if no qualifying events
  if (!totalEvents || totalEvents === 0) notFound();

  const eventList = (events ?? []) as Event[];

  // 3. Load similar venues
  let similarVenues: { id: string; name: string; type: string; city: string | null }[] = [];

  if (venueData.city && venueData.type) {
    const { data: candidates } = await supabase
      .from('venues')
      .select('id, name, type, city')
      .eq('type', venueData.type)
      .ilike('city', venueData.city)
      .neq('id', id)
      .limit(20);

    if (candidates && candidates.length > 0) {
      const candidateIds = candidates.map((v: { id: string }) => v.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: venueCounts } = await (supabase.from('events') as any)
        .select('venue_id')
        .in('venue_id', candidateIds)
        .in('publish_status', ['published', 'published_low_confidence'])
        .gte('start_date', today)
        .gte('quality_score', MIN_QUALITY);

      const activeIds = new Set(
        (venueCounts ?? []).map((e: { venue_id: string }) => e.venue_id),
      );

      similarVenues = candidates
        .filter((v: { id: string }) => activeIds.has(v.id))
        .slice(0, 6) as typeof similarVenues;
    }
  }

  // 4. Build JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: venueData.name,
    ...(venueData.address || venueData.city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(venueData.address ? { streetAddress: venueData.address } : {}),
            ...(venueData.city ? { addressLocality: venueData.city } : {}),
            ...(venueData.postal_code ? { postalCode: venueData.postal_code } : {}),
            addressCountry: 'AT',
          },
        }
      : {}),
    ...(venueData.website ? { url: venueData.website } : {}),
  };

  // 5. Build internal links
  const internalLinks: { label: string; href: string }[] = [];
  if (venueData.city && venueData.bundesland) {
    internalLinks.push({
      label: `Alle Events in ${venueData.city}`,
      href: `/stadt/${venueData.city.toLowerCase()}`,
    });
  }
  if (venueData.bundesland) {
    const blSlug = venueData.bundesland.toLowerCase();
    internalLinks.push({
      label: `Events in ${venueData.bundesland}`,
      href: `/${blSlug}`,
    });
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/<\/script>/gi, '<\\/script>'),
        }}
      />

      <main className="min-h-screen bg-surface text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-white/40 mb-6">
            <Link href="/" className="hover:text-white/70 transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-white/60">{venueData.name}</span>
          </nav>

          {/* Venue Info */}
          <VenueDetail venue={venueData} totalEvents={totalEvents ?? 0} />

          {/* Upcoming Events */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Kommende Events
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {eventList.map((event) => (
                <EventListCard key={event.id} event={event} />
              ))}
            </div>
          </section>

          {/* Similar Venues */}
          <SimilarVenues venues={similarVenues} />

          {/* Internal Links */}
          {internalLinks.length > 0 && (
            <nav className="mt-10 pt-8 border-t border-white/10">
              <div className="flex flex-wrap gap-2">
                {internalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          )}
        </div>
      </main>
    </>
  );
}
