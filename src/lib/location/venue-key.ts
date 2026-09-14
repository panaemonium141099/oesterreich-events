/**
 * Schlüssel für bestätigte Spielstätten-Zuordnungen ohne Quellen-Venue-ID
 * (fn-25, Review §4/§10).
 *
 * Feeds mit Venue-Kennung (Eventim `eventVenueId`) werden in
 * `source_venue_map` über diese Kennung bestätigt. Die meisten Scraper
 * liefern nur einen Namen; dafür bildet dieser Schlüssel die Identität
 * „diese Quelle nennt diesen Namen in diesem Ort": Quelle + gefalteter Name
 * + PLZ (ersatzweise Ortsname). Gleicher Name in einer anderen Gemeinde ist
 * ein anderer Schlüssel; eine Bestätigung gilt also nie österreichweit.
 *
 * Eine Bestätigung im Admin (`/api/admin/ortsdaten/venue-map`) schreibt
 * genau einen Eintrag mit diesem Schlüssel und wirkt auf alle künftigen
 * Events der Gruppe, beim nächsten Sync ebenso wie beim Backfill.
 */
import { extractCityFromAddress, extractPlzFromAddress } from './conservative-resolution';
import { normalizeGemeindeName } from './gemeinde-index';

export interface VenueKeyInput {
  source_name?: string | null;
  location_name?: string | null;
  postal_code?: string | null;
  city?: string | null;
  address?: string | null;
}

/** Gefalteter Venue-Name (klein, Umlaute vereinheitlicht, Leerraum). */
export function foldVenueNameForKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[„“"'`´’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function venueMapKey(input: VenueKeyInput): string | null {
  const source = input.source_name?.trim();
  const name = input.location_name?.trim();
  if (!source || !name || name.length < 3) return null;
  const plz = input.postal_code?.trim() || extractPlzFromAddress(input.address) || null;
  const city = input.city?.trim() || extractCityFromAddress(input.address) || null;
  const scope = plz ?? (city ? normalizeGemeindeName(city) : '');
  return `name:${source}:${foldVenueNameForKey(name)}:${scope}`;
}
