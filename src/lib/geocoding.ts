import { getDatabase } from './db/connection';
import { DISTRICTS } from './districts';
import { KNOWN_VENUES } from './known-venues';
import { matchPlaceName } from './utils/place-match';

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

// Nominatim place_rank threshold: reject results broader than town/village level
// place_rank 16 = "major street" level, anything < 16 is too broad (state, county, city district)
const MIN_PLACE_RANK = 16;

// Re-export KNOWN_VENUES as KNOWN_LOCATIONS for backward compatibility
const KNOWN_LOCATIONS: Record<string, GeoResult> = KNOWN_VENUES;

export async function geocodeLocation(query: string, hint = 'Austria'): Promise<GeoResult | null> {
  if (!query) return null;

  const queryLower = query.toLowerCase().trim();

  // Check known locations first (Unicode-aware token matching, no substring false positives)
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (matchPlaceName(query, key)) {
      return coords;
    }
  }

  // Check cache (include hint in cache key so different regions don't collide)
  const cacheKey = `${queryLower}||${hint}`;
  const db = getDatabase();
  const cached = db.prepare('SELECT latitude, longitude FROM geocode_cache WHERE query = ?').get(cacheKey) as GeoResult | undefined;
  if (cached) return cached;

  // Query Nominatim
  try {
    const searchQuery = `${query}, ${hint}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=at`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AustriaEvents-Scraper/1.0 (educational project)',
      },
    });

    if (!response.ok) return null;

    const results = await response.json();
    if (results.length === 0) return null;

    const nominatimResult = results[0];
    const lat = parseFloat(nominatimResult.lat);
    const lng = parseFloat(nominatimResult.lon);
    const placeRank = nominatimResult.place_rank ?? 0;

    // Validate: reject results with place_rank < 16 (state/county level, too broad)
    if (placeRank < MIN_PLACE_RANK) {
      console.warn(`[geocoding] Rejected Nominatim result for "${query}": place_rank=${placeRank} (< ${MIN_PLACE_RANK}), display_name="${nominatimResult.display_name}"`);
      return null;
    }

    // Validate: ensure coordinates fall within Austria bounding box
    if (lat < AUSTRIA_BBOX.minLat || lat > AUSTRIA_BBOX.maxLat || lng < AUSTRIA_BBOX.minLng || lng > AUSTRIA_BBOX.maxLng) {
      console.warn(`[geocoding] Rejected Nominatim result for "${query}": coords [${lat}, ${lng}] outside Austria bbox`);
      return null;
    }

    const result: GeoResult = { latitude: lat, longitude: lng };

    // Cache the result
    db.prepare('INSERT OR REPLACE INTO geocode_cache (query, latitude, longitude) VALUES (?, ?, ?)').run(
      cacheKey, result.latitude, result.longitude
    );

    return result;
  } catch {
    return null;
  }
}

const BUNDESLAND_HINTS: Record<string, string> = {
  wien: 'Wien, Austria',
  niederoesterreich: 'Niederösterreich, Austria',
  oberoesterreich: 'Oberösterreich, Austria',
  salzburg: 'Salzburg, Austria',
  steiermark: 'Steiermark, Austria',
  kaernten: 'Kärnten, Austria',
  tirol: 'Tirol, Austria',
  vorarlberg: 'Vorarlberg, Austria',
  burgenland: 'Burgenland, Austria',
};

export async function geocodeEventsWithoutCoords(): Promise<number> {
  const db = getDatabase();
  const events = db.prepare(
    'SELECT id, location_name, address, bundesland FROM events WHERE (latitude IS NULL OR longitude IS NULL) AND location_name IS NOT NULL'
  ).all() as Array<{ id: number; location_name: string; address: string | null; bundesland: string | null }>;

  let geocoded = 0;

  for (const event of events) {
    const hint = (event.bundesland && BUNDESLAND_HINTS[event.bundesland]) || 'Austria';
    const query = event.address || event.location_name;
    const result = await geocodeLocation(query, hint);

    if (result) {
      db.prepare('UPDATE events SET latitude = ?, longitude = ? WHERE id = ?').run(
        result.latitude, result.longitude, event.id
      );
      geocoded++;
    }

    // Rate limit: 1 req/sec for Nominatim
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  return geocoded;
}
