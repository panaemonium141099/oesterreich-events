/**
 * Gemeinde-Kontext für Kalender-Scraper (fn-25 B3).
 *
 * Die Gemeinde-Adapter (gem2go, gemeinden-generic, gemeinde-registry,
 * gemeinden) kennen die Gemeinde, deren Kalender sie lesen. Bisher schrieben
 * sie deren Mittelpunkt ununterscheidbar als Event-Koordinate und den
 * Gemeindenamen als Veranstaltungsort. Beides ist eine Gebietsangabe, kein
 * Veranstaltungsort — und eine Gemeinde-Kalenderseite beweist nicht, dass
 * jedes beworbene Event in dieser Gemeinde stattfindet.
 *
 * Deshalb:
 *  - `city` = Gemeindename (ausdrücklicher Ortskontext der Quelle),
 *  - Koordinaten nur, wenn das Event eigene hat (Detailseite/JSON-LD →
 *    `coords_precision: 'venue'`); sonst der Gemeinde-Mittelpunkt mit
 *    `coords_precision: 'municipality'`, damit der Schreibpfad ihn als
 *    Gebietsangabe behandelt,
 *  - `location_name` bleibt leer, wenn die Quelle keinen Veranstaltungsort
 *    nennt (die Anzeige fällt im Schreibpfad auf die belegte Gemeinde zurück),
 *  - nennt der Adresstext eine ANDERE bekannte PLZ, gewinnt die Adresse:
 *    dann keine Gemeinde-PLZ und kein Gemeinde-Mittelpunkt.
 */
import type { ScrapedEvent } from '@/types/events';
import { extractPlzFromAddress } from '@/lib/location/conservative-resolution';

export interface GemeindeContext {
  name: string;
  plz: string;
  lat: number;
  lng: number;
  bundesland: string;
  bezirk?: string | null;
}

const BUNDESLAND_NAMES = new Set([
  'burgenland', 'kärnten', 'kaernten', 'niederösterreich', 'niederoesterreich',
  'oberösterreich', 'oberoesterreich', 'salzburg', 'steiermark', 'tirol',
  'vorarlberg', 'wien', 'österreich', 'oesterreich', 'austria',
]);

/** Ein Bundesland- oder Landesname ist kein Veranstaltungsort. */
export function isRegionLabel(name: string | null | undefined): boolean {
  if (!name) return false;
  return BUNDESLAND_NAMES.has(name.trim().toLowerCase());
}

export function applyGemeindeContext<T extends ScrapedEvent>(event: T, g: GemeindeContext): T {
  const addressPlz = extractPlzFromAddress(event.address);
  const addressNamesOtherPlz = !!addressPlz && addressPlz !== g.plz;
  const hasOwnCoords =
    typeof event.latitude === 'number' && typeof event.longitude === 'number' &&
    Number.isFinite(event.latitude) && Number.isFinite(event.longitude) &&
    !(event.latitude === 0 && event.longitude === 0) &&
    !(event.latitude === g.lat && event.longitude === g.lng);

  // Der Gemeindename als „Veranstaltungsort" ist der alte Fallback der
  // Adapter (`location || gemeinde.name`), kein Quellwert: raus damit, die
  // Anzeige fällt im Schreibpfad auf die belegte Gemeinde zurück.
  const rawName = event.location_name?.trim();
  const townFallback = !!rawName && rawName.toLowerCase() === g.name.trim().toLowerCase();
  const out: T = {
    ...event,
    location_name: !rawName || townFallback || isRegionLabel(rawName) ? undefined : rawName,
    bundesland: event.bundesland ?? g.bundesland,
    district: event.district ?? g.bezirk ?? undefined,
  };

  if (addressNamesOtherPlz) {
    // Die Adresse widerspricht dem Kalender-Kontext: nur die Adresse zählt.
    out.postal_code = event.postal_code ?? addressPlz;
    out.city = event.city;
    if (hasOwnCoords) out.coords_precision = event.coords_precision ?? 'venue';
    else {
      out.latitude = undefined;
      out.longitude = undefined;
      out.coords_precision = undefined;
    }
    return out;
  }

  out.city = event.city ?? g.name;
  out.postal_code = event.postal_code ?? g.plz;
  if (hasOwnCoords) {
    out.coords_precision = event.coords_precision ?? 'venue';
  } else {
    out.latitude = g.lat;
    out.longitude = g.lng;
    out.coords_precision = 'municipality';
  }
  return out;
}
