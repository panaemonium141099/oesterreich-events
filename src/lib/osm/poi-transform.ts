/**
 * Overpass-Element -> osm_pois-Row (fn-18 Task 7).
 *
 * Pur und ohne Seiteneffekte, damit die Regeln testbar sind (das CLI in
 * src/scripts/import-osm-pois.ts macht Netz + DB).
 *
 * ODbL: siehe poi-whitelist.ts. Dieses Modul erzeugt AUSSCHLIESSLICH Rows
 * fuer `osm_pois` — es liest nie poi_activities/venues und faehrt keinerlei
 * Cross-Bestands-Dedup. Der einzige geteilte Baustein ist die
 * Gemeinde-REGISTRY (statische Ortsliste in src/lib/gemeinden/data.ts, kein
 * Bestand aus einer anderen Quelle) ueber `matchGemeinde`, damit OSM-POIs
 * und eigene Aktivitaeten dieselbe Gemeinde-Zuordnung/BBox-Plausibilitaet
 * verwenden.
 */

import { matchGemeinde } from '@/lib/activities/gemeinde-match';
import { classifyOsmTags } from './poi-whitelist';

export interface OverpassPoiElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Genau die Spalten der Tabelle — ALLE NOT-NULL-Spalten sind immer gefuellt
 *  (Upsert-Lehre aus fn-18.2: fehlende NOT-NULL-Spalte kippt den Batch). */
export interface OsmPoiRow {
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  name: string;
  category: string;
  osm_tag: string;
  setting: string | null;
  website: string | null;
  lat: number;
  lng: number;
  gemeinde_slug: string | null;
  bundesland: string;
  town: string | null;
  last_seen_at: string;
}

export type OsmSkipReason =
  | 'no-name'
  | 'not-whitelisted'
  | 'no-coords'
  | 'no-gemeinde-match';

export type OsmTransformResult =
  | { ok: true; row: OsmPoiRow }
  | { ok: false; reason: OsmSkipReason };

/** Koordinaten: Nodes direkt, Ways/Relations ueber `out center`. */
export function poiCoordinates(el: OverpassPoiElement): { lat: number; lng: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon };
  if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

/** Nur http(s)-URLs uebernehmen — OSM enthaelt auch `www.x.at` und Muell. */
export function normalizeWebsite(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Ein Overpass-Element in eine osm_pois-Row uebersetzen.
 *
 * Skips (bewusst hart, kein "irgendwie retten"):
 *   no-name            — ohne Namen als Ausflugsziel nicht darstellbar
 *   not-whitelisted    — Tag ausserhalb der kuratierten Whitelist
 *   no-coords          — Way/Relation ohne `out center`
 *   no-gemeinde-match  — ausserhalb der AT-Plausibilitaets-BBox oder > 25 km
 *                        vom naechsten Gemeinde-Zentrum (Overpass-BBoxen
 *                        ragen ueber die Staatsgrenze; diese POIs gehoeren
 *                        nicht in einen AT-Bestand)
 */
export function transformOsmPoi(el: OverpassPoiElement, seenAtIso: string): OsmTransformResult {
  const name = el.tags?.name?.trim();
  if (!name) return { ok: false, reason: 'no-name' };

  const classification = classifyOsmTags(el.tags);
  if (!classification) return { ok: false, reason: 'not-whitelisted' };

  const coords = poiCoordinates(el);
  if (!coords) return { ok: false, reason: 'no-coords' };

  const match = matchGemeinde(coords.lat, coords.lng);
  if (!match || !match.bundesland) return { ok: false, reason: 'no-gemeinde-match' };

  return {
    ok: true,
    row: {
      osm_type: el.type,
      osm_id: el.id,
      name,
      category: classification.category,
      osm_tag: classification.matchedTag,
      setting: classification.setting,
      website: normalizeWebsite(el.tags?.website ?? el.tags?.['contact:website']),
      lat: coords.lat,
      lng: coords.lng,
      gemeinde_slug: match.gemeindeSlug,
      bundesland: match.bundesland,
      town: el.tags?.['addr:city']?.trim() || match.gemeinde.name,
      last_seen_at: seenAtIso,
    },
  };
}

/**
 * Dedup INNERHALB des OSM-Bestands (dasselbe Element kommt aus mehreren
 * Regions-BBoxen bzw. Tag-Familien zurueck). Das ist KEIN Cross-Bestands-
 * Dedup — Schluessel ist ausschliesslich die OSM-Identitaet.
 * Letzter Treffer gewinnt (identische Daten, nur mehrfach geliefert).
 */
export function dedupeOsmRows(rows: OsmPoiRow[]): OsmPoiRow[] {
  const byKey = new Map<string, OsmPoiRow>();
  for (const row of rows) byKey.set(`${row.osm_type}:${row.osm_id}`, row);
  return [...byKey.values()];
}
