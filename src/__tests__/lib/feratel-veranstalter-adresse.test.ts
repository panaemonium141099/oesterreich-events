/**
 * Veranstalteranschrift als Venue (Prod 2026-10-14): Die Deskline-Detailseite
 * führt bei Europolis-Konzerten unter addressType 32 (Veranstaltungsort)
 * dieselbe Büroadresse wie unter 31 (Veranstalter): „Hollergasse 32/6,
 * 1150 Wien". Die Kette: mergeFeratelDetail übernahm Straße und PLZ, der
 * Resolver setzte die Zeile auf den Wiener Mittelpunkt, der Freigabevertrag
 * las die PLZ als Bestätigung dieses Mittelpunkts und schrieb das Bundesland
 * auf Wien um. „The Magic of Elvis" (Konzerthaus Klagenfurt) und „Impulso
 * Tenors" (KUZ Eisenstadt) standen so in Wien, die Klagenfurter Eventim-
 * Zeile hing als Dublette dahinter.
 */
import { describe, it, expect } from 'vitest';
import { extractFeratelDetail, type RawDetail } from '@/lib/scrapers/feratel-details';
import { feratelVenueBelongsToEvent, mergeFeratelDetail } from '@/lib/scrapers/FeratelScraper';
import { resolveConservativeLocation } from '@/lib/location/conservative-resolution';
import { positionFromPlzOnly } from '@/lib/location/contract';
import { addressPlaceRelation } from '@/lib/location/place-match';
import { gemeindenNamedByPlaceText } from '@/lib/location/gemeinde-index';
import { evaluateAdmission } from '@/lib/quality/admission';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

const NOW = new Date('2026-10-14T12:00:00Z');

// Detail-Antworten wie in feratel_event_details (Prod 2026-10-14).
const europolis = (street: string, company: string) => ({
  company, address1: street, city: 'Wien', zipCode: '1150', url: 'https://www.europolis-entertainment.eu',
});
const ELVIS_DETAIL: RawDetail = {
  nextOccurrences: { items: [{ date: '2026-11-04T00:00:00', duration: 0, startTime: '20:00' }], hasMoreItems: false },
  addresses: [
    { addressType: 31, ...europolis('Hollergasse 32/6', 'Europolis Entertainment') },
    { addressType: 32, ...europolis('Hollergasse 32/6', 'Europolis Entertainment') },
  ],
};
const IMPULSO_DETAIL: RawDetail = {
  nextOccurrences: { items: [{ date: '2026-12-14T00:00:00', duration: 0, startTime: '20:00' }], hasMoreItems: false },
  addresses: [
    { addressType: 31, ...europolis('Hollergasse 32/Top 6', 'Europolis Entertainment e.U.') },
    { addressType: 32, ...europolis('Hollergasse 32/Top 6', 'Europolis Entertainment e.U.') },
  ],
};

// Listen-Events, wie FeratelScraper.toScrapedEvent sie liefert: Venue und
// Ort aus der Liste, Bundesland aus der Region, keine API-Koordinate.
const ELVIS: ScrapedEvent = {
  source_id: 'feratel-02f85f20-de58-48b0-b00d-283ba8748490',
  source_name: 'feratel-deskline',
  source_url: null,
  title: 'The Magic of Elvis feat. JIMMY HOLMES',
  start_date: '2026-11-04T19:00:00.000Z',
  location_name: 'Konzerthaus Klagenfurt',
  city: 'Klagenfurt am Wörthersee',
  bundesland: 'Kärnten',
  country: 'AT',
};
const IMPULSO: ScrapedEvent = {
  source_id: 'feratel-dc26d70a-cfbf-4211-936b-57e5cc208cf8',
  source_name: 'feratel-deskline',
  source_url: null,
  title: 'Impulso Tenors - Total Christmas',
  start_date: '2026-12-14T19:00:00.000Z',
  location_name: 'Kultur Kongress Zentrum Eisenstadt',
  city: 'Eisenstadt',
  bundesland: 'Burgenland',
  country: 'AT',
};

type Row = {
  address: string | null;
  postal_code: string | null;
  bundesland: string | null;
  latitude: number | null;
  longitude: number | null;
  location_status: string;
  location_resolution: { reasons: string[]; gemeinde: { name: string } | null; admission: { corrections: string[] } };
};
const rowOf = (e: ScrapedEvent, existing?: Map<string, never>) =>
  toSupabaseRow(e, existing ?? new Map(), new Map()).row as unknown as Row;

describe('mergeFeratelDetail: Veranstalterbüro in einem anderen Ort ist kein Veranstaltungsort', () => {
  it('Elvis: Adresse und PLZ bleiben leer, Veranstalter und Ort der Liste bleiben', () => {
    const [base, dated] = mergeFeratelDetail(ELVIS, extractFeratelDetail(ELVIS_DETAIL));
    for (const r of [base, dated]) {
      expect(r.address).toBeUndefined();
      expect(r.postal_code).toBeUndefined();
      expect(r.address_rejected).toBe('venue_other_town');
      expect(r.organizer).toBe('Europolis Entertainment');
      expect(r.location_name).toBe('Konzerthaus Klagenfurt');
      expect(r.city).toBe('Klagenfurt am Wörthersee');
    }
    expect(dated.source_id).toBe(`${ELVIS.source_id}:2026-11-04`);
  });

  it('Elvis landet in Klagenfurt (Kärnten), nicht in Wien', () => {
    const [, dated] = mergeFeratelDetail(ELVIS, extractFeratelDetail(ELVIS_DETAIL));
    const row = rowOf(dated);
    expect(row.address).toBeNull();
    expect(row.bundesland).toBe('kaernten');
    expect(row.location_resolution.gemeinde?.name).toBe('Klagenfurt am Wörthersee');
    expect(row.postal_code).not.toBe('1150');
    expect(row.latitude).toBeCloseTo(46.62, 1);
    expect(row.longitude).toBeCloseTo(14.31, 1);
    expect(row.location_resolution.admission.corrections).toEqual([]);
  });

  it('Impulso Tenors landet in Eisenstadt (Burgenland)', () => {
    const [, dated] = mergeFeratelDetail(IMPULSO, extractFeratelDetail(IMPULSO_DETAIL));
    expect(dated.address).toBeUndefined();
    expect(dated.postal_code).toBeUndefined();
    const row = rowOf(dated);
    expect(row.bundesland).toBe('burgenland');
    expect(row.location_resolution.gemeinde?.name).toBe('Eisenstadt');
    expect(row.latitude).toBeCloseTo(47.85, 1);
  });

  it('Veranstalterbüro im selben Ort bleibt Adresse (Tourismusverband im Ort)', () => {
    const detail = extractFeratelDetail({
      addresses: [
        { addressType: 31, company: 'TVB Tulfes', address1: 'Schmalzgasse 27', city: 'Tulfes', zipCode: '6075' },
        { addressType: 32, company: 'TVB Tulfes', address1: 'Schmalzgasse 27', city: 'Tulfes', zipCode: '6075' },
      ],
    });
    const [r] = mergeFeratelDetail({ ...ELVIS, city: 'Tulfes', bundesland: 'Tirol' }, detail);
    expect(r.address).toBe('Schmalzgasse 27');
    expect(r.postal_code).toBe('6075');
    expect(r.address_rejected).toBeUndefined();
  });

  it('Liste ohne Ort: die Venue der Detailseite ist die einzige Ortsangabe', () => {
    const [r] = mergeFeratelDetail({ ...ELVIS, city: undefined }, extractFeratelDetail(ELVIS_DETAIL));
    expect(r.address).toBe('Hollergasse 32/6');
    expect(r.postal_code).toBe('1150');
    expect(r.city).toBe('Wien');
  });

  it('Schreibvarianten und Ortsteile zählen als derselbe Ort', () => {
    const venue = (city: string, zip: string) => ({ company: null, name: null, street: 'Hauptplatz 1', zip, city, url: null });
    const org = venue('x', '0000');
    const ev = (city: string, bundesland: string) => ({ ...ELVIS, city, bundesland }) as ScrapedEvent;
    // „Wörther See" / „Wörthersee", Abkürzung, Kurzform, Post-Ort
    expect(feratelVenueBelongsToEvent(ev('Velden am Wörthersee', 'Kärnten'), venue('Velden', '9220'), org)).toBe(true);
    expect(feratelVenueBelongsToEvent(ev('Matrei i.O.', 'Tirol'), venue('Matrei in Osttirol', '9971'), org)).toBe(true);
    expect(feratelVenueBelongsToEvent(ev('Neustift', 'Tirol'), venue('Neustift im Stubaital', '6167'), org)).toBe(true);
    expect(feratelVenueBelongsToEvent(ev('Zürs', 'Vorarlberg'), venue('Lech am Arlberg', '6764'), org)).toBe(true);
    expect(feratelVenueBelongsToEvent(ev('Bad Kleinkirchheim / St. Oswald', 'Kärnten'), venue('Bad Kleinkirchheim', '9546'), org)).toBe(true);
    // anderer Ort, Ausland
    expect(feratelVenueBelongsToEvent(ev('Wolfsberg', 'Kärnten'), venue('Klagenfurt', '9020'), org)).toBe(false);
    expect(feratelVenueBelongsToEvent(ev('Kufstein', 'Tirol'), venue('Salzburg', '5020'), org)).toBe(false);
    expect(feratelVenueBelongsToEvent(ev('Salzburg', 'Salzburg'), venue('München', '81673'), org)).toBe(false);
  });

  it('Grenzregion: liegt die Quellkoordinate im Bundesland der Venue, bleibt die Venue (Dachstein West, Hornspitz in Gosau)', () => {
    const office = { company: 'Dachstein Tourismus AG', name: null, street: 'Gosauseestraße 52', zip: '4824', city: 'Gosau', url: null };
    const ev = { ...ELVIS, city: 'Rußbach-Dachstein West', bundesland: 'Salzburg', location_name: 'Hornspitz' } as ScrapedEvent;
    expect(feratelVenueBelongsToEvent({ ...ev, latitude: 47.566836, longitude: 13.5190796 }, office, office)).toBe(true);
    // Ohne Koordinate stützt nichts die Veranstalteranschrift.
    expect(feratelVenueBelongsToEvent(ev, office, office)).toBe(false);
    // Die Venue-PLZ erklärt die Koordinate, der Resolver behält sie, der
    // Freigabevertrag korrigiert das Bundesland wie bisher.
    const [r] = mergeFeratelDetail({ ...ev, latitude: 47.566836, longitude: 13.5190796, coords_precision: 'venue' }, extractFeratelDetail({
      addresses: [
        { addressType: 31, company: office.company, address1: office.street, city: office.city, zipCode: office.zip },
        { addressType: 32, company: office.company, address1: office.street, city: office.city, zipCode: office.zip },
      ],
    }));
    const row = rowOf(r);
    expect(row.postal_code).toBe('4824');
    expect(row.bundesland).toBe('oberoesterreich');
    expect(row.location_resolution.reasons).not.toContain('plz_contradicts_city');
  });

  it('Ortsname aus einer Liste im Nachbarland: „St. Wolfgang" (Salzburger Liste) ist St. Wolfgang im Salzkammergut', () => {
    expect(gemeindenNamedByPlaceText('St. Wolfgang', 'salzburg').map(g => g.name)).toContain('St. Wolfgang im Salzkammergut');
    const dorfalm = { company: 'Dorfalm', name: null, street: 'Markt 123', zip: '5360', city: 'St. Wofgang', url: null };
    expect(feratelVenueBelongsToEvent({ ...ELVIS, city: 'St. Wolfgang', bundesland: 'Salzburg' } as ScrapedEvent, dorfalm, dorfalm)).toBe(true);
  });

  it('Ort nicht in der Stammdatei: eigene Venue zählt, Veranstalteranschrift nicht', () => {
    const office = { company: 'TVB', name: null, street: 'Marktplatz 1', zip: '5661', city: 'Rauris', url: null };
    const ev = { ...ELVIS, city: 'Raurisertal', bundesland: 'Salzburg' } as ScrapedEvent;
    expect(addressPlaceRelation('Raurisertal', { postal_code: '5661', city: 'Rauris' }, 'salzburg')).toBe('unknown');
    expect(feratelVenueBelongsToEvent(ev, office, office)).toBe(false);
    expect(feratelVenueBelongsToEvent(ev, { ...office, street: 'Hüttwinkl 3', company: 'Alm' }, office)).toBe(true);
  });
});

describe('Resolver: PLZ gegen genannten Ort und Bundesland', () => {
  const resolve = (input: Parameters<typeof resolveConservativeLocation>[0]) => resolveConservativeLocation(input, NOW);

  it('Veranstalter-PLZ 1150 bei Ort Klagenfurt und Kärnten wird verworfen, es zählt der Ort', () => {
    const d = resolve({ location_name: 'Konzerthaus Klagenfurt', address: 'Hollergasse 32/6', postal_code: '1150', city: 'Klagenfurt am Wörthersee', bundesland: 'Kärnten' });
    expect(d.reasons).toContain('plz_contradicts_city');
    expect(d.rejected).toContain('postal_code:1150:plz_contradicts_city');
    expect(d.evidence).not.toContain('plz:source:1150');
    expect(d.gemeinde?.name).toBe('Klagenfurt am Wörthersee');
    expect(d.gemeinde?.bundesland).toBe('kaernten');
    expect(d.postal_code).not.toBe('1150');
    expect(d.latitude).toBeCloseTo(46.62, 1);
  });

  it('Kufstein mit Salzburger und Leobener Veranstalter-PLZ bleibt in Kufstein', () => {
    for (const plz of ['5020', '8700']) {
      const d = resolve({ location_name: 'Stadtsaal Kufstein', postal_code: plz, city: 'Kufstein', bundesland: 'Tirol' });
      expect(d.reasons).toContain('plz_contradicts_city');
      expect(d.gemeinde?.name).toBe('Kufstein');
    }
  });

  it('eine Quellkoordinate bei der PLZ stützt sie: kein Widerspruch', () => {
    // Ohne Koordinate fiele die PLZ (siehe Kufstein oben).
    const d = resolve({ location_name: 'Saal', postal_code: '5020', city: 'Kufstein', bundesland: 'Tirol', latitude: 47.80, longitude: 13.04, coords_precision: 'venue' });
    expect(d.reasons).not.toContain('plz_contradicts_city');
    expect(d.postal_code).toBe('5020');
    expect(d.latitude).toBe(47.8);
  });

  it('Quellkoordinate am Veranstaltungsort, Veranstalter-PLZ weit weg: PLZ fällt, kein Konflikt mehr', () => {
    const d = resolve({ location_name: 'Konzerthaus Klagenfurt', postal_code: '1150', city: 'Klagenfurt am Wörthersee', bundesland: 'Kärnten', latitude: 46.621, longitude: 14.3137, coords_precision: 'venue' });
    expect(d.reasons).toContain('plz_contradicts_city');
    expect(d.status).not.toBe('conflict');
    expect(d.latitude).toBe(46.621);
  });

  it('PLZ im genannten Bundesland bleibt (nur ein Widerspruch, nicht beide)', () => {
    const d = resolve({ location_name: 'Saal', postal_code: '9020', city: 'Wolfsberg', bundesland: 'Kärnten' });
    expect(d.reasons).not.toContain('plz_contradicts_city');
    expect(d.postal_code).toBe('9020');
  });

  it('PLZ der genannten Gemeinde bleibt, auch wenn das Bundesland der Quelle falsch ist (meinbezirk Hartberg)', () => {
    const d = resolve({ location_name: 'DOT.Coworking', address: 'Schildbach 210, 8230 Hartberg', postal_code: '8230', city: 'Hartberg', bundesland: 'Burgenland' });
    expect(d.reasons).not.toContain('plz_contradicts_city');
    expect(d.gemeinde?.name).toBe('Hartberg');
  });

  it('Ortsteil, der anderswo als Gemeindename beginnt, ist kein Widerspruch (Sonnberg in Leogang)', () => {
    expect(gemeindenNamedByPlaceText('Sonnberg', 'oberoesterreich', { exact: true })).toEqual([]);
    const d = resolve({ location_name: 'Sonnberg 94', address: 'Sonnberg 94, 5771 Sonnberg', postal_code: '5771', city: 'Sonnberg', bundesland: 'Oberösterreich' });
    expect(d.reasons).not.toContain('plz_contradicts_city');
    expect(d.postal_code).toBe('5771');
  });
});

describe('Freigabevertrag: ein PLZ-Mittelpunkt bestätigt sich nicht selbst', () => {
  const OK = { title: 'Konzert', start_date: '2026-11-04T19:00:00.000Z', location_name: 'Konzerthaus Klagenfurt' };
  const opts = { now: NOW, regionOf: () => 'wien', plzRegionOf: () => 'wien' };

  it('ohne Herkunftsangabe: PLZ stützt die Koordinate, Bundesland wird korrigiert (bisheriges Verhalten)', () => {
    const v = evaluateAdmission({ ...OK, postal_code: '1150', bundesland: 'kaernten', latitude: 48.2082, longitude: 16.3738 }, opts);
    expect(v.corrections).toEqual(['use_coordinate_region']);
  });

  it('Koordinate ist der Mittelpunkt dieser PLZ: keine Korrektur, der Widerspruch bleibt offen', () => {
    const v = evaluateAdmission({ ...OK, postal_code: '1150', bundesland: 'kaernten', latitude: 48.2082, longitude: 16.3738, coords_from_plz: true }, opts);
    expect(v.corrections).toEqual([]);
    expect(v.decision).toBe('quarantine');
    expect(v.reasons).toContain('region_contradicts_coords');
  });

  it('positionFromPlzOnly: nur ein Mittelpunkt, den allein die PLZ trägt', () => {
    const plzOnly = resolveConservativeLocation({ location_name: 'Sonnberg 94', postal_code: '5771', city: 'Sonnberg', bundesland: 'Oberösterreich' }, NOW);
    expect(positionFromPlzOnly(plzOnly)).toBe(true);
    // Die PLZ-Gemeinde ist der genannte Ort: der Ort ist eine eigene Stimme.
    const named = resolveConservativeLocation({ location_name: 'Saal', postal_code: '8230', city: 'Hartberg', bundesland: 'Burgenland' }, NOW);
    expect(positionFromPlzOnly(named)).toBe(false);
    const source = resolveConservativeLocation({ location_name: 'Saal', postal_code: '8230', latitude: 47.28, longitude: 15.97, coords_precision: 'venue' }, NOW);
    expect(positionFromPlzOnly(source)).toBe(false);
  });

  it('Schreibpfad: genannte Gemeinde trägt die Bundesland-Korrektur weiter (meinbezirk Hartberg)', () => {
    const row = rowOf({ ...ELVIS, location_name: 'DOT.Coworking', address: 'Schildbach 210, 8230 Hartberg', postal_code: '8230', city: 'Hartberg', bundesland: 'Burgenland' });
    expect(row.bundesland).toBe('steiermark');
    expect(row.location_resolution.admission.corrections).toEqual(['use_coordinate_region']);
  });
});

describe('Schreibpfad: abgeleitete Position folgt der neuen Entscheidung', () => {
  const [, dated] = mergeFeratelDetail(ELVIS, extractFeratelDetail(ELVIS_DETAIL));
  const key = `${dated.source_name}::${dated.source_id}`;
  const existing = (over: Record<string, unknown>) =>
    new Map([[key, {
      id: 'b524682a', source_name: dated.source_name, source_id: dated.source_id,
      latitude: 48.2082, longitude: 16.3738, geocoding_confidence: 'gemeinde-centroid', geocoding_source: 'gemeinde-registry',
      publish_status: 'published', location_status: 'municipality_only', address: 'Hollergasse 32/6',
      stored_location_reasons: ['gemeinde_centroid_from_plz'], stored_latitude_provenance: 'derived:plz',
      ...over,
    }]]) as unknown as Map<string, never>;

  it('Wiener Mittelpunkt aus der Veranstalter-PLZ wird durch Klagenfurt ersetzt, die Büroadresse fällt', () => {
    const row = rowOf(dated, existing({}));
    expect(row.latitude).toBeCloseTo(46.62, 1);
    expect(row.bundesland).toBe('kaernten');
    expect(row.address).toBeNull();
    expect(row.location_resolution.reasons).toContain('derived_position_superseded');
    expect(row.location_resolution.reasons).not.toContain('legacy_coords_retained:gemeinde-centroid');
  });

  it('eine als Altbestand behaltene Koordinate bleibt beim bisherigen Rangvergleich', () => {
    const row = rowOf(dated, existing({ stored_location_reasons: ['gemeinde_centroid_from_plz', 'legacy_coords_retained:gemeinde-centroid'] }));
    expect(row.location_resolution.reasons).toContain('legacy_coords_retained:gemeinde-centroid');
  });
});
