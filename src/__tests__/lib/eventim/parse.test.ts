import { describe, it, expect } from 'vitest';
import { parseEventimFeed } from '@/lib/eventim/parse';
import type { EventimSeries, EventimEvent } from '@/lib/eventim/types';

const NOW = '2026-06-16T00:00:00.000Z';

const baseEvent = (over: Partial<EventimEvent> = {}): EventimEvent => ({
  eventId: 'E', eventName: 'Show', eventDateIso8601: '2026-09-01T20:00:00.000+02:00',
  eventStatus: '2', eventType: '1', deliverable: true,
  eventCity: 'WIEN', eventCountry: 'AT', eventZip: '7000', eventStreet: 'Hauptstr 1',
  eventVenue: 'Stadthalle', eventVenueId: 'V1', venueLatitude: 48.2, venueLongitude: 16.37,
  minPrice: 20, maxPrice: 40, evoLink: 'https://www.oeticket.com/e/E?affiliate=J70',
  priceCategories: [{ inventory: 'buchbar', price: '20,00', currency: 'EUR',
    priceCategoryId: '1', priceCategoryName: 'K1', priceCategoryNumber: '1', productType: '1' }],
  ...over,
});

const series: EventimSeries[] = [{
  esId: 'S1', esName: 'Big Tour', esText: '<b>Hallo</b> <p>Welt</p>',
  esPictureBig: 'https://img/x.jpg', esCategories: [{ category: '1A' }],
  events: [
    baseEvent({ eventId: 'A1' }),                                  // kept (bookable AT)
    baseEvent({ eventId: 'CANCELLED', eventStatus: '1' }),         // dropped (cancelled)
    baseEvent({ eventId: 'PAST', eventDateIso8601: '2020-01-01T20:00:00.000+01:00' }), // dropped
    baseEvent({ eventId: 'VOUCHER', eventType: '4' }),            // dropped (not ticket)
    baseEvent({ eventId: 'DE1', eventCountry: 'DE' }),            // kept (DE)
    baseEvent({ eventId: 'HR1', eventCountry: 'HR' }),            // dropped (foreign)
    baseEvent({ eventId: 'SOLDOUT', eventStatus: '4' }),         // kept, but not bookable
  ],
}];

describe('parseEventimFeed', () => {
  const out = parseEventimFeed(series, NOW);

  it('keeps only future, ticket-type, non-cancelled AT/DE/CH events', () => {
    expect(out.map((e) => e.source_id).sort()).toEqual(['A1', 'DE1', 'SOLDOUT']);
  });

  it('maps the bookable AT event with all key fields', () => {
    const a1 = out.find((e) => e.source_id === 'A1')!;
    expect(a1.source_name).toBe('Eventim');
    expect(a1.ticket_url).toBe('https://www.oeticket.com/e/E?affiliate=J70');
    expect(a1.category).toBe('Musik');
    expect(a1.tags).toEqual(['rock-pop']);
    expect(a1.category_locked).toBe(true);
    expect(a1.country).toBe('AT');
    expect(a1.latitude).toBe(48.2);
    expect(a1.price_text).toBe('20,00 € – 40,00 €');
    expect(a1.source_type).toBe('scraped');
  });

  it('strips HTML from the description', () => {
    const a1 = out.find((e) => e.source_id === 'A1')!;
    expect(a1.description).toBe('Hallo Welt');
  });

  it('omits ticket_url for sold-out (not bookable) events', () => {
    const so = out.find((e) => e.source_id === 'SOLDOUT')!;
    expect(so.ticket_url).toBeUndefined();
    expect(so.country).toBe('AT');
  });

  it('carries country for DE events', () => {
    expect(out.find((e) => e.source_id === 'DE1')!.country).toBe('DE');
  });
});
