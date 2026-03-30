/**
 * Force-geocode ALL events without coordinates using multiple strategies:
 * 1. PLZ lookup (instant)
 * 2. City name in location/title (instant)
 * 3. Nominatim for events with specific addresses (API, slow)
 * 4. Bundesland capital as last resort (instant)
 *
 * Run with: npx tsx src/scripts/force-geocode-all.ts
 */

import { getDatabase } from '../lib/db/connection';
import { getCoordinatesForPLZ } from '../lib/plzCoordinates';
import { geocodeLocation } from '../lib/geocoding';

// Bundesland → Landeshauptstadt-Koordinaten (Fallback)
const BUNDESLAND_CENTERS: Record<string, [number, number]> = {
  'wien': [48.2082, 16.3738],
  'niederoesterreich': [48.2000, 15.6333], // St. Pölten
  'oberoesterreich': [48.3064, 14.2858], // Linz
  'salzburg': [47.8000, 13.0400],
  'steiermark': [47.0707, 15.4395], // Graz
  'kaernten': [46.6247, 14.3089], // Klagenfurt
  'tirol': [47.2654, 11.3928], // Innsbruck
  'vorarlberg': [47.5000, 9.7500], // Bregenz
  'burgenland': [47.8453, 16.5189], // Eisenstadt
};

// Extended city/venue mapping
const CITY_COORDS: Record<string, [number, number]> = {
  // Wien
  'wien': [48.2082, 16.3738],
  'vienna': [48.2082, 16.3738],
  // NÖ
  'st. pölten': [48.2000, 15.6333],
  'st.pölten': [48.2000, 15.6333],
  'krems': [48.4100, 15.6100],
  'wiener neustadt': [47.8100, 16.2400],
  'wr. neustadt': [47.8100, 16.2400],
  'tulln': [48.3300, 15.8800],
  'amstetten': [48.1200, 14.8700],
  'korneuburg': [48.3500, 16.3300],
  'baden': [48.0100, 16.2300],
  'mödling': [48.0900, 16.2800],
  'stockerau': [48.3800, 15.9900],
  'hollabrunn': [48.5600, 15.9900],
  'mistelbach': [48.5700, 16.5800],
  'zwettl': [48.6000, 15.1700],
  'horn': [48.6600, 15.6600],
  'gmünd': [48.7700, 14.9800],
  'waidhofen': [48.0000, 14.7700],
  'melk': [48.2300, 15.3400],
  'neunkirchen': [47.7300, 16.0800],
  // OÖ
  'linz': [48.3064, 14.2858],
  'wels': [48.1600, 14.0200],
  'steyr': [48.0400, 14.4200],
  'gmunden': [47.9200, 13.8000],
  'vöcklabruck': [48.0000, 13.6600],
  'ried': [48.2100, 13.4900],
  'braunau': [48.2600, 13.0400],
  'freistadt': [48.5100, 14.5100],
  'perg': [48.2400, 14.6400],
  'rohrbach': [48.5700, 13.9900],
  'enns': [48.2100, 14.4700],
  'traun': [48.2200, 14.2400],
  'bad ischl': [47.7100, 13.6200],
  'andorf': [48.3700, 13.5700],
  'kirchdorf': [47.9100, 14.1200],
  'schärding': [48.4600, 13.4300],
  'grieskirchen': [48.2400, 13.8300],
  'leonding': [48.2800, 14.2500],
  // Steiermark
  'graz': [47.0707, 15.4395],
  'leoben': [47.3800, 15.0900],
  'kapfenberg': [47.4400, 15.2900],
  'bruck': [47.4100, 15.2700],
  'leibnitz': [46.7800, 15.5300],
  'hartberg': [47.2800, 15.9700],
  'weiz': [47.2200, 15.6200],
  'deutschlandsberg': [46.8100, 15.2200],
  'voitsberg': [47.0500, 15.1500],
  'judenburg': [47.1700, 14.6600],
  'knittelfeld': [47.2100, 14.8200],
  'murau': [47.1100, 14.1700],
  'liezen': [47.5700, 14.2400],
  'schladming': [47.3900, 13.6900],
  'feldbach': [46.9500, 15.8900],
  'fürstenfeld': [47.0500, 16.0800],
  'mürzzuschlag': [47.6100, 15.6800],
  'gleisdorf': [47.1000, 15.7100],
  // Salzburg
  'salzburg': [47.8000, 13.0400],
  'hallein': [47.6800, 13.1000],
  'zell am see': [47.3200, 12.8000],
  'tamsweg': [47.1300, 13.8100],
  'saalfelden': [47.4300, 12.8500],
  'bischofshofen': [47.4200, 13.2200],
  'gastein': [47.1200, 13.1300],
  'bad gastein': [47.1200, 13.1300],
  'obertauern': [47.2500, 13.5600],
  'radstadt': [47.3800, 13.4600],
  // Tirol
  'innsbruck': [47.2654, 11.3928],
  'kitzbühel': [47.4500, 12.3900],
  'kufstein': [47.5800, 12.1700],
  'schwaz': [47.3500, 11.7100],
  'wörgl': [47.4900, 12.0600],
  'imst': [47.2500, 10.7400],
  'landeck': [47.1400, 10.5700],
  'lienz': [46.8300, 12.7700],
  'reutte': [47.4800, 10.7200],
  'telfs': [47.3100, 11.0700],
  'hall in tirol': [47.2900, 11.5100],
  'hall': [47.2900, 11.5100],
  'seefeld': [47.3300, 11.1900],
  'mayrhofen': [47.1700, 11.8600],
  'ischgl': [47.0100, 10.2900],
  'sölden': [46.9700, 10.8700],
  'st. anton': [47.1300, 10.2600],
  'zillertal': [47.1700, 11.8700],
  // Kärnten
  'klagenfurt': [46.6247, 14.3089],
  'villach': [46.6130, 13.8500],
  'spittal': [46.8000, 13.5000],
  'wolfsberg': [46.8400, 14.8400],
  'hermagor': [46.6300, 13.3700],
  'völkermarkt': [46.6600, 14.6300],
  'feldkirchen': [46.7200, 14.0900],
  'st. veit': [46.7600, 14.3600],
  'nassfeld': [46.5600, 13.2700],
  'velden': [46.6100, 14.0400],
  'pörtschach': [46.6400, 14.1500],
  'wörthersee': [46.6200, 14.1400],
  // Vorarlberg
  'dornbirn': [47.4100, 9.7400],
  'feldkirch': [47.2400, 9.7400],
  'bregenz': [47.5000, 9.7500],
  'bludenz': [47.1500, 9.8200],
  'lustenau': [47.4300, 9.6600],
  'hohenems': [47.3600, 9.6900],
  'rankweil': [47.2700, 9.6400],
  'hard': [47.4900, 9.6900],
  'lech': [47.2100, 10.1400],
  'schruns': [47.0800, 9.9200],
  // Burgenland
  'eisenstadt': [47.8453, 16.5189],
  'oberwart': [47.2896, 16.2066],
  'neusiedl': [47.9480, 16.8438],
  'güssing': [47.0567, 16.3237],
  'jennersdorf': [46.9381, 16.1448],
  'mattersburg': [47.7351, 16.3988],
  'oberpullendorf': [47.4960, 16.5090],
  'pinkafeld': [47.3730, 16.1222],
  'stegersbach': [47.1631, 16.1589],
  'rust': [47.8003, 16.6710],
  'mörbisch': [47.7497, 16.6845],
  'podersdorf': [47.8554, 16.8307],
};

function extractPLZ(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d{4})\b/);
  return match ? match[1] : null;
}

function findCityCoords(text: string | null): [number, number] | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  // Check longer names first to avoid partial matches
  const entries = Object.entries(CITY_COORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [city, coords] of entries) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

async function main() {
  const db = getDatabase();

  const events = db.prepare(
    'SELECT id, title, postal_code, location_name, address, bundesland FROM events WHERE latitude IS NULL OR longitude IS NULL'
  ).all() as Array<{
    id: number;
    title: string;
    postal_code: string | null;
    location_name: string | null;
    address: string | null;
    bundesland: string | null;
  }>;

  console.log(`${events.length} Events ohne Koordinaten.`);

  let byPLZ = 0;
  let byCity = 0;
  let byNominatim = 0;
  let byBundesland = 0;

  const update = db.prepare('UPDATE events SET latitude = ?, longitude = ? WHERE id = ?');

  // Phase 1: Instant lookups (PLZ + City name)
  console.log('\n--- Phase 1: PLZ + Stadtname Lookup ---');
  const needNominatim: typeof events = [];
  const needFallback: typeof events = [];

  const batchInstant = db.transaction(() => {
    for (const event of events) {
      // Strategy 1: PLZ
      const plz = event.postal_code || extractPLZ(event.address) || extractPLZ(event.location_name);
      if (plz) {
        const coords = getCoordinatesForPLZ(plz);
        if (coords) {
          update.run(coords[0], coords[1], event.id);
          byPLZ++;
          continue;
        }
      }

      // Strategy 2: City name in title, location, address
      const cityCoords = findCityCoords(event.title)
        || findCityCoords(event.location_name)
        || findCityCoords(event.address);
      if (cityCoords) {
        update.run(cityCoords[0], cityCoords[1], event.id);
        byCity++;
        continue;
      }

      // Has specific location? Try Nominatim
      if (event.location_name && event.location_name.length > 3 && event.bundesland) {
        needNominatim.push(event);
      } else {
        needFallback.push(event);
      }
    }
  });
  batchInstant();
  console.log(`PLZ: ${byPLZ} | Stadt: ${byCity} | Brauchen Nominatim: ${needNominatim.length} | Brauchen Fallback: ${needFallback.length}`);

  // Phase 2: Nominatim for specific addresses (max 200 to stay reasonable)
  console.log('\n--- Phase 2: Nominatim Geocoding (max 200) ---');
  const nominatimBatch = needNominatim.slice(0, 200);
  for (const event of nominatimBatch) {
    try {
      const hint = event.bundesland ? `${event.bundesland}, Austria` : 'Austria';
      const query = event.address || event.location_name || '';
      const result = await geocodeLocation(query, hint);
      if (result) {
        update.run(result.latitude, result.longitude, event.id);
        byNominatim++;
      } else {
        needFallback.push(event);
      }
    } catch {
      needFallback.push(event);
    }
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1100));

    if (byNominatim % 20 === 0 && byNominatim > 0) {
      console.log(`  ${byNominatim} geocoded...`);
    }
  }
  // Events beyond the 200 limit also need fallback
  for (const ev of needNominatim.slice(200)) {
    needFallback.push(ev);
  }
  console.log(`Nominatim: ${byNominatim} geocoded`);

  // Phase 3: Bundesland-Hauptstadt als Fallback
  console.log('\n--- Phase 3: Bundesland-Fallback ---');
  const batchFallback = db.transaction(() => {
    for (const event of needFallback) {
      if (event.bundesland && BUNDESLAND_CENTERS[event.bundesland]) {
        const coords = BUNDESLAND_CENTERS[event.bundesland];
        // Add small random jitter (±0.02°, ~2km) to avoid all events stacking
        const jitterLat = (Math.random() - 0.5) * 0.04;
        const jitterLng = (Math.random() - 0.5) * 0.04;
        update.run(coords[0] + jitterLat, coords[1] + jitterLng, event.id);
        byBundesland++;
      }
    }
  });
  batchFallback();
  console.log(`Bundesland-Fallback: ${byBundesland}`);

  // Final stats
  const remaining = db.prepare('SELECT COUNT(*) as c FROM events WHERE latitude IS NULL').get() as { c: number };
  console.log(`\n=== ERGEBNIS ===`);
  console.log(`PLZ:               ${byPLZ}`);
  console.log(`Stadtname:         ${byCity}`);
  console.log(`Nominatim:         ${byNominatim}`);
  console.log(`Bundesland-Fallback: ${byBundesland}`);
  console.log(`TOTAL zugeordnet:  ${byPLZ + byCity + byNominatim + byBundesland}`);
  console.log(`Noch ohne:         ${remaining.c}`);
}

main().catch(console.error);
