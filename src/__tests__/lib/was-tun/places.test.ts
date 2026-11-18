/**
 * Wächter der Ortsliste von /was-tun/[slug]: jede Region hängt an einer
 * Gemeinde der Stammdaten, und kein Slug ist doppelt vergeben.
 */
import { describe, it, expect } from 'vitest';
import { ALL_GEMEINDEN, getGemeindeBySlug } from '@/lib/gemeinden/data';
import { TOURISM_REGIONS } from '@/lib/was-tun/regions';
import {
  allWasTunSlugs,
  relatedPlaces,
  resolveWasTunPlace,
  wasTunRedirectSlug,
} from '@/lib/was-tun/places';

const BUNDESLAENDER = [
  'burgenland', 'kaernten', 'niederoesterreich', 'oberoesterreich', 'salzburg',
  'steiermark', 'tirol', 'vorarlberg', 'wien',
];

describe('Tourismusregionen', () => {
  it('jede Region hängt an einer Gemeinde ihres Bundeslands', () => {
    const broken = TOURISM_REGIONS
      .map((r) => ({ r, place: resolveWasTunPlace(r.slug), anchor: getGemeindeBySlug(r.anchor) }))
      .filter(({ r, place, anchor }) => !anchor || place?.kind !== 'region' || place.bundeslandId !== r.bundesland)
      .map(({ r }) => `${r.slug} → ${r.anchor}`);
    expect(broken).toEqual([]);
  });

  it('die Ortsangabe beginnt klein mit einer Präposition und der Umkreis ist plausibel', () => {
    for (const r of TOURISM_REGIONS) {
      expect([r.slug, /^(in|im|am|an|auf) /.test(r.where)]).toEqual([r.slug, true]);
      expect(r.radiusKm).toBeGreaterThanOrEqual(10);
      expect(r.radiusKm).toBeLessThanOrEqual(40);
      expect(BUNDESLAENDER).toContain(r.bundesland);
    }
  });

  it('Slugs sind eindeutig, URL-tauglich und kollidieren mit keinem Bundesland und keiner Gemeinde', () => {
    const slugs = TOURISM_REGIONS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) {
      expect(s).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(BUNDESLAENDER).not.toContain(s);
      expect(getGemeindeBySlug(s)).toBeNull();
    }
  });
});

describe('Ortsauflösung', () => {
  it('Bundesland: Spaltenfilter statt Umkreis, eigene Ortsangabe', () => {
    const p = resolveWasTunPlace('steiermark');
    expect(p).toMatchObject({ kind: 'bundesland', where: 'in der Steiermark', center: null, eventsHubHref: '/steiermark' });
    // „in Salzburg" wäre die Stadt.
    expect(resolveWasTunPlace('salzburg')?.where).toBe('im Salzburger Land');
  });

  it('Gemeinde: Umkreis der Event-Übersicht, Städte weiter', () => {
    expect(resolveWasTunPlace('7000-eisenstadt')).toMatchObject({
      kind: 'gemeinde', name: 'Eisenstadt', where: 'in Eisenstadt', bundeslandId: 'burgenland',
      eventsHubHref: '/gemeinde/7000-eisenstadt',
    });
    expect(resolveWasTunPlace('7000-eisenstadt')?.center?.radiusKm).toBe(10);
    expect(resolveWasTunPlace('4020-linz')?.center?.radiusKm).toBe(15);
  });

  it('Region: Mittelpunkt der Anker-Gemeinde', () => {
    const p = resolveWasTunPlace('salzkammergut');
    const anchor = getGemeindeBySlug('4820-bad-ischl')!;
    expect(p).toMatchObject({ kind: 'region', where: 'im Salzkammergut', anchorName: 'Bad Ischl' });
    expect(p?.center).toEqual({ lat: anchor.lat, lng: anchor.lng, radiusKm: 30 });
  });

  it('Wien gibt es nur als Bundesland, der Gemeinde-Slug leitet um', () => {
    const wien = ALL_GEMEINDEN.find((g) => g.name === 'Wien')!;
    expect(wasTunRedirectSlug(wien.slug)).toBe('wien');
    expect(resolveWasTunPlace(wien.slug)).toBeNull();
    expect(resolveWasTunPlace('wien')?.kind).toBe('bundesland');
    expect(wasTunRedirectSlug('7000-eisenstadt')).toBeNull();
  });

  it('unbekannte Slugs lösen nicht auf', () => {
    expect(resolveWasTunPlace('gibt-es-nicht')).toBeNull();
    expect(resolveWasTunPlace('0000-nirgendwo')).toBeNull();
  });
});

describe('Sitemap und Verlinkung', () => {
  it('jeder Slug der Sitemap löst auf und kommt nur einmal vor', () => {
    const slugs = allWasTunSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.length).toBe(9 + TOURISM_REGIONS.length + ALL_GEMEINDEN.length - 1);
    expect(slugs.filter((s) => !resolveWasTunPlace(s))).toEqual([]);
  });

  it('Bundesland verlinkt seine Regionen und alle seine Gemeinden', () => {
    const rel = relatedPlaces(resolveWasTunPlace('burgenland')!);
    expect(rel.regions.map((r) => r.href)).toEqual(['/was-tun/neusiedler-see', '/was-tun/suedburgenland']);
    expect(rel.gemeinden.length).toBe(ALL_GEMEINDEN.filter((g) => resolveWasTunPlace(g.slug)?.bundeslandId === 'burgenland').length);
    expect(rel.gemeinden.some((g) => g.href === '/was-tun/7000-eisenstadt')).toBe(true);
  });

  it('Region verlinkt die Gemeinden in ihrem Umkreis, die Anker-Gemeinde zuerst', () => {
    const rel = relatedPlaces(resolveWasTunPlace('achensee')!);
    expect(rel.gemeinden[0].href).toBe('/was-tun/6212-eben-am-achensee');
    expect(rel.gemeinden.length).toBeLessThanOrEqual(40);
  });

  it('Gemeinde verlinkt acht Nachbarn und die Regionen, in deren Umkreis sie liegt', () => {
    const rel = relatedPlaces(resolveWasTunPlace('4820-bad-ischl')!);
    expect(rel.gemeinden).toHaveLength(8);
    expect(rel.regions.map((r) => r.href)).toContain('/was-tun/salzkammergut');
  });
});

describe('Ort als API-Parameter', () => {
  it('Bundesland als Spaltenfilter, Gemeinde und Region als Rechteck süd,west,nord,ost', async () => {
    const { scopeParams } = await import('@/lib/was-tun/loaders');
    expect(scopeParams(resolveWasTunPlace('steiermark')!)).toEqual({ bundesland: 'steiermark' });
    const g = getGemeindeBySlug('7000-eisenstadt')!;
    const [south, west, north, east] = scopeParams(resolveWasTunPlace('7000-eisenstadt')!).bbox.split(',').map(Number);
    expect(south).toBeLessThan(g.lat);
    expect(north).toBeGreaterThan(g.lat);
    expect(west).toBeLessThan(g.lng);
    expect(east).toBeGreaterThan(g.lng);
    // 10 km nach Norden und nach Süden sind zusammen rund 0,18 Breitengrade.
    expect(north - south).toBeCloseTo(0.18, 2);
  });
});
