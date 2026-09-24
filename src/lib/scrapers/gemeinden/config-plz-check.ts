/**
 * Prüft die PLZ eines Gemeinde-Scraper-Eintrags gegen die amtliche
 * Post-Tabelle (`data/plz-at.json`). Hintergrund 2026-09-24: in
 * gem2goGemeinden.ts war ein ganzer Vorarlberger Block um eine Zeile
 * verrutscht (Dornbirn trug 6922 Wolfurt, Feldkirch 6822 Satteins …),
 * jedes Event dieser Gemeinden landete im Nachbarort.
 *
 * Nur belegbare Fehler zählen: Führt die Post ein Postamt unter genau
 * diesem Gemeindenamen und liegt die eingetragene PLZ weder darauf noch
 * auf einem Postamt gleichen Namens, ist die PLZ falsch. Gemeinden ohne
 * eigenes Postamt (Zustellung über den Nachbarort) bleiben unbewertet,
 * ebenso gleichnamige Postämter in einem anderen Bezirk (Buch in Vorarlberg
 * vs. Buch in der Steiermark).
 *
 * SERVER-ONLY (liest data/plz-at.json).
 */
import { allPlzReferenceEntries, type PlzReferenceEntry } from '@/lib/location/plz-reference';
import { normalizeGemeindeName } from '@/lib/location/gemeinde-index';

let byOrt: Map<string, PlzReferenceEntry[]> | null = null;

function postEntriesForName(name: string): PlzReferenceEntry[] {
  if (!byOrt) {
    byOrt = new Map();
    for (const e of allPlzReferenceEntries()) {
      for (const o of e.orte) {
        const k = normalizeGemeindeName(o);
        byOrt.set(k, [...(byOrt.get(k) ?? []), e]);
      }
    }
  }
  return byOrt.get(normalizeGemeindeName(name)) ?? [];
}

/** Bezirksvergleich über den Namensanfang: die Post schreibt „Bruck an der
 *  Leitha", die Configs „Bruck/Leitha" oder „Kirchdorf/Krems". */
function bezirkStem(b: string): string {
  return normalizeGemeindeName(b).replace(/[^a-z]/g, '').slice(0, 5);
}

/** Richtige PLZ, wenn die eingetragene belegbar falsch ist, sonst `null`. */
export function expectedPlzIfWrong(name: string, plz: string, bezirk: string): string | null {
  const stem = bezirkStem(bezirk);
  const post = postEntriesForName(name).filter(e => e.bezirke.some(b => bezirkStem(b) === stem));
  if (post.length !== 1) return null;
  return post[0].plz === plz ? null : post[0].plz;
}
