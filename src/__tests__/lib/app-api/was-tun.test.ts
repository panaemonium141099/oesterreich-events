import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import type { AppLandingContext, AppTranslate } from '@/lib/app-api/landing';
import { toAppWasTun, toAppWasTunIndex } from '@/lib/app-api/was-tun';
import type { WasTunData } from '@/lib/was-tun/loaders';
import { resolveWasTunPlace } from '@/lib/was-tun/places';
import { wasTunThemeBySlug } from '@/lib/was-tun/themes';

// Der Lader braucht Datenbank und next/cache; hier zählt nur die Umformung.
vi.mock('@/lib/was-tun/loaders', () => ({}));

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppLandingContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
  mapboxToken: null,
};

const steiermark = resolveWasTunPlace('steiermark')!;

function event(n: number) {
  return {
    id: `${n}0000000-0000-4000-8000-000000000000`.slice(0, 36),
    title: `Event ${n}`,
    slug: `event-${n}`,
    start_date: '2026-11-07T19:00:00+00:00',
    location_name: 'Orpheum',
    postal_code: '8020',
    address: null,
    bundesland: 'steiermark',
    category: 'Musik',
    image_url: null,
    event_score: 60,
  };
}

function activity(n: number) {
  return { id: `a${n}`, slug: `ziel-${n}`, name: `Ziel ${n}`, tags: ['wandern'], town: 'Graz', price_hint: null, images: null };
}

function data(over: Partial<WasTunData> = {}): WasTunData {
  return {
    events: [event(1), event(2)],
    eventTotal: 50,
    shelfPool: [],
    activities: [activity(1), activity(2), activity(3)],
    activityTotal: 3,
    activityCursor: null,
    osmPois: [],
    eventApiParams: { bundesland: 'steiermark' },
    activityApiParams: { bundesland: 'steiermark' },
    ...over,
  } as WasTunData;
}

describe('toAppWasTunIndex', () => {
  it('listet Bundesländer und Regionen mit ihren Slugs', () => {
    const index = toAppWasTunIndex();
    expect(index.bundeslaender.map(b => b.slug)).toContain('steiermark');
    expect(index.bundeslaender).toHaveLength(9);
    expect(index.regions.length).toBeGreaterThan(5);
    expect(index.regions.every(r => r.slug && !r.slug.includes('/'))).toBe(true);
  });
});

describe('toAppWasTun', () => {
  it('stellt Frage, Antwort und Themen der Grundseite', () => {
    const body = toAppWasTun(steiermark, null, data(), ctx);
    expect(body.question).toMatch(/Steiermark/);
    expect(body.answer.length).toBeGreaterThan(20);
    expect(body.url).toBe('https://example.test/was-tun/steiermark');
    expect(body.themes[0]).toEqual({ slug: null, label: 'Alles', active: true });
    expect(body.themes.map(t => t.slug)).toEqual([null, 'heute', 'am-wochenende', 'bei-regen', 'draussen', 'mit-kindern', 'kostenlos']);
  });

  it('gibt dem Nachladen der Events Parameter und Cursor der Seite mit', () => {
    const body = toAppWasTun(steiermark, null, data(), ctx);
    expect(body.events).toMatchObject({ total: 50, more: { params: { bundesland: 'steiermark' }, cursor: event(2).id } });
    expect(body.events?.items).toHaveLength(2);
    const complete = toAppWasTun(steiermark, null, data({ eventTotal: 2 }), ctx);
    expect(complete.events?.more).toBeNull();
  });

  it('lädt Aktivitäten nur mit Cursor nach', () => {
    expect(toAppWasTun(steiermark, null, data(), ctx).activities?.more).toBeNull();
    const more = toAppWasTun(steiermark, null, data({ activityCursor: 'abc', activityTotal: 40 }), ctx);
    expect(more.activities).toMatchObject({ total: 40, more: { params: { bundesland: 'steiermark' }, cursor: 'abc' } });
    expect(more.activities?.items[0]).toMatchObject({ name: 'Ziel 1', place: 'Graz · Steiermark' });
  });

  it('markiert das aktive Thema und lässt weg, was das Thema nicht zeigt', () => {
    const theme = wasTunThemeBySlug('kostenlos')!;
    const body = toAppWasTun(steiermark, theme, data({ activities: [], activityTotal: 0, activityApiParams: null }), ctx);
    expect(body.theme).toBe('kostenlos');
    expect(body.url).toBe('https://example.test/was-tun/steiermark/kostenlos');
    expect(body.themes.find(t => t.active)?.slug).toBe('kostenlos');
    expect(body.activities).toBeNull();
    expect(body.related.gemeinden).toEqual([]);
  });

  it('zeigt OSM-Ziele erst ab drei, getrennt und mit Quellenangabe', () => {
    const poi = (n: number) => ({ id: `o${n}`, name: `Aussicht ${n}`, category: 'viewpoint', town: 'Graz', lat: 47, lng: 15, website: null, _distance_km: 1.26 * n });
    expect(toAppWasTun(steiermark, null, data({ osmPois: [poi(1), poi(2)] as never }), ctx).osm).toBeNull();
    const osm = toAppWasTun(steiermark, null, data({ osmPois: [poi(1), poi(2), poi(3)] as never }), ctx).osm!;
    expect(osm.title).toBe('Weitere Ausflugsziele in der Umgebung');
    expect(osm.items[0]).toMatchObject({ name: 'Aussicht 1', distance: '1,3 km' });
    expect(osm.attribution.text).toContain('OpenStreetMap contributors');
    expect(osm.attribution.links.map(l => l.url)).toEqual([
      'https://www.openstreetmap.org/copyright',
      'https://opendatacommons.org/licenses/odbl/1-0/',
    ]);
  });

  it('liefert häufige Fragen als Paare', () => {
    const faq = toAppWasTun(steiermark, null, data(), ctx).faq;
    expect(faq.length).toBeGreaterThan(0);
    expect(faq.every(f => f.question.endsWith('?') && f.answer.length > 0)).toBe(true);
  });
});
