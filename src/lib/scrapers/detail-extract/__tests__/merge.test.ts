import { describe, it, expect } from 'vitest';
import { mergeEnrichment } from '../merge';
import type { ScrapedEvent } from '@/types/events';

const baseEvent = (): ScrapedEvent => ({
  source_id: 'x',
  source_name: 'test',
  source_url: 'https://x',
  title: 'T',
  start_date: '2026-06-01',
});

describe('mergeEnrichment', () => {
  it('detail address wins when valid and listing missing', () => {
    const e = baseEvent();
    mergeEnrichment(e, { address: 'Schlossplatz 1' });
    expect(e.address).toBe('Schlossplatz 1');
  });

  it('rejects invalid detail address', () => {
    const e = baseEvent();
    e.address = 'Hauptstraße 5';
    mergeEnrichment(e, { address: 'Tisch 5' });
    expect(e.address).toBe('Hauptstraße 5');
  });

  it('detail wins for postal_code when listing empty', () => {
    const e = baseEvent();
    mergeEnrichment(e, { postal_code: '7000' });
    expect(e.postal_code).toBe('7000');
  });

  it('postal_code rejected if not 4 digits', () => {
    const e = baseEvent();
    e.postal_code = '1010';
    mergeEnrichment(e, { postal_code: 'abc' });
    expect(e.postal_code).toBe('1010');
  });

  it('location_name: detail wins only when longer', () => {
    const e = baseEvent();
    e.location_name = 'Wien';
    mergeEnrichment(e, { location_name: 'Stadthalle Wien' });
    expect(e.location_name).toBe('Stadthalle Wien');
  });

  it('location_name: listing keeps if already longer', () => {
    const e = baseEvent();
    e.location_name = 'Stadthalle Wien, Saal 1';
    mergeEnrichment(e, { location_name: 'Wien' });
    expect(e.location_name).toBe('Stadthalle Wien, Saal 1');
  });

  it('description: listing wins if already >= 200 chars', () => {
    const e = baseEvent();
    e.description = 'x'.repeat(250);
    mergeEnrichment(e, { description: 'short' });
    expect(e.description!.length).toBe(250);
  });

  it('description: detail wins when listing was short', () => {
    const e = baseEvent();
    e.description = 'short';
    const longDetail = 'x'.repeat(500);
    mergeEnrichment(e, { description: longDetail });
    expect(e.description).toBe(longDetail);
  });

  it('price_text fills when listing was empty', () => {
    const e = baseEvent();
    mergeEnrichment(e, { price_text: '€ 12,–', price_min: 12, price_max: 12 });
    expect(e.price_text).toBe('€ 12,–');
    expect(e.price_min).toBe(12);
  });

  it('price_text never overwrites existing listing price', () => {
    const e = baseEvent();
    e.price_text = '€ 20,–';
    e.price_min = 20;
    mergeEnrichment(e, { price_text: '€ 12,–', price_min: 12 });
    expect(e.price_text).toBe('€ 20,–');
    expect(e.price_min).toBe(20);
  });

  it('image_url: detail wins (hi-res)', () => {
    const e = baseEvent();
    e.image_url = 'https://example.com/thumb.jpg';
    mergeEnrichment(e, { image_url: 'https://example.com/full.jpg' });
    expect(e.image_url).toBe('https://example.com/full.jpg');
  });

  it('organizer fills when listing was empty', () => {
    const e = baseEvent();
    mergeEnrichment(e, { organizer: 'Musikverein' });
    expect(e.organizer).toBe('Musikverein');
  });

  it('organizer never overwrites', () => {
    const e = baseEvent();
    e.organizer = 'Listing-Org';
    mergeEnrichment(e, { organizer: 'Detail-Org' });
    expect(e.organizer).toBe('Listing-Org');
  });

  it('title detail wins when listing title contains HTML tags', () => {
    const e = baseEvent();
    e.title = '<img class="bad" src="..."> Real Title';
    mergeEnrichment(e, { title: 'Real Title' });
    expect(e.title).toBe('Real Title');
  });

  it('title NOT overwritten when listing title is clean', () => {
    const e = baseEvent();
    e.title = 'Konzert mit Mira';
    mergeEnrichment(e, { title: 'Different' });
    expect(e.title).toBe('Konzert mit Mira');
  });

  it('start_date is never overwritten', () => {
    const e = baseEvent();
    e.start_date = '2026-06-01';
    // start_date is not a key on DetailEnrichment — confirm merge does not touch it
    mergeEnrichment(e, { description: 'x'.repeat(300) });
    expect(e.start_date).toBe('2026-06-01');
  });
});
