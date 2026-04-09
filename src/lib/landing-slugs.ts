/**
 * Landing page slug configuration.
 *
 * Central source of truth for all SEO landing page URL mappings:
 * Bundesland slugs, city slugs, category slugs, and time filters.
 */

import { BUNDESLAENDER } from './bundeslaender';

// ---------------------------------------------------------------------------
// Category Slugs
// ---------------------------------------------------------------------------

/** Map from URL slug → DB category name (only high-volume categories) */
export const CATEGORY_SLUGS = new Map<string, string>([
  ['musik', 'Musik'],
  ['kultur', 'Kultur'],
  ['sport', 'Sport'],
  ['feste', 'Feste & Brauchtum'],
  ['maerkte', 'Märkte'],
  ['kulinarik', 'Wein & Kulinarik'],
  ['familie', 'Familie'],
  ['natur', 'Natur'],
  ['nightlife', 'Nightlife'],
  ['bildung', 'Bildung'],
]);

/** Reverse map: DB category name → URL slug */
const CATEGORY_REVERSE = new Map<string, string>();
for (const [slug, name] of CATEGORY_SLUGS) {
  CATEGORY_REVERSE.set(name, slug);
}

export function getCategoryFromSlug(slug: string): string | null {
  return CATEGORY_SLUGS.get(slug) ?? null;
}

export function getCategorySlug(categoryName: string): string | null {
  return CATEGORY_REVERSE.get(categoryName) ?? null;
}

// ---------------------------------------------------------------------------
// Time Filters
// ---------------------------------------------------------------------------

export const TIME_FILTERS = new Set(['heute', 'wochenende']);

export function isTimeFilter(slug: string): boolean {
  return TIME_FILTERS.has(slug);
}

/**
 * Returns date range for a time filter in Europe/Vienna timezone.
 * Both `from` and `to` are ISO date strings (YYYY-MM-DD) suitable for
 * Supabase .gte()/.lt() queries on start_date.
 */
export function getDateRange(filter: 'heute' | 'wochenende'): {
  from: string;
  to: string;
} {
  // Get current date in Vienna timezone
  const now = new Date();
  const viennaDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Europe/Vienna' }),
  );
  const year = viennaDate.getFullYear();
  const month = viennaDate.getMonth();
  const date = viennaDate.getDate();
  const dayOfWeek = viennaDate.getDay(); // 0=Sun, 6=Sat

  if (filter === 'heute') {
    const today = formatDate(year, month, date);
    const tomorrow = formatDate(year, month, date + 1);
    return { from: today, to: tomorrow };
  }

  // wochenende: Saturday 00:00 to Monday 00:00
  if (dayOfWeek === 0) {
    // Sunday — weekend is today through end of day
    const sunday = formatDate(year, month, date);
    const monday = formatDate(year, month, date + 1);
    return { from: sunday, to: monday };
  }
  if (dayOfWeek === 6) {
    // Saturday — weekend is today through Sunday
    const saturday = formatDate(year, month, date);
    const monday = formatDate(year, month, date + 2);
    return { from: saturday, to: monday };
  }
  // Weekday — next Saturday to Monday
  const daysUntilSaturday = 6 - dayOfWeek;
  const saturday = formatDate(year, month, date + daysUntilSaturday);
  const monday = formatDate(year, month, date + daysUntilSaturday + 2);
  return { from: saturday, to: monday };
}

function formatDate(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Bundesland Validation
// ---------------------------------------------------------------------------

const VALID_BUNDESLAENDER = new Set(
  BUNDESLAENDER.filter((b) => b.id !== 'all').map((b) => b.id),
);

export function isValidBundesland(slug: string): boolean {
  return VALID_BUNDESLAENDER.has(slug);
}

export function getBundeslandName(slug: string): string | null {
  const bl = BUNDESLAENDER.find((b) => b.id === slug);
  return bl?.name ?? null;
}

// ---------------------------------------------------------------------------
// City Configuration
// ---------------------------------------------------------------------------

export interface LandingCity {
  slug: string;
  name: string;
  bundesland: string;
  /** 'bundesland' = filter by bundesland (Wien), 'city' = filter by venue.city + address */
  filterMode: 'bundesland' | 'city';
}

/**
 * Cities with dedicated landing pages.
 * Only cities with >= 20 published future events qualify.
 * This list is intentionally static and grows manually as data coverage improves.
 */
export const LANDING_CITIES: LandingCity[] = [
  {
    slug: 'wien',
    name: 'Wien',
    bundesland: 'wien',
    filterMode: 'bundesland',
  },
  {
    slug: 'graz',
    name: 'Graz',
    bundesland: 'steiermark',
    filterMode: 'city',
  },
  {
    slug: 'innsbruck',
    name: 'Innsbruck',
    bundesland: 'tirol',
    filterMode: 'city',
  },
  {
    slug: 'salzburg-stadt',
    name: 'Salzburg',
    bundesland: 'salzburg',
    filterMode: 'city',
  },
  {
    slug: 'linz',
    name: 'Linz',
    bundesland: 'oberoesterreich',
    filterMode: 'city',
  },
  {
    slug: 'klagenfurt',
    name: 'Klagenfurt',
    bundesland: 'kaernten',
    filterMode: 'city',
  },
];

const CITY_MAP = new Map<string, LandingCity>();
for (const city of LANDING_CITIES) {
  CITY_MAP.set(city.slug, city);
}

export function isValidCity(slug: string): boolean {
  return CITY_MAP.has(slug);
}

export function getCityConfig(slug: string): LandingCity | null {
  return CITY_MAP.get(slug) ?? null;
}

/**
 * Cities that should NOT be generated under /stadt/ because they
 * are identical to their Bundesland route (Wien = Bundesland + Stadt).
 * These get a 301 redirect from /stadt/[slug] to /[bundesland].
 */
export function getCityRedirect(slug: string): string | null {
  const city = CITY_MAP.get(slug);
  if (city?.filterMode === 'bundesland') {
    return `/${city.bundesland}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Student Configuration
// ---------------------------------------------------------------------------

export interface StudentCity {
  slug: string;
  name: string;
  bundesland: string;
}

/**
 * Cities with dedicated student landing pages.
 * Only cities with enough student-relevant events qualify.
 * Linz and Klagenfurt are excluded until data coverage improves.
 */
export const STUDENT_CITIES: StudentCity[] = [
  { slug: 'wien', name: 'Wien', bundesland: 'wien' },
  { slug: 'graz', name: 'Graz', bundesland: 'steiermark' },
  { slug: 'innsbruck', name: 'Innsbruck', bundesland: 'tirol' },
  { slug: 'salzburg', name: 'Salzburg', bundesland: 'salzburg' },
];

const STUDENT_CITY_MAP = new Map<string, StudentCity>();
for (const city of STUDENT_CITIES) {
  STUDENT_CITY_MAP.set(city.slug, city);
}

export function isValidStudentCity(slug: string): boolean {
  return STUDENT_CITY_MAP.has(slug);
}

export function getStudentCityConfig(slug: string): StudentCity | null {
  return STUDENT_CITY_MAP.get(slug) ?? null;
}

/** Filters available on student pages */
export const STUDENT_FILTERS = new Set([
  'heute',
  'wochenende',
  'gratis',
  'nightlife',
  'musik',
  'kultur',
]);
