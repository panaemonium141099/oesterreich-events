/**
 * PLZ → kanonischer Bezirk (fn-19 Retrieval-Fix).
 *
 * Hintergrund: Viele Quellen (Feratel, Gemeinde-Kalender, Eventim) liefern
 * KEIN Bezirksfeld — `events.district` bleibt NULL, und der Stadt-Filter
 * der Smart-Suche (`district IN (...)`) wirft diese Events komplett raus
 * (belegt 2026-07-31: Eisenstadt-Hub zeigt 59 Events, Suche fand 0).
 *
 * Quelle: ALL_GEMEINDEN (~2.028 Einträge mit PLZ + Bezirk aus der
 * Gemeinden-Registry). Bezirksnamen werden durch denselben
 * district-normalizer gedreht wie der Schreibpfad, damit die Werte exakt
 * dem kanonischen Format in der DB entsprechen. Bei PLZ, die mehrere
 * Bezirke abdecken, gewinnt der häufigste (Tie → alphabetisch, damit
 * deterministisch).
 *
 * SERVER-ONLY: ALL_GEMEINDEN lädt per readFileSync — nicht in
 * Client-Bundles importieren.
 */

import { ALL_GEMEINDEN } from '@/lib/gemeinden/data';
import { normalizeDistrict, isCanonicalDistrict, STADT_PLZ } from '@/lib/district-normalizer';
import { bundeslandToId } from '@/lib/bundeslaender';

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
  return null; // z. B. 'wien' — Wien ist bewusst Bundesland-only
}

const PLZ_TO_DISTRICT: ReadonlyMap<string, PlzEntry> = (() => {
  // plz → (district|bundesland → count)
  const counts = new Map<string, Map<string, number>>();
  for (const g of ALL_GEMEINDEN) {
    const bl = bundeslandToId(g.bundesland);
    if (!bl || !g.plz || !g.bezirk) continue;
    const canonical = toCanonicalDistrict(g.bezirk, bl, g.plz);
    if (!canonical) continue;
    const key = `${canonical}|${bl}`;
    let byDistrict = counts.get(g.plz);
    if (!byDistrict) {
      byDistrict = new Map();
      counts.set(g.plz, byDistrict);
    }
    byDistrict.set(key, (byDistrict.get(key) ?? 0) + 1);
  }

  const out = new Map<string, PlzEntry>();
  for (const [plz, byDistrict] of counts) {
    const winner = [...byDistrict.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0];
    const [district, bundesland] = winner.split('|');
    out.set(plz, { district, bundesland });
  }

  // Statutarstadt-PLZ-Blöcke aus dem Normalizer überschreiben die
  // Registry (die kennt pro Stadt nur EINE PLZ — 8020 Graz, 6020
  // Innsbruck usw. fehlen dort).
  for (const rule of Object.values(STADT_PLZ)) {
    for (const plz of rule.stadtPLZ) {
      out.set(plz, { district: rule.stadtDistrict, bundesland: rule.bl });
    }
  }
  return out;
})();

/**
 * Liefert den kanonischen Bezirk für eine PLZ — oder null, wenn die PLZ
 * unbekannt ist oder (falls `bundeslandId` übergeben) das Bundesland
 * nicht zusammenpasst (Schutz gegen falsch erfasste PLZ).
 */
export function districtFromPlz(
  plz: string | null | undefined,
  bundeslandId?: string | null,
): string | null {
  const trimmed = plz?.trim();
  if (!trimmed) return null;
  const entry = PLZ_TO_DISTRICT.get(trimmed);
  if (!entry) return null;
  if (bundeslandId && entry.bundesland !== bundeslandId) return null;
  return entry.district;
}
