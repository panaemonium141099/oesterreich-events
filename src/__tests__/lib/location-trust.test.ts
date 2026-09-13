/**
 * Anreise-Gate (fn-25 Phase A5): nur belegte Zielpositionen bekommen einen
 * Routenlink. Adress-Strings und Alt-Labels reichen nicht mehr.
 */
import { describe, it, expect } from 'vitest';
import { isLocationTrusted, isLocationApproximate } from '@/lib/utils/location-trust';

const at = { latitude: 48.2, longitude: 16.37 };

describe('isLocationTrusted', () => {
  it('ohne Koordinaten nie', () => {
    expect(isLocationTrusted({ address: 'Seilerstätte 9, 1010 Wien', geocoding_confidence: 'manual' })).toBe(false);
  });

  it('ein Adresstext allein reicht nicht (Ronacher-Fall: Adresse Wien, Pin in Kärnten)', () => {
    expect(isLocationTrusted({ ...at, address: 'Seilerstätte 9, 1010 Wien', geocoding_confidence: 'exact' })).toBe(false);
  });

  it('Alt-Labels exact/verified/scraper/gemeinde-registry sind kein Beleg', () => {
    for (const conf of ['exact', 'verified', 'scraper', 'gemeinde-registry', 'normalized', null]) {
      expect(isLocationTrusted({ ...at, geocoding_confidence: conf })).toBe(false);
    }
  });

  it('manuell oder aus strukturierten Venue-Daten: vertraut', () => {
    expect(isLocationTrusted({ ...at, geocoding_confidence: 'manual' })).toBe(true);
    expect(isLocationTrusted({ ...at, geocoding_confidence: 'json-ld-venue' })).toBe(true);
  });

  it('die Ortsentscheidung erlaubt die Route ausdrücklich', () => {
    expect(isLocationTrusted({ ...at, geocoding_confidence: 'scraper', location_resolution: { allowed: { route: true } } })).toBe(true);
    expect(isLocationTrusted({ ...at, geocoding_confidence: 'scraper', location_resolution: { allowed: { route: false, pin: true } } })).toBe(false);
  });
});

describe('isLocationApproximate', () => {
  it('Koordinate ohne Beleg ist ungefähr; ohne Koordinate weder noch', () => {
    expect(isLocationApproximate({ ...at, geocoding_confidence: 'gemeinde-centroid' })).toBe(true);
    expect(isLocationApproximate({ ...at, location_resolution: { allowed: { route: true } } })).toBe(false);
    expect(isLocationApproximate({ address: 'x' })).toBe(false);
  });
});
