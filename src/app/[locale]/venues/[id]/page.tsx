import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Event } from '@/types/events';
import { HubEventGrid } from '@/components/Hub/HubEventGrid';
import { VenueDetail } from '@/components/Venues/VenueDetail';
import { SimilarVenues } from '@/components/Venues/SimilarVenues';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { bilingualAlternates } from '@/lib/seo/canonical';
import { SITE_COUNTRY } from '@/lib/site-country';

export const revalidate = 3600;

const MIN_QUALITY = 40;

function resolveLocale(raw: string): AppLocale {
  return hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
}

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
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, id } = await params;
  const locale = resolveLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'VenuePage' });
  const supabase = getReadClient();

  const { data: venue } = await supabase
    .from('venues')
    .select('name, type, city')
    .eq('id', id)
    .single();

  if (!venue) return { title: t('notFound') };

  // Layout template already appends " | LassTreffen.at" — skip the manual suffix.
  const title = `${venue.name}${venue.city ? ` — ${venue.city}` : ''}`;
  const description = t('metaDescription', {
    name: venue.name,
    cityPart: venue.city ? ` in ${venue.city}` : '',
  });

  // Venue-Seite ist jetzt real zweisprachig (VenuePage-Namespace, VenueDetail
  // + SimilarVenues uebersetzt), also eigener Canonical je Sprache statt
  // deOnlyAlternates.
  const alternates = bilingualAlternates(`/venues/${id}`, locale);

  return {
    title,
    description,
    alternates,
    openGraph: { title, description, url: alternates.canonical },
    twitter: { card: 'summary', title, description },
  };
}

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'VenuePage' });
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
      'id, title, slug, description, start_date, end_date, location_name, address, postal_code, bundesland, district, image_url, category, price_text, price_min, price_max, event_score, quality_score, venue_id',
      { count: 'exact' },
    )
    .eq('venue_id', id)
    .eq('country', SITE_COUNTRY)
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
        .eq('country', SITE_COUNTRY)
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
      label: t('allEventsIn', { name: venueData.city }),
      href: `/stadt/${venueData.city.toLowerCase()}`,
    });
  }
  if (venueData.bundesland) {
    const blSlug = venueData.bundesland.toLowerCase();
    internalLinks.push({
      label: t('eventsIn', { name: bundeslandDisplayName(venueData.bundesland, locale) }),
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

      <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14 pt-6 md:pt-8 pb-20">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12.5px] text-[var(--v4-ink-50)] mb-4">
            <Link href="/" className="hover:text-[var(--v4-ink-70)] transition-colors">
              {t('crumbHome')}
            </Link>
            <span>/</span>
            <span className="text-[var(--v4-ink-70)]">{venueData.name}</span>
          </nav>

          {/* Venue Info */}
          <div className="max-w-3xl">
            <VenueDetail venue={venueData} totalEvents={totalEvents ?? 0} />
          </div>

          {/* Upcoming Events: Spielplan als Poster-Raster wie /entdecken */}
          <HubEventGrid title={t('upcomingEvents')} events={eventList} />

          {/* Similar Venues */}
          <div className="max-w-3xl">
            <SimilarVenues venues={similarVenues} />
          </div>

          {/* Internal Links */}
          {internalLinks.length > 0 && (
            <nav className="mt-10 pt-8 border-t border-[var(--v4-hairline-2)]">
              <div className="flex flex-wrap gap-2">
                {internalLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[12.5px] font-medium text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)] px-3 py-1.5 rounded-full border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-4)] transition-colors"
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
