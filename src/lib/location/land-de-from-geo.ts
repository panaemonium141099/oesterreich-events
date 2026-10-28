/**
 * Deutsches Land zu einer Koordinate per Punkt-in-Polygon gegen die
 * Landflächen aus BKG VG250 (dl-de/by-2-0, `data/stammdaten-de/laender-de.geojson`,
 * gebaut von build-stammdaten-de.ts, Grenzen auf 25 m vereinfacht).
 * Gegenstück zu `bundeslandFromPolygon` (Österreich) für die Gegenprobe des
 * Freigabevertrags. Bodensee und Küstengewässer gehören zu keinem Land.
 *
 * Voll-literaler Pfad wegen Vercels output-file-tracing (siehe
 * src/lib/eventim/bundesland-from-geo.ts).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Poly {
  rings: number[][][];
  bbox: [number, number, number, number];
}

let regions: { id: string; polys: Poly[] }[] | null = null;

function load(): { id: string; polys: Poly[] }[] {
  if (regions) return regions;
  const geo = JSON.parse(readFileSync(join(process.cwd(), 'data', 'stammdaten-de', 'laender-de.geojson'), 'utf8')) as {
    features: { properties: { land: string }; geometry: { coordinates: number[][][][] } }[];
  };
  regions = geo.features.map(f => ({
    id: f.properties.land,
    polys: f.geometry.coordinates.map(rings => {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const [lng, lat] of rings[0]) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      return { rings, bbox: [minLng, minLat, maxLng, maxLat] as [number, number, number, number] };
    }),
  }));
  return regions;
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Land-ID (`bayern`, …) des Punkts oder null außerhalb der deutschen Landfläche. */
export function deLandFromPolygon(lat: number, lng: number): string | null {
  for (const region of load()) {
    for (const p of region.polys) {
      const [minLng, minLat, maxLng, maxLat] = p.bbox;
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      if (!pointInRing(lng, lat, p.rings[0])) continue;
      if (p.rings.slice(1).some(h => pointInRing(lng, lat, h))) continue;
      return region.id;
    }
  }
  return null;
}
