/**
 * Resolver mit Belegen (fn-25 C3/C6): Regressionsfälle aus dem Review §9.
 * Belege werden injiziert; nichts geht ins Netz oder in die DB.
 */
import { describe, it, expect } from 'vitest';
import { resolveEventLocation, type LocationEvidence } from '@/lib/location/resolver';
import { addressCacheKey, streetKey, foldVenueName, pickCorrections } from '@/lib/location/evidence';
import { locationBasisHash } from '@/lib/location/conservative-resolution';

const NOW = new Date('2026-09-13T12:00:00Z');
const r = (input: Parameters<typeof resolveEventLocation>[0], ev: LocationEvidence = {}) => resolveEventLocation(input, ev, NOW);

const linzVenue = { venue_id: 'v-hdf', name: 'Haus der Frau', latitude: 48.3021, longitude: 14.2917, postal_code: '4020', city: 'Linz' };

describe('Belege heben nur mit zweitem Nachweis an', () => {
  it('Haus der Frau: Kandidat mit gleicher Straße → venue_confirmed mit Pin und Route', () => {
    const d = r(
      { location_name: 'Haus der Frau', address: 'Volksgartenstraße 18, 4020, Linz', bundesland: 'oberoesterreich' },
      { venueCandidate: { ...linzVenue, matched_by: ['street'] } },
    );
    expect(d.status).toBe('venue_confirmed');
    expect(d.venue_id).toBe('v-hdf');
    expect(d.latitude).toBeCloseTo(48.3021, 3);
    expect(d.allowed).toEqual({ pin: true, route: true, distance: true, municipality_page: true });
    expect(d.location_name).toBe('Haus der Frau');
  });

  it('Namenstreffer in derselben PLZ ohne zweiten Beleg bleibt Gemeinde-Ebene (Einzelkandidat ≠ Beleg)', () => {
    const d = r(
      { location_name: 'Haus der Frau', address: 'Volksgartenstraße 18, 4020, Linz', bundesland: 'oberoesterreich' },
      { venueCandidate: { ...linzVenue, matched_by: [] } },
    );
    expect(d.status).toBe('municipality_only');
    expect(d.venue_id).toBeNull();
    expect(d.rejected).toContain('venue_candidate:v-hdf:name_only');
    expect(d.allowed.pin).toBe(false);
  });

  it('Kandidat weit weg von der genannten PLZ → Konflikt statt Übernahme', () => {
    const d = r(
      { location_name: 'Haus', address: 'Hauptstraße 1, 4020 Linz', bundesland: 'oberoesterreich' },
      { venueCandidate: { venue_id: 'v-x', name: 'Haus', latitude: 47.41, longitude: 13.77, postal_code: '4020', city: 'Linz', matched_by: ['street'] } },
    );
    expect(d.status).toBe('conflict');
    expect(d.latitude).toBeNull();
  });

  it('Quellkoordinate mit belegter Genauigkeit bleibt maßgeblich; naher Kandidat liefert nur die venue_id', () => {
    const d = r(
      { location_name: 'Tiroler Landestheater', address: 'Rennweg 2', postal_code: '6020', city: 'Innsbruck', latitude: 47.269, longitude: 11.395, coords_precision: 'venue', source_venue_id: 'eventim:1' },
      { venueCandidate: { venue_id: 'v-tlt', name: 'Tiroler Landestheater', latitude: 47.2692, longitude: 11.3952, postal_code: '6020', city: 'Innsbruck', matched_by: [] } },
    );
    expect(d.status).toBe('venue_confirmed');
    expect(d.latitude).toBe(47.269);
    expect(d.venue_id).toBe('v-tlt');
  });

  it('bestätigte Quellen-Venue-Zuordnung wird übernommen', () => {
    const d = r(
      { location_name: 'Haus im Puls', address: 'Obere Hauptstraße 31, 7100, Neusiedl', source_venue_id: 'eventfinder:hip' },
      { sourceVenueMap: { venue_id: null, latitude: 47.949, longitude: 16.843, precision: 'building', confirmed_by: 'admin@2026-09' } },
    );
    expect(d.status).toBe('venue_confirmed');
    expect(d.geocoding_source).toBe('source_venue_map');
    expect(d.allowed.route).toBe(true);
  });

  it('geocodierte Eventadresse: Gebäude → Route erlaubt, Straße → nur Pin', () => {
    const input = { location_name: 'Galerie Krinzinger', address: 'Seilerstätte 16, 1010 Wien', postal_code: '1010', bundesland: 'wien' };
    const building = r(input, { addressGeocode: { latitude: 48.2049, longitude: 16.3735, precision: 'building', provider: 'nominatim', cache_key: 'k' } });
    expect(building.status).toBe('address_confirmed');
    expect(building.allowed).toEqual({ pin: true, route: true, distance: true, municipality_page: true });
    const street = r(input, { addressGeocode: { latitude: 48.2049, longitude: 16.3735, precision: 'street', provider: 'nominatim', cache_key: 'k' } });
    expect(street.allowed.route).toBe(false);
    expect(street.allowed.pin).toBe(true);
  });

  it('Adress-Geocode ohne Hausnummer im Quelltext wird nicht übernommen', () => {
    const d = r(
      { location_name: 'Sommerarena', address: 'Arenaweg, 2500 Baden', postal_code: '2500', bundesland: 'niederoesterreich' },
      { addressGeocode: { latitude: 48.0, longitude: 16.23, precision: 'street', provider: 'nominatim', cache_key: 'k' } },
    );
    expect(d.status).toBe('municipality_only');
  });

  it('Adress-Geocode fern der PLZ → Konflikt', () => {
    const d = r(
      { location_name: 'Galerie', address: 'Seilerstätte 16, 1010 Wien', postal_code: '1010', bundesland: 'wien' },
      { addressGeocode: { latitude: 46.61, longitude: 13.26, precision: 'building', provider: 'nominatim', cache_key: 'k' } },
    );
    expect(d.status).toBe('conflict');
  });

  it('Online-Events werden nicht aufgewertet', () => {
    const d = r({ location_name: 'Online-Event', postal_code: '1010' }, { addressGeocode: { latitude: 48.2, longitude: 16.37, precision: 'building', provider: 'nominatim', cache_key: 'k' } });
    expect(d.status).toBe('online');
  });
});

describe('Cache- und Vergleichsschlüssel', () => {
  it('addressCacheKey braucht Hausnummer und PLZ/Ort und ist stabil', () => {
    expect(addressCacheKey({ address: 'Volksgartenstraße 18, 4020, Linz' })).toBe('addr:v1:volksgartenstrasse 18|4020|linz');
    expect(addressCacheKey({ address: 'Volksgartenstraße 18', postal_code: '4020', city: 'Linz' })).toBe('addr:v1:volksgartenstrasse 18|4020|linz');
    expect(addressCacheKey({ address: 'Arenaweg', postal_code: '2500' })).toBeNull();
    expect(addressCacheKey({ address: 'Hauptplatz 1' })).toBeNull();
  });

  it('streetKey vergleicht Straßen ohne Hausnummer und Schreibvarianten', () => {
    expect(streetKey('Volksgartenstraße 18, 4020 Linz')).toBe(streetKey('Volksgartenstrasse 18'));
    expect(streetKey('Rennweg 2')).toBe('rennweg');
    expect(streetKey('Am Bach 10')).toBe('am bach');
    expect(foldVenueName('Theater „Die Bühne“')).toBe('theater die buehne');
  });
});

describe('selectVenueCandidate: kein Treffer nach Reihenfolge, Name oder Anzahl (Review §9)', async () => {
  const { selectVenueCandidate } = await import('@/lib/location/evidence');
  const mk = (id: string, address: string | null, lat = 48.30, lng = 14.29, plz = '4020', viaAlias = false) => ({
    row: { id, name: 'Stadtsaal', name_normalized: 'stadtsaal', address, postal_code: plz, city: 'Linz', latitude: lat, longitude: lng },
    viaAlias,
  });

  it('zwei gleichnamige Venues in derselben PLZ ohne zweiten Beleg → kein Kandidat', () => {
    const pick = selectVenueCandidate({ location_name: 'Stadtsaal', address: 'Am Hauptplatz', postal_code: '4020' }, [mk('a', 'Hauptplatz 1'), mk('b', 'Landstraße 5', 48.31, 14.30)]);
    expect(pick).toBeNull();
  });

  it('die Straße im Adresstext entscheidet zwischen zwei gleichnamigen Venues', () => {
    const pick = selectVenueCandidate({ location_name: 'Stadtsaal', address: 'Landstraße 5, 4020 Linz', postal_code: '4020' }, [mk('a', 'Hauptplatz 1'), mk('b', 'Landstraße 5', 48.31, 14.30)]);
    expect(pick?.venue_id).toBe('b');
    expect(pick?.matched_by).toEqual(['street']);
  });

  it('zwei belegte Kandidaten bleiben mehrdeutig', () => {
    const pick = selectVenueCandidate({ location_name: 'Stadtsaal', address: 'Landstraße 5', postal_code: '4020', latitude: 48.30, longitude: 14.29 }, [mk('a', 'Landstraße 5'), mk('b', 'Landstraße 5', 48.3001, 14.2901)]);
    expect(pick).toBeNull();
  });

  it('Einzelkandidat ohne Beleg wird nur protokolliert (leeres matched_by)', () => {
    const pick = selectVenueCandidate({ location_name: 'Stadtsaal', postal_code: '4020' }, [mk('a', 'Hauptplatz 1')]);
    expect(pick?.matched_by).toEqual([]);
  });

  it('Kandidaten außerhalb des Ortskontexts (andere PLZ, anderer Ort) zählen nicht', () => {
    const pick = selectVenueCandidate({ location_name: 'Stadtsaal', postal_code: '4020', address: 'Hauptplatz 1' }, [mk('x', 'Hauptplatz 1', 47.0, 15.4, '8010')]);
    expect(pick).toBeNull();
  });
});

describe('manuelle Korrektur: Geltungsbereich, Gültigkeit, Verlegung (Review §7/§9)', () => {
  // Quelle nennt Haus der Frau; die Position der Quelle war falsch, ein Admin korrigiert.
  const source = { location_name: 'Haus der Frau', address: 'Volksgartenstraße 18, 4020, Linz', bundesland: 'oberoesterreich', event_id: 'ev-1' };
  const corr = {
    id: 'c-1', latitude: 48.3021, longitude: 14.2917, precision: 'building' as const, venue_id: null,
    location_name: null, postal_code: null, basis_hash: locationBasisHash(source), corrected_by: 'admin:x',
  };

  it('gültige Korrektur zum passenden Quellenstand wird angewendet (manual, Pin + Route)', () => {
    const d = r(source, { correction: corr, correctionsLoaded: true });
    expect(d.status).toBe('address_confirmed');
    expect(d.geocoding_confidence).toBe('manual');
    expect(d.latitude).toBe(48.3021);
    expect(d.allowed).toEqual({ pin: true, route: true, distance: true, municipality_page: true });
    expect(d.evidence).toContain('correction:c-1:admin:x');
    expect(d.provenance.latitude).toBe('manual');
    expect(d.location_name).toBe('Haus der Frau');
  });

  it('Korrektur schlägt Quellkoordinate und Venue-Kandidat (Basis = Quellenstand mit Koordinate)', () => {
    const withCoords = { ...source, latitude: 48.20, longitude: 16.37, coords_precision: 'venue' as const };
    const d = r(
      withCoords,
      { correction: { ...corr, basis_hash: locationBasisHash(withCoords) }, correctionsLoaded: true, venueCandidate: { ...linzVenue, latitude: 48.31, longitude: 14.30, matched_by: ['street'] } },
    );
    expect(d.geocoding_confidence).toBe('manual');
    expect(d.latitude).toBe(48.3021);
  });

  it('eine neue Quellkoordinate ist ein neuer Quellenstand: die Korrektur wird nicht blind weitergeführt', () => {
    const d = r({ ...source, latitude: 48.20, longitude: 16.37, coords_precision: 'venue' }, { correction: corr, correctionsLoaded: true });
    expect(d.reasons).toContain('correction_stale:c-1');
    expect(d.geocoding_confidence).not.toBe('manual');
  });

  it('Verlegung: liefert die Quelle andere Ortsangaben, ist die Korrektur veraltet und die Entscheidung wird neu getroffen', () => {
    const moved = { ...source, location_name: 'Posthof', address: 'Posthofstraße 43, 4020 Linz' };
    const d = r(moved, { correction: corr, correctionsLoaded: true });
    expect(d.geocoding_confidence).not.toBe('manual');
    expect(d.status).toBe('municipality_only');
    expect(d.latitude).not.toBe(48.3021);
    expect(d.reasons).toContain('correction_stale:c-1');
    expect(d.rejected).toContain('correction:c-1:source_location_changed');
  });

  it('ein geänderter Titel allein macht die Korrektur nicht ungültig', () => {
    const d = r({ ...source, title: 'Neuer Titel 2027' }, { correction: corr, correctionsLoaded: true });
    expect(d.geocoding_confidence).toBe('manual');
  });

  it('Korrektur ohne Quellenbezug (basis_hash null) gilt für jeden Quellenstand', () => {
    const d = r({ ...source, location_name: 'Irgendwo' }, { correction: { ...corr, basis_hash: null }, correctionsLoaded: true });
    expect(d.geocoding_confidence).toBe('manual');
  });

  it('Korrektur mit Venue-ID → venue_confirmed; mit PLZ → Gemeinde folgt der Korrektur', () => {
    const d = r(source, { correction: { ...corr, venue_id: 'v-hdf', postal_code: '4030' }, correctionsLoaded: true });
    expect(d.status).toBe('venue_confirmed');
    expect(d.venue_id).toBe('v-hdf');
    expect(d.postal_code).toBe('4030');
    expect(d.provenance.postal_code).toBe('manual');
    expect(d.gemeinde?.name).toBe('Linz');
  });

  it('korrigierte PLZ mit mehreren Gemeinden (4040 Linz/Lichtenberg): PLZ übernommen, Gemeinde bleibt offen', () => {
    const d = r(source, { correction: { ...corr, postal_code: '4040' }, correctionsLoaded: true });
    expect(d.postal_code).toBe('4040');
    expect(d.gemeinde).toBeNull();
    expect(d.allowed.municipality_page).toBe(true);
  });

  it('Korrektur löst auch einen Konflikt der Quelle auf', () => {
    const d = r({ ...source, latitude: 47.07, longitude: 15.44, coords_precision: 'venue' }, { correction: { ...corr, basis_hash: null }, correctionsLoaded: true });
    expect(d.status).toBe('address_confirmed');
    expect(d.latitude).toBe(48.3021);
  });
});

describe('pickCorrections: Gültigkeit und jüngste Korrektur je Event', () => {
  const NOW = new Date('2026-09-14T12:00:00Z');
  const row = (id: string, scope_id: string, extra: Partial<Parameters<typeof pickCorrections>[0][number]> = {}) => ({
    id, scope_id, before: { location_basis_hash: 'abc' }, after: { latitude: 48.3, longitude: 14.29, precision: 'building' },
    corrected_by: 'admin:x', valid_from: '2026-09-01T00:00:00Z', valid_to: null, created_at: '2026-09-01T00:00:00Z', ...extra,
  });

  it('beendete oder künftige Korrekturen zählen nicht', () => {
    const m = pickCorrections([
      row('a', 'e1', { valid_to: '2026-09-10T00:00:00Z' }),
      row('b', 'e2', { valid_from: '2026-10-01T00:00:00Z' }),
      row('c', 'e3'),
    ], NOW);
    expect(m.has('e1')).toBe(false);
    expect(m.has('e2')).toBe(false);
    expect(m.get('e3')?.basis_hash).toBe('abc');
  });

  it('die jüngste gültige Korrektur gewinnt; ohne Position keine Korrektur', () => {
    const m = pickCorrections([
      row('old', 'e1', { valid_from: '2026-08-01T00:00:00Z', after: { latitude: 47.0, longitude: 15.0 } }),
      row('new', 'e1', { valid_from: '2026-09-05T00:00:00Z' }),
      row('nopos', 'e2', { after: { precision: 'building' } }),
    ], NOW);
    expect(m.get('e1')?.id).toBe('new');
    expect(m.get('e1')?.precision).toBe('building');
    expect(m.has('e2')).toBe(false);
  });
});
