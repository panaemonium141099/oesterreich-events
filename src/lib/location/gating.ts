/**
 * Ausspielungs-Gating nach Wissensstand (fn-25 C5, Review §6).
 *
 * Eine Angabe wird nur in der Genauigkeit ausgespielt, die ihre Belege
 * tragen. Dieses Modul ist die EINE Stelle, an der Karte, Liste, Detail,
 * Umkreis, JSON-LD und Widgets nachfragen, was sie zeigen dürfen.
 *
 * Isomorph (kein I/O), damit Server-Routen und Client-Komponenten dieselbe
 * Regel anwenden.
 *
 * Schalter: `NEXT_PUBLIC_LOCATION_GATING=1` schärft die Regel für Pins und
 * Distanzen (Phase F, nach der Bestandssanierung). Ohne Schalter gilt für
 * Pin/Distanz das bisherige Verhalten (Koordinate vorhanden), die Anreise
 * ist bereits seit Phase A5 gesperrt, solange kein Beleg vorliegt.
 */

export interface GateableEvent {
  latitude?: number | null;
  longitude?: number | null;
  geocoding_confidence?: string | null;
  location_status?: string | null;
  location_precision?: string | null;
  location_resolution?: {
    allowed?: { pin?: boolean; route?: boolean; distance?: boolean; municipality_page?: boolean } | null;
  } | null;
}

export interface LocationOutputs {
  /** Präziser Event-Pin auf der Karte. */
  pin: boolean;
  /** Anreise-/Routenlink. */
  route: boolean;
  /** Distanzangaben, Umkreissortierung, „in deiner Nähe". */
  distance: boolean;
  /** Listung auf Gemeinde-/Bezirksseiten. */
  municipality_page: boolean;
  /** Koordinate vorhanden, aber keine belegte Veranstaltungsposition. */
  approximate: boolean;
}

const TRUSTED_LEGACY = new Set(['manual', 'json-ld-venue']);

export function locationGatingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LOCATION_GATING === '1';
}

/**
 * Was darf mit der Position dieses Events geschehen?
 *
 * Reihenfolge: gespeicherte Entscheidung (`location_resolution.allowed`) →
 * Status → Alt-Label. Zeilen ohne Entscheidung (noch nicht neu geschrieben)
 * gelten als „ungefähr", außer die Koordinate ist manuell oder aus
 * strukturierten Venue-Daten.
 */
export function locationOutputs(event: GateableEvent, opts: { enforce?: boolean } = {}): LocationOutputs {
  const hasCoords = event.latitude != null && event.longitude != null;
  const allowed = event.location_resolution?.allowed ?? null;
  const legacyTrusted = !!event.geocoding_confidence && TRUSTED_LEGACY.has(event.geocoding_confidence);
  const status = event.location_status ?? null;

  let pin: boolean;
  let route: boolean;
  let distance: boolean;
  let municipalityPage: boolean;

  if (allowed) {
    pin = hasCoords && allowed.pin === true;
    route = hasCoords && allowed.route === true;
    distance = hasCoords && allowed.distance === true;
    municipalityPage = allowed.municipality_page !== false;
  } else if (status) {
    const precise = status === 'venue_confirmed' || status === 'address_confirmed';
    pin = hasCoords && precise;
    route = hasCoords && precise;
    distance = hasCoords && precise;
    municipalityPage = precise || status === 'municipality_only';
  } else {
    pin = hasCoords && legacyTrusted;
    route = hasCoords && legacyTrusted;
    distance = hasCoords && legacyTrusted;
    municipalityPage = true;
  }
  if (legacyTrusted && hasCoords) {
    pin = true;
    route = true;
    distance = true;
  }

  const enforce = opts.enforce ?? locationGatingEnabled();
  if (!enforce) {
    // Übergangsphase: Pin und Distanz wie bisher (Koordinate vorhanden),
    // die Route bleibt an den Beleg gebunden.
    return { pin: hasCoords, route, distance: hasCoords, municipality_page: municipalityPage, approximate: hasCoords && !pin };
  }
  return { pin, route, distance, municipality_page: municipalityPage, approximate: hasCoords && !pin };
}

/** Flag-Bit im Karten-Payload (`get_event_map_points`): Position ungefähr. */
export const MAP_FLAG_APPROXIMATE = 16;
