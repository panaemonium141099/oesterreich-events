import { describe, expect, it } from 'vitest';
import { extractFeratelDetail, selectDetailCandidates, type RawDetail } from '@/lib/scrapers/feratel-details';
import { mergeFeratelDetail } from '@/lib/scrapers/FeratelScraper';
import type { ScrapedEvent } from '@/types/events';

const RAW: RawDetail = {
  copyright: '',
  author: 'TVB Abtenau',
  nextOccurrences: {
    items: [
      { date: '2026-09-18T00:00:00', duration: 0, startTime: '09:00' },
      { date: '2026-10-02T00:00:00', duration: 2, startTime: '09:00' },
      { date: '2026-10-09T00:00:00', duration: 0, startTime: '09:00' },
    ],
    hasMoreItems: true,
  },
  addresses: [
    { addressType: 31, company: 'Tourismusverband Abtenau', address1: 'Markt 165', city: 'Abtenau', zipCode: '5441', url: 'http://www.abtenau-info.at' },
    { addressType: 32, company: 'Salzburg Altstadt', address1: 'Mozartplatz 5', city: 'Salzburg', zipCode: '5020', url: '' },
  ],
  links: [
    { name: 'Tickets kaufen', url: 'https://tickets.example.at/x', type: 1, order: 2 },
    { name: 'Wochenprogramm', url: 'https://abtenau-info.at/service-2/wochenprogramm-abtenau/', type: 1, order: 1 },
  ],
  dynamicDescriptions: [
    { type: 901, name: 'Preis Information', description: '<p>€ 19,00 pro Person</p>' },
    { type: 912, name: 'Treffpunkt', description: 'Tourismusbüro, 09:00 Uhr' },
    { type: 906, name: 'Geeignet für', description: 'Familien' },
  ],
  handicapClassifications: [{ name: 'Rollstuhlgerecht' }],
  handicapFacilities: [{ groupName: 'Zugang', items: [{ name: 'Stufenlos', value: 'true' }, { name: 'Lift', value: 'false' }] }],
};

describe('extractFeratelDetail', () => {
  it('komprimiert Termine, Adressen, Links, Preis und Barrierefreiheit', () => {
    const d = extractFeratelDetail(RAW);
    expect(d.occurrences).toEqual([
      { localStart: '2026-09-18T09:00:00', duration: 0 },
      { localStart: '2026-10-02T09:00:00', duration: 2 },
      { localStart: '2026-10-09T09:00:00', duration: 0 },
    ]);
    expect(d.hasMoreOccurrences).toBe(true);
    expect(d.venue).toEqual({ company: 'Salzburg Altstadt', name: null, street: 'Mozartplatz 5', zip: '5020', city: 'Salzburg', url: null });
    expect(d.organizer?.company).toBe('Tourismusverband Abtenau');
    expect(d.website).toBe('https://abtenau-info.at/service-2/wochenprogramm-abtenau/');
    expect(d.ticketUrl).toBe('https://tickets.example.at/x');
    expect(d.price).toBe('€ 19,00 pro Person');
    expect(d.meetingPoint).toBe('Tourismusbüro, 09:00 Uhr');
    expect(d.suitableFor).toBe('Familien');
    expect(d.handicap).toEqual(['Rollstuhlgerecht', 'Stufenlos']);
    expect(d.copyright).toBe('TVB Abtenau');
  });

  it('ohne Links faellt die Website auf die Veranstalter-URL zurueck', () => {
    const d = extractFeratelDetail({ ...RAW, links: [] });
    expect(d.website).toBe('http://www.abtenau-info.at');
    expect(d.ticketUrl).toBeNull();
  });
});

describe('mergeFeratelDetail', () => {
  const event: ScrapedEvent = {
    source_id: 'feratel-abc',
    source_name: 'feratel-deskline',
    source_url: null,
    title: 'Salzburg Stadtführung',
    description: 'Erleben Sie die Mozartstadt.',
    start_date: '2026-09-18T07:00:00.000Z',
    city: 'Abtenau',
    price_flags: [],
  };

  it('mischt Adresse, Veranstalter, Link, Preis ein und legt die weiteren Termine als eigene Zeilen an', () => {
    const rows = mergeFeratelDetail(event, extractFeratelDetail(RAW));
    expect(rows).toHaveLength(3);
    const [first, second, third] = rows;
    expect(first.source_id).toBe('feratel-abc');
    expect(first.start_date).toBe('2026-09-18T07:00:00.000Z');
    expect(first.source_url).toBe('https://abtenau-info.at/service-2/wochenprogramm-abtenau/');
    expect(first.ticket_url).toBe('https://tickets.example.at/x');
    expect(first.organizer).toBe('Tourismusverband Abtenau');
    expect(first.address).toBe('Mozartplatz 5');
    expect(first.postal_code).toBe('5020');
    expect(first.city).toBe('Abtenau');
    expect(first.location_name).toBe('Salzburg Altstadt');
    expect(first.price_text).toBe('€ 19,00 pro Person');
    expect(first.price_flags).toEqual(['barrierefrei']);
    expect(first.description).toContain('Treffpunkt: Tourismusbüro, 09:00 Uhr');
    expect(first.description).toContain('Geeignet für: Familien');
    expect(second.source_id).toBe('feratel-abc:2026-10-02');
    expect(second.start_date).toBe('2026-10-02T07:00:00.000Z');
    expect(second.end_date).toBe('2026-10-02T09:00:00.000Z');
    expect(third.source_id).toBe('feratel-abc:2026-10-09');
    expect(third.end_date).toBeUndefined();
  });

  it('Eintritt frei in der Preisangabe setzt das Preis-Flag', () => {
    const rows = mergeFeratelDetail(event, extractFeratelDetail({ ...RAW, dynamicDescriptions: [{ type: 901, description: 'Eintritt frei!' }], handicapClassifications: [], handicapFacilities: [] }));
    expect(rows[0].price_flags).toEqual(['freier-eintritt']);
    expect(rows[0].price_text).toBe('Eintritt frei!');
  });
});

describe('selectDetailCandidates', () => {
  it('ohne Cache zuerst, dann die aeltesten, Budget und Mindestalter beachtet', () => {
    const now = Date.parse('2026-09-18T12:00:00Z');
    const index = {
      fetchedAt: new Map([
        ['a', '2026-09-18T11:30:00Z'], // frisch
        ['b', '2026-09-17T00:00:00Z'], // alt
        ['c', '2026-09-18T01:00:00Z'], // aelter als 6 h
      ]),
      detail: new Map(),
    };
    expect(selectDetailCandidates(['a', 'b', 'c', 'd', 'e'], index, 10, 6 * 3600_000, now)).toEqual(['d', 'e', 'b', 'c']);
    expect(selectDetailCandidates(['a', 'b', 'c', 'd', 'e'], index, 2, 6 * 3600_000, now)).toEqual(['d', 'e']);
    expect(selectDetailCandidates(['a'], index, 5, 6 * 3600_000, now)).toEqual([]);
  });
});
