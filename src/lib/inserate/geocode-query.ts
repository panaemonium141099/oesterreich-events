/**
 * Adressaufbereitung für Inserate: Suchanfragen fürs Geocoding und die
 * kanonische Schreibweise von `events.address`.
 *
 * REIN — kein Netz, kein I/O. Der eigentliche Geocoder wird von der
 * Freigabe-Route gerufen, die Kandidaten kommen von hier.
 *
 * WARUM DAS EIGENS EXISTIERT
 * ──────────────────────────
 * Die erste Fassung der Freigabe hat die Suchanfrage naiv aus allen
 * vorhandenen Feldern zusammengeklebt:
 *
 *     [address, postal_code, location_name].filter(Boolean).join(', ')
 *     → "Esterhazyplatz 5, 7000, Schlosspark Esterhazy"
 *
 * Nominatim liefert darauf NICHTS (gemessen 2026-09-07): die PLZ steht als
 * eigenes Feld ohne Ort, und der Veranstaltungsort hängt wie ein weiterer
 * Adressbestandteil hinten dran. Dieselbe Adresse als
 * "Esterhazyplatz 5, 7000 Eisenstadt" löst dagegen sauber auf
 * (47.8453969, 16.5201913).
 *
 * Folge des Fehlschlags war nicht etwa ein Event ohne Kartenpin, sondern
 * ein UNSICHTBARES Event: `/api/events` filtert mit
 * `.not('latitude', 'is', null)`, und die MV `event_map_points` verlangt
 * ebenfalls Koordinaten. Ohne lat/lng erscheint ein Inserat weder in der
 * Liste noch auf der Karte noch in der Suche — obwohl es auf
 * `publish_status='published'` steht.
 *
 * Deshalb zwei Dinge:
 *   1. Die Anfrage wird als echte Adresse formuliert, mit gestaffelten
 *      Rückfallebenen von genau nach grob.
 *   2. `events.address` wird kanonisch als "Strasse, PLZ Ort" geschrieben.
 *      `parseCityFromAddress` in slugify.ts liest den Ort genau aus dieser
 *      Form (Komma-getrennt, führende PLZ wird abgeschnitten) — nur so
 *      bekommt die Event-URL ihr `/{plz}-{ort}/`-Segment.
 */

/** Die Ortsangaben einer Einreichung. */
export interface AddressParts {
  location_name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Suchanfragen fürs Geocoding, von der genauesten zur gröbsten.
 * Der Aufrufer probiert sie der Reihe nach und nimmt den ersten Treffer.
 *
 * Die Reihenfolge ist bewusst: eine Hausnummer trifft das Gebäude, die
 * PLZ mit Ort trifft den Ortskern, der Veranstaltungsort allein trifft
 * mit etwas Glück das Gebäude und sonst nichts. Der reine Ort steht als
 * letzte Stufe, weil ein Pin im richtigen Dorf besser ist als gar keiner.
 *
 * `geocodeLocation` hängt selbst ", Austria" an und begrenzt auf
 * `countrycodes=at`; das gehört deshalb nicht in die Kandidaten.
 */
export function buildGeocodeCandidates(parts: AddressParts): string[] {
  const street = clean(parts.address);
  const plz = clean(parts.postal_code);
  const city = clean(parts.city);
  const venue = clean(parts.location_name);

  // "7000 Eisenstadt", "Eisenstadt" oder "7000" — was da ist.
  const place = [plz, city].filter(Boolean).join(' ') || null;

  const candidates = [
    street && place ? `${street}, ${place}` : null,
    place,
    venue && city ? `${venue}, ${city}` : null,
    venue,
  ];

  // Duplikate raus (z. B. wenn nur der Ort ausgefüllt ist), Reihenfolge bleibt.
  return [...new Set(candidates.filter((c): c is string => Boolean(c)))];
}

/**
 * Kanonische Adresse für `events.address`: "Strasse Hausnummer, PLZ Ort".
 *
 * Genau diese Form braucht `parseCityFromAddress` (slugify.ts), um den Ort
 * für die URL zu finden: es splittet an Kommata und schneidet eine
 * führende vierstellige PLZ vom letzten Teil ab. Ohne Komma zwischen
 * Strasse und Ort gibt es keinen zweiten Teil und damit keinen Ort.
 *
 * Gibt `null` zurück, wenn gar keine Ortsangabe vorliegt — dann bleibt die
 * Spalte leer, statt eine halbe Adresse zu behaupten.
 */
export function composeEventAddress(parts: AddressParts): string | null {
  const street = clean(parts.address);
  const plz = clean(parts.postal_code);
  const city = clean(parts.city);

  const place = [plz, city].filter(Boolean).join(' ') || null;

  if (street && place) return `${street}, ${place}`;
  if (street) return street;
  return place;
}
