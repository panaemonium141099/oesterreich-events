/**
 * Ortsentscheidung (fn-25): gemeinsames Vokabular für Schreib- und
 * Ausgabepfade.
 *
 * Grundregel: Eine Angabe wird nur in der Genauigkeit veröffentlicht, die
 * ihre Belege tragen. Eine bestätigte Gemeinde ist kein bestätigter
 * Veranstaltungsort. Deshalb trennen wir vier Dinge, die der alte
 * `geocoding_confidence`-Wert vermischt hat: Herkunft der Angabe, Sicherheit
 * der Identität, räumliche Genauigkeit und erlaubte Ausspielung.
 */

/** Wissensstand über den Veranstaltungsort. */
export type LocationStatus =
  /** Venue-Identität belegt (Quellen-Venue-ID oder geprüfte Zuordnung). */
  | 'venue_confirmed'
  /** Eventadresse belegt und Position dazu bekannt. */
  | 'address_confirmed'
  /** Nur die Gemeinde (oder das PLZ-Gebiet) ist belegt. */
  | 'municipality_only'
  /** Nur Bundesland/Region bekannt. */
  | 'region_only'
  /** Kein belastbarer Ort oder unbekannte Genauigkeit der Quellkoordinate. */
  | 'unresolved'
  /** Belastbare Angaben widersprechen sich. */
  | 'conflict'
  /** Ausdrücklich online/virtuell. */
  | 'online';

/** Räumliche Genauigkeit der gespeicherten Position. */
export type LocationPrecision =
  | 'entrance'
  | 'building'
  | 'site'
  | 'street'
  | 'locality'
  | 'municipality'
  | 'postcode'
  | 'region'
  | 'unknown';

/**
 * Genauigkeit, die ein Adapter für die von ihm gelieferten Koordinaten
 * behauptet. Fehlt die Angabe, gilt `unknown` (alte Adapter): die Position
 * wird gespeichert, aber nicht als bestätigt behandelt.
 */
export type SourceCoordsPrecision =
  | 'venue'
  | 'address'
  | 'municipality'
  | 'postcode'
  | 'region'
  | 'unknown';

/** Woher eine Angabe stammt. */
export type Provenance =
  | 'source'          // ausdrücklich geliefertes Feld der Quelle
  | 'address_text'    // aus dem Adresstext der Quelle extrahiert
  | 'title_text'      // aus dem Titel der Quelle extrahiert
  | 'registry'        // aus der Gemeinde-Registry übernommen
  | 'derived:plz'     // aus einer belegten PLZ berechnet
  | 'derived:coords'  // aus einer Koordinate berechnet (nie als Beleg zulässig)
  | 'default'         // Vorgabewert, weil die Quelle nichts geliefert hat
  | 'manual';

export interface AllowedOutputs {
  /** Präziser Event-Pin auf der Karte. */
  pin: boolean;
  /** Anreise-/Routenlink zur Position. */
  route: boolean;
  /** Distanzangaben / Umkreissuche. */
  distance: boolean;
  /** Listung auf der Gemeindeseite. */
  municipality_page: boolean;
}

export const LOCATION_RESOLUTION_VERSION = 1;

/**
 * Ergebnis der Ortsentscheidung, wie es in `events.location_resolution`
 * gespeichert wird. Alle Felder zusammen bilden EINE Entscheidung; Name,
 * PLZ und Koordinate werden nie aus verschiedenen Kandidaten kombiniert.
 */
export interface LocationDecision {
  version: number;
  status: LocationStatus;
  precision: LocationPrecision;
  /** Anzeigename = Rohwert der Quelle (nur getrimmt). */
  location_name: string | null;
  postal_code: string | null;
  /** Gemeinde aus der Registry, falls belegt (Name + PLZ der Registry). */
  gemeinde: { name: string; plz: string; bundesland: string; bezirk: string | null } | null;
  latitude: number | null;
  longitude: number | null;
  /** Kompatibler Wert für `events.geocoding_confidence`. */
  geocoding_confidence: 'scraper' | 'gemeinde-centroid' | null;
  geocoding_source: string | null;
  country: string;
  allowed: AllowedOutputs;
  /** Herkunft je Feld. */
  provenance: Partial<Record<'location_name' | 'postal_code' | 'latitude' | 'gemeinde' | 'country', Provenance>>;
  /** Warum die Entscheidung so ausfiel (maschinenlesbare Codes). */
  reasons: string[];
  /** Belege, auf die sich die Entscheidung stützt. */
  evidence: string[];
  /** Angaben, die verworfen wurden, mit Grund. */
  rejected: string[];
  resolved_at: string;
  input_hash: string;
}
