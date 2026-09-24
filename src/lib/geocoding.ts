/**
 * Nominatim-Geocoder mit gemeinsamem Cache, nur für Freitext, den ein Mensch
 * prüft (Veranstalter-Einreichungen im Admin, Barrierefrei-Import). Scraper
 * geocodieren NICHT selbst: Eventadressen löst die Pipeline strukturiert auf
 * (src/scripts/geocode-addresses.ts), die Entscheidung trifft der Resolver.
 */

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

export async function geocodeLocation(query: string, hint = 'Austria'): Promise<GeoResult | null> {
  if (!query) return null;

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
