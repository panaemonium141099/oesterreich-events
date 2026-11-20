import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import { toAppEventDetail, type AppEventDetailContext, type AppEventDetailInput } from '@/lib/app-api/event-detail';
import type { AppTranslate } from '@/lib/app-api/landing';
import type { Event } from '@/types/events';

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppEventDetailContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
};

const NOW = new Date('2026-11-05T10:00:00Z');

function event(over: Partial<Event> = {}): Event {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    title: 'Konzert &amp; Tanz',
    slug: 'konzert-tanz',
    start_date: '2026-11-20T19:00:00+00:00', // 20:00 Wien
    end_date: null,
    description: 'Erste Zeile.\nZweite Zeile.',
    location_name: 'Gasometer',
    address: 'Guglgasse 8',
    postal_code: '1110',
    district: null,
    bundesland: 'wien',
    country: 'AT',
    category: 'Musik',
    tags: ['konzert', 'Musik'],
    organizer: 'Verein Muster',
    image_url: 'https://img.example/plakat.jpg',
    image_width: 1200,
    image_credit: 'Foto Muster',
    source_id: 'quelle:1',
    source_name: 'musterkalender.at',
    source_url: 'https://musterkalender.at/konzert',
    publish_status: 'published',
    price_text: null,
    price_min: null,
    price_max: null,
    price_tier: null,
    price_flags: [],
    ticket_url: null,
    latitude: 48.185,
    longitude: 16.42,
    geocoding_confidence: null,
    location_resolution: null,
    ...over,
  } as unknown as Event;
}

function detail(over: Partial<Event> = {}, input: Partial<AppEventDetailInput> = {}) {
  return toAppEventDetail(
    { event: event(over), duplicateSources: [], related: [], successor: null, now: NOW, ...input },
    ctx,
  );
}

describe('toAppEventDetail', () => {
  it('trägt Kopf, Ort, Chips und die Quelle wie die Detailseite', () => {
    const d = detail();
    expect(d).toMatchObject({
      version: 1,
      title: 'Konzert & Tanz',
      isPast: false,
      description: 'Erste Zeile.\nZweite Zeile.',
      venue: { name: 'Gasometer', address: 'Guglgasse 8', organizer: 'Verein Muster' },
      chips: ['Musik', 'konzert'],
      source: { label: 'musterkalender.at', url: 'https://musterkalender.at/konzert' },
      alsoListed: [],
    });
    expect(d.hero).toMatchObject({
      image: 'https://img.example/plakat.jpg',
      dateLabel: 'Freitag, 20. November · 20:00',
      placeLabel: 'Gasometer · Wien',
      credit: { text: 'Foto Muster', sourceUrl: 'https://musterkalender.at/konzert' },
    });
    expect(d.url).toBe(`https://example.test${d.path}`);
    expect(d.related.heading).toBe('Ähnliche Events in Wien');
  });

  it('zeigt den Kauf-Knopf nur für Eventim und Inserate', () => {
    const eventim = detail({
      source_name: 'Eventim',
      ticket_url: 'https://tickets.example/kaufen?affiliate=J70',
      price_min: 29,
      price_max: 59,
    });
    expect(eventim.box).toMatchObject({
      kind: 'ticket',
      badge: 'Tickets verfügbar',
      headline: 'Offizieller Ticketshop: Eventim',
      priceFrom: '€ 29',
      ticket: { url: 'https://tickets.example/kaufen?affiliate=J70', provider: 'Eventim' },
    });

    // Ein gescrapter Ticket-Link beweist keine Buchbarkeit.
    const scraped = detail({ ticket_url: 'https://veranstalter.example/', price_text: 'VVK: 12 €; Abendkassa: 15 €' });
    expect(scraped.box.kind).toBe('unknown');
    expect(scraped.box.ticket).toBeNull();
    // Geschütztes Leerzeichen zwischen € und Betrag, wie in der Box der Website.
    expect(scraped.box.priceItems).toEqual([
      { label: 'VVK', value: '€ 12' },
      { label: 'Abendkassa', value: '€ 15' },
    ]);
  });

  it('kennt Eintritt frei und Abendkasse', () => {
    expect(detail({ price_tier: 'gratis' }).box).toMatchObject({ kind: 'free', badge: 'Eintritt frei', priceItems: [] });
    expect(detail({ price_flags: ['abendkasse'], price_text: '15 €' }).box).toMatchObject({
      kind: 'doorsale',
      badge: 'Abendkasse',
      priceAtDoor: '15 €',
    });
  });

  it('gibt eine Route nur bei belegten Koordinaten', () => {
    const approx = detail();
    expect(approx.location).toEqual({ mapsUrl: null, approximate: true, latitude: null, longitude: null });

    const trusted = detail({
      location_resolution: { allowed: { route: true } } as unknown as Event['location_resolution'],
    });
    expect(trusted.location.mapsUrl).toBe('https://www.google.com/maps/dir/?api=1&destination=48.185,16.42');
    expect(trusted.location.approximate).toBe(false);
  });

  it('setzt den Bildnachweis nie ans Kategorie-Foto', () => {
    const small = detail({ image_width: 222 });
    expect(small.hero.image).toMatch(/^https:\/\/example\.test\/images\/categories\//);
    expect(small.hero.credit).toBeNull();
  });

  it('nennt den Veranstalter nicht doppelt und führt Dubletten-Quellen', () => {
    expect(detail({ organizer: 'musterkalender.at' }).venue?.organizer).toBeNull();

    const d = detail({}, {
      duplicateSources: [
        { source_name: 'zweitquelle.at', source_url: 'https://zweitquelle.at/e/1' },
        { source_name: 'musterkalender.at', source_url: 'https://musterkalender.at/andere' },
      ],
    });
    expect(d.alsoListed).toEqual([{ label: 'zweitquelle.at', url: 'https://zweitquelle.at/e/1' }]);
  });

  it('erkennt vergangene Events und nennt die nächste Ausgabe', () => {
    const d = detail(
      { start_date: '2026-10-01T18:00:00+00:00' },
      { successor: event({ id: 'next', title: 'Konzert 2027', start_date: '2027-10-01T18:00:00+00:00' }) },
    );
    expect(d.isPast).toBe(true);
    expect(d.successor).toEqual({ id: 'next', title: 'Konzert 2027', dateLabel: 'Freitag, 1. Oktober · 20:00' });
  });
});
