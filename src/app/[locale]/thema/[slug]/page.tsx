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
 *
 * fn-17: die SEO-Copy (title/seoTitle/description/heroText/bodyIntro)
 * lebt jetzt lokalisiert im Message-Namespace `ThemeContent` (DE byte-
 * identisch zu src/lib/themes/data.ts); Chrome-Strings unter `ThemaPage`.
 */

import { notFound } from 'next/navigation';
import { bilingualAlternates } from '@/lib/seo/canonical';
import Image from 'next/image';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ALL_THEMES, getThemeBySlug, type Theme } from '@/lib/themes/data';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatDateLong, formatTime } from '@/lib/utils/date';
import { resolvePrimaryEventImage } from '@/lib/event-images';
import { buildFAQPageSchema, faqForTheme, type FAQTranslator } from '@/lib/seo/faq';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { CATEGORY_MESSAGE_KEYS } from '@/lib/i18n/category-labels';
import { dateLocaleFor } from '@/lib/i18n/date-locale';

export const revalidate = 3600;
// On-demand ISR — was build-time pre-rendered for all 12 themes,
// but each pre-render queries Supabase. Outages were aborting the
// whole build. Now each theme renders + caches on first visit.
// dynamicParams flipped to `true` so an unmatched slug still hits
// the route handler (which then notFound()s based on getThemeBySlug).
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

function resolveLocale(raw: string): AppLocale {
  return hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
}

/** Lokalisierte SEO-Copy eines Themes aus dem ThemeContent-Namespace. */
interface ThemeCopy {
  title: string;
  seoTitle: string;
  description: string;
  heroText: string;
  bodyIntro: string;
}

async function loadThemeCopy(slug: string, locale: AppLocale): Promise<ThemeCopy> {
  const tc = await getTranslations({ locale, namespace: 'ThemeContent' });
  return {
    title: tc(`${slug}.title`),
    seoTitle: tc(`${slug}.seoTitle`),
    description: tc(`${slug}.description`),
    heroText: tc(`${slug}.heroText`),
    bodyIntro: tc(`${slug}.bodyIntro`),
  };
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
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  const theme = getThemeBySlug(slug);
  if (!theme) {
    const tp = await getTranslations({ locale, namespace: 'ThemaPage' });
    return { title: tp('notFound') };
  }

  const copy = await loadThemeCopy(theme.slug, locale);
  const events = await loadThemeEventsCached(theme.category);
  // fn-17: Canonical zeigt auf die eigene Sprachversion, hreflang
  // verweist wechselseitig (DE unpräfixiert, EN unter /en).
  const alternates = bilingualAlternates(`/thema/${theme.slug}`, locale);

  const metadata: Metadata = {
    title: { absolute: copy.seoTitle },
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.seoTitle,
      description: copy.description,
      type: 'website',
      url: alternates.canonical,
      images: theme.image ? [{ url: theme.image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.seoTitle,
      description: copy.description,
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

function buildJsonLd(
  theme: Theme,
  copy: ThemeCopy,
  events: ThemeEvent[],
  totalEvents: number,
  locale: AppLocale,
  tFaq: FAQTranslator,
  categoryDisplay: string,
  crumbThemes: string,
): string {
  const localePrefix = locale === 'en' ? '/en' : '';
  const canonicalUrl = `https://lasstreffen.at${localePrefix}/thema/${theme.slug}`;

  const itemList = {
    '@type': 'ItemList',
    '@id': `${canonicalUrl}#itemlist`,
    name: copy.title,
    description: copy.description,
    url: canonicalUrl,
    numberOfItems: events.length,
    itemListElement: events.slice(0, 24).map((e, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `https://lasstreffen.at${localePrefix}${buildEventUrlV2(e)}`,
      name: e.title,
    })),
  };

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrl}#breadcrumbs`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: localePrefix ? `https://lasstreffen.at${localePrefix}` : 'https://lasstreffen.at' },
      { '@type': 'ListItem', position: 2, name: crumbThemes, item: `https://lasstreffen.at${localePrefix}/thema` },
      { '@type': 'ListItem', position: 3, name: copy.title, item: canonicalUrl },
    ],
  };

  const collection = {
    '@type': 'CollectionPage',
    '@id': `${canonicalUrl}#page`,
    name: copy.seoTitle,
    description: copy.description,
    url: canonicalUrl,
    inLanguage: locale === 'en' ? 'en' : 'de-AT',
    isPartOf: { '@id': `https://lasstreffen.at${localePrefix}/#website` },
    about: { '@id': `${canonicalUrl}#itemlist` },
  };

  // Category-specific FAQ (4-5 Q/A pairs). Boosts featured-snippet and
  // AI-citation eligibility. Skipped when theme has <3 events so we don't
  // emit a FAQPage for a near-empty hub (Google's threshold).
  const heroNoun = copy.title.split(' — ')[0]; // "Konzerte, Festivals & Live-Musik" → keeps
  const faqEntries = faqForTheme({
    slug: theme.slug,
    category: categoryDisplay,
    heroNoun: heroNoun.toLowerCase(),
    eventCount: totalEvents,
    t: tFaq,
    numberLocale: dateLocaleFor(locale),
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
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = resolveLocale(rawLocale);
  setRequestLocale(locale);
  const theme = getThemeBySlug(slug);
  if (!theme) notFound();

  const [copy, tp, tc, tFaq, tCat, events, blCounts] = await Promise.all([
    loadThemeCopy(theme.slug, locale),
    getTranslations({ locale, namespace: 'ThemaPage' }),
    getTranslations({ locale, namespace: 'ThemeContent' }),
    getTranslations({ locale, namespace: 'HubFAQ' }),
    getTranslations({ locale, namespace: 'Categories' }),
    loadThemeEventsCached(theme.category),
    loadBundeslandCountsCached(theme.category),
  ]);

  const numberLocale = dateLocaleFor(locale);
  const categoryDisplay = CATEGORY_MESSAGE_KEYS[theme.category]
    ? tCat(CATEGORY_MESSAGE_KEYS[theme.category])
    : theme.category;
  const totalEvents = Object.values(blCounts).reduce((a, b) => a + b, 0);
  const jsonLd = buildJsonLd(
    theme,
    copy,
    events,
    totalEvents,
    locale,
    tFaq as FAQTranslator,
    categoryDisplay,
    tp('crumbThemes'),
  );

  // Other themes — small "Verwandte Themen" block at the bottom for cross-link density.
  const otherThemes = ALL_THEMES.filter(t => t.slug !== theme.slug);
  const themeNoun = copy.title.split(' — ')[0];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="min-h-screen bg-surface text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-white/50 mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white/80">{tp('crumbHome')}</Link>
            <span className="mx-2">›</span>
            <Link href="/" className="hover:text-white/80">{tp('crumbThemes')}</Link>
            <span className="mx-2">›</span>
            <span>{copy.title}</span>
          </nav>

          {/* Hero */}
          <header className="relative mb-10 rounded-2xl overflow-hidden aspect-[21/9] md:aspect-[21/7]">
            <Image
              src={theme.image}
              alt={copy.title}
              fill
              sizes="(max-width: 768px) 100vw, 75vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
              <p className="text-xs md:text-sm font-medium uppercase tracking-[0.22em] text-white/60 mb-2">
                {tp('eyebrow')} {totalEvents > 0 && <>· <span className="tabular-nums">{totalEvents.toLocaleString(numberLocale)}</span> {tp('eyebrowEvents')}</>}
              </p>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-3 max-w-3xl">
                {copy.title}
              </h1>
              <p className="text-white/75 text-sm md:text-base max-w-2xl leading-relaxed">
                {copy.heroText}
              </p>
            </div>
          </header>

          {/* Intro */}
          <section className="mb-10 max-w-3xl">
            <p className="text-white/80 text-[15px] leading-relaxed">
              {copy.bodyIntro}
            </p>
          </section>

          {/* Top events grid */}
          {events.length > 0 && (
            <section className="mb-14">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold">
                  {tp('topEvents')}
                  <span className="text-white/40 text-sm ml-2 font-normal">
                    {tp('selectedCount', { count: events.length })}
                  </span>
                </h2>
                <Link
                  href={`/map?category=${encodeURIComponent(theme.category)}`}
                  className="text-sm text-white/60 hover:text-white"
                >
                  {tp('allOnMap')}
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
                          {formatDateLong(e.start_date, numberLocale)}
                          {formatTime(e.start_date, numberLocale) && ` · ${formatTime(e.start_date, numberLocale)}`}
                        </div>
                        <div className="font-semibold leading-snug line-clamp-2 mb-1">
                          {e.title}
                        </div>
                        <div className="text-xs text-white/50">
                          {e.location_name ?? e.address ?? '—'}
                          {e.bundesland && ` · ${bundeslandDisplayName(e.bundesland, locale)}`}
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
              {tp('byBundesland', { noun: themeNoun })}
            </h2>
            <p className="text-sm text-white/50 mb-5 max-w-2xl">
              {tp('byBundeslandText')}
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
                      <span className="font-medium">{bundeslandDisplayName(bl, locale)}</span>
                      <span className="text-sm text-white/50 tabular-nums">
                        {count.toLocaleString(numberLocale)}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>

          {/* Related themes */}
          <section className="mb-14">
            <h2 className="text-xl md:text-2xl font-bold mb-3">{tp('otherThemes')}</h2>
            <p className="text-sm text-white/50 mb-5 max-w-2xl">
              {tp('otherThemesText', { noun: themeNoun })}
            </p>
            <div className="flex flex-wrap gap-2">
              {otherThemes.map(t => (
                <Link
                  key={t.slug}
                  href={`/thema/${t.slug}`}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-white/25 text-sm text-white/80 transition-colors"
                >
                  {tc(`${t.slug}.title`).split(' — ')[0]}
                </Link>
              ))}
            </div>
          </section>

          {/* SEO footer */}
          <section className="text-sm text-white/50 leading-relaxed border-t border-white/10 pt-6 max-w-3xl">
            <p className="mb-2">
              <strong className="text-white/70">{themeNoun}</strong>{' '}
              {tp('footerP1')}
            </p>
            <p>
              {tp('footerP2')}{' '}
              <Link href="/map" className="underline hover:text-white/80">
                {tp('footerP2Link')}
              </Link>.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
