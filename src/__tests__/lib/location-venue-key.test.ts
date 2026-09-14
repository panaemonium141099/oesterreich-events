/**
 * Namensschlüssel für bestätigte Spielstätten-Zuordnungen (fn-25):
 * Quelle + Name + PLZ/Ort. Gleicher Name in anderer Gemeinde = anderer
 * Schlüssel; Schreibvarianten des Namens = derselbe.
 */
import { describe, it, expect } from 'vitest';
import { venueMapKey } from '@/lib/location/venue-key';

describe('venueMapKey', () => {
  it('bildet Quelle + gefalteten Namen + PLZ', () => {
    expect(venueMapKey({ source_name: 'feratel-deskline', location_name: 'Pfarrsaal Kammern', postal_code: '8773' })).toBe('name:feratel-deskline:pfarrsaal kammern:8773');
    expect(venueMapKey({ source_name: 'feratel-deskline', location_name: '  Pfarrsaal   KAMMERN ', postal_code: '8773' })).toBe('name:feratel-deskline:pfarrsaal kammern:8773');
  });

  it('gleicher Name in anderer Gemeinde ist ein anderer Schlüssel; andere Quelle ebenso', () => {
    const a = venueMapKey({ source_name: 'gem2go', location_name: 'Gemeindesaal', postal_code: '4040' });
    const b = venueMapKey({ source_name: 'gem2go', location_name: 'Gemeindesaal', postal_code: '4050' });
    const c = venueMapKey({ source_name: 'gemeinden', location_name: 'Gemeindesaal', postal_code: '4040' });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('ohne PLZ zählt der Ortsname (normalisiert), PLZ aus dem Adresstext wird erkannt', () => {
    expect(venueMapKey({ source_name: 'meinbezirk', location_name: 'Tagungshaus', city: 'Wörgl' })).toBe('name:meinbezirk:tagungshaus:woergl');
    expect(venueMapKey({ source_name: 'x', location_name: 'Stadtsaal', address: 'Hauptplatz 1, 4020 Linz' })).toBe('name:x:stadtsaal:4020');
  });

  it('ohne Quelle oder Namen kein Schlüssel', () => {
    expect(venueMapKey({ source_name: 'x', location_name: 'AB' })).toBeNull();
    expect(venueMapKey({ location_name: 'Stadtsaal', postal_code: '4020' })).toBeNull();
  });
});
