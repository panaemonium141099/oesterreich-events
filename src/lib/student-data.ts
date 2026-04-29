/**
 * Server-side data loading for student landing pages.
 *
 * Uses the same computeStudentScore() function as the Events API
 * to ensure pagination parity. Offset-based pagination (not cursor)
 * because scores are computed at query time.
 */

import { createClient } from '@supabase/supabase-js';
import type { Event } from '@/types/events';
import {
  STUDENT_CITIES,
  STUDENT_FILTERS,
  getCategoryFromSlug,
  getCategorySlug,
  getDateRange,
  type StudentCity,
} from './landing-slugs';
import { computeStudentScore, isFreeEvent, MIN_STUDENT_SCORE } from './utils/student-score';
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

export interface StudentPageData {
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
// Student Index Page
// ---------------------------------------------------------------------------

export interface StudentIndexData {
  cities: { city: StudentCity; eventCount: number }[];
  todayEvents: Event[];
}

export async function loadStudentIndex(): Promise<StudentIndexData> {
  const supabase = getReadClient();
  const today = new Date().toISOString().split('T')[0];

  // ─── Per-city counts in ONE query, not N ───────────────────────────
  // The previous version did `for city of STUDENT_CITIES` with one
  // round-trip per city — exactly the N+1 anti-pattern. Even after
  // parallelising it was still N requests against PostgREST, eating
  // connection-pool slots.
  //
  // Now: a single GROUP BY query that returns counts for all
  // bundesländer at once. Trade-off: this counts events meeting the
  // basic quality bar (`quality_score >= MIN_QUALITY`) and skips the
  // TypeScript-side `computeStudentScore` filter. That filter is still
  // applied on the dedicated /studenten/[city] pages where the actual
  // event list is rendered — the index just needs an indicator of how
  // many events are *available*, not a precise post-filter count.
  //
  // For pages where the exact count matters, query that page directly.
  const todayRange = getDateRange('heute');

  const studentBundeslaender = STUDENT_CITIES.map((c) => c.bundesland);

  const [countResult, todayResult] = await Promise.all([
    // ONE query, server-side aggregation. RPC returns N rows
    // (where N = number of bundesländer that have events), not
    // thousands. See migrations/20260428193100_student_index_rpc.sql.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)('student_event_counts_by_bundesland', {
      p_min_quality: MIN_QUALITY,
      p_bundeslaender: studentBundeslaender,
    }),
    // Today's top student events across all student bundesländer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('events') as any)
      .select('id, title, start_date, end_date, location_name, image_url, category, price_min, price_text, event_score, quality_score, bundesland, address')
      .in('publish_status', ['published', 'published_low_confidence'])
      .gte('start_date', todayRange.from)
      .lt('start_date', todayRange.to)
      .gte('quality_score', MIN_QUALITY)
      .in('bundesland', studentBundeslaender)
      .order('event_score', { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  // RPC returns rows like { bundesland: 'wien', event_count: 1234 }
  type CountRow = { bundesland: string; event_count: number | string };
  const bundeslandCounts = new Map<string, number>();
  for (const row of ((countResult.data ?? []) as CountRow[])) {
    bundeslandCounts.set(row.bundesland, Number(row.event_count));
  }

  const cities = STUDENT_CITIES.map((city) => ({
    city,
    eventCount: bundeslandCounts.get(city.bundesland) ?? 0,
  }));

  const todayScored = scoreAndFilter(((todayResult.data ?? []) as Event[]))
    .slice(0, 4);

  return { cities, todayEvents: todayScored.map((s) => s.event) };
}

// ---------------------------------------------------------------------------
// Student City Page
// ---------------------------------------------------------------------------

export async function loadStudentPage(
  city: StudentCity,
  filter: string | null,
): Promise<StudentPageData | null> {
  const supabase = getReadClient();

  // Parse filter
  const category = filter ? getCategoryFromSlug(filter) : null;
  const isFree = filter === 'gratis';
  const isTime = filter === 'heute' || filter === 'wochenende';
  const timeFilter = isTime ? (filter as 'heute' | 'wochenende') : null;

  // Validate filter
  if (filter && !category && !isFree && !isTime) {
    if (!STUDENT_FILTERS.has(filter)) return null;
  }

  // Load, score, filter
  const candidates = await loadCandidates(supabase, city, category, timeFilter);
  let scored = scoreAndFilter(candidates);

  // Apply free filter
  if (isFree) {
    scored = scored.filter((s) => isFreeEvent(s.event));
  }

  // Sort: studentScore DESC, then context-dependent secondary
  const useTimeSortSecondary = timeFilter === 'heute' || isFree;
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (useTimeSortSecondary) {
      return new Date(a.event.start_date).getTime() - new Date(b.event.start_date).getTime();
    }
    return (b.event.event_score ?? 0) - (a.event.event_score ?? 0);
  });

  const totalCount = scored.length;
  const events = scored.slice(0, PAGE_SIZE).map((s) => s.event);

  // Build page data
  const basePath = `/studenten/${city.slug}`;
  const title = buildTitle(city.name, category, timeFilter, isFree);
  const subtitle = `${totalCount} Veranstaltung${totalCount !== 1 ? 'en' : ''}`;

  const breadcrumbs = buildBreadcrumbs(city.name, basePath, filter);
  const filterChips = buildFilterChips(basePath, filter);
  const internalLinks = buildLinks(city);
  const jsonLd = buildJsonLd(title, totalCount, events);
  const paginationParams = buildPaginationParams(city, category, timeFilter, isFree);

  const metaTitle = `${title} | LassTreffen.at`;
  const metaDescription = `Entdecke ${totalCount} Events fur Studenten in ${city.name}${filter ? ` — ${filter}` : ''}. Nightlife, gratis Events und mehr.`;

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
// Shared internals
// ---------------------------------------------------------------------------

interface ScoredEvent {
  event: Event;
  score: number;
}

async function loadCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  city: StudentCity,
  category: string | null,
  timeFilter: 'heute' | 'wochenende' | null,
): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('events')
    .select(
      'id, title, description, start_date, end_date, location_name, address, bundesland, latitude, longitude, category, image_url, price_text, price_min, price_max, event_score, quality_score, venue_id',
    )
    .in('publish_status', ['published', 'published_low_confidence'])
    .gte('start_date', today)
    .gte('quality_score', MIN_QUALITY)
    .eq('bundesland', city.bundesland);

  if (category) {
    query = query.eq('category', category);
  }

  if (timeFilter) {
    const range = getDateRange(timeFilter);
    query = query.gte('start_date', range.from).lt('start_date', range.to);
  }

  // Load all candidates (no DB limit — offset pagination needs full set)
  query = query.order('event_score', { ascending: false, nullsFirst: false }).limit(500);

  const { data } = await query;
  return (data ?? []) as Event[];
}

function scoreAndFilter(candidates: Event[]): ScoredEvent[] {
  return candidates
    .map((event) => ({
      event,
      score: computeStudentScore(event),
    }))
    .filter((s) => s.score >= MIN_STUDENT_SCORE);
}

function buildTitle(
  cityName: string,
  category: string | null,
  timeFilter: string | null,
  isFree: boolean,
): string {
  let title = '';
  if (category) {
    title = `${category} fur Studenten in ${cityName}`;
  } else if (isFree) {
    title = `Gratis Events fur Studenten in ${cityName}`;
  } else {
    title = `Events fur Studenten in ${cityName}`;
  }
  if (timeFilter === 'heute') title += ' heute';
  else if (timeFilter === 'wochenende') title += ' am Wochenende';
  return title;
}

function buildBreadcrumbs(
  cityName: string,
  basePath: string,
  filter: string | null,
): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: 'Home', href: '/' },
    { label: 'Studenten', href: filter ? '/studenten' : undefined },
    { label: cityName, href: filter ? basePath : undefined },
  ];

  if (filter) {
    const label =
      filter === 'heute'
        ? 'Heute'
        : filter === 'wochenende'
          ? 'Wochenende'
          : filter === 'gratis'
            ? 'Gratis'
            : getCategoryFromSlug(filter) ?? filter;
    crumbs.push({ label });
  }

  if (!filter) {
    delete crumbs[crumbs.length - 1].href;
  }

  return crumbs;
}

function buildFilterChips(
  basePath: string,
  activeFilter: string | null,
): FilterChip[] {
  return [
    { label: 'Alle', href: basePath, active: !activeFilter },
    { label: 'Heute', href: `${basePath}/heute`, active: activeFilter === 'heute' },
    { label: 'Wochenende', href: `${basePath}/wochenende`, active: activeFilter === 'wochenende' },
    { label: 'Gratis', href: `${basePath}/gratis`, active: activeFilter === 'gratis' },
    { label: 'Nightlife', href: `${basePath}/nightlife`, active: activeFilter === 'nightlife' },
    { label: 'Musik', href: `${basePath}/musik`, active: activeFilter === 'musik' },
    { label: 'Kultur', href: `${basePath}/kultur`, active: activeFilter === 'kultur' },
  ];
}

function buildLinks(currentCity: StudentCity): LinkGroup[] {
  const groups: LinkGroup[] = [];

  // Other student cities
  const otherCities = STUDENT_CITIES.filter((c) => c.slug !== currentCity.slug).map((c) => ({
    label: c.name,
    href: `/studenten/${c.slug}`,
  }));
  if (otherCities.length > 0) {
    groups.push({ title: 'Andere Studenten-Stadte', links: otherCities });
  }

  // Link to general city/region page
  groups.push({
    title: 'Alle Events',
    links: [
      { label: `Alle Events in ${currentCity.name}`, href: `/stadt/${currentCity.slug}` },
      { label: `Region ${currentCity.bundesland}`, href: `/${currentCity.bundesland}` },
    ],
  });

  return groups;
}

function buildJsonLd(title: string, totalCount: number, events: Event[]): object {
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
          name: event.location_name ?? 'Osterreich',
        },
        ...(event.image_url ? { image: event.image_url } : {}),
      },
    })),
  };
}

function buildPaginationParams(
  city: StudentCity,
  category: string | null,
  timeFilter: 'heute' | 'wochenende' | null,
  isFree: boolean,
): Record<string, string> {
  const p: Record<string, string> = {
    bundesland: city.bundesland,
    studentScore: 'true',
    minQuality: String(MIN_QUALITY),
  };

  if (category) p.category = category;
  if (isFree) p.freeOnly = 'true';

  if (timeFilter) {
    const range = getDateRange(timeFilter);
    p.dateFrom = range.from;
    p.dateTo = range.to;
  }

  return p;
}
