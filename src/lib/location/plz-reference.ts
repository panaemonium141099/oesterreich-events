/**
 * Amtliche PLZ-Referenz (fn-25 C2): `data/plz-at.json` aus der RTR-Tabelle
 * (Österreichische Post / RTR, CC BY 4.0), gebaut von
 * `src/scripts/build-plz-db.ts`.
 *
 * Je PLZ die MENGE der Orte, politischen Bezirke und Bundesländer. Hier wird
 * nichts aufgelöst: wer genau einen Bezirk braucht, prüft selbst, ob die
 * Menge einelementig ist (siehe `districtFromPlz`), oder bringt einen
 * weiteren Beleg mit (belegte Gemeinde, Adresse).
 *
 * SERVER-ONLY (liest per readFileSync).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PlzReferenceEntry {
  plz: string;
  orte: string[];
  /** Bezirke in Rohschreibweise der Post („Wels(Stadt)", „Wels-Land"). */
  bezirke: string[];
  bundeslaender: string[];
}

let table: Map<string, PlzReferenceEntry> | null = null;

function load(): Map<string, PlzReferenceEntry> {
  if (table) return table;
  table = new Map();
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'plz-at.json'), 'utf8');
    for (const e of JSON.parse(raw) as PlzReferenceEntry[]) table.set(e.plz, e);
  } catch {
    console.warn('[plz-reference] data/plz-at.json fehlt — npx tsx src/scripts/build-plz-db.ts');
  }
  return table;
}

export function allPlzReferenceEntries(): PlzReferenceEntry[] {
  return [...load().values()];
}

export function plzReference(plz: string): PlzReferenceEntry | null {
  return load().get(plz) ?? null;
}

export function isOfficialAustrianPlz(plz: string): boolean {
  return /^\d{4}$/.test(plz) && load().has(plz);
}

/** Bundesland zur PLZ, nur wenn eindeutig. */
export function bundeslandForPlz(plz: string): string | null {
  const e = load().get(plz);
  return e && e.bundeslaender.length === 1 ? e.bundeslaender[0] : null;
}
