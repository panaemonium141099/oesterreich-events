/**
 * Nominatim-backed geocoder with shared Supabase cache.
 *
 * `geocodeEventsWithoutCoords` (the SQLite-reading batch helper) was removed
 * as part of the Supabase-only standardisation; the scrape pipeline's
 * `fix-geocoding.ts` + `openai-geocode.ts` steps handle post-scrape coord
 * resolution against Supabase.
 */

import { KNOWN_VENUES } from './known-venues';
import { matchPlaceName } from './utils/place-match';
import { getCachedGeo, setCachedGeo } from './geocode-cache';

interface GeoResult {
  latitude: number;
  longitude: number;
}

// Austria bounding box for validating geocoding results
const AUSTRIA_BBOX = {
  minLat: 46.3,
  maxLat: 49.1,
  minLng: 9.5,
  maxLng: 17.2,
};

// Nominatim place_rank threshold: reject results broader than town/village level.
const MIN_PLACE_RANK = 16;

const KNOWN_LOCATIONS: Record<string, GeoResult> = KNOWN_VENUES;

export async function geocodeLocation(query: string, hint = 'Austria'): Promise<GeoResult | null> {
  if (!query) return null;

  // Check known locations first (Unicode-aware token matching, no substring FPs).
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (matchPlaceName(query, key)) return coords;
  }

  // Shared Supabase cache (include hint in key so different regions don't collide).
  const queryLower = query.toLowerCase().trim();
  const cacheKey = `${queryLower}||${hint}`;
  const cached = await getCachedGeo(cacheKey);
  if (cached) return cached;

  // Query Nominatim.
  try {
    const searchQuery = `${query}, ${hint}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=at`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'AustriaEvents-Scraper/1.0 (educational project)' },
    });
    if (!response.ok) return null;

    const results = await response.json();
    if (results.length === 0) return null;

    const nominatimResult = results[0];
    const lat = parseFloat(nominatimResult.lat);
    const lng = parseFloat(nominatimResult.lon);
    const placeRank = nominatimResult.place_rank ?? 0;

    if (placeRank < MIN_PLACE_RANK) {
      console.warn(`[geocoding] Rejected "${query}": place_rank=${placeRank} < ${MIN_PLACE_RANK}`);
      return null;
    }
    if (lat < AUSTRIA_BBOX.minLat || lat > AUSTRIA_BBOX.maxLat || lng < AUSTRIA_BBOX.minLng || lng > AUSTRIA_BBOX.maxLng) {
      console.warn(`[geocoding] Rejected "${query}": [${lat}, ${lng}] outside Austria bbox`);
      return null;
    }

    const result: GeoResult = { latitude: lat, longitude: lng };
    await setCachedGeo(cacheKey, result.latitude, result.longitude);
    return result;
  } catch {
    return null;
  }
}
