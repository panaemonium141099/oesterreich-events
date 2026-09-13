/**
 * Resolver mit Belegen (fn-25 C3/C6): Regressionsfälle aus dem Review §9.
 * Belege werden injiziert; nichts geht ins Netz oder in die DB.
 */
import { describe, it, expect } from 'vitest';
import { resolveEventLocation, type LocationEvidence } from '@/lib/location/resolver';
import { addressCacheKey, streetKey, foldVenueName } from '@/lib/location/evidence';

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
