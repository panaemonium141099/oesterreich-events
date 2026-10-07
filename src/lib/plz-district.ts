/**
 * PLZ → kanonischer Bezirk (fn-19 Retrieval-Fix).
 *
 * Hintergrund: Viele Quellen (Feratel, Gemeinde-Kalender, Eventim) liefern
 * KEIN Bezirksfeld — `events.district` bleibt NULL, und der Stadt-Filter
 * der Smart-Suche (`district IN (...)`) wirft diese Events komplett raus
 * (belegt 2026-07-31: Eisenstadt-Hub zeigt 59 Events, Suche fand 0).
 *
 * Quelle: Gemeinde-Stammdatei (ALL_GEMEINDEN, Statistik Austria) und die
 * amtliche PLZ-Tabelle. Bezirksnamen werden durch denselben
 * district-normalizer gedreht wie der Schreibpfad, damit die Werte exakt
 * dem kanonischen Format in der DB entsprechen. Bei PLZ, die mehrere
 * Bezirke abdecken, gewinnt der häufigste (Tie → alphabetisch, damit
 * deterministisch).
 *
 * SERVER-ONLY: ALL_GEMEINDEN lädt per readFileSync — nicht in
 * Client-Bundles importieren.
 */

import { ALL_GEMEINDEN } from '@/lib/gemeinden/data';
import { normalizeDistrict, isCanonicalDistrict, stadtPlzRules, bundeslandOfDistrict } from '@/lib/district-normalizer';
import { bundeslandToId } from '@/lib/bundeslaender';
import { allPlzReferenceEntries } from '@/lib/location/plz-reference';
import { DISTRICTS_BY_BUNDESLAND } from '@/lib/districtsAT';

interface PlzEntry {
  district: string;
  bundesland: string;
}

/**
 * Registry-Bezirk → kanonischer Wert. Der Normalizer lässt unbekannte
 * Schreibweisen unverändert durch ('Innsbruck Stadt' → 'innsbruck
 * stadt') — solche Werte dürfen NICHT in die DB, sonst entsteht genau
 * der Alias-Wildwuchs, den die Kanonisierung beseitigt hat. Deshalb:
 * Suffix-Reparatur versuchen, sonst Eintrag verwerfen.
 */
function toCanonicalDistrict(bezirk: string, bl: string, plz: string): string | null {
  // Die RTR schreibt „Graz(Stadt)", „Sankt Pölten(Land)", die Statistik
  // Austria „Graz (Stadt)".
  const normalized = normalizeDistrict(bezirk.replace(/\s*\((land|stadt)\)\s*$/i, ' ($1)'), bl, plz);
  if (!normalized) return null;
  if (isCanonicalDistrict(normalized)) return normalized;
  const stadtFix = normalized.replace(/[ -]stadt$/, ' (stadt)');
  if (stadtFix !== normalized && isCanonicalDistrict(stadtFix)) return stadtFix;
  const landFix = normalized.replace(/[ -]land$/, '-land');
  if (landFix !== normalized && isCanonicalDistrict(landFix)) return landFix;
  // Amtliche Schreibweise der Statistik Austria: „Sankt Pölten (Land)",
  // „Waidhofen an der Ybbs (Stadt)" (kanonisch: „st. pölten (land)",
  // „waidhofen an der ybbs"). Umgekehrt schreibt die RTR „St. Johann im
  // Pongau" (kanonisch: „sankt johann im pongau").
  const sanktFix = normalized.replace(/^sankt /, 'st. ');
  if (sanktFix !== normalized && isCanonicalDistrict(sanktFix)) return sanktFix;
  const stFix = normalized.replace(/^st\. /, 'sankt ');
  if (stFix !== normalized && isCanonicalDistrict(stFix)) return stFix;
  const ohneStadt = normalized.replace(/ \(stadt\)$/, '');
  if (ohneStadt !== normalized && isCanonicalDistrict(ohneStadt)) return ohneStadt;
  // Oberösterreich schreibt „Stadt Linz", „Stadt Steyr", „Stadt Wels".
  const stadtVorne = normalized.replace(/^stadt (.+)$/, '$1 (stadt)');
  if (stadtVorne !== normalized && isCanonicalDistrict(stadtVorne)) return stadtVorne;
  // Rust ist Statutarstadt ohne eigenen Eintrag in district_canonical; der
  // Filter „eisenstadt" deckt Eisenstadt-Stadt, -Umgebung und Rust ab.
  if (ohneStadt === 'rust' && bl === 'burgenland') return 'eisenstadt';
  return null; // z. B. 'wien' — Wien ist bewusst Bundesland-only
}

/**
 * RTR-Bezirk einer PLZ → kanonischer Wert. Der Bezirk kann jenseits der
 * Landesgrenze der PLZ liegen und steht dann in der Schreibweise seines
 * eigenen Bundeslands: „Eisenstadt-Umgebung" unter der NÖ-PLZ 2443,
 * „Braunau" unter der Salzburger PLZ 5163. Gilt das Vokabular der PLZ nicht,
 * zählt das der anderen Länder, aber nur bei genau einer Lesart.
 */
function readRtrDistrict(bezirk: string, bl: string, plz: string): string | null {
  const own = toCanonicalDistrict(bezirk, bl, plz);
  if (own) return own;
  const readings = new Set<string>();
  for (const other of Object.keys(DISTRICTS_BY_BUNDESLAND)) {
    if (other === bl) continue;
    const reading = toCanonicalDistrict(bezirk, other, plz);
    if (reading) readings.add(reading);
  }
  return readings.size === 1 ? [...readings][0] : null;
}

interface PlzDistricts {
  districts: Set<string>;
  /** Bezirksnamen, die kein kanonischer Wert sind („NULL", „Wien 14.,Penzing"). */
  unreadable: Set<string>;
}

/**
 * PLZ → Bezirke als MENGE (fn-25 C2). Quellen: Gemeinde-Registry (eine PLZ je
 * Gemeinde) und die amtliche PLZ-Tabelle der RTR (`data/plz-at.json`, alle
 * Bezirke je PLZ). Bezirksnamen werden durch denselben district-normalizer
 * gedreht wie der Schreibpfad. Kein Häufigkeits- und kein Alphabetentscheid:
 * Mehrdeutigkeit bleibt Mehrdeutigkeit.
 *
 * Schlüssel ist das Bundesland der PLZ, nicht das des Bezirks: die RTR-Zeile
 * „1140, Wien, Tulln, W" heißt, die Wiener PLZ 1140 stellt auch nach
 * Klosterneuburg (Bezirk Tulln) zu. Solche Bezirke jenseits der Landesgrenze
 * bleiben in der Menge, weil sie die PLZ mehrdeutig machen; als Antwort
 * taugen sie nie (`districtFromPlz`).
 *
 * Ein unlesbarer Name fällt nicht weg, sondern wird vermerkt: er steht für
 * einen Bezirk, den die Menge nicht kennt. Bis 2026-10-07 fielen „Graz(Stadt)",
 * „Sankt Pölten(Land)" u. a. still heraus, und 5071 Wals galt als eindeutig
 * Salzburg-Umgebung.
 */
const PLZ_TO_DISTRICTS: ReadonlyMap<string, ReadonlyMap<string, PlzDistricts>> = (() => {
  const out = new Map<string, Map<string, PlzDistricts>>();
  const add = (plz: string, bl: string, bezirk: string, canonical: string | null) => {
    let byBl = out.get(plz);
    if (!byBl) { byBl = new Map(); out.set(plz, byBl); }
    let entry = byBl.get(bl);
    if (!entry) { entry = { districts: new Set(), unreadable: new Set() }; byBl.set(bl, entry); }
    if (canonical) entry.districts.add(canonical);
    else entry.unreadable.add(bezirk);
  };
  for (const g of ALL_GEMEINDEN) {
    const bl = bundeslandToId(g.bundesland);
    if (!bl || !g.plz || !g.bezirk) continue;
    add(g.plz, bl, g.bezirk, toCanonicalDistrict(g.bezirk, bl, g.plz));
  }
  for (const e of allPlzReferenceEntries()) {
    for (const bl of e.bundeslaender) {
      for (const bezirk of e.bezirke) add(e.plz, bl, bezirk, readRtrDistrict(bezirk, bl, e.plz));
    }
  }
  return out;
})();

/** Bezirksnamen, die die PLZ-Tabelle nicht lesen konnte (Wächter-Test, Diagnose). */
export function unreadablePlzDistricts(): { plz: string; bundesland: string; bezirk: string }[] {
  const out: { plz: string; bundesland: string; bezirk: string }[] = [];
  for (const [plz, byBl] of PLZ_TO_DISTRICTS) {
    for (const [bundesland, entry] of byBl) {
      for (const bezirk of entry.unreadable) out.push({ plz, bundesland, bezirk });
    }
  }
  return out;
}

/** Statutarstadt-PLZ-Blöcke: die präziseste Quelle für Stadt-PLZ. */
let stadtLookup: Map<string, PlzEntry> | null = null;
function stadtPlzLookup(): ReadonlyMap<string, PlzEntry> {
  if (stadtLookup) return stadtLookup;
  const out = new Map<string, PlzEntry>();
  for (const rule of Object.values(stadtPlzRules())) {
    for (const plz of rule.stadtPLZExklusiv) out.set(plz, { district: rule.stadtDistrict, bundesland: rule.bl });
  }
  stadtLookup = out;
  return out;
}

/**
 * Kanonische Bezirke einer PLZ (im Bundesland, falls gegeben). `complete`
 * ist falsch, wenn darunter ein unlesbarer Bezirksname war.
 */
function plzCandidates(plz: string | null | undefined, bundeslandId?: string | null): { districts: string[]; complete: boolean } {
  const trimmed = plz?.trim();
  if (!trimmed) return { districts: [], complete: true };
  const stadt = stadtPlzLookup().get(trimmed);
  if (stadt && (!bundeslandId || stadt.bundesland === bundeslandId)) return { districts: [stadt.district], complete: true };
  const byBl = PLZ_TO_DISTRICTS.get(trimmed);
  if (!byBl) return { districts: [], complete: true };
  const out = new Set<string>();
  let complete = true;
  for (const [bl, entry] of byBl) {
    if (bundeslandId && bl !== bundeslandId) continue;
    for (const d of entry.districts) out.add(d);
    if (entry.unreadable.size > 0) complete = false;
  }
  return { districts: [...out], complete };
}

/**
 * Alle lesbaren kanonischen Bezirke, die für eine PLZ (im Bundesland, falls
 * gegeben) infrage kommen. Leer, wenn die PLZ unbekannt ist.
 */
export function districtsForPlz(plz: string | null | undefined, bundeslandId?: string | null): string[] {
  return plzCandidates(plz, bundeslandId).districts;
}

/**
 * Liefert den kanonischen Bezirk für eine PLZ — NUR wenn er eindeutig ist.
 * Null, wenn die PLZ unbekannt ist, das Bundesland nicht passt oder mehrere
 * Bezirke infrage kommen (438 PLZ laut RTR). Wer den Bezirk trotzdem
 * braucht, leitet ihn aus einer belegten Gemeinde ab
 * (`districtFromGemeinde`).
 *
 * Der Bezirk muss im Bundesland liegen, für das gefragt wird (ohne
 * Bundesland: in dem der PLZ). Bis 2026-10-07 standen 523 Wiener Events mit
 * PLZ 1140/1190/1210 in Tulln bzw. Korneuburg: deren Wiener Gemeindebezirke
 * schreibt die RTR als „Wien 14.,Penzing", das kein kanonischer Wert ist,
 * also blieb der niederösterreichische Bezirk als einziger Kandidat übrig.
 * Ein unlesbarer Bezirksname zählt deshalb als weiterer Kandidat.
 */
export function districtFromPlz(
  plz: string | null | undefined,
  bundeslandId?: string | null,
): string | null {
  const { districts, complete } = plzCandidates(plz, bundeslandId);
  if (!complete || districts.length !== 1) return null;
  const [district] = districts;
  const home = bundeslandOfDistrict(district);
  if (!home) return null;
  if (bundeslandId) return home === bundeslandId ? district : null;
  return districtsForPlz(plz, home).includes(district) ? district : null;
}

/** Kanonischer Bezirk einer per Registry belegten Gemeinde. */
export function districtFromGemeinde(
  bezirk: string | null | undefined,
  bundeslandId: string | null | undefined,
  plz: string | null | undefined,
): string | null {
  if (!bezirk || !bundeslandId) return null;
  // Steht die Gemeinde fest, gilt ihr amtlicher Bezirk. Kein Umweg über die
  // PLZ: 2751 ist Amts-PLZ von Matzendorf-Hölles (Wiener Neustadt-Land) und
  // zugleich Neben-PLZ der Stadt Wiener Neustadt.
  return toCanonicalDistrict(bezirk, bundeslandId, '');
}

/**
 * DER Bezirk eines Events, für jeden Schreibweg gleich (Scraper-Sync,
 * Einreichungen, Neu-Entscheidung im Bestand): zuerst die belegte Gemeinde,
 * dann die PLZ, wenn sie genau einen Bezirk hat, zuletzt der Bezirk der
 * Quelle, falls er kanonisch ist. Bis 2026-09-24 hatte der Quell-Bezirk
 * Vorrang; 15.266 künftige Events standen in einem anderen Bezirk als ihre
 * Gemeinde. Nur kanonische Werte (FK auf district_canonical).
 */
export function districtForLocation(
  gemeinde: { bezirk: string | null; bundesland: string; plz: string } | null | undefined,
  postalCode: string | null | undefined,
  bundeslandId: string | null | undefined,
  sourceDistrict?: string | null,
): string | null {
  const fromGemeinde = gemeinde ? districtFromGemeinde(gemeinde.bezirk, gemeinde.bundesland, gemeinde.plz) : null;
  if (fromGemeinde) return fromGemeinde;
  const fromPlz = districtFromPlz(postalCode, bundeslandId);
  if (fromPlz) return fromPlz;
  const normalized = normalizeDistrict(sourceDistrict, bundeslandId, postalCode);
  return normalized && isCanonicalDistrict(normalized) ? normalized : null;
}
