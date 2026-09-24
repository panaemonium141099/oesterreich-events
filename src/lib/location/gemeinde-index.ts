/**
 * Nachschlagestrukturen über die Gemeinde-Stammdatei (`data/gemeinden-at.json`)
 * für die Ortsentscheidung.
 *
 * Bewusst als Mengen modelliert: eine PLZ kann mehrere Gemeinden decken und
 * ein Gemeindename kommt in mehreren Bundesländern vor. Der Aufrufer
 * entscheidet, ob Mehrdeutigkeit auflösbar ist; hier wird nichts nach
 * Häufigkeit oder Alphabet „gewonnen".
 *
 * SERVER-ONLY (liest per readFileSync).
 */
import { loadGemeindenMaster } from '@/lib/gemeinden/data';
import { allPlzReferenceEntries, isOfficialAustrianPlz } from './plz-reference';

export interface GemeindeRef {
  name: string;
  plz: string;
  /** kanonische Bundesland-ID (`oberoesterreich`, …) */
  bundesland: string;
  /** Bezirk laut Registry (Rohschreibweise). */
  bezirk: string | null;
  lat: number;
  lng: number;
  /** PLZ des Gemeindeamts (amtliche Gemeindeliste). */
  amtsPlz?: string;
  statutarstadt?: boolean;
}

export { normalizeGemeindeName } from './gemeinde-name';
import { normalizeGemeindeName } from './gemeinde-name';

let byPlz: Map<string, GemeindeRef[]> | null = null;
let byName: Map<string, GemeindeRef[]> | null = null;

// Eine PLZ kann mehrere Gemeinden bedienen und eine Gemeinde mehrere PLZ
// haben (Graz: 8010 und 16 weitere; 4040: Linz, Altenberg, Kirchschlag).
// Die amtliche Gemeindeliste führt beides. Kandidaten einer PLZ sind ALLE
// Gemeinden, die sie bedienen; bei mehreren entscheidet der Ortsname
// (4040 ist Amts-PLZ von Lichtenberg, gehört aber auch zu Linz: 271 Linzer
// Events landeten 2026-09-14 in Lichtenberg, als nur die Amts-PLZ zählte).
function build(): void {
  if (byPlz && byName) return;
  byPlz = new Map();
  byName = new Map();
  for (const g of loadGemeindenMaster()) {
    if (g.lat === 0 && g.lng === 0) continue;
    const ref: GemeindeRef = { name: g.name, plz: g.plz, bundesland: g.bundesland, bezirk: g.bezirk || null, lat: g.lat, lng: g.lng, amtsPlz: g.plz, statutarstadt: g.statutarstadt };
    for (const plz of g.plzAll) {
      const list = byPlz.get(plz) ?? [];
      list.push(ref);
      byPlz.set(plz, list);
    }
    const key = normalizeGemeindeName(ref.name);
    const nameList = byName.get(key) ?? [];
    nameList.push(ref);
    byName.set(key, nameList);
  }
}

/**
 * Hauptgemeinde einer PLZ ohne weiteren Beleg, nach amtlicher Gemeindeliste:
 * genau eine Gemeinde hat sie als Amts-PLZ und keine andere ist Statutarstadt
 * (2500 → Baden, obwohl Alland/Heiligenkreuz 2500 mitführen), oder keine hat
 * sie als Amts-PLZ und genau eine ist Statutarstadt (9061 → Klagenfurt).
 * Sonst null: 4040 (Amt Lichtenberg, aber auch Linz) und 2413 (Amt Berg UND
 * Edelstal) bleiben ohne Ortsnamen offen.
 */
export function hauptgemeindeFuerPlz(plz: string): GemeindeRef | null {
  const refs = gemeindenByPlz(plz);
  if (refs.length < 2) return refs[0] ?? null;
  const amt = refs.filter(r => r.amtsPlz === plz);
  const staedte = refs.filter(r => r.statutarstadt);
  if (amt.length === 1 && staedte.every(s => s === amt[0])) return amt[0];
  if (amt.length === 0 && staedte.length === 1) return staedte[0];
  return null;
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

/** Ist das eine bekannte österreichische PLZ (Post-Tabelle oder Stammdatei)? */
export function isKnownAustrianPlz(plz: string): boolean {
  if (!/^\d{4}$/.test(plz)) return false;
  if (isOfficialAustrianPlz(plz)) return true;
  build();
  return byPlz!.has(plz);
}

/**
 * Mittelpunkt für ein PLZ-Gebiet: genau dann eindeutig, wenn die Stammdatei
 * eine einzige Gemeinde zur PLZ kennt. Bei mehreren Gemeinden wird nur dann
 * ein Punkt geliefert, wenn eine davon per Name bestätigt ist (`preferName`).
 * Sonst `null`: Mehrdeutigkeit bleibt Mehrdeutigkeit.
 */
export function plzCentroid(
  plz: string,
  preferName?: string | null,
): { ref: GemeindeRef | null; lat: number; lng: number; ambiguous: boolean } | null {
  const refs = gemeindenByPlz(plz);
  if (refs.length === 1) return { ref: refs[0], lat: refs[0].lat, lng: refs[0].lng, ambiguous: false };
  if (refs.length > 1) {
    if (preferName) {
      const key = normalizeGemeindeName(preferName);
      const hit = refs.find(r => normalizeGemeindeName(r.name) === key);
      if (hit) return { ref: hit, lat: hit.lat, lng: hit.lng, ambiguous: false };
    }
    return { ref: null, lat: refs[0].lat, lng: refs[0].lng, ambiguous: true };
  }
  return null;
}

let placeNames: Set<string> | null = null;

/** Zwei Schreibweisen je Name: Umlaut als „oe" und Umlaut ohne Punkte. */
function placeKeys(input: string): string[] {
  const base = input.trim().toLowerCase()
    .replace(/\bst\.\s*/g, 'sankt ').replace(/\bst\s+/g, 'sankt ')
    .replace(/[^a-zäöüß0-9]+/g, ' ').trim();
  const oe = base.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const plain = base.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
  return [oe, plain];
}

/**
 * Ist das ein österreichischer Ortsname (Gemeinde laut Stammdatei oder Ort
 * laut Post-Tabelle)? Für die Titel-Bereinigung des Kategorie-Classifiers
 * („Dorffest in Neckenmarkt" → „Dorffest"). Ersetzt den GeoNames-Index des
 * früheren location-normalizer.
 */
export function isKnownAustrianPlaceName(phrase: string): boolean {
  if (!phrase || phrase.trim().length < 2) return false;
  if (!placeNames) {
    placeNames = new Set();
    for (const g of loadGemeindenMaster()) for (const k of placeKeys(g.name)) placeNames.add(k);
    for (const e of allPlzReferenceEntries()) for (const o of e.orte) for (const k of placeKeys(o)) placeNames.add(k);
  }
  return placeKeys(phrase).some(k => placeNames!.has(k));
}
