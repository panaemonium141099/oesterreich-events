import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import { toAppActivityDetail, toAppActivityFacets } from '@/lib/app-api/activities';
import type { AppLandingContext, AppTranslate } from '@/lib/app-api/landing';
import type { NearbyFutureEvent } from '@/lib/activities/nearby-loaders';
import type { PublicActivity } from '@/lib/activities/public-types';

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppLandingContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
  mapboxToken: null,
};

// Donnerstag, 05.11.2026, 11:00 Wiener Zeit.
const NOW = new Date('2026-11-05T10:00:00Z');

function activity(over: Partial<PublicActivity> = {}): PublicActivity {
  return {
    id: 'a1',
    slug: 'seeschloss-ort-gmunden',
    shortid: 'abc123',
    name: 'Seeschloss Ort',
    description: 'Schloss im Traunsee.',
    description_short: 'Schloss.',
    description_en: null,
    tags: ['museumstour', 'ausstellung'],
    setting: 'indoor',
    lat: 47.91,
    lng: 13.79,
    town: 'Gmunden',
    gemeinde_slug: 'gmunden',
    bundesland: 'oberoesterreich',
    opening_times: [{ from: '2026-05-01', to: '2026-12-31', timeFrom: '09:00', timeTo: '17:00', weekdays: null }],
    online_bookable: true,
    images: [
      { urls: ['https://img.example/a.jpg'], copyright: 'TVB Traunsee', license: null, author: 'Max Muster' },
      { urls: ['https://img.example/b.jpg'], copyright: 'TVB Traunsee', license: null, author: 'TVB Traunsee' },
    ],
    guest_cards: null,
    price_hint: 'ab 6 €',
    affiliate_product: null,
    source: 'deskline',
    is_closed: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as PublicActivity;
}

function nearby(id: string): NearbyFutureEvent {
  return {
    id: `${id}0000000-0000-4000-8000-000000000000`.slice(0, 36),
    title: `Event ${id}`,
    slug: `event-${id}`,
    start_date: '2026-11-07T19:00:00+00:00',
    location_name: 'Stadttheater',
    address: null,
    postal_code: '4810',
    bundesland: 'oberoesterreich',
    latitude: 47.92,
    longitude: 13.8,
    category: 'Musik',
    image_url: null,
    image_width: null,
    source_id: null,
    event_score: 60,
    _distance_km: 1.2,
  };
}

const build = (over: Partial<PublicActivity> = {}, events: NearbyFutureEvent[] = []) =>
  toAppActivityDetail({ activity: activity(over), gemeindeName: 'Gmunden', nearbyEvents: events, now: NOW }, ctx);

describe('toAppActivityDetail', () => {
  it('trägt Kopf, Ort, Tags und die Adresse zum Teilen', () => {
    expect(build()).toMatchObject({
      url: 'https://example.test/aktivitaet/seeschloss-ort-gmunden',
      name: 'Seeschloss Ort',
      place: 'Gmunden · Oberösterreich',
      closedLabel: null,
      description: 'Schloss im Traunsee.',
    });
    expect(build().tags.length).toBe(2);
  });

  it('nennt den Bildnachweis je Bild und fasst gleiche Angaben zusammen', () => {
    expect(build().images).toEqual([
      { url: 'https://img.example/a.jpg', credit: 'TVB Traunsee · Max Muster' },
      { url: 'https://img.example/b.jpg', credit: 'TVB Traunsee' },
    ]);
    expect(build({ images: null }).images).toEqual([]);
  });

  it('rechnet „Jetzt geöffnet" aus den Öffnungszeiten', () => {
    expect(build().openNow).toEqual({ open: true, label: 'Jetzt geöffnet' });
    const evening = toAppActivityDetail(
      { activity: activity(), gemeindeName: null, nearbyEvents: [], now: new Date('2026-11-05T19:00:00Z') },
      ctx,
    );
    expect(evening.openNow).toEqual({ open: false, label: 'Derzeit geschlossen' });
    expect(build({ opening_times: null }).openNow).toBeNull();
  });

  it('schreibt Öffnungszeiten ohne Striche', () => {
    expect(build().opening).toEqual({
      title: 'Öffnungszeiten & Saison',
      rows: [{ season: '01.05.2026 bis 31.12.2026', days: 'täglich', time: '09:00 bis 17:00' }],
    });
  });

  it('zeigt bei dauerhaft geschlossenen Orten keinen Öffnungsstatus und kein Angebot', () => {
    const closed = build({ is_closed: true, affiliate_product: { provider: 'viator' } });
    expect(closed.closedLabel).toBe('Dauerhaft geschlossen');
    expect(closed.openNow).toBeNull();
    expect(closed.hasBooking).toBe(false);
  });

  it('listet Kurzfakten und nennt die Quelle', () => {
    const detail = build();
    expect(detail.facts).toEqual([
      { label: 'Preis', value: 'ab 6 €' },
      { label: 'Umgebung', value: 'Indoor' },
      { label: 'Gemeinde', value: 'Gmunden' },
    ]);
    expect(detail.onlineBookable).toBe('Online buchbar');
    expect(detail.source).toMatchObject({ prefix: 'Quelle', label: 'Feratel Deskline', url: 'https://www.feratel.at/', allPath: '/quellen' });
    const curated = build({ source: 'kuratiert', source_url: 'https://quelle.example', source_label: 'Stadt Gmunden' });
    expect(curated.source).toMatchObject({ label: 'Stadt Gmunden', url: 'https://quelle.example' });
  });

  it('zeigt höchstens drei Events in der Nähe', () => {
    expect(build().nearbyEvents).toBeNull();
    const withEvents = build({}, [nearby('a'), nearby('b'), nearby('c'), nearby('d')]);
    expect(withEvents.nearbyEvents?.title).toBe('Events in der Nähe');
    expect(withEvents.nearbyEvents?.events.map(e => e.title)).toEqual(['Event a', 'Event b', 'Event c']);
  });

  it('gibt Lage und Route an', () => {
    expect(build().location).toMatchObject({ lat: 47.91, lng: 13.79, routeLabel: 'Route planen' });
    expect(build().location.mapsUrl).toContain('destination=47.91,13.79');
  });
});

describe('toAppActivityFacets', () => {
  it('fasst Bezirke je Bundesland zusammen und sortiert nach Namen', () => {
    const facets = toAppActivityFacets(
      [
        { bundesland: 'tirol', bezirk: 'kufstein', n: 40 },
        { bundesland: 'tirol', bezirk: 'innsbruck-land', n: 60 },
        { bundesland: 'burgenland', bezirk: 'eisenstadt', n: 10 },
      ],
      ctx,
    );
    expect(facets.bundeslaender.map(b => [b.name, b.count])).toEqual([
      ['Burgenland', 10],
      ['Tirol', 100],
    ]);
    expect(facets.bundeslaender[1].bezirke.map(b => b.id)).toEqual(['innsbruck-land', 'kufstein']);
    expect(facets.tags).toHaveLength(12);
    expect(facets.settings.map(s => s.label)).toEqual(['Indoor', 'Outdoor']);
    expect(`${facets.title} ${facets.intro}`).not.toMatch(/[–—]/);
  });
});
