/**
 * Baut die Regionsliste von lasstreffen.de (fn-31): die 16 Länder mit
 * Mittelpunkt, Kartenausschnitt und Grenzdatei, im selben Format wie
 * `BUNDESLAENDER` für Österreich.
 *
 *   npx tsx src/scripts/build-regions-de.ts
 *
 * Quelle ist `data/stammdaten-de/laender-de.geojson` (BKG VG250,
 * dl-de/by-2-0). Geschrieben werden
 *   src/lib/regions-de.generated.ts     Liste für Karte, Filter, Hubs
 *   public/laender-de/<id>.geojson      Grenze je Land für die Karte
 *   public/deutschland.geojson          Umriss des ganzen Landes (Vereinigung)
 * Die Karte (EventMap.updateBundeslandOverlay) erwartet je Datei EIN Feature,
 * wie bei den österreichischen Dateien: daraus zeichnet sie die Grenzlinie
 * und graut alles außerhalb aus.
 * Beide Ausgaben sind eingecheckt; der Wächter regions-de.test.ts prüft, dass
 * sie zur Quelle passen.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { union } from '@turf/union';
import { simplify } from '@turf/simplify';
import { featureCollection } from '@turf/helpers';

type Ring = number[][];
interface Feature {
  properties: { land: string; ars: string; name: string };
  geometry: { type: 'MultiPolygon' | 'Polygon'; coordinates: Ring[][] | Ring[] };
}

/** Kürzel der Länder (ISO 3166-2:DE ohne Präfix). */
const SHORT: Record<string, string> = {
  'schleswig-holstein': 'SH', hamburg: 'HH', niedersachsen: 'NI', bremen: 'HB',
  'nordrhein-westfalen': 'NW', hessen: 'HE', 'rheinland-pfalz': 'RP',
  'baden-wuerttemberg': 'BW', bayern: 'BY', saarland: 'SL', berlin: 'BE',
  brandenburg: 'BB', 'mecklenburg-vorpommern': 'MV', sachsen: 'SN',
  'sachsen-anhalt': 'ST', thueringen: 'TH',
};

/** Farben der Grenzlinien, je Land eine feste. */
const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d',
  '#ea580c', '#4f46e5', '#0d9488', '#c026d3', '#ca8a04', '#059669', '#e11d48', '#0284c7',
];

const round = (n: number, d = 3) => Number(n.toFixed(d));

export function boundsOf(feature: Feature): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const polys = (feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates) as Ring[][];
  for (const poly of polys) for (const ring of poly) for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [round(minLng), round(minLat), round(maxLng), round(maxLat)];
}

/** Zoomstufe, bei der der Ausschnitt in eine Karte von rund 900 px Breite passt. */
export function zoomFor(b: [number, number, number, number]): number {
  const span = Math.max(b[2] - b[0], (b[3] - b[1]) * 1.6);
  const z = Math.log2((360 * 900) / (256 * span)) - 0.4;
  return round(Math.min(10, Math.max(5, z)), 1);
}

function main() {
  const root = process.cwd();
  const src = JSON.parse(readFileSync(join(root, 'data', 'stammdaten-de', 'laender-de.geojson'), 'utf8')) as { features: Feature[] };
  const outDir = join(root, 'public', 'laender-de');
  mkdirSync(outDir, { recursive: true });

  const entries: string[] = [];
  let all: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  src.features.forEach((f, i) => {
    const b = boundsOf(f);
    all = [Math.min(all[0], b[0]), Math.min(all[1], b[1]), Math.max(all[2], b[2]), Math.max(all[3], b[3])];
    const id = f.properties.land;
    writeFileSync(
      join(outDir, `${id}.geojson`),
      JSON.stringify({ type: 'Feature', properties: { name: f.properties.name }, geometry: f.geometry }),
    );
    entries.push(`  {
    id: '${id}',
    name: '${f.properties.name}',
    shortName: '${SHORT[id]}',
    center: [${round((b[0] + b[2]) / 2)}, ${round((b[1] + b[3]) / 2)}],
    zoom: ${zoomFor(b)},
    pitch: 30,
    bearing: 0,
    geojsonFile: '/laender-de/${id}.geojson',
    borderColor: '${COLORS[i % COLORS.length]}',
    districts: [],
    bounds: [${b.join(', ')}],
  },`);
  });

  // Umriss Deutschlands: Vereinigung der 16 Länder, auf rund 100 m vereinfacht
  // (die Datei lädt bei jedem Öffnen der Karte).
  const merged = union(featureCollection(src.features.map(f => ({ type: 'Feature' as const, properties: {}, geometry: f.geometry as never }))));
  if (!merged) throw new Error('Vereinigung der Länder ist leer');
  const outline = simplify(merged, { tolerance: 0.001, highQuality: true });
  const roundCoords = (c: unknown): unknown => (typeof c === 'number' ? Number(c.toFixed(5)) : (c as unknown[]).map(roundCoords));
  writeFileSync(
    join(root, 'public', 'deutschland.geojson'),
    JSON.stringify({ type: 'Feature', properties: { name: 'Deutschland' }, geometry: { type: outline.geometry.type, coordinates: roundCoords(outline.geometry.coordinates) } }),
  );

  const file = `/**
 * ERZEUGT von src/scripts/build-regions-de.ts, nicht von Hand ändern.
 * Quelle: data/stammdaten-de/laender-de.geojson (BKG VG250, dl-de/by-2-0).
 */
import type { Bundesland } from '@/lib/bundeslaender';

export const REGIONS_DE: Bundesland[] = [
  {
    id: 'all',
    name: 'Ganz Deutschland',
    shortName: 'DE',
    center: [${round((all[0] + all[2]) / 2)}, ${round((all[1] + all[3]) / 2)}],
    zoom: ${zoomFor(all)},
    pitch: 30,
    bearing: 0,
    geojsonFile: '/deutschland.geojson',
    borderColor: '#6366f1',
    districts: [],
    bounds: [${all.map(n => round(n)).join(', ')}],
  },
${entries.join('\n')}
];
`;
  writeFileSync(join(root, 'src', 'lib', 'regions-de.generated.ts'), file);
  console.log(`${src.features.length} Länder, Ausschnitt Deutschland ${all.join(', ')}`);
}

if ((process.argv[1] ?? '').split('\\').join('/').endsWith('src/scripts/build-regions-de.ts')) main();
