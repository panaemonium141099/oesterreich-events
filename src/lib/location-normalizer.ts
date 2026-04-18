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
import { KNOWN_VENUES } from './known-venues';

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
  confidence: 'exact' | 'normalized' | 'fuzzy' | 'none'; // Note: 'fuzzy' is logged but never returned (no coord assignment)
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

    // Index by base name (without geographic suffix like "am See", "an der Donau")
    // This allows "Mörbisch" to match "Mörbisch am See", "Rust" to match "Rust", etc.
    const baseName = norm
      .replace(/\s+(im|in|am|bei|ob|an der|an dem)\s+\w+(\s+\w+)*$/i, '')
      .trim();
    if (baseName !== norm && baseName.length >= 3) {
      if (!normalizedIndex.has(baseName)) normalizedIndex.set(baseName, []);
      // Only add if not already in the list (avoid duplicates)
      const existing = normalizedIndex.get(baseName)!;
      if (!existing.includes(entry)) {
        existing.push(entry);
      }
    }
  }

  return normalizedIndex;
}

/**
 * German venue prefixes that indicate a location_name is a venue, not a city.
 * When detected, step 3b word-by-word matching is skipped to prevent
 * venue words (e.g., "Schloss") from matching GeoNames building entries.
 */
const VENUE_PREFIXES = [
  // Castles, churches, monasteries
  'schloss', 'burg', 'dom', 'kirche', 'stift', 'kloster',
  'pfarrkirche', 'kapelle', 'domkirche', 'pfarrsaal',
  // Wellness & parks
  'kurpark', 'kurhaus', 'therme',
  // Accommodation & gastronomy
  'gasthof', 'gasthaus', 'hotel', 'pension', 'seminarhotel',
  'restaurant', 'wirtshaus', 'beisl', 'cafe', 'kaffeehaus',
  'bar', 'pub',
  // Wine
  'weingut', 'weinhaus', 'vinothek', 'weinkeller',
  'buschenschank', 'heuriger',
  // Performance & culture venues
  'halle', 'stadthalle', 'kulturzentrum', 'konzerthaus',
  'theater', 'museum', 'galerie', 'festspielhaus',
  'kongresszentrum', 'musikpavillon',
  'seefestspiele', 'festspiele', 'landesgalerie',
  'veranstaltungszentrum', 'mehrzweckhalle',
  // Civic & community
  'rathaus', 'gemeindeamt', 'vereinshaus',
  'volkshochschule', 'jugendzentrum', 'seniorenzentrum',
  // Sports & leisure
  'arena', 'stadion', 'sportplatz',
  'schwimmbad', 'freibad', 'hallenbad', 'turnhalle',
  // Education & exhibition
  'kino', 'bibliothek', 'schulzentrum',
  'messezentrum', 'messe',
];

/**
 * Check if a location name starts with a known German venue prefix.
 * Case-insensitive. Returns true if the name is likely a venue, not a city.
 */
/**
 * Check whether the given normalized string matches a known Austrian
 * populated place (PPL-type GeoNames entry). Used by the category
 * classifier's location-detox to strip trailing place names from event
 * titles safely — i.e., only strip when the suffix really is a place,
 * so "Konzert im Park" and "Jazz bei Kerzenschein" stay intact.
 *
 * Expects the input to already be `normalizeString()`-normalized.
 */
export function isKnownAustrianPlace(normalized: string): boolean {
  if (!normalized || normalized.length < 2) return false;
  const index = buildIndex();
  const matches = index.get(normalized);
  if (!matches || matches.length === 0) return false;
  return matches.some(m => m.type.startsWith('PPL'));
}

export function isVenueName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return VENUE_PREFIXES.some(prefix => {
    if (lower === prefix) return true;
    // Must be followed by a space (prefix is a complete word)
    return lower.startsWith(prefix + ' ');
  });
}

/**
 * Extract a city name from a venue name by stripping the venue prefix.
 * E.g., "Kulturzentrum Mattersburg" -> "Mattersburg", "Therme Laa" -> "Laa".
 * Only accepts the remainder if it matches a PPL-type GeoNames entry (populated place),
 * rejecting Bundesland names (ADM1) and other non-settlement types.
 *
 * @returns NormalizeResult if a valid city was extracted, null otherwise
 */
export function extractCityFromVenueName(
  venueName: string,
  postalCode?: string,
  bundesland?: string,
  hint?: { lat: number; lng: number },
): NormalizeResult | null {
  const lower = venueName.toLowerCase().trim();
  const index = buildIndex();
  const geoHint = hint || getHint(postalCode, bundesland);

  for (const prefix of VENUE_PREFIXES) {
    if (!lower.startsWith(prefix + ' ')) continue;

    // Extract remainder after prefix
    const remainder = venueName.trim().substring(prefix.length + 1).trim();
    if (remainder.length < 2) continue;

    const norm = normalizeString(remainder);
    if (norm.length < 2) continue;

    // Look up in GeoNames index
    const matches = index.get(norm);
    if (!matches || matches.length === 0) {
      // Also try with suffix removal (e.g., "Laa" -> "Laa an der Thaya" via base-name index)
      // The base-name index already handles this, so just check if we get any match
      continue;
    }

    // FILTER: Only accept PPL-type entries (populated places).
    // Reject ADM1 (Bundesland), ADM2, etc. to prevent "Landesgalerie Burgenland"
    // from resolving to "Burgenland" as a city.
    const pplMatches = matches.filter(e => e.type.startsWith('PPL'));
    if (pplMatches.length === 0) continue;

    // AMBIGUITY GUARD: If the remainder has too many PPL matches (>5), it's likely
    // a saint name or common word (e.g., "St. Martin" has 15+ matches across Austria).
    // Skip to let title/description extraction handle it with more context.
    if (pplMatches.length > 5) continue;

    const best = disambiguate(pplMatches, postalCode, bundesland, geoHint);
    return {
      canonicalName: best.name,
      latitude: best.lat,
      longitude: best.lng,
      bundesland: best.bundesland,
      confidence: 'normalized',
    };
  }

  return null;
}

/**
 * Build a normalized index of known venue names for lookup.
 * Keys are normalizeString() output, values are venue coordinates.
 */
let knownVenueIndex: Map<string, { latitude: number; longitude: number }> | null = null;

function buildKnownVenueIndex(): Map<string, { latitude: number; longitude: number }> {
  if (knownVenueIndex) return knownVenueIndex;
  knownVenueIndex = new Map();
  for (const [key, coords] of Object.entries(KNOWN_VENUES)) {
    const norm = normalizeString(key);
    knownVenueIndex.set(norm, coords);
  }
  return knownVenueIndex;
}

/**
 * Normalize an Austrian place name string for matching.
 * Expands abbreviations and standardizes formatting.
 */
export function normalizeString(input: string): string {
  let s = input.trim();

  // Lowercase
  s = s.toLowerCase();

  // Normalize umlaut transliterations (oe→ö, ae→ä, ue→ü) BEFORE other processing
  // This ensures "Moerbisch" matches "Mörbisch" and "Kaernten" matches "Kärnten"
  // Only apply where it makes sense: not after 'q' for 'ue'
  s = s.replace(/oe/g, 'ö');
  s = s.replace(/ae/g, 'ä');
  s = s.replace(/(?<!q)ue/g, 'ü');

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

  // Bundesland geographic centroids (NOT capital cities) for unbiased disambiguation
  if (bundesland) {
    const BL_CENTROIDS: Record<string, { lat: number; lng: number }> = {
      'burgenland': { lat: 47.35, lng: 16.42 },        // geographic center, south of Oberpullendorf
      'wien': { lat: 48.208, lng: 16.372 },             // Wien is its own Bundesland
      'niederösterreich': { lat: 48.10, lng: 15.77 },   // geographic center
      'niederosterreich': { lat: 48.10, lng: 15.77 },
      'oberösterreich': { lat: 48.02, lng: 13.98 },     // geographic center
      'oberosterreich': { lat: 48.02, lng: 13.98 },
      'steiermark': { lat: 47.25, lng: 14.94 },         // geographic center
      'salzburg': { lat: 47.27, lng: 13.10 },           // geographic center
      'tirol': { lat: 47.05, lng: 11.40 },              // geographic center
      'kärnten': { lat: 46.75, lng: 13.85 },            // geographic center
      'karnten': { lat: 46.75, lng: 13.85 },
      'vorarlberg': { lat: 47.20, lng: 9.90 },          // geographic center
    };
    const center = BL_CENTROIDS[bundesland.toLowerCase()];
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

  // 3. Try extracting from compound names (comma-separated, dash-separated)
  // Try LAST part first (often the actual place name, e.g., "Oggau am Neusiedler See")
  const parts = locationName.split(/[,\-–—]/).map(p => p.trim()).filter(Boolean);
  for (const part of [...parts].reverse()) {
    if (part.length < 3) continue;
    const partNorm = normalizeString(part);

    // Try direct match on the part
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

    // Try with suffix removal on this part (e.g., "Oggau am Neusiedler See" → "Oggau")
    const partWithoutSuffix = partNorm
      .replace(/\s+(im|in|am|bei|ob|an der|an dem)\s+\w+(\s+\w+)*$/i, '')
      .trim();
    if (partWithoutSuffix !== partNorm && partWithoutSuffix.length >= 3) {
      const suffixPartMatches = index.get(partWithoutSuffix);
      if (suffixPartMatches && suffixPartMatches.length > 0) {
        const best = disambiguate(suffixPartMatches, postalCode, bundesland, geoHint);
        return {
          canonicalName: best.name,
          latitude: best.lat,
          longitude: best.lng,
          bundesland: best.bundesland,
          confidence: 'normalized',
        };
      }
    }
  }

  // 3b-pre. Check known venues BEFORE word-by-word matching.
  // This catches "Schloss Esterhazy", "Burg Forchtenstein", etc. with exact coords.
  const venueIndex = buildKnownVenueIndex();
  const venueMatch = venueIndex.get(norm);
  if (venueMatch) {
    return {
      canonicalName: locationName,
      latitude: venueMatch.latitude,
      longitude: venueMatch.longitude,
      bundesland: bundesland || '',
      confidence: 'exact',
    };
  }

  // 3b-guard. If the location_name starts with a venue prefix (Schloss, Burg, etc.),
  // skip step 3b word-by-word matching entirely. This prevents "Schloss" from matching
  // an HTL entry in GeoNames. Return null so normalizeEventLocation falls through
  // to title/address/description extraction.
  if (isVenueName(locationName)) {
    return null;
  }

  // 3b. Try individual words from the location name (for venue names like "Burgruine Landsee")
  // Try multi-word then single-word substrings.
  // FILTER: Only match PPL-type entries (populated places) to prevent building/venue
  // feature codes (HTL, CSTL, CH, MUS, etc.) from matching as cities.
  const nameWords = norm.split(/\s+/).filter(w => w.length >= 3);
  for (let len = Math.min(3, nameWords.length); len >= 1; len--) {
    for (let i = 0; i <= nameWords.length - len; i++) {
      const phrase = nameWords.slice(i, i + len).join(' ');
      const phraseMatches = index.get(phrase);
      if (phraseMatches && phraseMatches.length > 0) {
        // PPL-only filter: only accept populated place entries for word-by-word matching
        const pplMatches = phraseMatches.filter(e => e.type.startsWith('PPL'));
        if (pplMatches.length > 0) {
          const best = disambiguate(pplMatches, postalCode, bundesland, geoHint);
          return {
            canonicalName: best.name,
            latitude: best.lat,
            longitude: best.lng,
            bundesland: best.bundesland,
            confidence: 'normalized',
          };
        }
      }
    }
  }

  // 4. Fuzzy match (Levenshtein ≤ 2) — LOG ONLY, do NOT produce coordinate assignments.
  // Per epic confidence model: fuzzy matches must not be persisted as coordinates.
  if (norm.length >= 5) {
    let bestMatch: GeoEntry | null = null;
    let bestDist = 3; // threshold
    let bestKey = '';

    for (const [key, entries] of index) {
      // Skip very different lengths
      if (Math.abs(key.length - norm.length) > 2) continue;

      const dist = levenshtein(norm, key);
      if (dist < bestDist) {
        bestDist = dist;
        bestKey = key;
        bestMatch = disambiguate(entries, postalCode, bundesland, geoHint);
      }
    }

    if (bestMatch) {
      console.warn(`[location-normalizer] Fuzzy match rejected (not persisted): "${locationName}" ≈ "${bestMatch.name}" (key="${bestKey}", distance=${bestDist})`);
      // Return null — fuzzy matches must NOT produce coordinate assignments
    }
  }

  return null;
}

/**
 * Common German words that are also Austrian place names.
 * These should NOT match in title/description extraction unless confirmed
 * by Bundesland context or the name is long enough (>= 5 chars).
 */
const COMMON_WORD_PLACE_NAMES = new Set([
  'berg', 'stein', 'au', 'egg', 'hard', 'hof', 'see', 'feld',
  'bach', 'wand', 'mark', 'land', 'rain', 'ort', 'tal',
  'lend', 'gries', 'hall', 'sand', 'ried', 'hub', 'anger',
  'rust', 'horn', 'tulln', 'bruck',
]);

/**
 * Normalize a string for Unicode-aware comparison.
 * Collapses umlauts (ae/oe/ue), lowercases, strips diacritics.
 */
function normalizeForComparison(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .trim();
}

/**
 * Check if a normalized place name appears as complete tokens in normalized text.
 * Handles multi-word names (e.g., "Sankt Margarethen") and prevents substring matches
 * (e.g., "Rust" must not match inside "frustrated").
 */
function matchesAsCompleteTokens(normalizedPlaceName: string, normalizedText: string): boolean {
  const placeTokens = normalizedPlaceName.split(/\s+/);
  const textTokens = normalizedText.split(/[\s,;.!?\-–—/()[\]{}]+/).filter(t => t.length > 0);

  // Find the place name tokens as a contiguous sequence in the text tokens
  for (let i = 0; i <= textTokens.length - placeTokens.length; i++) {
    let allMatch = true;
    for (let j = 0; j < placeTokens.length; j++) {
      if (textTokens[i + j] !== placeTokens[j]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }
  return false;
}

/**
 * Extract place names from a text string (title or description) using Unicode-aware
 * token matching. Tries 3-word, 2-word, then 1-word phrases against the GeoNames index.
 * Returns the best (longest) match found.
 *
 * Uses complete token matching to prevent substring false positives (e.g., "Rust" in "frustrated").
 * Filters out common German words that happen to be place names (Berg, Stein, Au, etc.).
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
    .replace(/[€$%#@!?&*+="'`´;:.()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Prepare normalized text for token matching
  const normalizedText = normalizeForComparison(cleaned);

  const words = cleaned.split(/\s+/).filter(w => w.length >= 2);

  // Try longest phrases first (4, 3, 2, 1 words)
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
        // Skip common German function words
        if (windowSize === 1 && /^(der|die|das|und|mit|von|für|auf|bei|nach|ein|eine|zum|zur|den|dem|des|nicht|auch|noch|oder|als|wie|sie|ihr|wir|uns|hat|ist|war|sind|wird|kann|soll|muss|ganz|mehr|neue|gute|guten|guter|gutes|ganze)$/i.test(phrase)) continue;

        // PPL-only filter for short (1-2 word) matches: prevent building/church entries
        // (e.g., "Dom" CH, "Schloss" HTL) from matching as place names in text extraction.
        // This is consistent with the PPL-only filter on step 3b in normalizeLocation.
        // Use filtered candidates for disambiguation when applicable.
        let candidates = matches;
        if (windowSize <= 2) {
          const pplOnly = matches.filter(e => e.type.startsWith('PPL'));
          if (pplOnly.length === 0) continue;
          candidates = pplOnly;
        }

        // Common-word filter: words that are also common German/English words need
        // Bundesland context to be accepted as place names in text extraction.
        // German capitalizes all nouns, so capitalization alone is not a reliable indicator.
        // However, ALL-lowercase usage is a strong signal it's NOT a place name.
        if (windowSize === 1 && COMMON_WORD_PLACE_NAMES.has(norm)) {
          const originalWord = words[i];
          const isAllLowercase = originalWord === originalWord.toLowerCase();

          // All-lowercase common words are never place names (even with Bundesland context)
          if (isAllLowercase) continue;

          if (!bundesland) continue; // no context — skip ambiguous common word

          // With Bundesland context, require the match to be in that Bundesland
          const blNorm = bundesland.toLowerCase();
          const hasBlMatch = candidates.some(m =>
            m.bundesland.toLowerCase().includes(blNorm) ||
            blNorm.includes(m.bundesland.toLowerCase())
          );
          if (!hasBlMatch) continue;
        }

        // Unicode-aware complete token matching: verify the place name
        // appears as complete tokens in the text, not as a substring
        const bestCandidate = disambiguate(candidates, postalCode, bundesland, geoHint);
        const normalizedCandidateName = normalizeForComparison(bestCandidate.name);
        const normalizedPhrase = normalizeForComparison(phrase);

        // Check that either the phrase or the canonical name matches as complete tokens
        if (!matchesAsCompleteTokens(normalizedPhrase, normalizedText) &&
            !matchesAsCompleteTokens(normalizedCandidateName, normalizedText)) {
          continue; // substring match — skip
        }

        // For single-word matches with many ambiguous candidates and no good hint,
        // only accept if the match is in the same Bundesland
        if (windowSize === 1 && candidates.length > 3 && bundesland) {
          if (!bestCandidate.bundesland.toLowerCase().includes(bundesland.toLowerCase()) &&
              !bundesland.toLowerCase().includes(bestCandidate.bundesland.toLowerCase())) {
            continue; // skip — ambiguous single word, wrong Bundesland
          }
        }

        bestResult = {
          canonicalName: bestCandidate.name,
          latitude: bestCandidate.lat,
          longitude: bestCandidate.lng,
          bundesland: bestCandidate.bundesland,
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

  // Per epic design decision #5: when location_name is a venue and city was resolved
  // from context (address, title, description), use confidence "normalized" (rank 3)
  // instead of "from_title" (rank 4) to ensure venue-context resolutions take precedence.
  const isVenue = event.location_name ? isVenueName(event.location_name) : false;

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

  // 2. Try address field (higher priority than venue-name suffix per spec)
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
          confidence: isVenue ? 'normalized' : result.confidence,
        };
      }
    }
  }

  // 2b. If location_name is a venue, try extracting city from the venue name suffix.
  // E.g., "Kulturzentrum Mattersburg" -> strip prefix -> "Mattersburg" -> PPL match.
  // Done after address (more authoritative) but before title (less specific).
  if (isVenue && event.location_name) {
    const venueCity = extractCityFromVenueName(
      event.location_name, event.postal_code, event.bundesland, hint
    );
    if (venueCity) {
      return {
        latitude: venueCity.latitude,
        longitude: venueCity.longitude,
        confidence: 'normalized',
      };
    }
  }

  // 3. Try extracting place name from title
  if (event.title) {
    const result = extractPlaceFromText(event.title, event.postal_code, event.bundesland, hint);
    if (result) {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
        confidence: isVenue ? 'normalized' : 'from_title',
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
        confidence: isVenue ? 'normalized' : 'from_description',
      };
    }
  }

  // 5. PLZ fallback: if postal code is available and location is a venue, use PLZ
  // coordinates as last resort. Only for venues to avoid coarse PLZ-based coords
  // overriding the null (unresolved) result for non-venue locations.
  if (isVenue && event.postal_code) {
    try {
      const { getCoordinatesForPLZ } = require('./plzCoordinates');
      const coords = getCoordinatesForPLZ(event.postal_code);
      if (coords) {
        return {
          latitude: coords[0],
          longitude: coords[1],
          confidence: 'normalized',
        };
      }
    } catch { /* PLZ module not available */ }
  }

  return null;
}
