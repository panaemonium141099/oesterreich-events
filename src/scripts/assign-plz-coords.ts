/**
 * Assign coordinates to events based on their postal_code.
 * Much faster than Nominatim geocoding — instant lookup.
 * Also tries to extract PLZ from location_name and address fields.
 *
 * Run with: npx tsx src/scripts/assign-plz-coords.ts
 */

import { getDatabase } from '../lib/db/connection';
import { getCoordinatesForPLZ, getBundeslandFromPLZ } from '../lib/plzCoordinates';

// Major Austrian cities → coordinates (fallback when no PLZ available)
const CITY_COORDINATES: Record<string, [number, number]> = {
  // Landeshauptstädte
  'wien': [48.2082, 16.3738],
  'graz': [47.0707, 15.4395],
  'linz': [48.3064, 14.2858],
  'salzburg': [47.8000, 13.0400],
  'innsbruck': [47.2654, 11.3928],
  'klagenfurt': [46.6247, 14.3089],
  'villach': [46.6130, 13.8500],
  'wels': [48.1600, 14.0200],
  'steyr': [48.0400, 14.4200],
  'dornbirn': [47.4100, 9.7400],
  'feldkirch': [47.2400, 9.7400],
  'bregenz': [47.5000, 9.7500],
  'bludenz': [47.1500, 9.8200],
  'st. pölten': [48.2000, 15.6333],
  'st.pölten': [48.2000, 15.6333],
  'eisenstadt': [47.8453, 16.5189],

  // NÖ
  'krems': [48.4100, 15.6100],
  'wiener neustadt': [47.8100, 16.2400],
  'wr. neustadt': [47.8100, 16.2400],
  'wr.neustadt': [47.8100, 16.2400],
  'baden': [48.0100, 16.2300],
  'mödling': [48.0900, 16.2800],
  'amstetten': [48.1200, 14.8700],
  'tulln': [48.3300, 15.8800],
  'korneuburg': [48.3500, 16.3300],
  'stockerau': [48.3800, 15.9900],
  'hollabrunn': [48.5600, 15.9900],
  'mistelbach': [48.5700, 16.5800],
  'gänserndorf': [48.3400, 16.7200],
  'zwettl': [48.6000, 15.1700],
  'horn': [48.6600, 15.6600],
  'gmünd': [48.7700, 14.9800],
  'waidhofen': [48.0000, 14.7700],
  'melk': [48.2300, 15.3400],
  'neunkirchen': [47.7300, 16.0800],
  'ternitz': [47.7200, 16.0400],
  'bruck an der leitha': [48.0300, 16.5300],
  'perchtoldsdorf': [48.1200, 16.2700],
  'klosterneuborg': [48.3100, 16.3300],

  // Burgenland
  'oberwart': [47.2896, 16.2066],
  'oberpullendorf': [47.4960, 16.5090],
  'neusiedl': [47.9480, 16.8438],
  'güssing': [47.0567, 16.3237],
  'jennersdorf': [46.9381, 16.1448],
  'mattersburg': [47.7351, 16.3988],
  'pinkafeld': [47.3730, 16.1222],
  'stegersbach': [47.1631, 16.1589],
  'rust': [47.8003, 16.6710],
  'mörbisch': [47.7497, 16.6845],
  'podersdorf': [47.8554, 16.8307],
  'frauenkirchen': [47.8384, 16.9228],
  'kobersdorf': [47.5950, 16.3920],

  // Steiermark
  'leoben': [47.3800, 15.0900],
  'kapfenberg': [47.4400, 15.2900],
  'bruck an der mur': [47.4100, 15.2700],
  'bruck': [47.4100, 15.2700],
  'liezen': [47.5700, 14.2400],
  'hartberg': [47.2800, 15.9700],
  'fürstenfeld': [47.0500, 16.0800],
  'feldbach': [46.9500, 15.8900],
  'leibnitz': [46.7800, 15.5300],
  'deutschlandsberg': [46.8100, 15.2200],
  'voitsberg': [47.0500, 15.1500],
  'weiz': [47.2200, 15.6200],
  'murau': [47.1100, 14.1700],
  'judenburg': [47.1700, 14.6600],
  'knittelfeld': [47.2100, 14.8200],
  'schladming': [47.3900, 13.6900],
  'mariazell': [47.7700, 15.3200],
  'mürzzuschlag': [47.6100, 15.6800],

  // Salzburg
  'hallein': [47.6800, 13.1000],
  'zell am see': [47.3200, 12.8000],
  'st. johann im pongau': [47.3500, 13.2000],
  'tamsweg': [47.1300, 13.8100],
  'saalfelden': [47.4300, 12.8500],
  'bischofshofen': [47.4200, 13.2200],
  'radstadt': [47.3800, 13.4600],
  'bad gastein': [47.1200, 13.1300],
  'bad hofgastein': [47.1700, 13.1000],
  'gastein': [47.1200, 13.1300],
  'obertauern': [47.2500, 13.5600],
  'mittersill': [47.2800, 12.4800],

  // Tirol
  'kitzbühel': [47.4500, 12.3900],
  'kufstein': [47.5800, 12.1700],
  'schwaz': [47.3500, 11.7100],
  'imst': [47.2500, 10.7400],
  'landeck': [47.1400, 10.5700],
  'lienz': [46.8300, 12.7700],
  'reutte': [47.4800, 10.7200],
  'wörgl': [47.4900, 12.0600],
  'telfs': [47.3100, 11.0700],
  'hall': [47.2900, 11.5100],
  'hall in tirol': [47.2900, 11.5100],
  'seefeld': [47.3300, 11.1900],
  'mayrhofen': [47.1700, 11.8600],
  'ischgl': [47.0100, 10.2900],
  'sölden': [46.9700, 10.8700],
  'st. anton': [47.1300, 10.2600],
  'st. johann in tirol': [47.5200, 12.4200],

  // Kärnten
  'spittal': [46.8000, 13.5000],
  'spittal an der drau': [46.8000, 13.5000],
  'hermagor': [46.6300, 13.3700],
  'wolfsberg': [46.8400, 14.8400],
  'völkermarkt': [46.6600, 14.6300],
  'feldkirchen': [46.7200, 14.0900],
  'st. veit': [46.7600, 14.3600],
  'st. veit an der glan': [46.7600, 14.3600],
  'pörtschach': [46.6400, 14.1500],
  'velden': [46.6100, 14.0400],
  'wörthersee': [46.6200, 14.1400],
  'nassfeld': [46.5600, 13.2700],
  'millstatt': [46.8100, 13.5800],
  'ossiach': [46.6800, 13.9800],

  // OÖ
  'gmunden': [47.9200, 13.8000],
  'vöcklabruck': [48.0000, 13.6600],
  'ried': [48.2100, 13.4900],
  'ried im innkreis': [48.2100, 13.4900],
  'braunau': [48.2600, 13.0400],
  'braunau am inn': [48.2600, 13.0400],
  'schärding': [48.4600, 13.4300],
  'grieskirchen': [48.2400, 13.8300],
  'kirchdorf': [47.9100, 14.1200],
  'freistadt': [48.5100, 14.5100],
  'perg': [48.2400, 14.6400],
  'rohrbach': [48.5700, 13.9900],
  'eferding': [48.3100, 14.0200],
  'enns': [48.2100, 14.4700],
  'traun': [48.2200, 14.2400],
  'leonding': [48.2800, 14.2500],
  'bad ischl': [47.7100, 13.6200],
  'mondsee': [47.8600, 13.3500],
  'andorf': [48.3700, 13.5700],

  // Vorarlberg
  'lustenau': [47.4300, 9.6600],
  'rankweil': [47.2700, 9.6400],
  'götzis': [47.3300, 9.6300],
  'hohenems': [47.3600, 9.6900],
  'hard': [47.4900, 9.6900],
  'bezau': [47.3800, 9.9000],
  'lech': [47.2100, 10.1400],
  'schruns': [47.0800, 9.9200],
};

function extractPLZ(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d{4})\b/);
  return match ? match[1] : null;
}

function findCityCoords(text: string | null): [number, number] | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
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

  console.log(`${events.length} Events ohne Koordinaten gefunden.`);

  let byPLZ = 0;
  let byCity = 0;
  let byBundesland = 0;
  let notFound = 0;

  const update = db.prepare('UPDATE events SET latitude = ?, longitude = ? WHERE id = ?');

  const batch = db.transaction(() => {
    for (const event of events) {
      // Strategy 1: Direct PLZ lookup
      const plz = event.postal_code || extractPLZ(event.address) || extractPLZ(event.location_name);
      if (plz) {
        const coords = getCoordinatesForPLZ(plz);
        if (coords) {
          update.run(coords[0], coords[1], event.id);
          byPLZ++;
          continue;
        }
      }

      // Strategy 2: City name lookup in location, address, AND title
      const cityCoords = findCityCoords(event.location_name)
        || findCityCoords(event.address)
        || findCityCoords(event.title);
      if (cityCoords) {
        update.run(cityCoords[0], cityCoords[1], event.id);
        byCity++;
        continue;
      }

      notFound++;
    }
  });

  batch();

  console.log(`\n=== Ergebnis ===`);
  console.log(`Per PLZ zugeordnet:    ${byPLZ}`);
  console.log(`Per Stadtname:         ${byCity}`);
  console.log(`Nicht gefunden:        ${notFound}`);
  console.log(`Gesamt zugeordnet:     ${byPLZ + byCity}`);

  // Report remaining
  const remaining = db.prepare('SELECT COUNT(*) as c FROM events WHERE latitude IS NULL OR longitude IS NULL').get() as { c: number };
  console.log(`\nNoch ohne Koordinaten: ${remaining.c}`);
}

main().catch(console.error);
