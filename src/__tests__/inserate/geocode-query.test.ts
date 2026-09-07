import { describe, it, expect } from 'vitest';
import { buildGeocodeCandidates, composeEventAddress } from '@/lib/inserate/geocode-query';
import { resolveEventUrlPrefix } from '@/lib/utils/slugify';

describe('buildGeocodeCandidates', () => {
  it('stellt die vollständige Adresse mit Ort voran', () => {
    // Genau diese Form löst bei Nominatim auf (gemessen 2026-09-07:
    // "Esterhazyplatz 5, 7000 Eisenstadt" -> 47.8453969, 16.5201913).
    const candidates = buildGeocodeCandidates({
      address: 'Esterhazyplatz 5',
      postal_code: '7000',
      city: 'Eisenstadt',
      location_name: 'Schlosspark Esterhazy',
    });
    expect(candidates[0]).toBe('Esterhazyplatz 5, 7000 Eisenstadt');
  });

  it('erzeugt niemals die alte, unauflösbare Form "Strasse, PLZ, Venue"', () => {
    // Das war der Fehler in Produktion: Nominatim lieferte darauf nichts
    // und das freigegebene Event blieb ohne Koordinaten unsichtbar.
    const candidates = buildGeocodeCandidates({
      address: 'Esterhazyplatz 5',
      postal_code: '7000',
      city: 'Eisenstadt',
      location_name: 'Schlosspark Esterhazy',
    });
    expect(candidates).not.toContain('Esterhazyplatz 5, 7000, Schlosspark Esterhazy');
  });

  it('staffelt von genau nach grob', () => {
    const candidates = buildGeocodeCandidates({
      address: 'Hauptstrasse 1',
      postal_code: '8010',
      city: 'Graz',
      location_name: 'Orpheum',
    });
    expect(candidates).toEqual([
      'Hauptstrasse 1, 8010 Graz',
      '8010 Graz',
      'Orpheum, Graz',
      'Orpheum',
    ]);
  });

  it('kommt ohne Strasse aus', () => {
    const candidates = buildGeocodeCandidates({
      postal_code: '5020',
      city: 'Salzburg',
      location_name: 'Rockhouse',
    });
    expect(candidates).toEqual(['5020 Salzburg', 'Rockhouse, Salzburg', 'Rockhouse']);
  });

  it('kommt ohne PLZ aus', () => {
    const candidates = buildGeocodeCandidates({
      address: 'Dorfplatz 3',
      city: 'Rust',
    });
    expect(candidates).toEqual(['Dorfplatz 3, Rust', 'Rust']);
  });

  it('liefert keine Duplikate, wenn nur der Ort bekannt ist', () => {
    expect(buildGeocodeCandidates({ city: 'Rust' })).toEqual(['Rust']);
  });

  it('liefert eine leere Liste, wenn gar keine Ortsangabe da ist', () => {
    expect(buildGeocodeCandidates({})).toEqual([]);
  });

  it('ignoriert Felder, die nur Leerzeichen enthalten', () => {
    expect(buildGeocodeCandidates({ address: '   ', city: 'Wien' })).toEqual(['Wien']);
  });
});

describe('composeEventAddress', () => {
  it('schreibt "Strasse, PLZ Ort"', () => {
    expect(
      composeEventAddress({ address: 'Esterhazyplatz 5', postal_code: '7000', city: 'Eisenstadt' }),
    ).toBe('Esterhazyplatz 5, 7000 Eisenstadt');
  });

  it('lässt die Strasse weg, wenn keine da ist', () => {
    expect(composeEventAddress({ postal_code: '7000', city: 'Eisenstadt' })).toBe('7000 Eisenstadt');
  });

  it('gibt null zurück statt eine halbe Adresse zu behaupten', () => {
    expect(composeEventAddress({})).toBeNull();
  });

  it('liefert eine Form, aus der die Event-URL den Ort liest', () => {
    // Das ist der eigentliche Zweck des Kommas: parseCityFromAddress
    // splittet daran. Ohne Komma fiele die URL auf die Landeshauptstadt
    // zurück (/7000-eisenstadt/ statt /7000-rust/).
    const address = composeEventAddress({
      address: 'Hauptstrasse 1',
      postal_code: '7071',
      city: 'Rust',
    });
    const { plz, ort } = resolveEventUrlPrefix({
      postal_code: '7071',
      address,
      bundesland: 'burgenland',
      location_name: 'Seebad Rust',
    });
    expect(`${plz}-${ort}`).toBe('7071-rust');
  });
});
