/**
 * Event-URL-Präfix je Seite (fn-31.10). Läuft in CI mit SITE_COUNTRY leer
 * (Österreich, vierstellige PLZ) und mit DE (fünfstellig, Gemeinde der PLZ).
 */
import { describe, it, expect } from 'vitest';
import { buildEventUrlV2, resolveEventUrlPrefix, plzOrtSlug } from '@/lib/utils/slugify';
import { getSite } from '@/lib/site';
import { PLZ_ORT_SLUGS_DE } from '@/lib/utils/plz-ort-slugs-de.generated';
import { urlGemeindeForPlz } from '@/scripts/build-plz-ort-slugs-de';

const ev = (o: Partial<{ postal_code: string | null; address: string | null; bundesland: string | null; location_name: string | null }>) => ({
  id: '0123456789abcdef', slug: 'ein-fest', start_date: '2026-12-01T18:00:00+00:00',
  postal_code: null, address: null, bundesland: null, location_name: null, ...o,
});

describe('Tabelle für Deutschland', () => {
  const index = new Map<string, string>();
  for (const group of PLZ_ORT_SLUGS_DE.split(';')) {
    const [slug, plzs] = group.split(':');
    for (const p of plzs.split(',')) index.set(p, slug);
  }

  it('jede PLZ ist fünfstellig und steht genau einmal', () => {
    const all = PLZ_ORT_SLUGS_DE.split(';').flatMap(g => g.split(':')[1].split(','));
    expect(all.every(p => /^\d{5}$/.test(p))).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(8000);
  });

  it('der Ort ist die Gemeinde der PLZ', () => {
    expect(index.get('10115')).toBe('berlin');
    expect(index.get('27404')).toBe('zeven');
    expect(index.get('80331')).toBe('muenchen');
  });

  it('mehrere Gemeinden unter einer PLZ: das Amt unter der PLZ, sonst die größte', () => {
    expect(urlGemeindeForPlz('00000', [])).toBe(null);
    // Zwei Gemeinden, keine sitzt unter der PLZ: die größere gewinnt, stabil.
    const a = urlGemeindeForPlz('99999', ['11000000', '02000000']);
    expect(a?.name).toBe('Berlin');
  });
});

describe('Präfix dieser Seite', () => {
  const at = getSite().country === 'AT';

  it('PLZ der Stammdaten ergibt PLZ und Ort', () => {
    if (at) {
      expect(resolveEventUrlPrefix(ev({ postal_code: '1010' }))).toEqual({ plz: '1010', ort: 'wien' });
      expect(plzOrtSlug('10115')).toBe(null);
    } else {
      expect(resolveEventUrlPrefix(ev({ postal_code: '27404', address: 'Godenstedter Str. 61, 27404 Zeven' }))).toEqual({ plz: '27404', ort: 'zeven' });
      expect(buildEventUrlV2(ev({ postal_code: '10115' }))).toBe('/events/10115-berlin/2026-12-01/ein-fest');
      expect(plzOrtSlug('1010')).toBe(null);
    }
  });

  it('ohne PLZ: Österreich fällt auf das Bundesland zurück, Deutschland nennt keinen Ersatzwert', () => {
    if (at) {
      expect(buildEventUrlV2(ev({ bundesland: 'steiermark', location_name: 'Irdning' }))).toBe('/events/8010-irdning/2026-12-01/ein-fest');
      expect(buildEventUrlV2(ev({}))).toBe('/events/0000-at/2026-12-01/ein-fest');
    } else {
      expect(buildEventUrlV2(ev({ address: 'Markt 1, 06628 Naumburg' }))).toBe('/events/naumburg/2026-12-01/ein-fest');
      expect(buildEventUrlV2(ev({}))).toBe('/events/deutschland/2026-12-01/ein-fest');
      // Vierstellige oder unbekannte PLZ ist keine deutsche PLZ.
      expect(resolveEventUrlPrefix(ev({ postal_code: '1010' })).plz).toBe('');
      expect(resolveEventUrlPrefix(ev({ postal_code: '00000' })).plz).toBe('');
    }
  });

  it('keine deutsche URL trägt 0000 oder -at', () => {
    if (at) return;
    for (const e of [ev({}), ev({ postal_code: '27404' }), ev({ address: 'x, 12345 Irgendwo' }), ev({ bundesland: 'steiermark' })]) {
      const url = buildEventUrlV2(e);
      expect(url).not.toMatch(/\/0000|-at\//);
    }
  });
});
