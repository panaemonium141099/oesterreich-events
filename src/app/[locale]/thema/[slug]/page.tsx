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
import type { Event } from '@/types/events';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { loadShelfPool } from '@/lib/hubs/shelf-pool';
import { viennaToday } from '@/lib/utils/event-time';
import { HubShelves } from '@/components/Hub/HubShelves';
import { HubEventGrid } from '@/components/Hub/HubEventGrid';
import { RegionTile, Shelf } from '@/components/Discover/v4/shelf-ui';
import { buildFAQPageSchema, faqForTheme, type FAQTranslator } from '@/lib/seo/faq';
import { Link } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { CATEGORY_MESSAGE_KEYS } from '@/lib/i18n/category-labels';
import { dateLocaleFor } from '@/lib/i18n/date-locale';
import { SITE_COUNTRY } from '@/lib/site-country';

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
  image_width: number | null;
  source_id: string | null;
  price_text: string | null;
  price_min: number | null;
  price_max: number | null;
  district: string | null;
  event_score: number | null;
}

/**
 * Anzeigename → Slug der neun Bundesländer. events.bundesland und die
 * Routen /[bundesland]/[filter] verwenden beide den Slug.
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

const loadThemeEventsCached = unstable_cache(
  async (category: string): Promise<ThemeEvent[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('events')
      .select('id, title, slug, start_date, end_date, location_name, address, postal_code, bundesland, district, latitude, longitude, category, image_url, image_width, source_id, price_text, price_min, price_max, event_score')
      .eq('category', category)
      .eq('publish_status', 'published')
      // Österreichweit heißt hier ohne Ortsfilter: nach Score standen sonst
      // Eventim-Termine aus Deutschland und der Schweiz in den Top 48.
      .eq('country', SITE_COUNTRY)
      .gte('start_date', today)
      .order('event_score', { ascending: false, nullsFirst: false })
      .order('start_date', { ascending: true })
      .limit(48);

    if (error || !data) return [];
    return data as ThemeEvent[];
  },
  // -v2: ohne Länderfilter gecachte Listen nicht weiter ausliefern
  ['thema-events-v2'],
  { revalidate: 3600, tags: ['event', 'thema'] },
);

/** Regal-Kandidaten (heute bis Wochenende + 14 Tage), österreichweit. */
const loadThemeShelfPoolCached = unstable_cache(
  async (category: string, today: string): Promise<Event[]> =>
    loadShelfPool(supabase, { category, statuses: ['published'] }, today),
  ['thema-shelf-pool-v1'],
  { revalidate: 3600, tags: ['event', 'thema'] },
);

const loadBundeslandCountsCached = unstable_cache(
  async (category: string): Promise<Record<string, number>> => {
    const today = new Date().toISOString().slice(0, 10);
    const counts: Record<string, number> = {};

    // One count query per bundesland — 9 small parallel HEAD requests.
    // A single GROUP BY via RPC would be faster in theory, but the count
    // head-requests are cheap (<50 ms each) and this avoids a custom RPC.
    // events.bundesland trägt den Slug ('niederoesterreich'), nicht den
    // Anzeigenamen: mit den Namen standen bis 2026-10-26 überall 0 Events.
    // 'estimated' wie die Bundesland-Seiten, exakte Zählungen sprengen bei
    // großen Kategorien das Statement-Timeout.
    const bundeslaender = Object.values(BL_SLUG);
    await Promise.all(
      bundeslaender.map(async bl => {
        const { count } = await supabase
          .from('events')
          .select('id', { count: 'estimated', head: true })
          .eq('category', category)
          .eq('bundesland', bl)
          .eq('publish_status', 'published')
          .eq('country', SITE_COUNTRY)
          .gte('start_date', today);
        counts[bl] = count ?? 0;
      }),
    );
    return counts;
  },
  // -v2: Zählungen nach Slug statt Anzeigename
  ['thema-bl-counts-v2'],
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

  const [copy, tp, tc, tFaq, tCat, events, blCounts, shelfPool] = await Promise.all([
    loadThemeCopy(theme.slug, locale),
    getTranslations({ locale, namespace: 'ThemaPage' }),
    getTranslations({ locale, namespace: 'ThemeContent' }),
    getTranslations({ locale, namespace: 'HubFAQ' }),
    getTranslations({ locale, namespace: 'Categories' }),
    loadThemeEventsCached(theme.category),
    loadBundeslandCountsCached(theme.category),
    loadThemeShelfPoolCached(theme.category, viennaToday()),
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
      <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14 pt-6 md:pt-8 pb-20">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--v4-ink-50)] mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-[var(--v4-ink-70)]">{tp('crumbHome')}</Link>
            <span>/</span>
            <Link href="/" className="hover:text-[var(--v4-ink-70)]">{tp('crumbThemes')}</Link>
            <span>/</span>
            <span className="text-[var(--v4-ink-70)]">{copy.title}</span>
          </nav>

          {/* Hero */}
          <header className="relative mb-8 rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[21/9] md:aspect-[21/7]">
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
          <section className="mb-2 max-w-3xl">
            <p className="text-[var(--v4-ink-70)] text-[15px] leading-relaxed">
              {copy.bodyIntro}
            </p>
          </section>

          {/* Regale wie auf /entdecken. „Nach Region" ersetzt die frühere
              Bundesland-Liste und verlinkt wie sie /{bundesland}/{thema}. */}
          <HubShelves
            events={shelfPool}
            hide={{ categories: true, chips: true }}
            extra={
              <Shelf title={tp('byBundesland', { noun: themeNoun })} sub={tp('byBundeslandText')}>
                {Object.entries(blCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([bl, count]) => (
                    <RegionTile
                      key={bl}
                      href={`/${bl}/${theme.slug}`}
                      name={bundeslandDisplayName(bl, locale)}
                      image={`/images/regions/${bl}.jpg`}
                      count={count}
                    />
                  ))}
              </Shelf>
            }
          />

          {/* Top events */}
          <HubEventGrid
            title={tp('topEvents')}
            sub={tp('selectedCount', { count: events.length })}
            events={events as unknown as Event[]}
          >
            <div className="flex justify-center mt-8">
              <Link
                href={`/map?category=${encodeURIComponent(theme.category)}`}
                className="press-haptic px-6 py-2.5 rounded-full text-[13px] font-semibold text-[var(--v4-ink)] border border-[var(--v4-hairline-3)] hover:border-[var(--v4-hairline-4)] transition-colors"
              >
                {tp('allOnMap')}
              </Link>
            </div>
          </HubEventGrid>

          {/* Related themes */}
          <section className="mb-14">
            <h2 className="m-0 mb-2 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{tp('otherThemes')}</h2>
            <p className="text-sm text-[var(--v4-ink-50)] mb-4 max-w-2xl">
              {tp('otherThemesText', { noun: themeNoun })}
            </p>
            <div className="flex flex-wrap gap-2">
              {otherThemes.map(t => (
                <Link
                  key={t.slug}
                  href={`/thema/${t.slug}`}
                  className="rounded-full border border-[var(--v4-hairline-3)] hover:border-[var(--v4-hairline-4)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--v4-ink)] transition-colors"
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
