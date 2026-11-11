/**
 * Deutsche Gemeinden aus der EINZIGEN Stammdatei `data/gemeinden-de.json`
 * (gebaut von src/scripts/build-stammdaten-de.ts aus dem Gemeindeverzeichnis
 * von Destatis). Gegenstück zu `data.ts` für Österreich: PLZ, Kreis, Verband
 * und Mittelpunkt einer deutschen Gemeinde stehen nur dort.
 *
 * SERVER-ONLY (liest per readFileSync).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeGemeindeName } from '@/lib/location/gemeinde-name';

export interface GemeindeDe {
  /** Amtlicher Gemeindeschlüssel, 8 Stellen. */
  ags: string;
  /** Amtlicher Regionalschlüssel, 12 Stellen (mit Verband). */
  ars: string;
  /** Name ohne Statuszusatz („Neustadt a.d.Aisch"). */
  name: string;
  /** Name laut Destatis („Neustadt a.d.Aisch, St"). */
  nameAmtlich: string;
  /** Land-ID aus `laender-de.ts` (`rheinland-pfalz`, …). */
  land: string;
  kreisKey: string;
  kreis: string;
  /** Amt, Verbandsgemeinde, Samtgemeinde, Verwaltungsgemeinschaft; sonst null. */
  verbandKey: string | null;
  verband: string | null;
  /** PLZ des Gemeindeamts laut Destatis. */
  plz: string;
  /** Alle PLZ der Gemeinde (Amts-PLZ und belegte Ortsnamen, `plz-de.json`). */
  plzAll: string[];
  lat: number;
  lng: number;
  einwohner: number;
}

let cache: GemeindeDe[] | null = null;
let byAgs: Map<string, GemeindeDe> | null = null;
let byLandName: Map<string, GemeindeDe[]> | null = null;

export function loadGemeindenDe(): GemeindeDe[] {
  if (cache) return cache;
  cache = JSON.parse(readFileSync(join(process.cwd(), 'data', 'gemeinden-de.json'), 'utf8')) as GemeindeDe[];
  return cache;
}

function index(): void {
  if (byAgs && byLandName) return;
  byAgs = new Map();
  byLandName = new Map();
  for (const g of loadGemeindenDe()) {
    byAgs.set(g.ags, g);
    const k = `${g.land}|${normalizeGemeindeName(g.name)}`;
    byLandName.set(k, [...(byLandName.get(k) ?? []), g]);
  }
}

export function gemeindeDeByAgs(ags: string): GemeindeDe | null {
  index();
  return byAgs!.get(ags) ?? null;
}

/**
 * Gemeinde zu einem Registry- oder Quelleneintrag: über den
 * Gemeindeschlüssel, sonst über den Namen im Land, aber nur wenn er dort
 * eindeutig ist (es gibt z. B. mehrere „Hausen" in Bayern). PLZ und
 * Koordinaten des Eintrags werden bewusst NICHT verwendet.
 */
export function findGemeindeDe(ref: { ags?: string | null; name: string; land: string }): GemeindeDe | null {
  index();
  if (ref.ags && byAgs!.has(ref.ags)) return byAgs!.get(ref.ags)!;
  const hits = byLandName!.get(`${ref.land}|${normalizeGemeindeName(ref.name)}`) ?? [];
  return hits.length === 1 ? hits[0] : null;
}

let byVerband: Map<string, GemeindeDe[]> | null = null;

/** Alle Gemeinden eines Amts bzw. einer Verbands-, Samt- oder Verwaltungsgemeinschaft. */
export function gemeindenDeByVerband(verbandKey: string): GemeindeDe[] {
  if (!byVerband) {
    byVerband = new Map();
    for (const g of loadGemeindenDe()) {
      if (g.verbandKey) byVerband.set(g.verbandKey, [...(byVerband.get(g.verbandKey) ?? []), g]);
    }
  }
  return byVerband.get(verbandKey) ?? [];
}
