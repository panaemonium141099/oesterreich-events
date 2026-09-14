/**
 * Ortsentscheidung Phase A (fn-25): Regressionsfälle aus dem Review-Plan §9
 * und aus docs/ORTSDATEN-ANALYSE-2026-09-13.md. Jeder Fall ist ein realer
 * Prod-Befund; die Eingaben sind die tatsächlichen Quellwerte.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveConservativeLocation,
  extractPlzFromAddress,
  extractCityFromAddress,
  hasHouseNumber,
} from '@/lib/location/conservative-resolution';
import { shouldOverwriteCoords } from '@/lib/db/supabase-sync';

const NOW = new Date('2026-09-13T12:00:00Z');
const resolve = (input: Parameters<typeof resolveConservativeLocation>[0]) =>
  resolveConservativeLocation(input, NOW);

describe('Der Name kommt von der Quelle und wird nie ersetzt', () => {
  it('Haus der Frau (Linz) bleibt Haus der Frau und landet nicht in Haus im Ennstal', () => {
    const d = resolve({
      location_name: 'Haus der Frau',
      address: 'Volksgartenstraße 18, 4020, Linz',
      bundesland: 'oberoesterreich',
    });
    expect(d.location_name).toBe('Haus der Frau');
    expect(d.postal_code).toBe('4020');
    expect(d.gemeinde?.name).toBe('Linz');
    expect(d.status).toBe('municipality_only');
    expect(d.allowed.pin).toBe(false);
    // Linz-Zentroid, nicht Haus im Ennstal (47.41/13.77)
    expect(d.latitude).toBeGreaterThan(48.2);
    expect(d.longitude).toBeGreaterThan(14.2);
  });

  it('Martin-Luther-Kirche wird nicht über den Namensteil "Kirche" zu Hirschegg', () => {
    const d = resolve({
      location_name: 'Martin-Luther-Kirche',
      address: 'Johann-Konrad-Vogel-Straße 1, 4020, Linz',
      bundesland: 'oberoesterreich',
    });
    expect(d.location_name).toBe('Martin-Luther-Kirche');
    expect(d.gemeinde?.name).toBe('Linz');
    expect(d.longitude).toBeGreaterThan(14);
  });

  it('Theater in der Innenstadt wird nicht in Theater an der Wien umbenannt', () => {
    const d = resolve({
      location_name: 'Theater in der Innenstadt',
      address: 'Museumstraße 7a, 4020, Linz',
      bundesland: 'oberoesterreich',
    });
    expect(d.location_name).toBe('Theater in der Innenstadt');
    expect(d.postal_code).toBe('4020');
    expect(d.latitude).toBeGreaterThan(48.2);
  });

  it('Franz-Haas-Platz (Wien) wird nicht zu Galtür', () => {
    const d = resolve({ location_name: 'Franz-Haas-Platz', address: 'Franz-Haas-Platz, 1110, Wien' });
    expect(d.location_name).toBe('Franz-Haas-Platz');
    expect(d.postal_code).toBe('1110');
    expect(d.gemeinde?.bundesland).toBe('wien');
    expect(d.latitude).toBeGreaterThan(48.1);
  });

  it('Sommerarena Baden behält den Venue-Namen', () => {
    const d = resolve({
      location_name: 'Sommerarena Baden',
      address: 'Arenaweg',
      postal_code: '2500',
      bundesland: 'niederoesterreich',
    });
    expect(d.location_name).toBe('Sommerarena Baden');
    expect(d.gemeinde?.name).toBe('Baden');
  });
});

describe('Keine Position aus Titel, Beschreibung oder Venue-Wörtern', () => {
  it('Galerie Krinzinger ohne PLZ und ohne Stadt bekommt keine Koordinate aus dem Titel', () => {
    const d = resolve({
      title: 'Erik Schmidt "Blue Zone" in der Galerie, Egg im Bregenzerwald lässt grüßen',
      location_name: 'Galerie Krinzinger',
      address: 'Seilerstätte 16',
    });
    expect(d.latitude).toBeNull();
    expect(d.status).toBe('unresolved');
  });

  it('Titel-PLZ nur im Muster "in 1230 Wien"', () => {
    const d = resolve({ title: 'Privat Flohmarkt in 1230 Wien', location_name: 'Privatgarten' });
    expect(d.postal_code).toBe('1230');
    expect(d.provenance.postal_code).toBe('title_text');
    const none = resolve({ title: 'Kammermusik 2026/2027', location_name: 'Saal' });
    expect(none.postal_code).toBeNull();
  });
});

describe('PLZ nie aus Koordinaten; Widersprüche werden nicht übernommen', () => {
  it('Quellkoordinate ohne PLZ liefert keine zurückgerechnete PLZ', () => {
    const d = resolve({ location_name: 'Handwerksmühle Ritzenried', latitude: 47.122, longitude: 10.78 });
    expect(d.postal_code).toBeNull();
    expect(d.latitude).toBe(47.122);
  });

  it('Adress-PLZ zählt als Quellangabe, nicht ein Text-Treffer anderswo', () => {
    const d = resolve({
      location_name: 'Handwerksmühle Ritzenried',
      address: 'Ritzenried 107, 6474',
      latitude: 47.122,
      longitude: 10.78,
    });
    expect(d.postal_code).toBe('6474');
    expect(d.provenance.postal_code).toBe('address_text');
    expect(d.gemeinde?.bundesland).toBe('tirol');
  });

  it('Quellkoordinate weit weg von der genannten PLZ ist ein Konflikt ohne Position', () => {
    // Eventim "Ambach" Götzis: PLZ 6840, Pin in Niederösterreich
    const d = resolve({
      location_name: 'Ambach',
      address: 'Am Bach 10',
      postal_code: '6840',
      bundesland: 'vorarlberg',
      latitude: 48.307,
      longitude: 15.582,
      coords_precision: 'venue',
    });
    expect(d.status).toBe('conflict');
    expect(d.latitude).toBeNull();
    expect(d.postal_code).toBe('6840');
    expect(d.allowed.pin).toBe(false);
  });

  it('Regionsmittelpunkte werden nicht als Event-Position gespeichert', () => {
    const d = resolve({
      location_name: 'Bergerlebnis',
      bundesland: 'salzburg',
      latitude: 47.349,
      longitude: 13.06,
      coords_precision: 'region',
    });
    expect(d.latitude).toBeNull();
    expect(d.status).toBe('region_only');
  });
});

describe('Genauigkeit der Quellkoordinate bestimmt Status und Ausspielung', () => {
  it('Feed-Venue mit Quellen-Venue-ID: bestätigt, Pin und Anreise erlaubt', () => {
    const d = resolve({
      location_name: 'Tiroler Landestheater',
      address: 'Rennweg 2',
      postal_code: '6020',
      city: 'Innsbruck',
      country: 'AT',
      latitude: 47.269,
      longitude: 11.395,
      coords_precision: 'venue',
      source_venue_id: 'eventim:4711',
    });
    expect(d.status).toBe('venue_confirmed');
    expect(d.precision).toBe('building');
    expect(d.allowed).toEqual({ pin: true, route: true, distance: true, municipality_page: true });
    expect(d.gemeinde?.name).toBe('Innsbruck');
  });

  it('Festivalgelände ohne Hausnummer mit Venue-Koordinate der Quelle: Pin und Route erlaubt', () => {
    const d = resolve({ location_name: 'Festgelände Wiesen', city: 'Wiesen', postal_code: '7203', bundesland: 'burgenland', latitude: 47.741, longitude: 16.335, coords_precision: 'venue' });
    expect(d.status).toBe('address_confirmed');
    expect(d.allowed.pin).toBe(true);
    expect(d.allowed.route).toBe(true);
  });

  it('Alte Adapter ohne Genauigkeitsangabe: Position gespeichert, aber nicht bestätigt', () => {
    const d = resolve({ location_name: 'Kulturverein Röda', address: 'Gaswerkgasse 2, 4400 Steyr', latitude: 48.04, longitude: 14.42 });
    expect(d.status).toBe('unresolved');
    expect(d.precision).toBe('unknown');
    expect(d.latitude).toBe(48.04);
    expect(d.allowed.pin).toBe(false);
    expect(d.reasons).toContain('source_coords_precision_unknown');
  });

  it('Gemeinde-Zentroid eines Gemeinde-Kalenders bleibt Gebietsangabe', () => {
    const d = resolve({
      location_name: 'Gemeindesaal',
      postal_code: '7000',
      city: 'Eisenstadt',
      bundesland: 'burgenland',
      latitude: 47.8467,
      longitude: 16.5249,
      coords_precision: 'municipality',
    });
    expect(d.status).toBe('municipality_only');
    expect(d.geocoding_confidence).toBe('gemeinde-centroid');
    expect(d.allowed.pin).toBe(false);
    expect(d.allowed.municipality_page).toBe(true);
  });
});

describe('Gemeinde-Auflösung ohne Raten', () => {
  it('Salzburg als Ortsname im deklarierten Bundesland ist die Stadt, nicht der Landesmittelpunkt', () => {
    const d = resolve({ location_name: 'Salzburg', bundesland: 'salzburg' });
    expect(d.status).toBe('municipality_only');
    expect(d.gemeinde?.name).toBe('Salzburg');
    expect(d.postal_code).toBe('5020');
    expect(d.latitude).toBeGreaterThan(47.7);
  });

  it('Ohne deklariertes Bundesland wird ein mehrdeutiger Ortsname nicht aufgelöst', () => {
    // "Berg" gibt es in mehreren Bundesländern.
    const d = resolve({ location_name: 'Berg', address: 'Hauptstraße 23' });
    expect(d.gemeinde).toBeNull();
    expect(d.latitude).toBeNull();
    expect(d.status).toBe('unresolved');
  });

  it('PLZ mit mehreren Gemeinden: das deklarierte Bundesland entscheidet, nicht die Reihenfolge', () => {
    // 2413 = Berg (NÖ) und Edelstal (Bgld)
    const noe = resolve({ location_name: 'Gemeindeamt', address: 'Hauptstraße 23', postal_code: '2413', bundesland: 'niederoesterreich' });
    expect(noe.gemeinde?.name).toBe('Berg');
    const open = resolve({ location_name: 'Gemeindeamt', postal_code: '2413' });
    expect(open.gemeinde).toBeNull();
    expect(open.reasons).toContain('plz_covers_multiple_gemeinden');
    expect(open.latitude).toBeNull();
    expect(open.status).toBe('municipality_only');
  });

  it('Einzelkandidat im falschen Bundesland wird verworfen', () => {
    // "Galtür" existiert nur in Tirol; deklariert ist Burgenland.
    const d = resolve({ location_name: 'Galtür', bundesland: 'burgenland' });
    expect(d.gemeinde).toBeNull();
    expect(d.status).toBe('region_only');
  });

  it('Ausland: keine österreichische PLZ-Ableitung, Quellkoordinate bleibt', () => {
    const d = resolve({
      location_name: 'Haus Leipzig',
      address: 'Elsterstraße 22 - 24',
      postal_code: '04109',
      country: 'DE',
      latitude: 51.34,
      longitude: 12.37,
      coords_precision: 'venue',
      source_venue_id: 'eventim:99',
    });
    expect(d.country).toBe('DE');
    expect(d.postal_code).toBeNull();
    expect(d.gemeinde).toBeNull();
    expect(d.latitude).toBe(51.34);
    expect(d.location_name).toBe('Haus Leipzig');
  });

  it('Online-Events bekommen keinen physischen Ersatzort', () => {
    const d = resolve({ location_name: 'Online-Event', postal_code: '1010' });
    expect(d.status).toBe('online');
    expect(d.latitude).toBeNull();
  });
});

describe('Hilfsfunktionen', () => {
  it('extractPlzFromAddress: genau eine bekannte PLZ, keine Hausnummern, keine 5-Steller', () => {
    expect(extractPlzFromAddress('Pollheimerstraße 17, 4600')).toBe('4600');
    expect(extractPlzFromAddress('Olgastr. 20, 88045 Friedrichshafen')).toBeNull();
    expect(extractPlzFromAddress('Hauptgasse 38, 7083 Purbach am Neusiedler See')).toBe('7083');
    expect(extractPlzFromAddress('Am Bach 10')).toBeNull();
  });

  it('extractCityFromAddress liest den Ort hinter der PLZ oder den letzten Kommateil', () => {
    expect(extractCityFromAddress('Hauptgasse 38, 7083 Purbach am Neusiedler See')).toBe('Purbach am Neusiedler See');
    expect(extractCityFromAddress('Volksgartenstraße 18, 4020, Linz')).toBe('Linz');
    expect(extractCityFromAddress('Mittereck 19, 8383 Sankt Martin an der Raab')).toBe('Sankt Martin an der Raab');
    expect(extractCityFromAddress('Seilerstätte 16')).toBeNull();
  });

  it('hasHouseNumber erkennt Straße + Nummer', () => {
    expect(hasHouseNumber('Rennweg 2, 6020, Innsbruck')).toBe(true);
    expect(hasHouseNumber('Museumstraße 7a, 4020, Linz')).toBe(true);
    expect(hasHouseNumber('7000 Eisenstadt')).toBe(false);
    expect(hasHouseNumber('Arenaweg')).toBe(false);
  });
});

describe('shouldOverwriteCoords: die Quelle ist für ihre Koordinate maßgeblich', () => {
  const row = (lat: number, lng: number, conf: string | null) => ({ latitude: lat, longitude: lng, geocoding_confidence: conf });

  it('neue Quellkoordinate ersetzt Alt-Normalizer-, Master- und KI-Koordinaten', () => {
    for (const conf of ['exact', 'normalized', 'verified', 'from_title', 'from_description', 'gemini', 'openai', 'nominatim', 'gemeinde-registry', null]) {
      expect(shouldOverwriteCoords(row(47.41, 13.77, conf), 48.3, 14.29, 'scraper')).toBe(true);
    }
  });

  it('geänderte Quellkoordinate ersetzt die alte Quellkoordinate auch bei kleinem Abstand (300 m)', () => {
    expect(shouldOverwriteCoords(row(48.3000, 14.2900, 'scraper'), 48.3027, 14.2900, 'scraper')).toBe(true);
    expect(shouldOverwriteCoords(row(48.3, 14.29, 'scraper'), 48.3, 14.29, 'scraper')).toBe(false);
  });

  it('Gemeinde-Zentroid sperrt keine Quellkoordinate, ersetzt aber Alt-Treffer', () => {
    expect(shouldOverwriteCoords(row(48.3, 14.29, 'scraper'), 48.31, 14.28, 'gemeinde-centroid')).toBe(false);
    expect(shouldOverwriteCoords(row(47.41, 13.77, 'exact'), 48.31, 14.28, 'gemeinde-centroid')).toBe(true);
  });

  it('manuelle Korrekturen bleiben', () => {
    expect(shouldOverwriteCoords(row(48.3, 14.29, 'manual'), 48.31, 14.28, 'scraper')).toBe(false);
  });
});
