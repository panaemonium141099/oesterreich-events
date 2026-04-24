/**
 * Theme hub — `/thema/{slug}`
 *
 * Austria-wide landing page for one taxonomy-v3 category (Musik, Kultur &
 * Bühne, …). 12 pages total, one per theme in src/lib/themes/data.ts.
 *
 * SEO architecture:
 *   - Static pre-render via `generateStaticParams` + ISR
 *     (`revalidate = 3600`); the theme universe is small and fixed, so
 *     paying for a cold build once per theme is free at deploy-time.
 *   - JSON-LD: `ItemList` (top 24 events), `BreadcrumbList`, `CollectionPage`
 *     so Google understands the page as a curated list rather than generic
 *     search results.
 *   - Internal links: every bundesland chip links to `/{bundesland}/{slug}`
 *     (the existing per-bundesland landing page, now wired to v3 via the
 *     preceding taxonomy-drift commit). That gives Google + human users a
 *     clear click path theme → bundesland → event.
 *
 * Low-content guard: every v3 category has thousands of events Austria-
 * wide so we don't expect the noindex branch to trigger, but the logic
 * is in place defensively.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

import { ALL_THEMES, getThemeBySlug, type Theme } from '@/lib/themes/data';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import { buildFAQPageSchema, faqForTheme } from '@/lib/seo/faq';

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_THEMES.map(t => ({ slug: t.slug }));
}

// ───────────────────────────────────────────────────────────────────────
// Data — top events + bundesland breakdown for the category
// ───────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface ThemeEvent {
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
}

/**
 * Map from `events.bundesland` value → URL slug used by /[bundesland]/[filter].
 * DB stores the display names ("Niederösterreich"); the landing-page routes
 * expect the slug form ("niederoesterreich"). Keep in sync with BUNDESLAENDER
 * in `src/lib/bundeslaender.ts` (same mapping, duplicated here for zero-import).
 */
const BL_SLUG: Record<string, string> = {
  'Burgenland':       'burgenland',
  'Kärnten':          'kaernten',
  'Niederösterreich': 'niederoesterreich',
  'Oberösterreich':   'oberoesterreich',
  'Salzburg':         'salzburg',
  'Steiermark':       'steiermark',
  'Tirol':            'tirol',
  'Vorarlberg':       'vorarlberg',
  'Wien':             'wien',
};

/** Best-effort reverse-slug — DB sometimes carries abbreviations. */
function bundeslandToSlug(bl: string | null | undefined): string | null {
  if (!bl) return null;
  return BL_SLUG[bl] ?? bl.trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
}

const loadThemeEventsCached = unstable_cache(
  async (category: string): Promise<ThemeEvent[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('events')
      .select('id, title, slug, start_date, end_date, location_name, address, postal_code, bundesland, latitude, longitude, category, image_url, price_text, event_score')
      .eq('category', category)
      .eq('publish_status', 'published')
      .gte('start_date', today)
      .order('event_score', { ascending: false, nullsFirst: false })
      .order('start_date', { ascending: true })
      .limit(48);

    if (error || !data) return [];
    return data as ThemeEvent[];
  },
  ['thema-events'],
  { revalidate: 3600, tags: ['event', 'thema'] },
);

const loadBundeslandCountsCached = unstable_cache(
  async (category: string): Promise<Record<string, number>> => {
    const today = new Date().toISOString().slice(0, 10);
    const counts: Record<string, number> = {};

    // One count query per bundesland — 9 small parallel HEAD requests.
    // A single GROUP BY via RPC would be faster in theory, but the count
    // head-requests are cheap (<50 ms each) and this avoids a custom RPC.
    const bundeslaender = Object.keys(BL_SLUG);
    await Promise.all(
      bundeslaender.map(async bl => {
        const { count } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('category', category)
          .eq('bundesland', bl)
          .eq('publish_status', 'published')
          .gte('start_date', today);
        counts[bl] = count ?? 0;
      }),
    );
    return counts;
  },
  ['thema-bl-counts'],
  { revalidate: 3600, tags: ['event', 'thema'] },
);

// ───────────────────────────────────────────────────────────────────────
// Metadata
// ───────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const theme = getThemeBySlug(slug);
  if (!theme) return { title: 'Thema nicht gefunden' };

  const events = await loadThemeEventsCached(theme.category);
  const canonicalUrl = `https://lasstreffen.at/thema/${theme.slug}`;

  const metadata: Metadata = {
    title: { absolute: theme.seoTitle },
    description: theme.description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: theme.seoTitle,
      description: theme.description,
      type: 'website',
      url: canonicalUrl,
      images: theme.image ? [{ url: theme.image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: theme.seoTitle,
      description: theme.description,
      images: theme.image ? [theme.image] : undefined,
    },
  };

  if (events.length < 3) {
    metadata.robots = { index: false, follow: true };
  }
  return metadata;
}

// ───────────────────────────────────────────────────────────────────────
// JSON-LD
// ───────────────────────────────────────────────────────────────────────

function buildJsonLd(theme: Theme, events: ThemeEvent[], totalEvents: number): string {
  const canonicalUrl = `https://lasstreffen.at/thema/${theme.slug}`;

  const itemList = {
    '@type': 'ItemList',
    '@id': `${canonicalUrl}#itemlist`,
    name: theme.title,
    description: theme.description,
    url: canonicalUrl,
    numberOfItems: events.length,
    itemListElement: events.slice(0, 24).map((e, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `https://lasstreffen.at${buildEventUrlV2(e)}`,
      name: e.title,
    })),
  };

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumbs`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lasstreffen.at' },
      { '@type': 'ListItem', position: 2, name: 'Themen', item: 'https://lasstreffen.at/thema' },
      { '@type': 'ListItem', position: 3, name: theme.title, item: canonicalUrl },
    ],
  };

  const collection = {
    '@type': 'CollectionPage',
    '@id': `${canonicalUrl}#page`,
    name: theme.seoTitle,
    description: theme.description,
    url: canonicalUrl,
    inLanguage: 'de-AT',
    isPartOf: { '@id': 'https://lasstreffen.at/#website' },
    about: { '@id': `${canonicalUrl}#itemlist` },
  };

  // Category-specific FAQ (4-5 Q/A pairs). Boosts featured-snippet and
  // AI-citation eligibility. Skipped when theme has <3 events so we don't
  // emit a FAQPage for a near-empty hub (Google's threshold).
  const heroNoun = theme.title.split(' — ')[0]; // "Konzerte, Festivals & Live-Musik" → keeps
  const faqEntries = faqForTheme({
    slug: theme.slug,
    category: theme.category,
    heroNoun: heroNoun.toLowerCase(),
    eventCount: totalEvents,
  });
  const faqPage = buildFAQPageSchema(faqEntries);

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [itemList, breadcrumb, collection, ...(faqPage ? [faqPage] : [])],
  };

  return JSON.stringify(graph).replace(/<\/script>/gi, '<\\/script>');
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────

export default async function ThemePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const theme = getThemeBySlug(slug);
  if (!theme) notFound();

  const [events, blCounts] = await Promise.all([
    loadThemeEventsCached(theme.category),
    loadBundeslandCountsCached(theme.category),
  ]);

  const totalEvents = Object.values(blCounts).reduce((a, b) => a + b, 0);
  const jsonLd = buildJsonLd(theme, events, totalEvents);

  // Other themes — small "Verwandte Themen" block at the bottom for cross-link density.
  const otherThemes = ALL_THEMES.filter(t => t.slug !== theme.slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="min-h-screen bg-surface text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-white/50 mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white/80">Home</Link>
            <span className="mx-2">›</span>
            <Link href="/" className="hover:text-white/80">Themen</Link>
            <span className="mx-2">›</span>
            <span>{theme.title}</span>
          </nav>

          {/* Hero */}
          <header className="relative mb-10 rounded-2xl overflow-hidden aspect-[21/9] md:aspect-[21/7]">
            <Image
              src={theme.image}
              alt={theme.title}
              fill
              sizes="(max-width: 768px) 100vw, 75vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
              <p className="text-xs md:text-sm font-medium uppercase tracking-[0.22em] text-white/60 mb-2">
                Thema {totalEvents > 0 && <>· <span className="tabular-nums">{totalEvents.toLocaleString('de-AT')}</span> Events</>}
              </p>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-3 max-w-3xl">
                {theme.title}
              </h1>
              <p className="text-white/75 text-sm md:text-base max-w-2xl leading-relaxed">
                {theme.heroText}
              </p>
            </div>
          </header>

          {/* Intro */}
          <section className="mb-10 max-w-3xl">
            <p className="text-white/80 text-[15px] leading-relaxed">
              {theme.bodyIntro}
            </p>
          </section>

          {/* Top events grid */}
          {events.length > 0 && (
            <section className="mb-14">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold">
                  Top-Events
                  <span className="text-white/40 text-sm ml-2 font-normal">
                    · {events.length} ausgewählt
                  </span>
                </h2>
                <Link
                  href={`/map?category=${encodeURIComponent(theme.category)}`}
                  className="text-sm text-white/60 hover:text-white"
                >
                  Alle auf der Karte →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map(e => {
                  const blSlug = bundeslandToSlug(e.bundesland);
                  return (
                    <Link
                      key={e.id}
                      href={buildEventUrlV2(e)}
                      className="group rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-colors"
                    >
                      <div className="relative w-full aspect-[4/3] bg-white/5">
                        <Image
                          src={resolvePrimaryEventImage({ imageUrl: e.image_url, category: e.category, title: e.title })}
                          alt={e.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
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
                          {e.location_name ?? e.address ?? '—'}
                          {e.bundesland && ` · ${e.bundesland}`}
                          {blSlug && e.price_text && ' · '}
                          {e.price_text && <span>{e.price_text}</span>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Bundesland breakdown — internal link density */}
          <section className="mb-14">
            <h2 className="text-xl md:text-2xl font-bold mb-3">
              {theme.title.split(' — ')[0]} nach Bundesland
            </h2>
            <p className="text-sm text-white/50 mb-5 max-w-2xl">
              Events in einem bestimmten Bundesland? Klick durch — jede Region hat
              eine eigene, täglich aktualisierte Agenda.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
              {Object.entries(blCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([bl, count]) => {
                  const blSlug = BL_SLUG[bl];
                  return (
                    <Link
                      key={bl}
                      href={`/${blSlug}/${theme.slug}`}
                      className="flex items-baseline justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/25 transition-colors"
                    >
                      <span className="font-medium">{bl}</span>
                      <span className="text-sm text-white/50 tabular-nums">
                        {count.toLocaleString('de-AT')}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>

          {/* Related themes */}
          <section className="mb-14">
            <h2 className="text-xl md:text-2xl font-bold mb-3">Andere Themen</h2>
            <p className="text-sm text-white/50 mb-5 max-w-2xl">
              Falls {theme.title.split(' — ')[0]} gerade nicht passt — hier sind
              die anderen großen Event-Kategorien auf LassTreffen.at.
            </p>
            <div className="flex flex-wrap gap-2">
              {otherThemes.map(t => (
                <Link
                  key={t.slug}
                  href={`/thema/${t.slug}`}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/25 text-sm text-white/80 transition-colors"
                >
                  {t.title.split(' — ')[0]}
                </Link>
              ))}
            </div>
          </section>

          {/* SEO footer */}
          <section className="text-sm text-white/50 leading-relaxed border-t border-white/10 pt-6 max-w-3xl">
            <p className="mb-2">
              <strong className="text-white/70">{theme.title.split(' — ')[0]}</strong>{' '}
              ist eine von 12 Haupt-Kategorien auf LassTreffen.at, Österreichs
              größter Event-Aggregator. Die Termine werden täglich aus offiziellen
              Ticket-Anbietern, Gemeinde-Kalendern, Tourismus-Portalen und
              Veranstalter-Feeds zusammengeführt und dupliziert-gefiltert.
            </p>
            <p>
              Alle Events sind auf einer interaktiven Karte verortet und nach
              Bundesland, Bezirk oder Gemeinde filterbar. Für tägliche Empfehlungen
              in deiner Nähe lohnt der Blick auf die{' '}
              <Link href="/map" className="underline hover:text-white/80">
                Event-Karte
              </Link>.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
