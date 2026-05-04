/**
 * Shared OSM/Overpass venue utilities used by:
 *   - src/scripts/import-osm-venues.ts          (bars/pubs/clubs)
 *   - src/scripts/import-overpass-all-venues.ts (all named POIs)
 *
 * This module is import-only. It must NOT trigger any fetches, DB writes,
 * or other side effects when imported. Both importers have their own
 * `main()` functions that drive their respective workflows.
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: { timestamp_osm_base: string };
  elements: OverpassElement[];
}

// ─── BUNDESLAND COORDS ──────────────────────────────────────────────────────

/**
 * Austrian Bundesland bounding boxes for coordinate-based assignment.
 * Order matters: Wien is checked before NÖ because Wien is fully inside NÖ's bbox.
 *
 * bounds: [minLon, minLat, maxLon, maxLat]
 */
const BUNDESLAND_BOUNDS: Array<{ id: string; bounds: [number, number, number, number] }> = [
  { id: 'wien', bounds: [16.182, 48.118, 16.578, 48.323] },
  { id: 'burgenland', bounds: [15.996, 46.831, 17.161, 48.119] },
  { id: 'niederoesterreich', bounds: [14.453, 47.422, 17.069, 49.021] },
  { id: 'oberoesterreich', bounds: [12.749, 47.461, 14.992, 48.773] },
  { id: 'salzburg', bounds: [12.076, 46.944, 13.996, 48.041] },
  { id: 'steiermark', bounds: [13.563, 46.612, 16.172, 47.828] },
  { id: 'kaernten', bounds: [12.657, 46.372, 15.065, 47.131] },
  { id: 'tirol', bounds: [10.098, 46.651, 12.966, 47.743] },
  { id: 'vorarlberg', bounds: [9.531, 46.841, 10.237, 47.596] },
];

/**
 * Determine Bundesland from coordinates using bounding box matching.
 * Wien is checked first since it's fully contained within NÖ's bbox.
 */
export function bundeslandFromCoords(lat: number, lon: number): string | null {
  for (const { id, bounds } of BUNDESLAND_BOUNDS) {
    const [minLon, minLat, maxLon, maxLat] = bounds;
    if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
      return id;
    }
  }
  return null;
}

// ─── NAME UTILITIES ─────────────────────────────────────────────────────────

/**
 * Normalize a venue name for deduplication: lowercase, trim, fold quotes.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"');
}

// ─── STUDENT-RELEVANT HEURISTIC ─────────────────────────────────────────────

/**
 * Determine if a venue is likely student-relevant based on OSM tags.
 */
export function isStudentRelevant(tags: Record<string, string>): boolean {
  const name = (tags.name || '').toLowerCase();
  const studentKeywords = ['studi', 'uni ', 'campus', 'mensa', 'fachschaft', 'hochschul'];
  return studentKeywords.some((kw) => name.includes(kw));
}

// ─── COORDINATE EXTRACTION ──────────────────────────────────────────────────

/**
 * Get coordinates from an Overpass element. Nodes have lat/lon directly;
 * ways/relations have a `center` property when queried with `out center`.
 */
export function getCoordinates(el: OverpassElement): { lat: number; lon: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

// ─── ID NAMESPACING ─────────────────────────────────────────────────────────

const WAY_OFFSET = 10_000_000_000_000;       // 10^13
const RELATION_OFFSET = 20_000_000_000_000;  // 2 × 10^13

/**
 * OSM IDs are only unique within their type (node/way/relation). We offset
 * way IDs by 10^13 and relation IDs by 2×10^13 so we can use a single
 * BIGINT column with a UNIQUE constraint.
 *
 * Existing osm_id values in the venues table all come from nodes (max ~14B),
 * so this scheme is backward compatible.
 */
export function namespacedOsmId(el: OverpassElement): number {
  if (el.type === 'node') return el.id;
  if (el.type === 'way') return el.id + WAY_OFFSET;
  return el.id + RELATION_OFFSET;
}
