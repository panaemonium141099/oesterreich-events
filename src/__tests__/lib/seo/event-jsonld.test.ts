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
