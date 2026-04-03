/**
 * Location Normalizer for Austrian place names.
 *
 * Uses a GeoNames AT database (34k+ entries) to:
 * 1. Normalize abbreviations ("St." → "Sankt", "a.d." → "an der")
 * 2. Match location names to canonical entries with coordinates
 * 3. Fuzzy-match typos (Levenshtein distance ≤ 2)
 * 4. Disambiguate duplicates via PLZ or Bundesland
 */
import { readFileSync } from 'fs';
import { join } from 'path';

interface GeoEntry {
  name: string;
  ascii: string;
  alt: string[];
  lat: number;
  lng: number;
  bundesland: string;
  pop: number;
  type: string;
}

interface NormalizeResult {
  canonicalName: string;
  latitude: number;
  longitude: number;
  bundesland: string;
  confidence: 'exact' | 'normalized' | 'fuzzy' | 'none';
}

// Lazy-loaded database
let geoDb: GeoEntry[] | null = null;
let normalizedIndex: Map<string, GeoEntry[]> | null = null;

function loadDb(): GeoEntry[] {
  if (geoDb) return geoDb;
  try {
    const path = join(process.cwd(), 'data', 'geonames-at.json');
    geoDb = JSON.parse(readFileSync(path, 'utf8'));
    return geoDb!;
  } catch {
    console.warn('[location-normalizer] GeoNames DB not found — run: npx tsx src/scripts/build-geonames-db.ts');
    geoDb = [];
    return geoDb;
  }
}

function buildIndex(): Map<string, GeoEntry[]> {
  if (normalizedIndex) return normalizedIndex;
  const db = loadDb();
  normalizedIndex = new Map();

  for (const entry of db) {
    // Index by normalized name
    const norm = normalizeString(entry.name);
    if (!normalizedIndex.has(norm)) normalizedIndex.set(norm, []);
    normalizedIndex.get(norm)!.push(entry);

    // Also index by ascii name
    const ascii = normalizeString(entry.ascii);
    if (ascii !== norm) {
      if (!normalizedIndex.has(ascii)) normalizedIndex.set(ascii, []);
      normalizedIndex.get(ascii)!.push(entry);
    }

    // Index alternative names
    for (const alt of entry.alt) {
      const altNorm = normalizeString(alt);
      if (altNorm && altNorm !== norm) {
        if (!normalizedIndex.has(altNorm)) normalizedIndex.set(altNorm, []);
        normalizedIndex.get(altNorm)!.push(entry);
      }
    }
  }

  return normalizedIndex;
}

/**
 * Normalize an Austrian place name string for matching.
 * Expands abbreviations and standardizes formatting.
 */
export function normalizeString(input: string): string {
  let s = input.trim();

  // Lowercase
  s = s.toLowerCase();

  // Expand common Austrian abbreviations
  s = s.replace(/\bst\.\s*/gi, 'sankt ');
  s = s.replace(/\bst\s+(?=[a-zäöü])/gi, 'sankt ');
  s = s.replace(/\ba\.?\s*d\.\s*/gi, 'an der ');
  s = s.replace(/\ba\.\s*(?=[A-ZÄÖÜ])/g, 'am ');
  s = s.replace(/\bi\.\s*/gi, 'im ');
  s = s.replace(/\bb\.\s*/gi, 'bei ');
  s = s.replace(/\bo\.\s*/gi, 'ob ');

  // Normalize umlauts for matching (keep both forms)
  // Don't replace — just normalize spacing/punctuation

  // Remove parenthetical suffixes like "(Gemeinde)" or "(Stadt)"
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ');

  // Normalize separators
  s = s.replace(/\//g, ' ');
  s = s.replace(/[-–—]/g, ' ');
  s = s.replace(/,\s*/g, ' ');

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Short-circuit for very different lengths
  if (Math.abs(a.length - b.length) > 3) return Math.max(a.length, b.length);

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Disambiguate multiple GeoNames matches using PLZ or Bundesland.
 */
function disambiguate(
  matches: GeoEntry[],
  plz?: string,
  bundesland?: string,
): GeoEntry {
  if (matches.length === 1) return matches[0];

  // Try Bundesland filter
  if (bundesland) {
    const blNorm = bundesland.toLowerCase();
    const blMatches = matches.filter(m =>
      m.bundesland.toLowerCase().includes(blNorm) ||
      blNorm.includes(m.bundesland.toLowerCase())
    );
    if (blMatches.length === 1) return blMatches[0];
    if (blMatches.length > 1) matches = blMatches;
  }

  // Pick the one with highest population (most likely the intended match)
  return matches.reduce((best, m) => m.pop > best.pop ? m : best, matches[0]);
}

/**
 * Normalize a location name and return canonical coordinates.
 *
 * @param locationName - Raw location name from scraper (e.g., "St. Georgen am Leithagebirge")
 * @param postalCode - Optional PLZ for disambiguation
 * @param bundesland - Optional Bundesland for disambiguation
 * @returns Normalized result with coordinates, or null if no match
 */
export function normalizeLocation(
  locationName: string,
  postalCode?: string,
  bundesland?: string,
): NormalizeResult | null {
  if (!locationName || locationName.length < 2) return null;

  const index = buildIndex();
  const norm = normalizeString(locationName);

  // 1. Exact match on normalized name
  const exactMatches = index.get(norm);
  if (exactMatches && exactMatches.length > 0) {
    const best = disambiguate(exactMatches, postalCode, bundesland);
    return {
      canonicalName: best.name,
      latitude: best.lat,
      longitude: best.lng,
      bundesland: best.bundesland,
      confidence: exactMatches.length === 1 ? 'exact' : 'normalized',
    };
  }

  // 2. Try without common suffixes ("im Burgenland", "in Steiermark", etc.)
  const withoutSuffix = norm
    .replace(/\s+(im|in|am|bei|ob|an der|an dem)\s+\w+$/i, '')
    .trim();
  if (withoutSuffix !== norm && withoutSuffix.length >= 3) {
    const suffixMatches = index.get(withoutSuffix);
    if (suffixMatches && suffixMatches.length > 0) {
      const best = disambiguate(suffixMatches, postalCode, bundesland);
      return {
        canonicalName: best.name,
        latitude: best.lat,
        longitude: best.lng,
        bundesland: best.bundesland,
        confidence: 'normalized',
      };
    }
  }

  // 3. Fuzzy match (Levenshtein ≤ 2) — only for names ≥ 5 chars
  if (norm.length >= 5) {
    let bestMatch: GeoEntry | null = null;
    let bestDist = 3; // threshold

    for (const [key, entries] of index) {
      // Skip very different lengths
      if (Math.abs(key.length - norm.length) > 2) continue;

      const dist = levenshtein(norm, key);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = disambiguate(entries, postalCode, bundesland);
      }
    }

    if (bestMatch) {
      return {
        canonicalName: bestMatch.name,
        latitude: bestMatch.lat,
        longitude: bestMatch.lng,
        bundesland: bestMatch.bundesland,
        confidence: 'fuzzy',
      };
    }
  }

  return null;
}

/**
 * Normalize coordinates for a scraped event.
 * Tries location_name first, then address, then falls back to existing coords.
 */
export function normalizeEventLocation(event: {
  location_name?: string;
  address?: string;
  postal_code?: string;
  bundesland?: string;
  latitude?: number;
  longitude?: number;
}): { latitude: number; longitude: number; location_name?: string } | null {
  // Try location_name
  if (event.location_name) {
    const result = normalizeLocation(event.location_name, event.postal_code, event.bundesland);
    if (result && result.confidence !== 'none') {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        location_name: result.canonicalName,
      };
    }
  }

  // Try address field
  if (event.address) {
    // Extract city from address (usually last part after comma)
    const parts = event.address.split(',').map(p => p.trim());
    const city = parts[parts.length - 1]?.replace(/^\d{4,5}\s*/, ''); // remove PLZ prefix
    if (city && city.length >= 3) {
      const result = normalizeLocation(city, event.postal_code, event.bundesland);
      if (result && result.confidence !== 'none') {
        return {
          latitude: result.latitude,
          longitude: result.longitude,
        };
      }
    }
  }

  return null;
}
