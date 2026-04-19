/**
 * Server-side data loading for landing pages.
 *
 * Shared between Bundesland and Stadt pages to avoid duplication.
 * Uses anon key (read-only, public data only).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
}

// ---------------------------------------------------------------------------
// Bundesland page data
// ---------------------------------------------------------------------------

export async function loadBundeslandPage(
  bundesland: string,
  category: string | null,
  timeFilter: 'heute' | 'wochenende' | null,
): Promise<LandingPageData | null> {
  if (!isValidBundesland(bundesland)) return null;

  const blName = getBundeslandName(bundesland)!;
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
  const title = buildTitle(blName, category, timeFilter);
  const subtitle = `${totalCount} Veranstaltung${totalCount !== 1 ? 'en' : ''}`;

  const breadcrumbs = buildBreadcrumbs(blName, basePath, category, timeFilter);
  const filterChips = buildFilterChips(basePath, category, timeFilter);
  const internalLinks = buildBundeslandLinks(bundesland, blName, category);
  const jsonLd = buildJsonLd(title, totalCount, events);
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
  const metaDescription = `Entdecke ${totalCount} Events in ${blName}${timeFilter ? ` ${timeFilter}` : ''}${category ? ` — ${category}` : ''}. Alle Veranstaltungen auf einen Blick.`;

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
  };
}

// ---------------------------------------------------------------------------
// Stadt page data
// ---------------------------------------------------------------------------

export async function loadStadtPage(
  cityConfig: LandingCity,
  category: string | null,
  timeFilter: 'heute' | 'wochenende' | null,
): Promise<LandingPageData> {
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
  const title = buildTitle(cityConfig.name, category, timeFilter);
  const subtitle = `${totalCount} Veranstaltung${totalCount !== 1 ? 'en' : ''}`;

  const breadcrumbs = buildBreadcrumbs(
    cityConfig.name,
    basePath,
    category,
    timeFilter,
  );
  const filterChips = buildFilterChips(basePath, category, timeFilter);
  const internalLinks = buildStadtLinks(cityConfig, category);
  const jsonLd = buildJsonLd(title, totalCount, events);
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
  const metaDescription = `Entdecke ${totalCount} Events in ${cityConfig.name}${timeFilter ? ` ${timeFilter}` : ''}${category ? ` — ${category}` : ''}. Alle Veranstaltungen auf einen Blick.`;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('events') as any).select(
    'id, title, description, start_date, end_date, location_name, address, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, event_score, quality_score, venue_id',
    { count: 'exact' },
  );

  // Only published, quality-gated, future events
  query = query
    .or(
      'publish_status.eq.published,publish_status.eq.published_low_confidence,publish_status.is.null',
    )
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
  category: string | null,
  timeFilter: string | null,
): string {
  let title = '';
  if (category) {
    title = `${category} in ${locationName}`;
  } else {
    title = `Events in ${locationName}`;
  }
  if (timeFilter === 'heute') {
    title += ' heute';
  } else if (timeFilter === 'wochenende') {
    title += ' am Wochenende';
  }
  return title;
}

function buildBreadcrumbs(
  locationName: string,
  basePath: string,
  category: string | null,
  timeFilter: string | null,
): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: 'Home', href: '/' },
    { label: locationName, href: category || timeFilter ? basePath : undefined },
  ];

  if (category) {
    const slug = getCategorySlug(category);
    crumbs.push({
      label: category,
      href: timeFilter ? `${basePath}/${slug}` : undefined,
    });
  }

  if (timeFilter) {
    crumbs.push({
      label: timeFilter === 'heute' ? 'Heute' : 'Wochenende',
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
): FilterChip[] {
  const chips: FilterChip[] = [];

  // Time chips
  chips.push({
    label: 'Alle',
    href: basePath,
    active: !activeCategory && !activeTimeFilter,
  });
  chips.push({
    label: 'Heute',
    href: activeCategory
      ? `${basePath}/${getCategorySlug(activeCategory)}/heute`
      : `${basePath}/heute`,
    active: activeTimeFilter === 'heute',
  });
  chips.push({
    label: 'Wochenende',
    href: activeCategory
      ? `${basePath}/${getCategorySlug(activeCategory)}/wochenende`
      : `${basePath}/wochenende`,
    active: activeTimeFilter === 'wochenende',
  });

  // Category chips
  for (const [slug, name] of CATEGORY_SLUGS) {
    chips.push({
      label: name,
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
): LinkGroup[] {
  const groups: LinkGroup[] = [];

  // Categories in same Bundesland
  const categoryLinks = [...CATEGORY_SLUGS].map(([slug, name]) => ({
    label: name,
    href: `/${currentBundesland}/${slug}`,
  }));
  groups.push({ title: `Mehr in ${blName}`, links: categoryLinks });

  // Cities
  const cityLinks = LANDING_CITIES.filter(
    (c) => c.filterMode === 'city',
  ).map((c) => ({
    label: c.name,
    href: `/stadt/${c.slug}`,
  }));
  if (cityLinks.length > 0) {
    groups.push({ title: 'Stadte', links: cityLinks });
  }

  // Other Bundeslaender
  const otherBl = BUNDESLAENDER.filter(
    (b) => b.id !== 'all' && b.id !== currentBundesland,
  ).map((b) => ({
    label: b.name,
    href: `/${b.id}${activeCategory ? `/${getCategorySlug(activeCategory)}` : ''}`,
  }));
  groups.push({ title: 'Andere Regionen', links: otherBl });

  return groups;
}

function buildStadtLinks(
  currentCity: LandingCity,
  activeCategory: string | null,
): LinkGroup[] {
  const groups: LinkGroup[] = [];

  // Categories in same city
  const categoryLinks = [...CATEGORY_SLUGS].map(([slug, name]) => ({
    label: name,
    href: `/stadt/${currentCity.slug}/${slug}`,
  }));
  groups.push({ title: `Mehr in ${currentCity.name}`, links: categoryLinks });

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
    label: b.name,
    href: `/${b.id}${activeCategory ? `/${getCategorySlug(activeCategory)}` : ''}`,
  }));
  groups.push({ title: 'Regionen', links: blLinks });

  return groups;
}

function buildJsonLd(
  title: string,
  totalCount: number,
  events: Event[],
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
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
          name: event.location_name ?? event.address ?? 'Osterreich',
        },
        ...(event.image_url ? { image: event.image_url } : {}),
      },
    })),
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
