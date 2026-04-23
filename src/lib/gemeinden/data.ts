/**
 * Austrian Gemeinden — compiled from data/gemeinden-registry/*.json.
 *
 * Source of truth: the 9 per-Bundesland JSON files assembled during the
 * scraper-registry work. Each entry has PLZ, name, bundesland, bezirk, and
 * — crucially for Phase-2 hub pages — lat/lng of the village centre.
 *
 * We load the JSON at build time (synchronous `require` via Node fs),
 * which turns this into a plain typed constant in the bundle. No runtime
 * DB lookup needed for the ~2 028 entries.
 *
 * A future iteration could promote this to a Supabase table for RLS-
 * gated admin edits, but for static hub generation an in-memory array is
 * simpler + faster.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AustrianGemeinde {
  name: string;
  /** 4-digit Austrian PLZ. Primary identifier for URL generation. */
  plz: string;
  bezirk: string;
  bundesland: string;
  /** Village-centre coordinates — from the registry, hand-verified. */
  lat: number;
  lng: number;
  /** The URL-safe segment used by /gemeinde/[slug]. Format `{plz}-{name-slug}`. */
  slug: string;
}

/** Slugifies a gemeinde name — lowercases, strips umlauts + diacritics,
 *  replaces non-alphanumerics with hyphens. Mirrors the logic used by
 *  the event-URL builder so PLZ-Ort prefixes stay consistent site-wide. */
function gemeindeSlug(name: string): string {
  let s = name;
  const umlauts: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'Ä': 'ae', 'Ö': 'oe', 'Ü': 'ue' };
  for (const [k, v] of Object.entries(umlauts)) s = s.split(k).join(v);
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

// Typed shape of one JSON record (matches what the registry files expose).
interface RawGemeinde {
  name: string;
  plz?: string | null;
  bezirk?: string | null;
  bundesland?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const BUNDESLAENDER = [
  'burgenland',
  'kaernten',
  'niederoesterreich',
  'oberoesterreich',
  'salzburg',
  'steiermark',
  'tirol',
  'vorarlberg',
  'wien',
] as const;

function loadAll(): AustrianGemeinde[] {
  const root = process.cwd();
  const out: AustrianGemeinde[] = [];
  const seen = new Set<string>();

  for (const bl of BUNDESLAENDER) {
    try {
      const raw = readFileSync(join(root, 'data/gemeinden-registry', `${bl}.json`), 'utf8');
      const parsed = JSON.parse(raw) as RawGemeinde[];
      for (const g of parsed) {
        if (!g.name || !g.plz || !/^\d{4}$/.test(g.plz) ||
            typeof g.lat !== 'number' || typeof g.lng !== 'number') {
          continue;
        }
        const slug = `${g.plz}-${gemeindeSlug(g.name)}`;
        if (seen.has(slug)) continue; // dedupe across duplicate PLZ entries
        seen.add(slug);
        out.push({
          name:       g.name,
          plz:        g.plz,
          bezirk:     g.bezirk ?? '',
          bundesland: g.bundesland ?? '',
          lat:        g.lat,
          lng:        g.lng,
          slug,
        });
      }
    } catch (err) {
      console.warn(`[gemeinden] failed to load ${bl}.json:`, err);
    }
  }

  return out;
}

/** All Austrian Gemeinden loaded at module-init time. Length ≈ 2 028. */
export const ALL_GEMEINDEN: ReadonlyArray<AustrianGemeinde> = loadAll();

/** Fast slug → gemeinde lookup. */
const BY_SLUG = new Map(ALL_GEMEINDEN.map(g => [g.slug, g]));

export function getGemeindeBySlug(slug: string): AustrianGemeinde | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Haversine distance in km between two points.
 * Cheap enough to run per-item at build time or in a hot page render.
 */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a = sinLat * sinLat +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) *
    sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the N nearest Gemeinden to the given one, sorted by distance.
 * Used for the "Nachbar-Gemeinden" sidebar on low-content hub pages —
 * when a tiny village has <3 events, we point to neighbours that do.
 */
export function findNeighbourGemeinden(
  g: AustrianGemeinde,
  limit = 6,
): AustrianGemeinde[] {
  return [...ALL_GEMEINDEN]
    .filter(other => other.slug !== g.slug)
    .map(other => ({ g: other, d: haversineKm(g.lat, g.lng, other.lat, other.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(x => x.g);
}

/**
 * lat/lng bbox that approximately covers `radiusKm` around a centre.
 * Used to filter events inside Supabase via cheap `>=`/`<=` comparisons.
 *
 * 1° latitude  ≈ 111 km
 * 1° longitude ≈ 111 km × cos(latitude in radians)  — shrinks with latitude
 *
 * We over-query slightly (bbox > actual circle) and let the page render
 * filter by haversine if precision matters. For our ~48° Austrian
 * latitude, the bbox shrink-factor is ~0.67 on the longitude axis.
 */
export function bboxAround(
  lat: number,
  lng: number,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

export { haversineKm, gemeindeSlug };
