/**
 * Accurate Bundesland lookup from coordinates via point-in-polygon against the
 * official Austrian Bundesland boundaries (the same GeoJSON the map mask uses,
 * in public/). This is the clean, deterministic source — no bounding-box
 * approximation, no name matching, no PLZ guessing.
 *
 * Script/Node only (reads public/*.geojson via readFileSync). Used by the
 * Eventim importer; not bundled into the Next app.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Wien MUST be checked before Niederösterreich — Wien lies within NÖ's extent
// and NÖ's polygon has no Wien hole, so a Wien point matches both.
const REGION_FILES: { id: string; file: string }[] = [
  { id: 'wien', file: 'wien.geojson' },
  { id: 'burgenland', file: 'burgenland.geojson' },
  { id: 'niederoesterreich', file: 'niederoesterreich.geojson' },
  { id: 'oberoesterreich', file: 'oberoesterreich.geojson' },
  { id: 'steiermark', file: 'steiermark.geojson' },
  { id: 'kaernten', file: 'kaernten.geojson' },
  { id: 'salzburg', file: 'salzburg.geojson' },
  { id: 'tirol', file: 'tirol.geojson' },
  { id: 'vorarlberg', file: 'vorarlberg.geojson' },
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
  for (const { id, file } of REGION_FILES) {
    try {
      const geo = JSON.parse(readFileSync(join(process.cwd(), 'public', file), 'utf8'));
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
