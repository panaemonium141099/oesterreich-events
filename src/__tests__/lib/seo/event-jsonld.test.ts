import { describe, it, expect } from 'vitest';
import { buildJsonLd, parsePriceText } from '@/lib/seo/event-jsonld';
import type { Event } from '@/types/events';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: '12345678-abcd-4000-8000-000000000000',
    source_id: null,
    source_name: null,
    source_url: null,
    title: 'Testfest',
    description: null,
    start_date: '2026-09-15',
    end_date: null,
    location_name: null,
    address: null,
    postal_code: null,
    bundesland: null,
    district: null,
    latitude: null,
    longitude: null,
    category: null,
    price_text: null,
    price_min: null,
    price_max: null,
    image_url: null,
    organizer: null,
    tags: null,
    ...overrides,
  } as Event;
}

function parse(event: Event): Record<string, any> {
  return JSON.parse(buildJsonLd(event));
}

describe('buildJsonLd — GSC-Warnungs-Fixes', () => {
  it('setzt endDate = startDate als Eintages-Fallback', () => {
    expect(parse(makeEvent()).endDate).toBe('2026-09-15');
  });

  it('behaelt echtes end_date bei', () => {
    expect(parse(makeEvent({ end_date: '2026-09-17' })).endDate).toBe('2026-09-17');
  });

  it('emittiert PostalAddress schon bei PLZ ohne Strasse', () => {
    const ld = parse(makeEvent({ postal_code: '7000' }));
    expect(ld.location.address).toEqual({
      '@type': 'PostalAddress',
      postalCode: '7000',
      addressCountry: 'AT',
    });
  });

  it('parst addressLocality aus der Adresse', () => {
    const ld = parse(makeEvent({ address: 'Hauptstraße 5, 8010 Graz', postal_code: '8010' }));
    expect(ld.location.address.streetAddress).toBe('Hauptstraße 5, 8010 Graz');
    expect(ld.location.address.addressLocality).toBe('Graz');
    expect(ld.location.address.postalCode).toBe('8010');
  });

  it('laesst address weg wenn weder Strasse noch PLZ noch Ort bekannt', () => {
    const ld = parse(makeEvent());
    expect(ld.location.address).toBeUndefined();
  });

  it('verwirft ungueltige PLZ statt sie zu emittieren', () => {
    const ld = parse(makeEvent({ postal_code: 'A-12' }));
    expect(ld.location.address).toBeUndefined();
  });

  it('baut description-Fallback aus Titel, Datum und Ort', () => {
    const ld = parse(makeEvent({ location_name: 'Stadthalle Wien' }));
    expect(ld.description).toBe('Testfest — 15.09.2026 — Stadthalle Wien');
  });

  it('nutzt echte description unveraendert (auf 500 gekappt)', () => {
    const ld = parse(makeEvent({ description: 'Ein Fest.' }));
    expect(ld.description).toBe('Ein Fest.');
  });

  it('absolutiert relative Fallback-Bilder', () => {
    const ld = parse(makeEvent());
    expect(ld.image).toMatch(/^https:\/\/lasstreffen\.at\/images\//);
  });

  it('laesst absolute Bild-URLs unangetastet', () => {
    const url = 'https://cdn.example.com/bild.jpg';
    const ld = parse(makeEvent({ image_url: url }));
    expect(ld.image).toBe(url);
  });

  it('emittiert offers weiterhin NUR mit bekanntem Preis', () => {
    expect(parse(makeEvent()).offers).toBeUndefined();
    expect(parse(makeEvent({ price_text: 'Eintritt frei' })).offers.price).toBe('0');
    expect(parse(makeEvent({ price_min: 25 })).offers.price).toBe('25');
  });

  it('eventStatus/organizer/performer sind immer gesetzt', () => {
    const ld = parse(makeEvent());
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(ld.organizer.name).toBe('LassTreffen.at');
    expect(ld.performer.name).toBe('Testfest');
  });
});

describe('parsePriceText', () => {
  it('erkennt Gratis-Varianten als 0', () => {
    expect(parsePriceText('Eintritt frei')).toBe('0');
    expect(parsePriceText('kostenlos')).toBe('0');
  });

  it('extrahiert Zahlen mit Komma', () => {
    expect(parsePriceText('€12,50')).toBe('12.50');
  });

  it('liefert null ohne erkennbaren Preis', () => {
    expect(parsePriceText('VVK demnächst')).toBeNull();
    expect(parsePriceText(null)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// fn-23: Zeitzone, Uhrzeit-Praezision und eventStatus.
// Die Ausgangswerte stammen aus echten Prod-Zeilen (gemessen 2026-09-05),
// damit die Tests die tatsaechlich vorkommenden Platzhalter-Formen abdecken.
// ───────────────────────────────────────────────────────────────────────────

describe('buildJsonLd — startDate/Zeitzone (fn-23)', () => {
  it('emittiert Wiener Ortszeit mit Offset statt des rohen UTC-Strings', () => {
    // 17:00Z ist in Wien 19:00 — vorher stand "2026-10-01T17:00:00+00:00" im Markup.
    const ld = parse(makeEvent({ start_date: '2026-10-01T17:00:00+00:00' }));
    expect(ld.startDate).toBe('2026-10-01T19:00:00+02:00');
  });

  it('nutzt im Winter den CET-Offset', () => {
    const ld = parse(makeEvent({ start_date: '2026-12-01T19:00:00+00:00' }));
    expect(ld.startDate).toBe('2026-12-01T20:00:00+01:00');
  });

  it('liefert reines Datum statt erfundener Uhrzeit (Platzhalter 00:00Z)', () => {
    const ld = parse(makeEvent({ start_date: '2026-10-01T00:00:00+00:00' }));
    expect(ld.startDate).toBe('2026-10-01');
  });

  it('korrigiert den Tagesversatz der viennaToUtc-Platzhalter (22:00Z)', () => {
    // 22:00Z = Wien 00:00 am 2. Oktober. Vorher wurde der 1. Oktober ausgeliefert.
    const ld = parse(makeEvent({ start_date: '2026-10-01T22:00:00+00:00' }));
    expect(ld.startDate).toBe('2026-10-02');
  });

  it('unterdrueckt die Uhrzeit bei is_all_day', () => {
    const ld = parse(makeEvent({ start_date: '2026-10-01T14:00:00+00:00', is_all_day: true }));
    expect(ld.startDate).toBe('2026-10-01');
  });

  it('haelt endDate auf derselben Praezision wie startDate', () => {
    const timed = parse(makeEvent({
      start_date: '2026-10-01T17:00:00+00:00',
      end_date: '2026-10-01T20:00:00+00:00',
    }));
    expect(timed.endDate).toBe('2026-10-01T22:00:00+02:00');

    const dayOnly = parse(makeEvent({
      start_date: '2026-10-01T00:00:00+00:00',
      end_date: '2026-10-05T16:00:00+00:00',
    }));
    expect(dayOnly.endDate).toBe('2026-10-05');
  });

  it('macht aus einem synthetischen 23:59:59Z-Ende kein Zweitages-Event', () => {
    const ld = parse(makeEvent({
      start_date: '2026-08-08T00:00:00+00:00',
      end_date: '2026-08-08T23:59:59+00:00',
    }));
    expect(ld.startDate).toBe('2026-08-08');
    expect(ld.endDate).toBe('2026-08-08');
  });

  it('faellt bei einem Ende vor dem Start auf den Start zurueck', () => {
    const ld = parse(makeEvent({
      start_date: '2026-10-01T17:00:00+00:00',
      end_date: '2026-09-30T17:00:00+00:00',
    }));
    expect(ld.endDate).toBe(ld.startDate);
  });
});

describe('buildJsonLd — eventStatus (fn-23)', () => {
  it('bleibt ohne Spaltenwert auf EventScheduled', () => {
    expect(parse(makeEvent()).eventStatus).toBe('https://schema.org/EventScheduled');
  });

  it('bildet eine Absage ab und nimmt das Ticket aus dem Verkauf', () => {
    const ld = parse(makeEvent({ event_status: 'cancelled', price_min: 25 }));
    expect(ld.eventStatus).toBe('https://schema.org/EventCancelled');
    expect(ld.offers.availability).toBe('https://schema.org/SoldOut');
  });

  it('emittiert previousStartDate bei einer Verschiebung', () => {
    const ld = parse(makeEvent({
      event_status: 'rescheduled',
      start_date: '2026-11-05T19:00:00+00:00',
      previous_start_date: '2026-10-01T17:00:00+00:00',
    }));
    expect(ld.eventStatus).toBe('https://schema.org/EventRescheduled');
    expect(ld.previousStartDate).toBe('2026-10-01T19:00:00+02:00');
  });

  it('schaltet bei moved_online auf VirtualLocation um', () => {
    const ld = parse(makeEvent({ event_status: 'moved_online', ticket_url: 'https://stream.example/x' }));
    expect(ld.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode');
    expect(ld.location['@type']).toBe('VirtualLocation');
    expect(ld.location.url).toBe('https://stream.example/x');
  });

  it('faellt bei unbekanntem Status auf scheduled zurueck', () => {
    const ld = parse(makeEvent({ event_status: 'quatsch' as never }));
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled');
  });
});

describe('buildJsonLd — i18n (fn-23)', () => {
  it('markiert die deutsche Seite als de', () => {
    expect(parse(makeEvent()).inLanguage).toBe('de');
  });

  it('markiert die englische Seite als en und traegt die /en-URL', () => {
    const enUrl = 'https://lasstreffen.at/en/events/1010-wien/2026-09-15/testfest';
    const ld = JSON.parse(buildJsonLd(makeEvent(), { locale: 'en', canonicalUrl: enUrl }));
    expect(ld.inLanguage).toBe('en');
    expect(ld.url).toBe(enUrl);
  });

  it('lokalisiert den Orts-Fallback', () => {
    const de = JSON.parse(buildJsonLd(makeEvent(), { locale: 'de' }));
    const en = JSON.parse(buildJsonLd(makeEvent(), { locale: 'en' }));
    expect(de.location.name).toBe('Österreich');
    expect(en.location.name).toBe('Austria');
  });
});
