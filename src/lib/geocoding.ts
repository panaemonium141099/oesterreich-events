import { getDatabase } from './db/connection';
import { DISTRICTS } from './districts';

interface GeoResult {
  latitude: number;
  longitude: number;
}

// Known Burgenland venue coordinates for common locations
const KNOWN_LOCATIONS: Record<string, GeoResult> = {
  'kulturzentrum mattersburg': { latitude: 47.7351, longitude: 16.3988 },
  'kulturzentrum oberschützen': { latitude: 47.3536, longitude: 16.1988 },
  'friedensburg schlaining': { latitude: 47.3258, longitude: 16.2733 },
  'landesgalerie burgenland': { latitude: 47.8453, longitude: 16.5189 },
  'kulturzentrum eisenstadt': { latitude: 47.8453, longitude: 16.5189 },
  'schloss esterhazy': { latitude: 47.8458, longitude: 16.5182 },
  'burg forchtenstein': { latitude: 47.7081, longitude: 16.3283 },
  'schloss lackenbach': { latitude: 47.5862, longitude: 16.4673 },
  'haydn-haus eisenstadt': { latitude: 47.8456, longitude: 16.5213 },
  'joseph haydn privatschule': { latitude: 47.8445, longitude: 16.5207 },
  'kulturzentrum güssing': { latitude: 47.0567, longitude: 16.3237 },
  'burg güssing': { latitude: 47.0567, longitude: 16.3237 },
  'bad tatzmannsdorf': { latitude: 47.3344, longitude: 16.2258 },
  'sonnentherme lutzmannsburg': { latitude: 47.4627, longitude: 16.6465 },
  'familypark': { latitude: 47.7633, longitude: 16.7267 },
  'neusiedl am see': { latitude: 47.9480, longitude: 16.8438 },
  'rust': { latitude: 47.8003, longitude: 16.6710 },
  'mörbisch': { latitude: 47.7497, longitude: 16.6845 },
  'podersdorf': { latitude: 47.8554, longitude: 16.8307 },
  'illmitz': { latitude: 47.7689, longitude: 16.8028 },
  'frauenkirchen': { latitude: 47.8384, longitude: 16.9228 },
  'nationalpark neusiedler see': { latitude: 47.7700, longitude: 16.7680 },
  'oberwart': { latitude: 47.2896, longitude: 16.2066 },
  'jennersdorf': { latitude: 46.9381, longitude: 16.1448 },
  'pinkafeld': { latitude: 47.3730, longitude: 16.1222 },
  'stegersbach': { latitude: 47.1631, longitude: 16.1589 },
  'andau': { latitude: 47.7744, longitude: 17.0304 },
  'gols': { latitude: 47.8966, longitude: 16.9060 },
  'jois': { latitude: 47.9601, longitude: 16.7968 },
  'st. margarethen': { latitude: 47.7967, longitude: 16.5936 },
  'siegendorf': { latitude: 47.7792, longitude: 16.5511 },
  'raiding': { latitude: 47.5574, longitude: 16.5290 },
  'lockenhaus': { latitude: 47.4060, longitude: 16.4259 },
  'bernstein': { latitude: 47.3992, longitude: 16.2517 },
  'stadtschlaining': { latitude: 47.3258, longitude: 16.2733 },
};

export async function geocodeLocation(query: string, hint = 'Austria'): Promise<GeoResult | null> {
  if (!query) return null;

  const queryLower = query.toLowerCase().trim();

  // Check known locations first
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (queryLower.includes(key)) {
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

    const result: GeoResult = {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    };

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
