/**
 * PLZ-Referenz für Deutschland (fn-29.1): `data/plz-de.json`, gebaut von
 * src/scripts/build-stammdaten-de.ts aus GeoNames (CC BY 4.0) und der
 * Amts-PLZ des Destatis-Gemeindeverzeichnisses. Gegenstück zu
 * `plz-reference.ts` (Österreich, RTR).
 *
 * Je PLZ die MENGE der Orte, Gemeinden (AGS), Kreise und Länder. Hier wird
 * nichts aufgelöst; wer genau eine Gemeinde oder ein Land braucht, prüft, ob
 * die Menge einelementig ist, oder bringt einen weiteren Beleg mit.
 * Großkunden-PLZ (nur Firmeneinträge) sind markiert und belegen keinen Ort.
 *
 * SERVER-ONLY (liest per readFileSync).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PlzReferenceDeEntry {
  plz: string;
  orte: string[];
  /** AGS der Gemeinden, die diese PLZ belegt führen. */
  gemeinden: string[];
  /** Kreisschlüssel, fünfstellig. */
  kreise: string[];
  /** Land-IDs aus `laender-de.ts`. */
  laender: string[];
  /** Ort → AGS, wo der Ort genau einer Gemeinde angehört (Ortsteile über die VG250-Fläche). */
  orteGemeinde?: Record<string, string>;
  grosskunde?: true;
}

let table: Map<string, PlzReferenceDeEntry> | null = null;

function load(): Map<string, PlzReferenceDeEntry> {
  if (table) return table;
  table = new Map();
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'plz-de.json'), 'utf8');
    for (const e of JSON.parse(raw) as PlzReferenceDeEntry[]) table.set(e.plz, e);
  } catch {
    console.warn('[plz-reference-de] data/plz-de.json fehlt — npm run build:stammdaten:de');
  }
  return table;
}

export function allPlzReferenceDeEntries(): PlzReferenceDeEntry[] {
  return [...load().values()];
}

export function plzReferenceDe(plz: string): PlzReferenceDeEntry | null {
  return load().get(plz) ?? null;
}

/** Fünfstellig und in der Referenz bekannt (auch Großkunden-PLZ). */
export function isOfficialGermanPlz(plz: string): boolean {
  return /^\d{5}$/.test(plz) && load().has(plz);
}

/**
 * Gemeinde (AGS) eines Orts unter dieser PLZ („Mahlow", 15831 →
 * Blankenfelde-Mahlow). Nur der Ortsname, wie die PLZ-Referenz ihn führt
 * (Groß-/Kleinschreibung und Leerraum egal); sonst null.
 */
export function postOrtGemeindeDe(plz: string, ort: string): string | null {
  const map = load().get(plz)?.orteGemeinde;
  if (!map) return null;
  const key = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const k = key(ort);
  for (const [o, ags] of Object.entries(map)) if (key(o) === k) return ags;
  return null;
}

/** Land zur PLZ, nur wenn eindeutig und kein Großkunde. */
export function landForPlzDe(plz: string): string | null {
  const e = load().get(plz);
  return e && !e.grosskunde && e.laender.length === 1 ? e.laender[0] : null;
}
