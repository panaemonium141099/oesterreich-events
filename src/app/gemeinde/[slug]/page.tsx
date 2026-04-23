/**
 * Gemeinde hub page — `/gemeinde/{plz}-{slug}`
 *
 * Part of fn-13 phase 2. Generates one indexable hub page per Austrian
 * municipality (~2 028 URLs from data/gemeinden-registry). Each hub
 * shows upcoming events in a 10 km radius around the village centre,
 * plus links to neighbour municipalities.
 *
 * SEO wiring:
 *   - Full static prerender list via `generateStaticParams` so ISR kicks
 *     in for all 2k slugs without cold-start penalty.
 *   - 1-hour `revalidate` keeps event counts / featured events fresh.
 *   - JSON-LD: `Place` for the gemeinde, `ItemList` for the events,
 *     `BreadcrumbList` for the nav.
 *   - Low-content guard: <3 events → `robots: noindex` + prominent
 *     neighbour-gemeinden list so the page still has some utility for
 *     a human visitor but doesn't pollute Google's index as thin content.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

import {
  ALL_GEMEINDEN,
  bboxAround,
  findNeighbourGemeinden,
  getGemeindeBySlug,
  haversineKm,
  type AustrianGemeinde,
} from '@/lib/gemeinden/data';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { resolvePrimaryEventImage } from '@/lib/event-images';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Pre-build the slug list so Next knows the universe of valid URLs.
  // Returning an empty array would also work (pure ISR), but listing
  // them lets the build phase spot typos early via the validator.
  return ALL_GEMEINDEN.map(g => ({ slug: g.slug }));
}

// ───────────────────────────────────────────────────────────────────────
// Data loading — nearby events inside a bbox, cached per gemeinde
// ───────────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface NearbyEvent {
  id: string;
  title: string;
  slug: string | null;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  image_url: string | null;
  price_text: string | null;
  event_score: number | null;
  _distance_km?: number;
}

const loadNearbyEventsCached = unstable_cache(
  async (lat: number, lng: number, radiusKm: number): Promise<NearbyEvent[]> => {
    const { minLat, maxLat, minLng, maxLng } = bboxAround(lat, lng, radiusKm);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('events')
      .select('id, title, slug, start_date, end_date, location_name, address, postal_code, bundesland, latitude, longitude, category, image_url, price_text, event_score')
      .gte('start_date', today)
      .eq('publish_status', 'published')
      .gte('latitude', minLat).lte('latitude', maxLat)
      .gte('longitude', minLng).lte('longitude', maxLng)
      .order('event_score', { ascending: false, nullsFirst: false })
      .order('start_date', { ascending: true })
      .limit(60);

    if (error || !data) return [];

    // Filter by actual haversine distance (bbox is rectangular, circle
    // is tighter). Keep only within radius.
    return (data as NearbyEvent[])
      .map(e => {
        if (e.latitude == null || e.longitude == null) return null;
        const d = haversineKm(lat, lng, e.latitude, e.longitude);
        if (d > radiusKm) return null;
        return { ...e, _distance_km: d };
      })
      .filter((x): x is NearbyEvent & { _distance_km: number } => x !== null);
  },
  ['gemeinde-nearby-events'],
  { revalidate: 3600, tags: ['event', 'gemeinde'] },
);

async function loadNearbyEvents(g: AustrianGemeinde): Promise<NearbyEvent[]> {
  return loadNearbyEventsCached(g.lat, g.lng, 10);
}

// ───────────────────────────────────────────────────────────────────────
// Metadata
// ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = getGemeindeBySlug(slug);
  if (!g) return { title: 'Gemeinde nicht gefunden' };

  const events = await loadNearbyEvents(g);
  const count = events.length;

  // Dynamic description tuned for the SERP snippet:
  //   "124 Events in Eisenstadt — heute und diese Woche. Konzerte, Feste,
  //    Kirchenveranstaltungen und mehr auf LassTreffen.at."
  const description = count > 0
    ? `${count} Veranstaltungen in ${g.name}${g.bezirk ? ` (${g.bezirk})` : ''} — heute und in den kommenden Wochen. Konzerte, Feste, Kultur und mehr auf LassTreffen.at.`
    : `Veranstaltungen und Events in ${g.name}${g.bezirk ? ` (${g.bezirk})` : ''}. Aktueller Veranstaltungskalender für ${g.bundesland} auf LassTreffen.at.`;

  const title = `Events in ${g.name} ${g.plz} — ${count > 0 ? `${count} Veranstaltungen` : 'Veranstaltungskalender'}`;
  const canonicalUrl = `https://lasstreffen.at/gemeinde/${g.slug}`;

  const metadata: Metadata = {
    title: { absolute: title.length > 60 ? title.slice(0, 57).trimEnd() + '…' : title },
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
    },
    twitter: { card: 'summary', title, description },
  };

  // Low-content guard — a silent gemeinde with <3 events shouldn't bloat
  // the index with thin pages. Keep it crawlable (follow) so Google can
  // still discover links to neighbour gemeinden, but noindex the page.
  if (count < 3) {
    metadata.robots = { index: false, follow: true };
  }

  return metadata;
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────

function buildJsonLd(g: AustrianGemeinde, events: NearbyEvent[]): string {
  const canonicalUrl = `https://lasstreffen.at/gemeinde/${g.slug}`;

  const place = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: g.name,
    address: {
      '@type': 'PostalAddress',
      postalCode: g.plz,
      addressLocality: g.name,
      addressRegion: g.bundesland,
      addressCountry: 'AT',
    },
    geo: { '@type': 'GeoCoordinates', latitude: g.lat, longitude: g.lng },
    url: canonicalUrl,
  };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.slice(0, 10).map((e, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `https://lasstreffen.at${buildEventUrlV2(e)}`,
      name: e.title,
    })),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lasstreffen.at' },
      { '@type': 'ListItem', position: 2, name: g.bundesland, item: `https://lasstreffen.at/${slugifyBundesland(g.bundesland)}` },
      { '@type': 'ListItem', position: 3, name: g.name, item: canonicalUrl },
    ],
  };

  return [place, itemList, breadcrumb]
    .map(o => JSON.stringify(o).replace(/<\/script>/gi, '<\\/script>'))
    .join('\n');
}

function slugifyBundesland(bl: string): string {
  const map: Record<string, string> = {
    'Burgenland': 'burgenland',
    'Kärnten': 'kaernten',
    'Niederösterreich': 'niederoesterreich',
    'Oberösterreich': 'oberoesterreich',
    'Salzburg': 'salzburg',
    'Steiermark': 'steiermark',
    'Tirol': 'tirol',
    'Vorarlberg': 'vorarlberg',
    'Wien': 'wien',
  };
  return map[bl] ?? bl.toLowerCase();
}

export default async function GemeindeHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = getGemeindeBySlug(slug);
  if (!g) notFound();

  const events = await loadNearbyEvents(g);
  const neighbours = findNeighbourGemeinden(g, 8);
  const jsonLd = buildJsonLd(g, events);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="min-h-screen bg-surface text-white">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-white/50 mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white/80">Home</Link>
            <span className="mx-2">›</span>
            <Link href={`/${slugifyBundesland(g.bundesland)}`} className="hover:text-white/80">
              {g.bundesland}
            </Link>
            <span className="mx-2">›</span>
            <span>{g.name}</span>
          </nav>

          {/* Header */}
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Events in {g.name}
            </h1>
            <p className="text-white/60">
              {g.plz} {g.name}
              {g.bezirk ? ` · Bezirk ${g.bezirk}` : ''}
              {' · '}{g.bundesland}
            </p>
            <p className="mt-3 text-white/80 leading-relaxed max-w-2xl">
              {events.length > 0 ? (
                <>
                  Aktuell <strong className="text-white">{events.length}</strong>{' '}
                  Veranstaltungen im Umkreis von 10 km um {g.name} — von Konzerten
                  und Festen bis zu Kulturevents. Alle Termine werden täglich aus
                  offiziellen Quellen aktualisiert.
                </>
              ) : (
                <>
                  Aktuell keine Events im Umkreis von 10 km um {g.name} gefunden.
                  Schau in einer Nachbar-Gemeinde nach — eine Liste findest du unten
                  auf der Seite.
                </>
              )}
            </p>
          </header>

          {/* Event grid */}
          {events.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-semibold mb-4">Kommende Veranstaltungen</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map(e => (
                  <Link
                    key={e.id}
                    href={buildEventUrlV2(e)}
                    className="rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors block"
                  >
                    <div className="relative w-full aspect-[4/3] bg-white/5">
                      <Image
                        src={resolvePrimaryEventImage({ imageUrl: e.image_url, category: e.category, title: e.title })}
                        alt={e.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                        unoptimized={process.env.NODE_ENV !== 'production'}
                      />
                    </div>
                    <div className="p-3">
                      <div className="text-xs text-white/50 mb-1">
                        {formatDateLong(e.start_date)}
                        {formatTime(e.start_date) && ` · ${formatTime(e.start_date)}`}
                      </div>
                      <div className="font-semibold leading-snug line-clamp-2 mb-1">
                        {e.title}
                      </div>
                      <div className="text-xs text-white/50">
                        {e.location_name ?? e.address ?? g.name}
                        {e._distance_km != null && ` · ${e._distance_km.toFixed(1)} km`}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Neighbour gemeinden */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-3">Nachbar-Gemeinden</h2>
            <p className="text-sm text-white/50 mb-4">
              Events auch in der Umgebung von {g.name} — die 8 nächstgelegenen
              Orte mit eigener Event-Übersicht.
            </p>
            <div className="flex flex-wrap gap-2">
              {neighbours.map(n => (
                <Link
                  key={n.slug}
                  href={`/gemeinde/${n.slug}`}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-white/25 text-sm text-white/80"
                >
                  {n.name}
                  <span className="text-white/40 ml-1.5">
                    {haversineKm(g.lat, g.lng, n.lat, n.lng).toFixed(1)} km
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* SEO text block — additional context Google can extract */}
          <section className="text-sm text-white/50 leading-relaxed border-t border-white/10 pt-6">
            <p className="mb-2">
              <strong className="text-white/70">{g.name}</strong> liegt im Bezirk
              {g.bezirk ? ` ${g.bezirk}` : ''} in {g.bundesland}, Österreich. Auf
              LassTreffen.at findest du täglich aktualisierte Veranstaltungen in{' '}
              {g.name} und Umgebung — von Dorffesten und Märkten bis zu
              Konzerten, Festivals und Kulturveranstaltungen.
            </p>
            <p>
              Die Event-Liste wird automatisch aus offiziellen Gemeinde-Kalendern,
              Tourismus-Portalen, Ticket-Vendors und Veranstaltungs-Aggregatoren
              zusammengeführt und dupliziert-gefiltert, damit du keine
              Ankündigung doppelt liest.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
