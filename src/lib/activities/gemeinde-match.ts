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
 * Plausibilitaets-Grenzen: Oesterreich-BBox mit kleinem Rand
 * (Extreme AT: lat 46.372..49.021, lng 9.530..17.161). Vertauschte
 * lat/lng, 0/0-Koordinaten und Nicht-AT-Punkte fallen hier durch,
 * BEVOR ein "naechstes" Gemeinde-Match sie zu valide aussehenden,
 * aber falschen gemeinde_slug/bundesland-Werten persistiert.
 */
const AUSTRIA_BBOX = {
  minLat: 46.3, maxLat: 49.1,
  minLng: 9.4, maxLng: 17.3,
} as const;

/**
 * Obergrenze fuer die Distanz zum naechsten Gemeinde-Zentrum. Die Registry
 * (~2.000 Zentren) deckt Oesterreich mit ~6-7 km Rasterabstand ab; selbst
 * abgelegene Alpin-POIs (Gletscherlifte) liegen < ~15 km vom Zentrum ihrer
 * Gemeinde. Punkte jenseits von 25 km sind keine plausiblen AT-POIs
 * (z. B. Muenchen liegt innerhalb der BBox-Laengengrade) -> null.
 */
const MAX_MATCH_DISTANCE_KM = 25;

/**
 * Nearest-Gemeinde fuer einen Koordinaten-Punkt. Deterministisch: bei
 * (praktisch nicht vorkommenden) exakten Distanz-Gleichstaenden gewinnt die
 * erste Zeile in Registry-Reihenfolge (strikte <-Vergleiche, fixe Ladeordnung).
 * Null bei nicht-finiten Koordinaten, Punkten ausserhalb der AT-BBox,
 * Distanz > MAX_MATCH_DISTANCE_KM oder leerer Registry — der Ingest
 * (Task 2) ueberspringt solche POIs, statt Datenmuell zu persistieren.
 */
export function matchGemeinde(lat: number, lng: number): GemeindeMatch | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (
    lat < AUSTRIA_BBOX.minLat || lat > AUSTRIA_BBOX.maxLat ||
    lng < AUSTRIA_BBOX.minLng || lng > AUSTRIA_BBOX.maxLng
  ) {
    return null;
  }

  let best: AustrianGemeinde | null = null;
  let bestDistance = Infinity;
  for (const g of ALL_GEMEINDEN) {
    const d = haversineKm(lat, lng, g.lat, g.lng);
    if (d < bestDistance) {
      bestDistance = d;
      best = g;
    }
  }
  if (!best || bestDistance > MAX_MATCH_DISTANCE_KM) return null;

  return {
    gemeinde: best,
    gemeindeSlug: best.slug,
    bundesland: bundeslandToId(best.bundesland),
    distanceKm: bestDistance,
  };
}
