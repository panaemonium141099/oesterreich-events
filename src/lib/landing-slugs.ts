/**
 * Landing page slug configuration.
 *
 * Central source of truth for all SEO landing page URL mappings:
 * Bundesland slugs, city slugs, category slugs, and time filters.
 */

import { BUNDESLAENDER } from './bundeslaender';
import { addViennaDays, viennaDayStart, viennaToday, viennaWeekday } from './utils/event-time';

// ---------------------------------------------------------------------------
// Category Slugs
// ---------------------------------------------------------------------------

/**
 * Map from URL slug → DB category name.
 *
 * Slugs are the SEO-facing path segment (`/wien/kultur`); values must match
 * the taxonomy v3 category names exactly (see docs/TAXONOMY.md), because
 * landing-data/student-data queries do `.eq('category', value)` and the DB
 * was migrated to these names via 20260423_taxonomy_v3_combined.sql.
 *
 * History: values used to be the OLD flat names (Kultur, Nightlife, Wein &
 * Kulinarik, Märkte, Feste & Brauchtum, Bildung, Familie, Natur). After the
 * v3 migration those stopped existing in the DB and every `/wien/kultur`-
 * style landing page silently showed 0 events — broken SEO across ~500 URLs.
 *
 * Two slugs (`feste`, `maerkte`) intentionally map to the same category
 * `Märkte & Feste` because those two old top-level categories were merged
 * in v3. Both URL paths keep working; CATEGORY_REVERSE picks `maerkte` as
 * the canonical outbound slug (last-write-wins on insertion order).
 */
export const CATEGORY_SLUGS = new Map<string, string>([
  ['musik', 'Musik'],
  ['kultur', 'Kultur & Bühne'],
  ['sport', 'Sport & Bewegung'],
  ['feste', 'Märkte & Feste'],
  ['maerkte', 'Märkte & Feste'],
  ['kulinarik', 'Essen & Trinken'],
  ['familie', 'Familie & Kinder'],
  ['natur', 'Natur & Abenteuer'],
  ['nightlife', 'Nightlife & Party'],
  ['bildung', 'Wissen & Karriere'],
  ['wellness', 'Wellness & Spiritualität'],
  ['community', 'Community & Freizeit'],
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
 * `from`/`to` are Vienna calendar days (YYYY-MM-DD, `to` exclusive) for URL
 * params; `fromIso`/`toIso` are the matching instants (00:00 Wien) for
 * Supabase `.gte()/.lt()` on start_date — a bare date there would compare
 * against 00:00 UTC and pull 00:00–02:00-Wien events onto the previous day.
 */
export function getDateRange(filter: 'heute' | 'wochenende'): {
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
} {
  const today = viennaToday();
  const dayOfWeek = viennaWeekday(today); // 0=Sun, 6=Sat

  let from: string;
  let to: string;
  if (filter === 'heute') {
    from = today;
    to = addViennaDays(today, 1);
  } else if (dayOfWeek === 0) {
    // Sunday — weekend is today through end of day
    from = today;
    to = addViennaDays(today, 1);
  } else if (dayOfWeek === 6) {
    // Saturday — weekend is today through Sunday
    from = today;
    to = addViennaDays(today, 2);
  } else {
    // Weekday — next Saturday 00:00 to Monday 00:00
    from = addViennaDays(today, 6 - dayOfWeek);
    to = addViennaDays(from, 2);
  }
  return {
    from,
    to,
    fromIso: viennaDayStart(from).toISOString(),
    toIso: viennaDayStart(to).toISOString(),
  };
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
