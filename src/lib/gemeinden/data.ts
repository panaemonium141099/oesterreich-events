/**
 * Österreichische Gemeinden aus der EINZIGEN Stammdatei `data/gemeinden-at.json`
 * (gebaut von src/scripts/build-gemeinden-master.ts aus der amtlichen
 * Gemeindeliste der Statistik Austria). PLZ, Bezirk und Ortsmittelpunkt
 * einer Gemeinde stehen nur dort; Scraper-Listen und Hub-Seiten lesen sie
 * hier ab, statt eigene Kopien zu führen (Drift-Befund 2026-09-24).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bundeslandToId } from '@/lib/bundeslaender';
import { normalizeGemeindeName } from '@/lib/location/gemeinde-name';

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

// Eintrag der Stammdatei `data/gemeinden-at.json` (build-gemeinden-master.ts,
// Quelle Statistik Austria). Einzige Gemeinde-Stammdatei der Seite.
export interface MasterGemeinde {
  gkz: string;
  name: string;
  plz: string;
  plzAll: string[];
  bezirk: string;
  bundesland: string;
  lat: number;
  lng: number;
  statutarstadt: boolean;
  legacySlugs?: string[];
}

const BUNDESLAND_LABEL: Record<string, string> = {
  burgenland: 'Burgenland',
  kaernten: 'Kärnten',
  niederoesterreich: 'Niederösterreich',
  oberoesterreich: 'Oberösterreich',
  salzburg: 'Salzburg',
  steiermark: 'Steiermark',
  tirol: 'Tirol',
  vorarlberg: 'Vorarlberg',
  wien: 'Wien',
};

let masterCache: MasterGemeinde[] | null = null;

/** Rohdaten der Stammdatei (auch für den Orts-Index). */
export function loadGemeindenMaster(): MasterGemeinde[] {
  if (masterCache) return masterCache;
  masterCache = JSON.parse(readFileSync(join(process.cwd(), 'data', 'gemeinden-at.json'), 'utf8')) as MasterGemeinde[];
  return masterCache;
}

const BL_BY_GKZ_DIGIT: Record<string, string> = {
  '1': 'burgenland', '2': 'kaernten', '3': 'niederoesterreich', '4': 'oberoesterreich',
  '5': 'salzburg', '6': 'steiermark', '7': 'tirol', '8': 'vorarlberg', '9': 'wien',
};

let byGkz: Map<string, MasterGemeinde> | null = null;
let byBlName: Map<string, MasterGemeinde[]> | null = null;
let aliases: Map<string, string> | null = null;

function indexMaster(): void {
  if (byGkz && byBlName && aliases) return;
  byGkz = new Map();
  byBlName = new Map();
  for (const g of loadGemeindenMaster()) {
    byGkz.set(g.gkz, g);
    const k = `${g.bundesland}|${normalizeGemeindeName(g.name)}`;
    byBlName.set(k, [...(byBlName.get(k) ?? []), g]);
  }
  aliases = new Map();
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'data', 'stammdaten', 'gemeinde-aliase.json'), 'utf8')) as Record<string, string>;
  for (const [key, gkz] of Object.entries(raw)) {
    if (key.startsWith('_')) continue;
    const [bl, name] = key.split('|');
    aliases.set(`${bl}|${normalizeGemeindeName(name)}`, gkz);
  }
}

/**
 * Gemeinde der Stammdatei zu einem Scraper-Listeneintrag: über die
 * Gemeindekennziffer, sonst über den amtlichen Namen im Bundesland, sonst
 * über die geprüfte Alias-Tabelle (Umbenennungen, Fusionen). PLZ, Bezirk
 * oder Koordinaten des Listeneintrags werden bewusst NICHT verwendet.
 */
export function findGemeinde(ref: { gkz?: string | null; name: string; bundesland: string }): MasterGemeinde | null {
  indexMaster();
  if (ref.gkz && byGkz!.has(ref.gkz)) return byGkz!.get(ref.gkz)!;
  // Alte Kennziffern (vor Fusionen) tragen das Bundesland in der ersten Stelle.
  const bl = bundeslandToId(ref.bundesland) ?? (ref.gkz ? BL_BY_GKZ_DIGIT[ref.gkz[0]] ?? null : null);
  if (!bl) return null;
  const key = `${bl}|${normalizeGemeindeName(ref.name)}`;
  const hits = byBlName!.get(key) ?? [];
  if (hits.length === 1) return hits[0];
  const alias = aliases!.get(key);
  return alias ? byGkz!.get(alias) ?? null : null;
}

/** Anzeigename des Bundeslands zur ID (Stammdatei führt IDs). */
export function bundeslandLabel(id: string): string {
  return BUNDESLAND_LABEL[id] ?? id;
}

const LEGACY_SLUGS = new Map<string, string>();

function loadAll(): AustrianGemeinde[] {
  return loadGemeindenMaster()
    .filter(g => g.lat !== 0 || g.lng !== 0)
    .map(g => {
      const slug = `${g.plz}-${gemeindeSlug(g.name)}`;
      for (const old of g.legacySlugs ?? []) LEGACY_SLUGS.set(old, slug);
      return {
        name: g.name,
        plz: g.plz,
        bezirk: g.bezirk,
        bundesland: BUNDESLAND_LABEL[g.bundesland] ?? g.bundesland,
        lat: g.lat,
        lng: g.lng,
        slug,
      };
    });
}

/** Alle österreichischen Gemeinden (Gebietsstand laut Stammdatei, ≈ 2 100). */
export const ALL_GEMEINDEN: ReadonlyArray<AustrianGemeinde> = loadAll();

/** Fast slug → gemeinde lookup. */
const BY_SLUG = new Map(ALL_GEMEINDEN.map(g => [g.slug, g]));

export function getGemeindeBySlug(slug: string): AustrianGemeinde | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Aktueller Slug zu einem früheren Hub-Slug (PLZ/Name seit der
 *  Stammdaten-Umstellung 2026-09-24 korrigiert), sonst `null`. */
export function currentGemeindeSlug(legacySlug: string): string | null {
  return LEGACY_SLUGS.get(legacySlug) ?? null;
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
