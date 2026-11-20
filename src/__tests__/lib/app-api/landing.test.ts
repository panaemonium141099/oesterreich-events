import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import { absoluteUrl, toAppEventCard, toAppLanding, type AppLandingContext, type AppTranslate } from '@/lib/app-api/landing';
import type { LandingData } from '@/lib/v4/get-landing-data';
import type { Event } from '@/types/events';

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppLandingContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
  mapboxToken: 'pk.test',
};

function event(over: Partial<Event> = {}): Event {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    title: 'Konzert &amp; Tanz',
    slug: 'konzert-tanz',
    start_date: '2026-11-20T19:00:00+00:00', // 20:00 Wien
    end_date: null,
    location_name: 'Gasometer',
    address: 'Guglgasse 8',
    postal_code: '1110',
    district: null,
    bundesland: 'wien',
    country: 'AT',
    category: 'Musik',
    image_url: 'https://img.example/plakat.jpg',
    image_width: 1200,
    source_id: 'quelle:1',
    price_text: null,
    price_min: 29,
    price_max: 59,
    ...over,
  } as Event;
}

function landing(over: Partial<LandingData> = {}): LandingData {
  return {
    today: '2026-11-20',
    countryTotal: 88_412,
    tip: null,
    season: { seasonId: 'advent', picks: [] },
    program: [],
    weekend: [],
    weekendRange: { from: '2026-11-20', to: '2026-11-22' },
    dorffeste: [],
    artistsLive: [],
    festivals: [],
    posts: [],
    activities: [],
    mapPins: [],
    ...over,
  };
}

describe('toAppEventCard', () => {
  it('rechnet Tag, Uhrzeit, Ort und Preis wie die Karten der Website', () => {
    const card = toAppEventCard(event(), ctx);
    expect(card).toMatchObject({
      title: 'Konzert & Tanz',
      day: '2026-11-20',
      dayShort: 'Fr 20. Nov.',
      time: '20:00',
      place: 'Gasometer · Wien',
      price: { label: 'ab 29 €', free: false },
      image: 'https://img.example/plakat.jpg',
      imageResolved: 'https://img.example/plakat.jpg',
      categoryLabel: 'Musik',
    });
    expect(card.path.startsWith('/events/')).toBe(true);
  });

  it('zeigt keine Uhrzeit, wenn die Quelle nur den Tag kennt', () => {
    expect(toAppEventCard(event({ start_date: '2026-11-20T00:00:00+00:00' }), ctx).time).toBeNull();
    // Mitternacht Wiener Zeit: der Tag bleibt der Wiener Tag.
    const card = toAppEventCard(event({ start_date: '2026-11-20T23:00:00+00:00' }), ctx);
    expect(card.time).toBeNull();
    expect(card.day).toBe('2026-11-21');
  });

  it('nennt Gratis-Events „Gratis"', () => {
    const card = toAppEventCard(event({ price_min: null, price_max: null, price_text: 'Eintritt frei' }), ctx);
    expect(card.price).toEqual({ label: 'Gratis', free: true });
  });

  it('liefert für tote und zu kleine Bilder das Kategorie-Foto der Website', () => {
    const dead = toAppEventCard(event({ image_width: 0 }), ctx);
    expect(dead.image).toBeNull();
    expect(dead.imageResolved).toMatch(/^https:\/\/example\.test\/images\/categories\/.+\.jpg$/);

    // 222-px-Teaser: im Regal bleibt das Bild der Quelle, groß gezeigt wird das Kategorie-Foto.
    const small = toAppEventCard(event({ image_width: 222 }), ctx);
    expect(small.image).toBe('https://img.example/plakat.jpg');
    expect(small.imageResolved).toMatch(/^https:\/\/example\.test\/images\/categories\//);
  });
});

describe('toAppLanding', () => {
  it('rundet die Event-Zahl ab und benennt den Tag', () => {
    const out = toAppLanding(landing(), ctx);
    expect(out.version).toBe(1);
    expect(out.eventCount).toBe(88_000);
    expect(out.todayLabel).toBe('Freitag, 20. November');
    expect(toAppLanding(landing({ countryTotal: 640 }), ctx).eventCount).toBeNull();
  });

  it('kennzeichnet nur gebuchte Tipps mit dem Sponsor', () => {
    const sponsored = toAppLanding(
      landing({ tip: { event: event(), kind: 'sponsored', sponsorName: 'Brauerei Muster' } }),
      ctx,
    ).tip!;
    expect(sponsored.sponsorName).toBe('Brauerei Muster');
    expect(sponsored.line).toBe('Fr., 20. Nov. · 20:00 · Brauerei Muster');
    expect(sponsored.cta).toBe('Tickets ab 29 €');

    const auto = toAppLanding(
      landing({ tip: { event: event({ price_min: null, price_max: null }), kind: 'auto', sponsorName: 'nie zeigen' } }),
      ctx,
    ).tip!;
    expect(auto.sponsorName).toBeNull();
    expect(auto.line).toBe('Fr., 20. Nov. · 20:00 · Gasometer');
    expect(auto.cta).toBe('Zum Event');
  });

  it('trägt die Texte der Saison und die Zeile jedes Picks', () => {
    const out = toAppLanding(
      landing({ season: { seasonId: 'advent', picks: [{ ...event(), featured: true }] } }),
      ctx,
    );
    expect(out.season).toMatchObject({ kicker: 'Advent', more: 'Alle Adventmärkte', morePath: '/entdecken?saison=advent' });
    expect(out.season.picks[0]).toMatchObject({ featured: true, meta: 'Fr., 20. Nov. · 20:00 · Gasometer' });
  });

  it('beschriftet Programm und Wochenende', () => {
    const out = toAppLanding(landing(), ctx);
    expect(out.program.sub).toBe('Freitag, ab 17 Uhr');
    expect(out.weekend.sub).toBe('Fr 20. Nov. bis So 22. Nov.');
    expect(
      toAppLanding(landing({ weekendRange: { from: '2026-11-22', to: '2026-11-22' } }), ctx).weekend.sub,
    ).toBe('So 22. Nov.');
  });

  it('baut das Kartenbild nur mit Token und nennt alle Regionen mit Bild', () => {
    const pins = [{ lat: 48.2, lng: 16.37 }];
    const withToken = toAppLanding(landing({ mapPins: pins }), ctx);
    expect(withToken.map.image).toContain('api.mapbox.com');
    expect(withToken.map.image).toContain('@2x');
    expect(withToken.map.pins).toEqual(pins);
    expect(toAppLanding(landing({ mapPins: pins }), { ...ctx, mapboxToken: null }).map.image).toBeNull();

    expect(withToken.regions).toHaveLength(9);
    expect(withToken.regions[0].image).toMatch(/^https:\/\/example\.test\/images\/regions\//);
  });

  it('reicht Bildnachweis und Ort der Aktivitäten durch', () => {
    const out = toAppLanding(
      landing({
        activities: [
          {
            id: 'a1',
            slug: 'therme-x',
            name: 'Therme X',
            tags: ['therme'],
            town: 'Bad Blumau',
            bundesland: 'steiermark',
            setting: 'indoor',
            price_hint: null,
            images: [{ urls: ['https://cdn.example/t.jpg'], copyright: 'TVB Muster', author: 'TVB Muster' }],
          },
        ],
      } as unknown as Partial<LandingData>),
      ctx,
    );
    expect(out.activities[0]).toMatchObject({
      image: 'https://cdn.example/t.jpg',
      credit: 'TVB Muster',
      place: 'Bad Blumau · Steiermark',
    });
    expect(out.activities[0].tagLabel).toBeTruthy();
  });
});

describe('absoluteUrl', () => {
  it('macht nur lokale Pfade absolut', () => {
    expect(absoluteUrl('/images/a.jpg', 'https://example.test')).toBe('https://example.test/images/a.jpg');
    expect(absoluteUrl('https://cdn.example/a.jpg', 'https://example.test')).toBe('https://cdn.example/a.jpg');
  });
});
