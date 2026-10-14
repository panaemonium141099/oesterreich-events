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
let byCompact: Map<string, GemeindeRef[]> | null = null;
let allRefs: GemeindeRef[] | null = null;

/** Name ohne Leerzeichen: „Wörther See" = „Wörthersee", „Neusiedler See" = „Neusiedlersee". */
function compactKey(name: string): string {
  return normalizeGemeindeName(name).replace(/ /g, '');
}

// Eine PLZ kann mehrere Gemeinden bedienen und eine Gemeinde mehrere PLZ
// haben (Graz: 8010 und 16 weitere; 4040: Linz, Altenberg, Kirchschlag).
// Die amtliche Gemeindeliste führt beides. Kandidaten einer PLZ sind ALLE
// Gemeinden, die sie bedienen; bei mehreren entscheidet der Ortsname
// (4040 ist Amts-PLZ von Lichtenberg, gehört aber auch zu Linz: 271 Linzer
// Events landeten 2026-09-14 in Lichtenberg, als nur die Amts-PLZ zählte).
function build(): void {
  if (byPlz && byName && byCompact && allRefs) return;
  byPlz = new Map();
  byName = new Map();
  byCompact = new Map();
  allRefs = [];
  for (const g of loadGemeindenMaster()) {
    if (g.lat === 0 && g.lng === 0) continue;
    const ref: GemeindeRef = { name: g.name, plz: g.plz, bundesland: g.bundesland, bezirk: g.bezirk || null, lat: g.lat, lng: g.lng, amtsPlz: g.plz, statutarstadt: g.statutarstadt };
    allRefs.push(ref);
    for (const plz of g.plzAll) {
      const list = byPlz.get(plz) ?? [];
      list.push(ref);
      byPlz.set(plz, list);
    }
    const key = normalizeGemeindeName(ref.name);
    const nameList = byName.get(key) ?? [];
    nameList.push(ref);
    byName.set(key, nameList);
    const compact = compactKey(ref.name);
    const compactList = byCompact.get(compact) ?? [];
    compactList.push(ref);
    byCompact.set(compact, compactList);
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

let postOrte: Map<string, string[]> | null = null;

/** Post-Orte der PLZ-Tabelle („Zürs" → 6763, „Kühtai" → 6183). */
function plzForPostOrt(text: string): string[] {
  if (!postOrte) {
    postOrte = new Map();
    for (const e of allPlzReferenceEntries()) {
      for (const o of e.orte) {
        const k = compactKey(o);
        postOrte.set(k, [...(postOrte.get(k) ?? []), e.plz]);
      }
    }
  }
  return postOrte.get(compactKey(text)) ?? [];
}

/** Allgemeine erste Wörter, die allein keine Gemeinde bezeichnen. */
const GENERIC_FIRST_WORDS = new Set(['sankt', 'bad', 'maria', 'markt', 'deutsch', 'neu', 'gross', 'klein', 'ober', 'unter', 'hinter', 'vorder', 'windisch', 'kroatisch', 'stadt', 'region', 'gemeinde']);

/**
 * Gemeinden, die ein Ortstext meint, nur für VERGLEICHE (liegt eine PLZ im
 * genannten Ort oder widerspricht sie ihm?), nie für eine Zuordnung: die
 * Ortsentscheidung bleibt beim exakten Namen (`gemeindenByName`).
 *
 * Quellen nennen Orte oft nicht amtlich: Tourismusnamen („Bad Kleinkirchheim /
 * St. Oswald", „Millstatt am Millstätter See"), Kurzformen („Neustift" für
 * „Neustift im Stubaital", „Matrei i.O."), Ortsteile („Zürs") und
 * Schreibvarianten („Wörther See"). Gesucht wird nacheinander, bis es einen
 * Treffer gibt: der ganze Text, seine Teile und Post-Orte der PLZ-Tabelle;
 * dann im genannten Bundesland amtliche Namen, die mit den Wörtern des Texts
 * (auch abgekürzt) beginnen; zuletzt dort Namen mit demselben ersten,
 * unterscheidungskräftigen Wort (`exact: true` lässt diese beiden
 * Näherungen weg). Treffer im genannten Bundesland gehen vor; gibt es dort
 * keine, zählen alle.
 */
export function gemeindenNamedByPlaceText(
  text: string | null | undefined,
  bundesland?: string | null,
  opts: { exact?: boolean } = {},
): GemeindeRef[] {
  if (!text || !text.trim()) return [];
  build();
  const exact = (t: string): GemeindeRef[] => [
    ...gemeindenByName(t),
    ...(byCompact!.get(compactKey(t)) ?? []),
    ...plzForPostOrt(t).flatMap(plz => gemeindenByPlz(plz)),
  ];
  const parts = text.split(/\s*(?:[/&,+]|\s-\s|\s+und\s+|-)\s*/i).map(p => p.trim()).filter(p => p.length >= 3);
  const hits = new Set<GemeindeRef>(exact(text));
  if (hits.size === 0) for (const p of parts) for (const r of exact(p)) hits.add(r);
  const inBl = (refs: Iterable<GemeindeRef>) => [...refs].filter(r => !bundesland || r.bundesland === bundesland);
  if (bundesland && !opts.exact && inBl(hits).length === 0) {
    const keys = [text, ...parts].map(t => normalizeGemeindeName(t).split(' ')).filter(k => k[0].length >= 3);
    const pool = allRefs!.filter(r => r.bundesland === bundesland).map(r => ({ r, words: normalizeGemeindeName(r.name).split(' ') }));
    // Wortanfänge, auch abgekürzt: „Neustift" → „Neustift im Stubaital",
    // „Matrei i.O." → „Matrei in Osttirol".
    for (const { r, words } of pool) {
      if (keys.some(k => k.length <= words.length && k[0] === words[0] && k.every((w, i) => words[i].startsWith(w)))) hits.add(r);
    }
    // Gleiches erstes Wort: „Millstatt am Millstätter See" → „Millstatt am See".
    if (inBl(hits).length === 0) {
      for (const { r, words } of pool) {
        if (keys.some(k => k[0].length >= 5 && !GENERIC_FIRST_WORDS.has(k[0]) && k[0] === words[0])) hits.add(r);
      }
    }
  }
  const scoped = inBl(hits);
  return scoped.length > 0 ? scoped : [...hits];
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
