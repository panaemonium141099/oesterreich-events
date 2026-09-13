/**
 * Vertrauens-Gate für Event-Koordinaten (Anreise-Link, „Ortsangabe ungefähr").
 *
 * Hintergrund: Mehr als die Hälfte der Live-Events sitzt auf Gemeinde-,
 * PLZ- oder GeoNames-Mittelpunkten, nicht am Veranstaltungsort
 * (docs/ORTSDATEN-ANALYSE-2026-09-13.md). Ein Routenlink dorthin schickt
 * Nutzer an den falschen Ort.
 *
 * Regel seit fn-25 (2026-09-13): Der Anreise-Button braucht eine BELEGTE
 * Zielposition. Belegt ist eine Position nur, wenn
 *   1. die Ortsentscheidung des Schreibpfads die Anreise ausdrücklich
 *      erlaubt (`location_resolution.allowed.route`), oder
 *   2. die Koordinate manuell bzw. aus strukturierten Venue-Daten der
 *      Quellseite stammt (`manual`, `json-ld-venue`).
 * Ein beliebiger Adresstext oder die Alt-Labels `exact`/`verified` reichen
 * nicht mehr: `exact` war ein GeoNames-Namenstreffer („Ronacher" → Weiler
 * in Kärnten), `verified` eine Master-Koordinate aus demselben Verfahren.
 *
 * Alles andere gilt als ungefähr: die UI zeigt „Ortsangabe ungefähr, beim
 * Veranstalter prüfen" statt eines Routenlinks.
 */

const TRUSTED_GEOCODING_CONFIDENCES = new Set<string>(['manual', 'json-ld-venue']);

export interface EventLocationLike {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  geocoding_confidence?: string | null;
  location_status?: string | null;
  location_resolution?: { allowed?: { route?: boolean; pin?: boolean } | null } | null;
}

/**
 * True, wenn die Koordinate belastbar genug ist, um Nutzer dorthin zu schicken.
 * Immer false ohne Koordinaten.
 */
export function isLocationTrusted(event: EventLocationLike): boolean {
  if (event.latitude == null || event.longitude == null) return false;
  if (event.location_resolution?.allowed?.route === true) return true;
  if (event.geocoding_confidence && TRUSTED_GEOCODING_CONFIDENCES.has(event.geocoding_confidence)) {
    return true;
  }
  return false;
}

/**
 * True, wenn Koordinaten vorhanden, aber nicht belegt genug für eine Route
 * sind. Die UI zeigt dann den „Ortsangabe ungefähr"-Hinweis.
 */
export function isLocationApproximate(event: EventLocationLike): boolean {
  if (event.latitude == null || event.longitude == null) return false;
  return !isLocationTrusted(event);
}
