/**
 * Accurate Bundesland lookup from coordinates via point-in-polygon against the
 * official Austrian Bundesland boundaries (the same GeoJSON the map mask uses,
 * in public/). This is the clean, deterministic source — no bounding-box
 * approximation, no name matching, no PLZ guessing.
 *
 * Läuft in Node (reads public/*.geojson via readFileSync) — sowohl im
 * CLI-Import-Script als auch in der Cron-Route /api/cron/eventim, wird also
 * von Vercels output-file-tracing erfasst (siehe REGION_READERS unten).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Wien MUST be checked before Niederösterreich — Wien lies within NÖ's extent
// and NÖ's polygon has no Wien hole, so a Wien point matches both.
//
// Jeder Eintrag liest seine Datei mit einem voll-literalen Pfad: Vercels
// output-file-tracing (@vercel/nft) kann nur Literal-Argumente auflösen.
// Mit `join(process.cwd(), 'public', file)` (file = Variable) landete das
// GESAMTE public/-Verzeichnis (597 MB Bilder) im Bundle der Cron-Route
// /api/cron/eventim und sprengte Vercels 250-MB-Function-Limit.
const REGION_READERS: { id: string; read: () => string }[] = [
  { id: 'wien', read: () => readFileSync(join(process.cwd(), 'public', 'wien.geojson'), 'utf8') },
  { id: 'burgenland', read: () => readFileSync(join(process.cwd(), 'public', 'burgenland.geojson'), 'utf8') },
  { id: 'niederoesterreich', read: () => readFileSync(join(process.cwd(), 'public', 'niederoesterreich.geojson'), 'utf8') },
  { id: 'oberoesterreich', read: () => readFileSync(join(process.cwd(), 'public', 'oberoesterreich.geojson'), 'utf8') },
  { id: 'steiermark', read: () => readFileSync(join(process.cwd(), 'public', 'steiermark.geojson'), 'utf8') },
  { id: 'kaernten', read: () => readFileSync(join(process.cwd(), 'public', 'kaernten.geojson'), 'utf8') },
  { id: 'salzburg', read: () => readFileSync(join(process.cwd(), 'public', 'salzburg.geojson'), 'utf8') },
  { id: 'tirol', read: () => readFileSync(join(process.cwd(), 'public', 'tirol.geojson'), 'utf8') },
  { id: 'vorarlberg', read: () => readFileSync(join(process.cwd(), 'public', 'vorarlberg.geojson'), 'utf8') },
];

interface Poly {
  rings: number[][][]; // [outerRing, ...holes], each ring = [[lng, lat], ...]
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}
interface Region {
  id: string;
  polys: Poly[];
}

let regions: Region[] | null = null;

function loadRegions(): Region[] {
  if (regions) return regions;
  regions = [];
  for (const { id, read } of REGION_READERS) {
    try {
      const geo = JSON.parse(read());
      const g = geo.geometry;
      const polygons: number[][][][] = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
      const polys: Poly[] = polygons.map((rings) => {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const [lng, lat] of rings[0]) {
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
        return { rings, bbox: [minLng, minLat, maxLng, maxLat] };
      });
      regions.push({ id, polys });
    } catch {
      /* missing geojson — skip this region */
    }
  }
  return regions;
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPoly(lng: number, lat: number, poly: Poly): boolean {
  const [minLng, minLat, maxLng, maxLat] = poly.bbox;
  if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false; // fast reject
  if (!pointInRing(lng, lat, poly.rings[0])) return false; // must be in outer ring
  for (let h = 1; h < poly.rings.length; h++) {
    if (pointInRing(lng, lat, poly.rings[h])) return false; // but not in a hole
  }
  return true;
}

/**
 * Returns the Austrian Bundesland id ('wien', 'tirol', …) containing the point,
 * or null when the point is outside Austria.
 */
export function bundeslandFromPolygon(lat: number, lng: number): string | null {
  for (const region of loadRegions()) {
    for (const poly of region.polys) {
      if (pointInPoly(lng, lat, poly)) return region.id;
    }
  }
  return null;
}
