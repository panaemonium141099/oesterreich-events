import { describe, expect, it } from 'vitest';
import { buildEventUrlV2, plzOrtSlug, resolveEventUrlPrefix } from '@/lib/utils/slugify';

// Prod-Fälle 2026-09-24: vorher Landeshauptstadt oder Venue-Name im Präfix.
describe('Event-URL-Präfix aus der Post-Tabelle', () => {
  it.each([
    ['8630', 'Basilika Mariazell', null, 'steiermark', 'mariazell'],
    ['6370', 'Studio G10', 'Untere Gänsbachgasse 10', 'tirol', 'kitzbuehel'],
    ['9122', 'Bikepoint', 'Schulstraße 10', 'kaernten', 'st-kanzian-am-klopeiner-see'],
    ['6800', 'Montforthaus Feldkirch', 'Montfortplatz 1', 'vorarlberg', 'feldkirch'],
    ['1010', 'Burgtheater', 'Universitätsring 2', 'wien', 'wien'],
    ['4040', null, null, 'oberoesterreich', 'linz'],
  ])('%s %s → %s', (postal_code, location_name, address, bundesland, ort) => {
    expect(resolveEventUrlPrefix({ postal_code, location_name, address, bundesland })).toEqual({
      plz: postal_code,
      ort,
    });
  });

  it('URL hängt nur an der PLZ: anderer Ortsname, gleiche URL', () => {
    const base = { id: 'abcdef12-0000', slug: 'kirtag', start_date: '2026-10-04T10:00:00Z', postal_code: '5584', bundesland: 'salzburg' };
    const a = buildEventUrlV2({ ...base, location_name: 'Walcherhäusl mit Mühlen', address: 'Nr. 19' });
    const b = buildEventUrlV2({ ...base, location_name: 'Zederhaus', address: null });
    expect(a).toBe('/events/5584-zederhaus/2026-10-04/kirtag');
    expect(b).toBe(a);
  });

  it('ohne gültige PLZ bleibt der alte Fallback', () => {
    expect(resolveEventUrlPrefix({ postal_code: null, location_name: 'Irdning', address: null, bundesland: 'steiermark' }))
      .toEqual({ plz: '8010', ort: 'irdning' });
    expect(plzOrtSlug('0000')).toBeNull();
  });
});
