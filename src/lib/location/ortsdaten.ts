/**
 * Ortsdaten je Land (fn-29.2): Gemeinde-Index, PLZ-Format, Land-IDs,
 * Landesrahmen, Punkt-in-Polygon und PLZ→Land. Die Ortsentscheidung und der
 * Freigabevertrag laufen für jedes Land mit Ortsdaten nach denselben Regeln;
 * Länder ohne Ortsdaten bekommen weiter keine Ableitungen.
 *
 * Österreich: Statistik Austria, RTR, Bundesland-Polygone in public/.
 * Deutschland: Destatis, GeoNames, BKG VG250 (data/gemeinden-de.json,
 * data/plz-de.json, data/stammdaten-de/laender-de.geojson).
 *
 * SERVER-ONLY (die Indizes lesen per readFileSync).
 */
import { bundeslandToId } from '@/lib/bundeslaender';
import { bundeslandFromPolygon } from '@/lib/eventim/bundesland-from-geo';
import { loadGemeindenDe } from '@/lib/gemeinden/de';
import { deLandToId } from '@/lib/gemeinden/laender-de';
import { AT_GEMEINDE_INDEX, createGemeindeIndex, type GemeindeIndex } from './gemeinde-index';
import { deLandFromPolygon } from './land-de-from-geo';
import { getBundeslandFromPLZ } from './plz-bundesland';
import { allPlzReferenceDeEntries, isOfficialGermanPlz, landForPlzDe } from './plz-reference-de';

export interface Box {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export interface Ortsdaten {
  country: 'AT' | 'DE';
  index: GemeindeIndex;
  plzDigits: 4 | 5;
  /** Land-ID zu einer Quellangabe („Oberösterreich", „Bayern"). */
  landId(raw: string | null | undefined): string | null;
  /** Grober Rahmen des Landes für die Plausibilität einer Quellkoordinate. */
  box: Box;
  /** Land der Koordinate per Polygon, null außerhalb der Landfläche. */
  regionOf(lat: number, lng: number): string | null;
  /** Land der PLZ, nur wenn eindeutig. */
  plzRegionOf(plz: string): string | null;
}

// Österreich-Bounding-Box wie in admission.ts / score-event.ts.
const AT_BOX: Box = { latMin: 46.3, latMax: 49.1, lngMin: 9.5, lngMax: 17.2 };
// Deutschland: äußerste Landpunkte (List auf Sylt 55,06° N, Oberstdorf
// 47,27° N, Selfkant 5,87° O, Deschka 15,04° O) mit Rand.
const DE_BOX: Box = { latMin: 47.2, latMax: 55.1, lngMin: 5.8, lngMax: 15.1 };

const AT: Ortsdaten = {
  country: 'AT',
  index: AT_GEMEINDE_INDEX,
  plzDigits: 4,
  landId: bundeslandToId,
  box: AT_BOX,
  regionOf: bundeslandFromPolygon,
  plzRegionOf: getBundeslandFromPLZ,
};

let de: Ortsdaten | null = null;

function deOrtsdaten(): Ortsdaten {
  if (de) return de;
  de = {
    country: 'DE',
    index: createGemeindeIndex({
      *gemeinden() {
        for (const g of loadGemeindenDe()) {
          yield {
            ref: { name: g.name, plz: g.plz, bundesland: g.land, bezirk: g.kreis || null, lat: g.lat, lng: g.lng, amtsPlz: g.plz, statutarstadt: false },
            plzAll: g.plzAll,
          };
        }
      },
      postOrte: () => allPlzReferenceDeEntries(),
      isOfficialPlz: isOfficialGermanPlz,
      plzPattern: /^\d{5}$/,
    }),
    plzDigits: 5,
    landId: deLandToId,
    box: DE_BOX,
    regionOf: deLandFromPolygon,
    plzRegionOf: landForPlzDe,
  };
  return de;
}

/** Ortsdaten zum (normalisierten) Ländercode, null für Länder ohne Stammdaten. */
export function ortsdatenFor(country: string | null | undefined): Ortsdaten | null {
  if (country === 'AT') return AT;
  if (country === 'DE') return deOrtsdaten();
  return null;
}

export function inBox(lat: number, lng: number, b: Box): boolean {
  return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
}

/**
 * Land der Koordinate für den Freigabevertrag (`AdmissionOptions.regionOf`):
 * Polygone des deklarierten Landes; Länder ohne Ortsdaten wie bisher gegen
 * die österreichischen Flächen (findet dort nichts außer Fehlzuordnungen).
 */
export function regionOfCountry(lat: number, lng: number, country: string = 'AT'): string | null {
  return (ortsdatenFor(country) ?? AT).regionOf(lat, lng);
}

/** Land der PLZ für den Freigabevertrag (`AdmissionOptions.plzRegionOf`). */
export function plzRegionOfCountry(plz: string, country: string = 'AT'): string | null {
  return (ortsdatenFor(country) ?? AT).plzRegionOf(plz);
}

/**
 * Die Spalten `events.bundesland` (CHECK auf die neun österreichischen IDs)
 * und `events.district` (FK auf district_canonical) führen nur österreichische
 * Werte. Für andere Länder bleiben sie leer; das Land einer deutschen
 * Gemeinde steht in `location_resolution.gemeinde.bundesland`. Ein DE-Wert in
 * der Spalte würde den ganzen Schreib-Batch abweisen (auch AT-Zeilen im
 * Eventim-Import).
 */
export function writesAustrianRegionColumns(country: string | null | undefined): boolean {
  return country === 'AT';
}
