/**
 * Location Normalizer for Austrian place names.
 *
 * Uses a GeoNames AT database (34k+ entries) to:
 * 1. Normalize abbreviations ("St." → "Sankt", "a.d." → "an der")
 * 2. Match location names to canonical entries with coordinates
 * 3. Fuzzy-match typos (Levenshtein distance ≤ 2)
 * 4. Disambiguate duplicates via PLZ, Bundesland, or geographic proximity (closest match)
 * 5. Extract place names from event titles and descriptions
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
 * Haversine distance in km between two coordinates.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Disambiguate multiple GeoNames matches.
 * Priority: geographic proximity (closest match) > Bundesland > population.
 */
function disambiguate(
  matches: GeoEntry[],
  plz?: string,
  bundesland?: string,
  hint?: { lat: number; lng: number },
): GeoEntry {
  if (matches.length === 1) return matches[0];

  let candidates = [...matches];

  // Try Bundesland filter
  if (bundesland) {
    const blNorm = bundesland.toLowerCase();
    const blMatches = candidates.filter(m =>
      m.bundesland.toLowerCase().includes(blNorm) ||
      blNorm.includes(m.bundesland.toLowerCase())
    );
    if (blMatches.length === 1) return blMatches[0];
    if (blMatches.length > 1) candidates = blMatches;
  }

  // CLOSEST MATCH: if we have a geographic hint, sort by distance
  if (hint) {
    candidates.sort((a, b) => {
      const distA = haversineKm(hint.lat, hint.lng, a.lat, a.lng);
      const distB = haversineKm(hint.lat, hint.lng, b.lat, b.lng);
      return distA - distB;
    });
    return candidates[0];
  }

  // Fallback: pick the one with highest population (most likely the intended match)
  return candidates.reduce((best, m) => m.pop > best.pop ? m : best, candidates[0]);
}

/**
 * Get a geographic hint from PLZ or Bundesland for closest-match disambiguation.
 */
function getHint(plz?: string, bundesland?: string): { lat: number; lng: number } | undefined {
  // Try PLZ first — most precise hint
  if (plz) {
    try {
      // Dynamically import PLZ coordinates if available
      const { getCoordinatesForPLZ } = require('./plzCoordinates');
      const coords = getCoordinatesForPLZ(plz);
      if (coords) return { lat: coords[0], lng: coords[1] };
    } catch { /* PLZ module not available */ }
  }

  // Bundesland center as rough hint
  if (bundesland) {
    const BL_CENTERS: Record<string, { lat: number; lng: number }> = {
      'burgenland': { lat: 47.845, lng: 16.519 },
      'wien': { lat: 48.208, lng: 16.372 },
      'niederösterreich': { lat: 48.221, lng: 15.632 },
      'niederosterreich': { lat: 48.221, lng: 15.632 },
      'oberösterreich': { lat: 48.306, lng: 14.286 },
      'oberosterreich': { lat: 48.306, lng: 14.286 },
      'steiermark': { lat: 47.070, lng: 15.439 },
      'salzburg': { lat: 47.811, lng: 13.055 },
      'tirol': { lat: 47.268, lng: 11.393 },
      'kärnten': { lat: 46.624, lng: 14.305 },
      'karnten': { lat: 46.624, lng: 14.305 },
      'vorarlberg': { lat: 47.249, lng: 9.980 },
    };
    const center = BL_CENTERS[bundesland.toLowerCase()];
    if (center) return center;
  }

  return undefined;
}

/**
 * Normalize a location name and return canonical coordinates.
 *
 * @param locationName - Raw location name from scraper
 * @param postalCode - Optional PLZ for disambiguation
 * @param bundesland - Optional Bundesland for disambiguation
 * @param hint - Optional geographic hint for closest-match disambiguation
 * @returns Normalized result with coordinates, or null if no match
 */
export function normalizeLocation(
  locationName: string,
  postalCode?: string,
  bundesland?: string,
  hint?: { lat: number; lng: number },
): NormalizeResult | null {
  if (!locationName || locationName.length < 2) return null;

  const index = buildIndex();
  const norm = normalizeString(locationName);
  const geoHint = hint || getHint(postalCode, bundesland);

  // 1. Exact match on normalized name
  const exactMatches = index.get(norm);
  if (exactMatches && exactMatches.length > 0) {
    const best = disambiguate(exactMatches, postalCode, bundesland, geoHint);
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
      const best = disambiguate(suffixMatches, postalCode, bundesland, geoHint);
      return {
        canonicalName: best.name,
        latitude: best.lat,
        longitude: best.lng,
        bundesland: best.bundesland,
        confidence: 'normalized',
      };
    }
  }

  // 3. Try extracting just the last part after comma/dash (often the city)
  const parts = locationName.split(/[,\-–—]/).map(p => p.trim()).filter(Boolean);
  for (const part of parts.reverse()) {
    if (part.length < 3) continue;
    const partNorm = normalizeString(part);
    const partMatches = index.get(partNorm);
    if (partMatches && partMatches.length > 0) {
      const best = disambiguate(partMatches, postalCode, bundesland, geoHint);
      return {
        canonicalName: best.name,
        latitude: best.lat,
        longitude: best.lng,
        bundesland: best.bundesland,
        confidence: 'normalized',
      };
    }
  }

  // 4. Fuzzy match (Levenshtein ≤ 2) — only for names ≥ 5 chars
  if (norm.length >= 5) {
    let bestMatch: GeoEntry | null = null;
    let bestDist = 3; // threshold

    for (const [key, entries] of index) {
      // Skip very different lengths
      if (Math.abs(key.length - norm.length) > 2) continue;

      const dist = levenshtein(norm, key);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = disambiguate(entries, postalCode, bundesland, geoHint);
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
 * Extract place names from a text string (title or description) using sliding window.
 * Tries 3-word, 2-word, then 1-word phrases against the GeoNames index.
 * Returns the best (longest) match found.
 */
export function extractPlaceFromText(
  text: string,
  postalCode?: string,
  bundesland?: string,
  hint?: { lat: number; lng: number },
): NormalizeResult | null {
  if (!text || text.length < 3) return null;

  const index = buildIndex();
  const geoHint = hint || getHint(postalCode, bundesland);

  // Clean text: remove common noise words, numbers, punctuation
  const cleaned = text
    .replace(/\d{1,2}[.:]\d{2}/g, '') // remove times like 17:00
    .replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, '') // remove dates like 05.04.2026
    .replace(/[€$%#@!?&*+="'`´;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length >= 2);

  // Try longest phrases first (3, 2, 1 words)
  let bestResult: NormalizeResult | null = null;
  let bestWordCount = 0;

  for (let windowSize = Math.min(4, words.length); windowSize >= 1; windowSize--) {
    if (bestWordCount >= windowSize) break; // already found a longer match

    for (let i = 0; i <= words.length - windowSize; i++) {
      const phrase = words.slice(i, i + windowSize).join(' ');
      if (phrase.length < 3) continue;

      const norm = normalizeString(phrase);
      const matches = index.get(norm);

      if (matches && matches.length > 0) {
        // Skip words that are common German words, not place names
        if (windowSize === 1 && /^(der|die|das|und|mit|von|für|auf|bei|nach|ein|eine|zum|zur|den|dem|des|nicht|auch|noch|oder|als|wie|sie|ihr|wir|uns|hat|ist|war|sind|wird|kann|soll|muss|ganz|mehr|neue|gute|guten|guter|gutes|ganze|guten|guter)$/i.test(phrase)) continue;

        const best = disambiguate(matches, postalCode, bundesland, geoHint);

        // For single-word matches with many ambiguous candidates and no good hint,
        // only accept if the match is in the same Bundesland
        if (windowSize === 1 && matches.length > 3 && bundesland) {
          if (!best.bundesland.toLowerCase().includes(bundesland.toLowerCase()) &&
              !bundesland.toLowerCase().includes(best.bundesland.toLowerCase())) {
            continue; // skip — ambiguous single word, wrong Bundesland
          }
        }

        bestResult = {
          canonicalName: best.name,
          latitude: best.lat,
          longitude: best.lng,
          bundesland: best.bundesland,
          confidence: 'normalized',
        };
        bestWordCount = windowSize;
        break; // found a match at this window size, move to smaller window
      }
    }
  }

  return bestResult;
}

/**
 * Normalize coordinates for a scraped event.
 * Checks location_name, address, title, and description for place names.
 * Uses closest-match disambiguation when multiple candidates exist.
 */
export function normalizeEventLocation(event: {
  title?: string;
  description?: string;
  location_name?: string;
  address?: string;
  postal_code?: string;
  bundesland?: string;
  latitude?: number;
  longitude?: number;
}): { latitude: number; longitude: number; location_name?: string; confidence: string } | null {
  const hint = getHint(event.postal_code, event.bundesland);

  // 1. Try location_name (most specific)
  if (event.location_name) {
    const result = normalizeLocation(event.location_name, event.postal_code, event.bundesland, hint);
    if (result && result.confidence !== 'none') {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        location_name: result.canonicalName,
        confidence: result.confidence,
      };
    }
  }

  // 2. Try address field
  if (event.address) {
    // Extract city from address (usually last part after comma)
    const parts = event.address.split(',').map(p => p.trim());
    const city = parts[parts.length - 1]?.replace(/^\d{4,5}\s*/, ''); // remove PLZ prefix
    if (city && city.length >= 3) {
      const result = normalizeLocation(city, event.postal_code, event.bundesland, hint);
      if (result && result.confidence !== 'none') {
        return {
          latitude: result.latitude,
          longitude: result.longitude,
          confidence: result.confidence,
        };
      }
    }
  }

  // 3. Try extracting place name from title
  if (event.title) {
    const result = extractPlaceFromText(event.title, event.postal_code, event.bundesland, hint);
    if (result) {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        confidence: 'from_title',
      };
    }
  }

  // 4. Try extracting from description (first 300 chars)
  if (event.description) {
    const snippet = event.description.slice(0, 300);
    const result = extractPlaceFromText(snippet, event.postal_code, event.bundesland, hint);
    if (result) {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        confidence: 'from_description',
      };
    }
  }

  return null;
}
