// src/lib/pipeline/normalize-venue.ts

const ARTICLES = /\b(der|die|das|the|ein|eine)\b/gi;
// Abbreviation expansions: [pattern, replacement]
// Patterns are applied in order; use regex strings for flexibility.
const ABBREVIATION_RULES: [RegExp, string][] = [
  [/str\./gi, 'strasse'],
  [/g\./gi, 'gasse'],
  [/pl\./gi, 'platz'],
  [/nr\.?\s*/gi, ''],
];
const PUNCTUATION = /[.,;:!?'"()\[\]{}]/g;
const MULTI_SPACE = /\s{2,}/g;

// City name variants for stripping
const CITY_SUFFIXES = /\b(wien|vienna|graz|linz|salzburg|innsbruck|klagenfurt|bregenz|eisenstadt|st\.?\s*pölten|villach|wels|steyr|dornbirn|feldkirch|leoben|wiener\s*neustadt)\b/gi;

// Generic venue names that should NOT be used as hard aliases
const GENERIC_VENUE_NAMES = new Set([
  'pfarrsaal', 'stadthalle', 'kulturhaus', 'gemeindezentrum',
  'veranstaltungszentrum', 'gemeindesaal', 'vereinshaus',
  'mehrzweckhalle', 'festsaal', 'turnhalle', 'sporthalle',
  'gasthaus', 'gasthof', 'wirtshaus', 'beisl',
  'kirche', 'pfarrkirche', 'dom', 'kapelle',
  'rathaus', 'bezirksamt', 'gemeindeamt',
  'schule', 'volksschule', 'hauptschule', 'gymnasium',
  'park', 'stadtpark', 'schlosspark',
]);

/**
 * Normalize a venue name for alias matching.
 * Returns the normalized string for comparison.
 */
export function normalizeVenueName(name: string): string {
  let result = name.normalize('NFC');
  result = result.toLowerCase().trim();

  // Expand abbreviations (before punctuation removal)
  for (const [pattern, replacement] of ABBREVIATION_RULES) {
    result = result.replace(pattern, replacement);
  }

  // Remove articles
  result = result.replace(ARTICLES, '');

  // Remove punctuation
  result = result.replace(PUNCTUATION, '');

  // Collapse whitespace
  result = result.replace(MULTI_SPACE, ' ').trim();

  return result;
}

/**
 * Normalize venue name and strip city suffix for broader matching.
 * "Flex Wien" → "flex"
 */
export function normalizeVenueNameCompact(name: string): string {
  let result = normalizeVenueName(name);
  result = result.replace(CITY_SUFFIXES, '');
  result = result.replace(MULTI_SPACE, ' ').trim();
  return result;
}

/**
 * Check if a venue name is generic (should not be a hard alias).
 */
export function isGenericVenueName(normalizedName: string): boolean {
  // Check if the entire normalized name (without city) is generic
  const compact = normalizedName.replace(CITY_SUFFIXES, '').replace(MULTI_SPACE, ' ').trim();
  return GENERIC_VENUE_NAMES.has(compact);
}

/**
 * Extract host from a URL.
 * "https://www.flex.at/events" → "flex.at"
 */
export function extractHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Haversine distance between two coordinates in meters.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
