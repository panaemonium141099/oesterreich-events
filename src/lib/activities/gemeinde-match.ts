/**
 * Gemeinde-Zuordnung fuer Aktivitaeten (fn-18, Epic E4).
 *
 * Nearest-Haversine aus lat/lng gegen die Gemeinde-Registry
 * (src/lib/gemeinden/data.ts, ~2.000 Eintraege) — KEIN String-Match auf
 * `town` (mehrdeutig). POIs ohne Koordinaten werden vom Ingest uebersprungen
 * (dieses Modul liefert dann null).
 *
 * `bundesland` kommt AUTORITATIV aus der gematchten Registry-Zeile und wird
 * ueber den bestehenden zentralen Helper `bundeslandToId` auf die kanonische
 * lowercase-ID normalisiert ('burgenland', 'kaernten', ...) — kein
 * ad-hoc-lowercase. Die Feratel-REGIONS-Config ist NICHT verlaesslich
 * (enthaelt 'Österreich'-Eintraege) und dient nur als Fallback-/Log-Feld
 * im Ingest (Task 2).
 */

import { ALL_GEMEINDEN, haversineKm, type AustrianGemeinde } from '@/lib/gemeinden/data';
import { bundeslandToId, type Bundesland } from '@/lib/bundeslaender';

export interface GemeindeMatch {
  /** Die gematchte Registry-Zeile (Name, PLZ, Bezirk, Koordinaten). */
  gemeinde: AustrianGemeinde;
  /** URL-Slug `{plz}-{name-slug}` fuer poi_activities.gemeinde_slug. */
  gemeindeSlug: string;
  /** Kanonische lowercase-Bundesland-ID via bundeslandToId; null nur bei
   *  kaputtem Registry-Eintrag (Lauf-Fehler im Ingest, Task 2). */
  bundesland: Bundesland['id'] | null;
  /** Distanz POI -> Gemeinde-Zentrum in km. */
  distanceKm: number;
}

/**
 * Nearest-Gemeinde fuer einen Koordinaten-Punkt. Deterministisch: bei
 * (praktisch nicht vorkommenden) exakten Distanz-Gleichstaenden gewinnt die
 * erste Zeile in Registry-Reihenfolge (strikte <-Vergleiche, fixe Ladeordnung).
 * Null bei nicht-finiten Koordinaten oder leerer Registry.
 */
export function matchGemeinde(lat: number, lng: number): GemeindeMatch | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let best: AustrianGemeinde | null = null;
  let bestDistance = Infinity;
  for (const g of ALL_GEMEINDEN) {
    const d = haversineKm(lat, lng, g.lat, g.lng);
    if (d < bestDistance) {
      bestDistance = d;
      best = g;
    }
  }
  if (!best) return null;

  return {
    gemeinde: best,
    gemeindeSlug: best.slug,
    bundesland: bundeslandToId(best.bundesland),
    distanceKm: bestDistance,
  };
}
