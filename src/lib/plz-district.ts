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
import { normalizeDistrict, isCanonicalDistrict, stadtPlzRules } from '@/lib/district-normalizer';
import { bundeslandToId } from '@/lib/bundeslaender';
import { allPlzReferenceEntries } from '@/lib/location/plz-reference';

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
  const normalized = normalizeDistrict(bezirk, bl, plz);
  if (!normalized) return null;
  if (isCanonicalDistrict(normalized)) return normalized;
  const stadtFix = normalized.replace(/[ -]stadt$/, ' (stadt)');
  if (stadtFix !== normalized && isCanonicalDistrict(stadtFix)) return stadtFix;
  const landFix = normalized.replace(/[ -]land$/, '-land');
  if (landFix !== normalized && isCanonicalDistrict(landFix)) return landFix;
  // Amtliche Schreibweise der Statistik Austria: „Sankt Pölten (Land)",
  // „Waidhofen an der Ybbs (Stadt)" (kanonisch: „st. pölten (land)",
  // „waidhofen an der ybbs").
  const sanktFix = normalized.replace(/^sankt /, 'st. ');
  if (sanktFix !== normalized && isCanonicalDistrict(sanktFix)) return sanktFix;
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
 * PLZ → Bezirke als MENGE (fn-25 C2). Quellen: Gemeinde-Registry (eine PLZ je
 * Gemeinde) und die amtliche PLZ-Tabelle der RTR (`data/plz-at.json`, alle
 * Bezirke je PLZ). Bezirksnamen werden durch denselben district-normalizer
 * gedreht wie der Schreibpfad. Kein Häufigkeits- und kein Alphabetentscheid:
 * Mehrdeutigkeit bleibt Mehrdeutigkeit.
 */
const PLZ_TO_DISTRICTS: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>> = (() => {
  const out = new Map<string, Map<string, Set<string>>>();
  const add = (plz: string, bl: string, district: string) => {
    let byBl = out.get(plz);
    if (!byBl) { byBl = new Map(); out.set(plz, byBl); }
    let set = byBl.get(bl);
    if (!set) { set = new Set(); byBl.set(bl, set); }
    set.add(district);
  };
  for (const g of ALL_GEMEINDEN) {
    const bl = bundeslandToId(g.bundesland);
    if (!bl || !g.plz || !g.bezirk) continue;
    const canonical = toCanonicalDistrict(g.bezirk, bl, g.plz);
    if (canonical) add(g.plz, bl, canonical);
  }
  for (const e of allPlzReferenceEntries()) {
    for (const bl of e.bundeslaender) {
      for (const bezirk of e.bezirke) {
        const canonical = toCanonicalDistrict(bezirk, bl, e.plz);
        if (canonical) add(e.plz, bl, canonical);
      }
    }
  }
  return out;
})();

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
 * Alle kanonischen Bezirke, die für eine PLZ (im Bundesland, falls gegeben)
 * infrage kommen. Leer, wenn die PLZ unbekannt ist.
 */
export function districtsForPlz(plz: string | null | undefined, bundeslandId?: string | null): string[] {
  const trimmed = plz?.trim();
  if (!trimmed) return [];
  const stadt = stadtPlzLookup().get(trimmed);
  if (stadt && (!bundeslandId || stadt.bundesland === bundeslandId)) return [stadt.district];
  const byBl = PLZ_TO_DISTRICTS.get(trimmed);
  if (!byBl) return [];
  const out = new Set<string>();
  for (const [bl, set] of byBl) {
    if (bundeslandId && bl !== bundeslandId) continue;
    for (const d of set) out.add(d);
  }
  return [...out];
}

/**
 * Liefert den kanonischen Bezirk für eine PLZ — NUR wenn er eindeutig ist.
 * Null, wenn die PLZ unbekannt ist, das Bundesland nicht passt oder mehrere
 * Bezirke infrage kommen (438 PLZ laut RTR). Wer den Bezirk trotzdem
 * braucht, leitet ihn aus einer belegten Gemeinde ab
 * (`districtFromGemeinde`).
 */
export function districtFromPlz(
  plz: string | null | undefined,
  bundeslandId?: string | null,
): string | null {
  const candidates = districtsForPlz(plz, bundeslandId);
  return candidates.length === 1 ? candidates[0] : null;
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
