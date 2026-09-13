/**
 * Nachschlagestrukturen über die Gemeinde-Registry (`data/gemeinden-registry`)
 * für die Ortsentscheidung.
 *
 * Bewusst als Mengen modelliert: eine PLZ kann mehrere Gemeinden decken und
 * ein Gemeindename kommt in mehreren Bundesländern vor. Der Aufrufer
 * entscheidet, ob Mehrdeutigkeit auflösbar ist; hier wird nichts nach
 * Häufigkeit oder Alphabet „gewonnen".
 *
 * SERVER-ONLY (liest per readFileSync).
 */
import { ALL_GEMEINDEN, type AustrianGemeinde } from '@/lib/gemeinden/data';
import { STADT_PLZ } from '@/lib/district-normalizer';
import { bundeslandToId } from '@/lib/bundeslaender';
import { getCoordinatesForPLZ } from '@/lib/plzCoordinates';
import { isOfficialAustrianPlz } from './plz-reference';

export interface GemeindeRef {
  name: string;
  plz: string;
  /** kanonische Bundesland-ID (`oberoesterreich`, …) */
  bundesland: string;
  /** Bezirk laut Registry (Rohschreibweise). */
  bezirk: string | null;
  lat: number;
  lng: number;
}

/** Schreibweise für den Namensvergleich: klein, Umlaute vereinheitlicht,
 *  „St."/„Sankt" gleichgesetzt, Satzzeichen weg. */
export function normalizeGemeindeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\bst\.\s*/g, 'sankt ')
    .replace(/\bst\s+/g, 'sankt ')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let byPlz: Map<string, GemeindeRef[]> | null = null;
let byName: Map<string, GemeindeRef[]> | null = null;

function toRef(g: AustrianGemeinde): GemeindeRef | null {
  const bl = bundeslandToId(g.bundesland);
  if (!bl) return null;
  return { name: g.name, plz: g.plz, bundesland: bl, bezirk: g.bezirk || null, lat: g.lat, lng: g.lng };
}

function build(): void {
  if (byPlz && byName) return;
  byPlz = new Map();
  byName = new Map();
  for (const g of ALL_GEMEINDEN) {
    const ref = toRef(g);
    if (!ref) continue;
    const plzList = byPlz.get(ref.plz) ?? [];
    plzList.push(ref);
    byPlz.set(ref.plz, plzList);
    const key = normalizeGemeindeName(ref.name);
    const nameList = byName.get(key) ?? [];
    nameList.push(ref);
    byName.set(key, nameList);
  }
  // Statutarstädte: die Registry kennt pro Stadt nur EINE PLZ (8010 Graz),
  // die übrigen Stadt-PLZ (8020, 8036, …) gehören zur selben Gemeinde.
  for (const [cityKey, rule] of Object.entries(STADT_PLZ)) {
    const cityRefs = byName.get(normalizeGemeindeName(cityKey.replace(/-/g, ' ')));
    const city = cityRefs?.find(r => r.bundesland === rule.bl);
    if (!city) continue;
    for (const plz of rule.stadtPLZ) {
      if (!byPlz.has(plz)) byPlz.set(plz, [city]);
    }
  }
}

/** Alle Gemeinden zu einer PLZ (leer, wenn unbekannt). */
export function gemeindenByPlz(plz: string): GemeindeRef[] {
  build();
  return byPlz!.get(plz) ?? [];
}

/** Alle Gemeinden mit exakt diesem Namen (normalisiert). */
export function gemeindenByName(name: string): GemeindeRef[] {
  build();
  const key = normalizeGemeindeName(name);
  if (!key) return [];
  return byName!.get(key) ?? [];
}

/** Ist das eine bekannte österreichische PLZ (Registry, Stadt-Blöcke oder
 *  PLZ-Tabelle)? */
export function isKnownAustrianPlz(plz: string): boolean {
  if (!/^\d{4}$/.test(plz)) return false;
  if (isOfficialAustrianPlz(plz)) return true;
  build();
  return byPlz!.has(plz) || getCoordinatesForPLZ(plz) !== null;
}

/**
 * Mittelpunkt für ein PLZ-Gebiet: genau dann eindeutig, wenn die Registry
 * eine einzige Gemeinde zur PLZ kennt. Bei mehreren Gemeinden wird nur dann
 * ein Punkt geliefert, wenn eine davon per Name bestätigt ist (`preferName`).
 * Sonst `null`: Mehrdeutigkeit bleibt Mehrdeutigkeit.
 */
export function plzCentroid(
  plz: string,
  preferName?: string | null,
): { ref: GemeindeRef | null; lat: number; lng: number; ambiguous: boolean } | null {
  build();
  const refs = byPlz!.get(plz) ?? [];
  if (refs.length === 1) return { ref: refs[0], lat: refs[0].lat, lng: refs[0].lng, ambiguous: false };
  if (refs.length > 1) {
    if (preferName) {
      const key = normalizeGemeindeName(preferName);
      const hit = refs.find(r => normalizeGemeindeName(r.name) === key);
      if (hit) return { ref: hit, lat: hit.lat, lng: hit.lng, ambiguous: false };
    }
    return { ref: null, lat: refs[0].lat, lng: refs[0].lng, ambiguous: true };
  }
  const table = getCoordinatesForPLZ(plz);
  if (table) return { ref: null, lat: table[0], lng: table[1], ambiguous: false };
  return null;
}
