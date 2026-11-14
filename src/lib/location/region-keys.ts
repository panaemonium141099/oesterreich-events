/**
 * Regionsschlüssel eines Events (fn-31): Land, Kreis bzw. Bezirk und Gemeinde
 * als Schlüssel aus den amtlichen Stammdaten.
 *
 *   region_id     AT: Bundesland-ID (`wien`)            DE: Land-ID (`bayern`)
 *   kreis_key     AT: politischer Bezirk, 3 Stellen     DE: Kreisschlüssel, 5 Stellen
 *   gemeinde_key  AT: Gemeindekennziffer, 5 Stellen     DE: AGS, 8 Stellen
 *
 * Die Spalten `bundesland` (CHECK) und `district` (FK) führen nur
 * österreichische Werte. Diese drei Spalten gelten für beide Länder, tragen
 * keinen CHECK und keinen FK und sind damit der Weg, auf dem lasstreffen.de
 * nach Land, Kreis und Gemeinde filtert.
 *
 * Abgeleitet wird aus der Gemeinde der Ortsentscheidung
 * (`location_resolution.gemeinde`: Name, PLZ, Land, Kreis bzw. Bezirk), nie aus
 * Koordinaten oder Freitext. Sync und Backfill rufen dieselbe Funktion.
 * Regel: Name im Land; bei mehreren gleichnamigen Gemeinden entscheidet der
 * Kreis, dann die PLZ; bleibt es mehrdeutig, ist der Gemeindeschlüssel NULL.
 * Gemessen am 14.11.2026 über die kommenden sichtbaren DE-Events: 98,89 %
 * eindeutig, 1,11 % ohne Gemeinde, ein Event mehrdeutig.
 */
import { loadGemeindenDe, type GemeindeDe } from '@/lib/gemeinden/de';
import { findGemeinde } from '@/lib/gemeinden/data';
import { normalizeGemeindeName } from '@/lib/location/gemeinde-name';
import { bundeslandToId } from '@/lib/bundeslaender';
import { deLandToId } from '@/lib/gemeinden/laender-de';

export interface RegionKeys {
  region_id: string | null;
  kreis_key: string | null;
  gemeinde_key: string | null;
}

/** Die Gemeinde, wie die Ortsentscheidung sie speichert. */
export interface DecisionGemeinde {
  name: string;
  plz: string;
  bundesland: string;
  bezirk: string | null;
}

const NONE: RegionKeys = { region_id: null, kreis_key: null, gemeinde_key: null };

let deByLandName: Map<string, GemeindeDe[]> | null = null;

function deCandidates(land: string, name: string): GemeindeDe[] {
  if (!deByLandName) {
    deByLandName = new Map();
    for (const g of loadGemeindenDe()) {
      const k = `${g.land}|${normalizeGemeindeName(g.name)}`;
      deByLandName.set(k, [...(deByLandName.get(k) ?? []), g]);
    }
  }
  return deByLandName.get(`${land}|${normalizeGemeindeName(name)}`) ?? [];
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.normalize('NFC').toLowerCase().trim() === b.normalize('NFC').toLowerCase().trim();

function deKeys(gemeinde: DecisionGemeinde): RegionKeys {
  const land = deLandToId(gemeinde.bundesland);
  if (!land) return NONE;
  let hits = deCandidates(land, gemeinde.name);
  if (hits.length > 1) {
    const byKreis = hits.filter(g => same(g.kreis, gemeinde.bezirk));
    if (byKreis.length >= 1) hits = byKreis;
  }
  if (hits.length > 1) {
    const byPlz = hits.filter(g => g.plz === gemeinde.plz || g.plzAll.includes(gemeinde.plz));
    if (byPlz.length >= 1) hits = byPlz;
  }
  if (hits.length === 1) {
    return { region_id: land, kreis_key: hits[0].kreisKey || null, gemeinde_key: hits[0].ags };
  }
  // Gemeinde nicht eindeutig: das Land steht fest; der Kreis nur, wenn alle
  // Kandidaten im selben Kreis liegen.
  const kreise = new Set(hits.map(g => g.kreisKey));
  return { region_id: land, kreis_key: hits.length > 0 && kreise.size === 1 ? hits[0].kreisKey || null : null, gemeinde_key: null };
}

function atKeys(gemeinde: DecisionGemeinde): RegionKeys {
  const land = bundeslandToId(gemeinde.bundesland);
  if (!land) return NONE;
  const hit = findGemeinde({ name: gemeinde.name, bundesland: land });
  if (!hit) return { region_id: land, kreis_key: null, gemeinde_key: null };
  // Die Gemeindekennziffer beginnt mit Bundesland (1 Stelle) und politischem
  // Bezirk (2 Stellen): die ersten drei Stellen sind der Bezirk.
  return { region_id: land, kreis_key: hit.gkz.slice(0, 3), gemeinde_key: hit.gkz };
}

/**
 * Regionsschlüssel aus Land und Gemeinde der Ortsentscheidung. Ohne Gemeinde
 * und für Länder ohne Stammdaten sind alle drei NULL.
 */
export function regionKeys(country: string | null | undefined, gemeinde: DecisionGemeinde | null | undefined): RegionKeys {
  if (!gemeinde || !gemeinde.name || !gemeinde.bundesland) return NONE;
  if (country === 'DE') return deKeys(gemeinde);
  if (country === 'AT') return atKeys(gemeinde);
  return NONE;
}
