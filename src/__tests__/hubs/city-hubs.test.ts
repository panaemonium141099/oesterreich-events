import { describe, it, expect } from 'vitest';
import {
  CITY_HUBS,
  getCityHub,
  isCityHub,
  STADT_TO_GEMEINDE,
} from '@/lib/hubs/city-hubs';
import { buildEntdeckenHref } from '@/lib/hubs/hub-links';
import { getGemeindeBySlug } from '@/lib/gemeinden/data';

describe('city-hubs', () => {
  it('marks exactly the 5 major cities as city hubs', () => {
    expect(Object.keys(CITY_HUBS).sort()).toEqual(
      [
        '4020-linz',
        '5020-salzburg',
        '6020-innsbruck',
        '8010-graz',
        '9020-klagenfurt-am-woerthersee',
      ].sort(),
    );
  });

  it('getCityHub / isCityHub resolve cities and reject villages', () => {
    expect(isCityHub('4020-linz')).toBe(true);
    expect(getCityHub('4020-linz')?.name).toBe('Linz');
    expect(isCityHub('7000-eisenstadt')).toBe(false);
    expect(getCityHub('7000-eisenstadt')).toBeNull();
  });

  it('every city hub has a wider-than-village radius and a curated intro', () => {
    for (const hub of Object.values(CITY_HUBS)) {
      expect(hub.radiusKm).toBeGreaterThan(10);
      expect(hub.intro.lead.length).toBeGreaterThan(0);
      expect(hub.intro.body.length).toBeGreaterThan(0);
    }
  });

  it('STADT_TO_GEMEINDE targets are all real gemeinde slugs (guards typos)', () => {
    for (const [stadt, gemeindeSlug] of Object.entries(STADT_TO_GEMEINDE)) {
      expect(
        getGemeindeBySlug(gemeindeSlug),
        `${stadt} -> ${gemeindeSlug} must resolve`,
      ).not.toBeNull();
    }
  });
});

describe('buildEntdeckenHref (hybrid bridge)', () => {
  it('returns bare /entdecken with no scope', () => {
    expect(buildEntdeckenHref({})).toBe('/entdecken');
  });

  it('encodes bundesland scope', () => {
    expect(buildEntdeckenHref({ bundesland: 'oberoesterreich' })).toBe(
      '/entdecken?bl=oberoesterreich',
    );
  });

  it('encodes place scope (plz + ort)', () => {
    expect(
      buildEntdeckenHref({ placeName: 'Linz', placePostalCode: '4020' }),
    ).toBe('/entdecken?plz=4020&ort=Linz');
  });

  it('combines region + place scope in stable order', () => {
    expect(
      buildEntdeckenHref({
        bundesland: 'oberoesterreich',
        placeName: 'Linz',
        placePostalCode: '4020',
      }),
    ).toBe('/entdecken?bl=oberoesterreich&plz=4020&ort=Linz');
  });
});
