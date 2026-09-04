/**
 * Server-side data loading for landing pages.
 *
 * Shared between Bundesland and Stadt pages to avoid duplication.
 * Uses anon key (read-only, public data only).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getTranslations } from 'next-intl/server';
import type { Event } from '@/types/events';
import {
  CATEGORY_SLUGS,
  getCategorySlug,
  isValidBundesland,
  getBundeslandName,
  isTimeFilter,
  getDateRange,
  LANDING_CITIES,
  type LandingCity,
} from './landing-slugs';
import { BUNDESLAENDER } from './bundeslaender';
import type { FilterChip } from '@/components/Landing/FilterChips';
import type { LinkGroup } from '@/components/Landing/InternalLinks';
import { STADT_INTROS } from '@/content/landing-intros';
import { buildFAQPageSchema, faqForBundesland, type FAQEntry } from './seo/faq';
import { STADT_TO_GEMEINDE } from './hubs/city-hubs';
import { bundeslandDisplayName } from './i18n/bundesland-names';
import { CATEGORY_MESSAGE_KEYS } from './i18n/category-labels';
import type { AppLocale } from '@/i18n/routing';

const BASE_URL = 'https://lasstreffen.at';

/**
 * fn-17: Übersetzer-Handle wie von `getTranslations()` geliefert.
 * Die DE-Messages (HubLanding/HubFAQ/HubIntros in messages/de.json) sind
 * byte-identisch zu den früher hier inlined gebauten Strings — deutsche
 * Seiten rendern unverändert; nur /en bekommt englische Texte.
 */
type Translator = ((key: string, values?: Record<string, string | number>) => string) & {
  /** next-intl: true, wenn der Key im geladenen Katalog existiert. */
  has: (key: string) => boolean;
};

const PAGE_SIZE = 20;
const MIN_QUALITY = 40;

function getReadClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export interface LandingPageData {
  events: Event[];
  totalCount: number;
  title: string;
  subtitle: string;
  breadcrumbs: { label: string; href?: string }[];
  filterChips: FilterChip[];
  internalLinks: LinkGroup[];
  jsonLd: object;
  paginationParams: Record<string, string>;
  metaTitle: string;
  metaDescription: string;
  /**
   * Editorial intro — only set for "root" landing pages (/<bundesland>
   * and /stadt/<city>), not for sub-filter permutations, to avoid
   * duplicate-content penalties and keep the intro truly curated.
   */
  intro?: {
    lead: string;
    body: string;
    tips?: string;
  };
}

// ---------------------------------------------------------------------------
// Bundesland page data
// ---------------------------------------------------------------------------

export async function loadBundeslandPage(
  bundesland: string,
  category: string | null,
  timeFilter: 'heute' | 'wochenende' | null,
  locale: AppLocale = 'de',
): Promise<LandingPageData | null> {
  if (!isValidBundesland(bundesland)) return null;

  // fn-17: alle sichtbaren Strings kommen aus messages/<locale>.json.
  // DE-Werte sind byte-identisch zur vorherigen Inline-Fassung.
  const t = (await getTranslations({ locale, namespace: 'HubLanding' })) as Translator;
  const tCat = (await getTranslations({ locale, namespace: 'Categories' })) as Translator;
  const tFaq = (await getTranslations({ locale, namespace: 'HubFAQ' })) as Translator;

  const blName = locale === 'de'
    ? getBundeslandName(bundesland)!
    : bundeslandDisplayName(bundesland, locale);
  // Localized category display name (DB value stays German everywhere else).
  const catDisplay = category
    ? (CATEGORY_MESSAGE_KEYS[category] ? tCat(CATEGORY_MESSAGE_KEYS[category]) : category)
    : null;
  const supabase = getReadClient();

  // Build query
  const sortByDate = timeFilter === 'heute';
  const { events, totalCount } = await queryEvents(supabase, {
    bundesland,
    category,
    timeFilter,
    sortByDate,
  });

  // Build page elements
  const basePath = `/${bundesland}`;
  const title = buildTitle(blName, catDisplay, timeFilter, t);
  const subtitle = t('subtitle', { count: totalCount });

  const breadcrumbs = buildBreadcrumbs(blName, basePath, catDisplay, category, timeFilter, t);
  const filterChips = buildFilterChips(basePath, category, timeFilter, t, tCat);
  const internalLinks = buildBundeslandLinks(bundesland, blName, category, locale, t, tCat);
  // Canonical pathname for JSON-LD URLs — matches what generateMetadata
  // returns and what the route actually resolves to.
  const pathname = [basePath, category ? getCategorySlug(category) : null, timeFilter]
    .filter((p): p is string => Boolean(p))
    .join('/');
  let metaExtra = '';
  if (timeFilter) {
    metaExtra += t(timeFilter === 'heute' ? 'metaExtraToday' : 'metaExtraWeekend');
  }
  if (catDisplay) metaExtra += ` — ${catDisplay}`;
  const metaDescription = t('metaDescription', { count: totalCount, name: blName, extra: metaExtra });
  const faqEntries = faqForBundesland({ where: blName, category: catDisplay, timeFilter, t: tFaq });
  const jsonLd = buildJsonLd({
    title,
    description: metaDescription,
    totalCount,
    events,
    pathname: pathname.startsWith('/') ? pathname : `/${pathname}`,
    breadcrumbs,
    faqEntries,
    locale,
  });
  const paginationParams = buildPaginationParams({
    bundesland,
    category,
    timeFilter,
    sortByDate,
  });

  // The root layout's title.template already appends " | LassTreffen.at",
  // so we keep metaTitle brand-free here. Including the suffix again would
  // render a double-brand title (e.g. "Events Wien | LassTreffen.at | LassTreffen.at")
  // and trips Bing's "Title too long" warning.
  const metaTitle = title;

  // Only the ROOT page for each Bundesland carries the editorial intro
  // (no category, no time filter). Sub-views inherit from the crawlable
  // parent — avoids duplicate-content across the hundred permutations.
  // fn-17: die kuratierten Intros leben jetzt in messages/<locale>.json
  // (Namespace HubIntros, DE byte-identisch zu src/content/landing-intros.ts).
  let intro: LandingPageData['intro'];
  if (!category && !timeFilter) {
    const tIntro = (await getTranslations({ locale, namespace: 'HubIntros' })) as Translator;
    // has()-Guard: NICHT jeder gueltige Bundesland-Slug hat ein kuratiertes
    // Intro — `at-de-ch` ist eine Pseudo-Region (src/lib/bundeslaender.ts) und
    // war schon im alten BUNDESLAND_INTROS-Objekt nicht enthalten. Ohne den
    // Guard rendert next-intl den rohen Key ("HubIntros.at-de-ch.lead") als
    // sichtbaren Text. Fehlendes Intro = gar kein Intro-Block, exakt wie vorher.
    if (tIntro.has(`${bundesland}.lead`)) {
      intro = {
        lead: tIntro(`${bundesland}.lead`),
        body: tIntro(`${bundesland}.body`),
        tips: tIntro.has(`${bundesland}.tips`) ? tIntro(`${bundesland}.tips`) : undefined,
      };
    }
  }

  return {
    events,
    totalCount,
    title,
    subtitle,
    breadcrumbs,
    filterChips,
    internalLinks,
    jsonLd,
    paginationParams,
    metaTitle,
    metaDescription,
    intro,
  };
}

// ---------------------------------------------------------------------------
// Stadt page data
// ---------------------------------------------------------------------------

export async function loadStadtPage(
  cityConfig: LandingCity,
  category: string | null,
  timeFilter: 'heute' | 'wochenende' | null,
  locale: AppLocale = 'de',
): Promise<LandingPageData> {
  const t = (await getTranslations({ locale, namespace: 'HubLanding' })) as Translator;
  const tCat = (await getTranslations({ locale, namespace: 'Categories' })) as Translator;
  const tFaq = (await getTranslations({ locale, namespace: 'HubFAQ' })) as Translator;
  const catDisplay = category
    ? (CATEGORY_MESSAGE_KEYS[category] ? tCat(CATEGORY_MESSAGE_KEYS[category]) : category)
    : null;
  const supabase = getReadClient();
  const sortByDate = timeFilter === 'heute';

  const { events, totalCount } = await queryEvents(supabase, {
    bundesland:
      cityConfig.filterMode === 'bundesland' ? cityConfig.bundesland : null,
    city: cityConfig.filterMode === 'city' ? cityConfig.name : null,
    category,
    timeFilter,
    sortByDate,
  });

  const basePath = `/stadt/${cityConfig.slug}`;
  const title = buildTitle(cityConfig.name, catDisplay, timeFilter, t);
  const subtitle = t('subtitle', { count: totalCount });

  const breadcrumbs = buildBreadcrumbs(
    cityConfig.name,
    basePath,
    catDisplay,
    category,
    timeFilter,
    t,
  );
  const filterChips = buildFilterChips(basePath, category, timeFilter, t, tCat);
  const internalLinks = buildStadtLinks(cityConfig, category, locale, t, tCat);
  const pathname = [basePath, category ? getCategorySlug(category) : null, timeFilter]
    .filter((p): p is string => Boolean(p))
    .join('/');
  let metaExtra = '';
  if (timeFilter) {
    metaExtra += t(timeFilter === 'heute' ? 'metaExtraToday' : 'metaExtraWeekend');
  }
  if (catDisplay) metaExtra += ` — ${catDisplay}`;
  const metaDescription = t('metaDescription', { count: totalCount, name: cityConfig.name, extra: metaExtra });
  const faqEntries = faqForBundesland({ where: cityConfig.name, category: catDisplay, timeFilter, t: tFaq });
  const jsonLd = buildJsonLd({
    title,
    description: metaDescription,
    totalCount,
    events,
    pathname: pathname.startsWith('/') ? pathname : `/${pathname}`,
    breadcrumbs,
    faqEntries,
    locale,
  });
  const paginationParams = buildPaginationParams({
    bundesland:
      cityConfig.filterMode === 'bundesland' ? cityConfig.bundesland : null,
    city: cityConfig.filterMode === 'city' ? cityConfig.name : null,
    category,
    timeFilter,
    sortByDate,
  });

  // The root layout's title.template already appends " | LassTreffen.at",
  // so we keep metaTitle brand-free here. Including the suffix again would
  // render a double-brand title (e.g. "Events Wien | LassTreffen.at | LassTreffen.at")
  // and trips Bing's "Title too long" warning.
  const metaTitle = title;

  // Only the Stadt root page shows the intro — same rationale as the
  // Bundesland root pages above.
  const intro = (!category && !timeFilter) ? STADT_INTROS[cityConfig.slug] : undefined;

  return {
    events,
    totalCount,
    title,
    subtitle,
    breadcrumbs,
    filterChips,
    internalLinks,
    jsonLd,
    paginationParams,
    metaTitle,
    metaDescription,
    intro,
  };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface QueryParams {
  bundesland?: string | null;
  city?: string | null;
  category: string | null;
  timeFilter: 'heute' | 'wochenende' | null;
  sortByDate: boolean;
}

async function queryEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: QueryParams,
): Promise<{ events: Event[]; totalCount: number }> {
  const today = new Date().toISOString().split('T')[0];

  // count='estimated' statt 'exact' — landing-page paginator nutzt estimated total
  // count, exact count macht zweite Vollscan-Query auf der 175k events-Tabelle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('events') as any).select(
    'id, title, description, start_date, end_date, location_name, address, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, event_score, quality_score, venue_id',
    { count: 'estimated' },
  );

  // Only published, quality-gated, future events.
  // publish_status ist seit 2026-04-29 NOT NULL DEFAULT 'published', kein OR IS NULL nötig.
  query = query
    .in('publish_status', ['published', 'published_low_confidence'])
    .gte('start_date', today)
    .gte('quality_score', MIN_QUALITY);

  // Bundesland filter
  if (params.bundesland) {
    query = query.eq('bundesland', params.bundesland);
  }

  // City filter (venue.city + address fallback)
  if (params.city) {
    const { data: venues } = await supabase
      .from('venues')
      .select('id')
      .ilike('city', params.city);

    const venueIds = (venues ?? []).map(
      (v: { id: string }) => v.id,
    );

    if (venueIds.length > 0) {
      query = query.or(
        `venue_id.in.(${venueIds.join(',')}),address.ilike.%${params.city}%`,
      );
    } else {
      query = query.ilike('address', `%${params.city}%`);
    }
  }

  // Category filter
  if (params.category) {
    query = query.eq('category', params.category);
  }

  // Time filter
  if (params.timeFilter) {
    const range = getDateRange(params.timeFilter);
    query = query.gte('start_date', range.from).lt('start_date', range.to);
  }

  // Sort
  if (params.sortByDate) {
    query = query.order('start_date', { ascending: true });
  } else {
    query = query.order('event_score', { ascending: false, nullsFirst: false });
  }

  query = query.limit(PAGE_SIZE);

  const { data, count } = await query;

  return {
    events: (data ?? []) as Event[],
    totalCount: count ?? 0,
  };
}

function buildTitle(
  locationName: string,
  categoryDisplay: string | null,
  timeFilter: string | null,
  t: Translator,
): string {
  let title = '';
  if (categoryDisplay) {
    title = t('titleCategory', { category: categoryDisplay, name: locationName });
  } else {
    title = t('titleEvents', { name: locationName });
  }
  if (timeFilter === 'heute') {
    title += t('suffixToday');
  } else if (timeFilter === 'wochenende') {
    title += t('suffixWeekend');
  }
  return title;
}

function buildBreadcrumbs(
  locationName: string,
  basePath: string,
  categoryDisplay: string | null,
  category: string | null,
  timeFilter: string | null,
  t: Translator,
): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: t('crumbHome'), href: '/' },
    { label: locationName, href: category || timeFilter ? basePath : undefined },
  ];

  if (category) {
    const slug = getCategorySlug(category);
    crumbs.push({
      label: categoryDisplay ?? category,
      href: timeFilter ? `${basePath}/${slug}` : undefined,
    });
  }

  if (timeFilter) {
    crumbs.push({
      label: timeFilter === 'heute' ? t('crumbToday') : t('crumbWeekend'),
    });
  }

  // Last crumb has no href (current page)
  if (!category && !timeFilter) {
    delete crumbs[crumbs.length - 1].href;
  }

  return crumbs;
}

function buildFilterChips(
  basePath: string,
  activeCategory: string | null,
  activeTimeFilter: string | null,
  t: Translator,
  tCat: Translator,
): FilterChip[] {
  const chips: FilterChip[] = [];

  // Time chips
  chips.push({
    label: t('chipAll'),
    href: basePath,
    active: !activeCategory && !activeTimeFilter,
  });
  chips.push({
    label: t('chipToday'),
    href: activeCategory
      ? `${basePath}/${getCategorySlug(activeCategory)}/heute`
      : `${basePath}/heute`,
    active: activeTimeFilter === 'heute',
  });
  chips.push({
    label: t('chipWeekend'),
    href: activeCategory
      ? `${basePath}/${getCategorySlug(activeCategory)}/wochenende`
      : `${basePath}/wochenende`,
    active: activeTimeFilter === 'wochenende',
  });

  // Category chips (label localized, URL slug + active-check on DB name)
  for (const [slug, name] of CATEGORY_SLUGS) {
    chips.push({
      label: CATEGORY_MESSAGE_KEYS[name] ? tCat(CATEGORY_MESSAGE_KEYS[name]) : name,
      href: activeTimeFilter
        ? `${basePath}/${slug}/${activeTimeFilter}`
        : `${basePath}/${slug}`,
      active: activeCategory === name,
    });
  }

  return chips;
}

function buildBundeslandLinks(
  currentBundesland: string,
  blName: string,
  activeCategory: string | null,
  locale: AppLocale,
  t: Translator,
  tCat: Translator,
): LinkGroup[] {
  const groups: LinkGroup[] = [];

  // Categories in same Bundesland
  const categoryLinks = [...CATEGORY_SLUGS].map(([slug, name]) => ({
    label: CATEGORY_MESSAGE_KEYS[name] ? tCat(CATEGORY_MESSAGE_KEYS[name]) : name,
    href: `/${currentBundesland}/${slug}`,
  }));
  groups.push({ title: t('linksMoreIn', { name: blName }), links: categoryLinks });

  // Cities — link to the canonical /gemeinde city hubs. The old /stadt URLs
  // now 301-redirect there; linking direct avoids the redirect hop and keeps
  // internal link equity flowing straight to the canonical page.
  const cityLinks = LANDING_CITIES.filter(
    (c) => c.filterMode === 'city',
  ).map((c) => ({
    label: c.name,
    href: `/gemeinde/${STADT_TO_GEMEINDE[c.slug] ?? c.slug}`,
  }));
  if (cityLinks.length > 0) {
    groups.push({ title: t('linksCities'), links: cityLinks });
  }

  // Other Bundeslaender
  const otherBl = BUNDESLAENDER.filter(
    (b) => b.id !== 'all' && b.id !== currentBundesland,
  ).map((b) => ({
    label: locale === 'de' ? b.name : bundeslandDisplayName(b.id, locale),
    href: `/${b.id}${activeCategory ? `/${getCategorySlug(activeCategory)}` : ''}`,
  }));
  groups.push({ title: t('linksOtherRegions'), links: otherBl });

  return groups;
}

function buildStadtLinks(
  currentCity: LandingCity,
  activeCategory: string | null,
  locale: AppLocale,
  t: Translator,
  tCat: Translator,
): LinkGroup[] {
  const groups: LinkGroup[] = [];

  // Categories in same city
  const categoryLinks = [...CATEGORY_SLUGS].map(([slug, name]) => ({
    label: CATEGORY_MESSAGE_KEYS[name] ? tCat(CATEGORY_MESSAGE_KEYS[name]) : name,
    href: `/stadt/${currentCity.slug}/${slug}`,
  }));
  groups.push({ title: t('linksMoreIn', { name: currentCity.name }), links: categoryLinks });

  // Other cities
  const otherCities = LANDING_CITIES.filter(
    (c) => c.slug !== currentCity.slug && c.filterMode === 'city',
  ).map((c) => ({
    label: c.name,
    href: `/stadt/${c.slug}`,
  }));
  if (otherCities.length > 0) {
    groups.push({ title: 'Andere Stadte', links: otherCities });
  }

  // Bundeslaender
  const blLinks = BUNDESLAENDER.filter((b) => b.id !== 'all').map((b) => ({
    label: locale === 'de' ? b.name : bundeslandDisplayName(b.id, locale),
    href: `/${b.id}${activeCategory ? `/${getCategorySlug(activeCategory)}` : ''}`,
  }));
  groups.push({ title: 'Regionen', links: blLinks });

  return groups;
}

/**
 * Emit a `@graph` wrapping four coordinated schemas:
 *   1. ItemList        — ranked list of events for Rich Results.
 *   2. CollectionPage  — page-level context so Google knows this is a
 *                        curated list rather than organic search results.
 *   3. BreadcrumbList   — nav hierarchy for Sitelinks + Overview boxes.
 *   4. FAQPage          — 3-5 Q/A pairs tailored to the page context
 *                         (where + category + timeFilter). Eligible for
 *                         featured snippets and AI-search citations.
 *
 * All four share the canonical page URL via `@id` references so crawlers
 * treat them as parts of the same entity.
 */
function buildJsonLd(params: {
  title: string;
  description: string;
  totalCount: number;
  events: Event[];
  pathname: string;                                            // "/wien" or "/stadt/graz/musik/heute"
  breadcrumbs: { label: string; href?: string }[];
  faqEntries: FAQEntry[];
  locale: AppLocale;
}): object {
  const { title, description, totalCount, events, pathname, breadcrumbs, faqEntries, locale } = params;
  // fn-17: EN-Seiten leben unter /en — Canonical-/Breadcrumb-URLs und
  // inLanguage müssen die eigene Sprachversion referenzieren.
  const localePrefix = locale === 'en' ? '/en' : '';
  const pageUrl = `${BASE_URL}${localePrefix}${pathname}`;

  const itemList = {
    '@type': 'ItemList',
    '@id': `${pageUrl}#itemlist`,
    name: title,
    numberOfItems: totalCount,
    itemListElement: events.slice(0, 10).map((event, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: event.title,
        startDate: event.start_date,
        ...(event.end_date ? { endDate: event.end_date } : {}),
        location: {
          '@type': 'Place',
          name: event.location_name ?? event.address ?? 'Österreich',
        },
        ...(event.image_url ? { image: event.image_url } : {}),
      },
    })),
  };

  const collectionPage = {
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#page`,
    url: pageUrl,
    name: title,
    description,
    inLanguage: locale === 'en' ? 'en' : 'de-AT',
    isPartOf: { '@id': `${BASE_URL}${localePrefix}/#website` }, // matches root layout WebSite
    about: { '@id': `${pageUrl}#itemlist` },
  };

  // Breadcrumb: prepend Home, use href for intermediates, omit for current.
  const breadcrumbList = {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumbs`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}${localePrefix}` },
      ...breadcrumbs.map((b, idx) => ({
        '@type': 'ListItem',
        position: idx + 2,
        name: b.label,
        ...(b.href
          ? { item: `${BASE_URL}${b.href === '/' ? (localePrefix || '/') : `${localePrefix}${b.href}`}` }
          : {}),
      })),
    ],
  };

  const faqPage = buildFAQPageSchema(faqEntries);

  return {
    '@context': 'https://schema.org',
    '@graph': [itemList, collectionPage, breadcrumbList, ...(faqPage ? [faqPage] : [])],
  };
}

function buildPaginationParams(params: QueryParams): Record<string, string> {
  const p: Record<string, string> = {};

  if (params.bundesland) p.bundesland = params.bundesland;
  if (params.city) p.city = params.city;
  if (params.category) p.category = params.category;

  if (params.timeFilter) {
    const range = getDateRange(params.timeFilter as 'heute' | 'wochenende');
    p.dateFrom = range.from;
    p.dateTo = range.to;
  }

  p.minQuality = String(MIN_QUALITY);
  p.sort = params.sortByDate ? 'date' : 'score';

  return p;
}
