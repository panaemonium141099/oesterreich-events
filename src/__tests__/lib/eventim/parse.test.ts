import { describe, it, expect } from 'vitest';
import { parseEventimFeed, seriesArtists, type EventimArtistsByEvent } from '@/lib/eventim/parse';
import type { EventimSeries, EventimEvent, EventimArtist } from '@/lib/eventim/types';

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
    expect(a1.tags).toEqual(['rock', 'pop']);
    expect(a1.category_locked).toBe(true);
    expect(a1.country).toBe('AT');
    expect(a1.bundesland).toBe('wien');
    expect(a1.latitude).toBe(48.2);
    expect(a1.coords_precision).toBe('venue');
    expect(a1.city).toBe('WIEN');
    expect(a1.source_venue_id).toBe('eventim:V1');
    expect(a1.price_text).toBe('20,00 € – 40,00 €');
    expect(a1.source_type).toBe('scraped');
    expect(a1.image_url).toBe('https://img/x.jpg');
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

  it('carries country for DE events (no Bundesland for non-AT)', () => {
    const de = out.find((e) => e.source_id === 'DE1')!;
    expect(de.country).toBe('DE');
    expect(de.bundesland).toBeUndefined();
  });

  it('fn-25: ohne Venue-Koordinate kein PLZ-Mittelpunkt als Position, PLZ und Ort bleiben Quellangaben', () => {
    const s: EventimSeries[] = [{ esId: 'S', esName: 'X', esCategories: [{ category: '1A' }],
      events: [baseEvent({ eventId: 'NOCOORDS', venueLatitude: 0, venueLongitude: 0, eventZip: '7000', eventCity: 'EISENSTADT' })] }];
    const ev = parseEventimFeed(s, NOW)[0];
    expect(ev.latitude).toBeUndefined();
    expect(ev.longitude).toBeUndefined();
    expect(ev.coords_precision).toBeUndefined();
    expect(ev.postal_code).toBe('7000');
    expect(ev.city).toBe('EISENSTADT');
    expect(ev.bundesland).toBe('burgenland');
  });

  it('drops Eventim blank.gif placeholder images', () => {
    const s: EventimSeries[] = [{ esId: 'S', esName: 'X', esCategories: [{ category: '1A' }],
      esPictureBig: 'https://www.oeticket.com/obj/media/AT-eventim/teaser/blank.gif',
      events: [baseEvent({ eventId: 'P' })] }];
    expect(parseEventimFeed(s, NOW)[0].image_url).toBeUndefined();
  });
});

describe('parseEventimFeed: Platzhalter-Koordinaten des Feeds (fn-25)', () => {
  const placeholder: EventimSeries[] = [{
    esId: 'S2', esName: 'Wien Abende', esText: '', esPictureBig: undefined as unknown as string, esCategories: [{ category: '1A' }],
    events: [
      baseEvent({ eventId: 'W1', eventVenue: 'Royal Vienna Hall', eventVenueId: '385010', eventStreet: 'Mariahilfer Straße 1', eventZip: '1060', venueLatitude: 48.209, venueLongitude: 16.37 }),
      baseEvent({ eventId: 'W2', eventVenue: 'Mirage', eventVenueId: '507152', eventStreet: 'Praterstraße 2', eventZip: '1020', venueLatitude: 48.209, venueLongitude: 16.37 }),
      baseEvent({ eventId: 'W3', eventVenue: 'Bolena', eventVenueId: '523095', eventStreet: 'Josefstädter Straße 3', eventZip: '1080', venueLatitude: 48.209, venueLongitude: 16.37 }),
      baseEvent({ eventId: 'M1', eventVenue: 'Musikverein Wien', eventVenueId: '201', eventStreet: 'Musikvereinsplatz 1', eventZip: '1010', venueLatitude: 48.20044, venueLongitude: 16.37068 }),
      baseEvent({ eventId: 'M2', eventVenue: 'Musikverein Wien, Brahms-Saal', eventVenueId: '202', eventStreet: 'Musikvereinsplatz 1', eventZip: '1010', venueLatitude: 48.20044, venueLongitude: 16.37068 }),
      baseEvent({ eventId: 'M3', eventVenue: 'Musikverein Wien, Großer Saal', eventVenueId: '203', eventStreet: 'Bösendorferstraße 12', eventZip: '1010', venueLatitude: 48.20044, venueLongitude: 16.37068 }),
    ],
  }];
  const out = parseEventimFeed(placeholder, NOW);

  it('Stadtmittelpunkt für drei Spielstätten in drei Straßen → municipality, Koordinate und Venue-Kennung bleiben', () => {
    for (const id of ['W1', 'W2', 'W3']) {
      const e = out.find(x => x.source_id === id)!;
      expect(e.coords_precision).toBe('municipality');
      expect(e.latitude).toBe(48.209);
      expect(e.source_venue_id).toBeDefined();
      expect(e.city).toBe('WIEN');
    }
  });

  it('Säle eines Hauses (zwei Straßenschreibweisen) bleiben Venue-Koordinaten', () => {
    for (const id of ['M1', 'M2', 'M3']) expect(out.find(x => x.source_id === id)!.coords_precision).toBe('venue');
  });
});

describe('parseEventimFeed: Serien-Künstler je Event (fn-30)', () => {
  const artist = (over: Partial<EventimArtist> = {}): EventimArtist => ({
    artistId: 'ART-1', artistName: 'Bilderbuch', artistImage: 'https://img/bilderbuch.jpg',
    evoLink: 'https://www.oeticket.com/artist/bilderbuch/?affiliate=J70', ...over,
  });
  const feed: EventimSeries[] = [
    {
      esId: 'S1', esName: 'Tour', esCategories: [{ category: '1A' }],
      artists: [
        artist(),
        artist({ artistId: 'ART-2', artistName: '  Wanda ', artistImage: undefined, evoLink: undefined }),
        artist({ artistId: 'ART-3', artistName: '   ' }),          // leerer Name: verworfen
        artist({ artistId: '', artistName: 'Ohne ID' }),           // leere ID: verworfen (Primärschlüssel)
        artist({ artistId: 'ART-1', artistName: 'Bilderbuch (Dublette)' }), // zweite Zeile derselben ID
      ],
      events: [
        baseEvent({ eventId: 'K1' }),
        baseEvent({ eventId: 'K2', eventCountry: 'DE' }),
        baseEvent({ eventId: 'K-PAST', eventDateIso8601: '2020-01-01T20:00:00.000+01:00' }),
      ],
    },
    { esId: 'S2', esName: 'Ohne Künstler', esCategories: [{ category: '1A' }], events: [baseEvent({ eventId: 'N1' })] },
    { esId: 'S3', esName: 'Nur leere', esCategories: [{ category: '1A' }], artists: [artist({ artistName: '' })], events: [baseEvent({ eventId: 'N2' })] },
  ];

  it('liefert je übernommenem Event die bereinigten Serien-Künstler, auch für DE', () => {
    const artists: EventimArtistsByEvent = new Map();
    const out = parseEventimFeed(feed, NOW, undefined, artists);
    expect(out.map((e) => e.source_id).sort()).toEqual(['K1', 'K2', 'N1', 'N2']);
    expect([...artists.keys()].sort()).toEqual(['K1', 'K2']);
    expect(artists.get('K1')).toEqual([
      { artistId: 'ART-1', artistName: 'Bilderbuch', artistImage: 'https://img/bilderbuch.jpg', evoLink: 'https://www.oeticket.com/artist/bilderbuch/?affiliate=J70' },
      { artistId: 'ART-2', artistName: 'Wanda', artistImage: undefined, evoLink: undefined },
    ]);
    expect(artists.get('K2')).toEqual(artists.get('K1'));
  });

  it('Serien ohne Künstler und verworfene Events liefern keinen Eintrag', () => {
    const artists: EventimArtistsByEvent = new Map();
    parseEventimFeed(feed, NOW, undefined, artists);
    expect(artists.has('N1')).toBe(false);
    expect(artists.has('N2')).toBe(false);
    expect(artists.has('K-PAST')).toBe(false);
    expect(seriesArtists(feed[1])).toEqual([]);
  });

  it('ScrapedEvent bleibt unverändert: kein Künstler-Feld, gleiche Zeilen mit und ohne Sammler', () => {
    const artists: EventimArtistsByEvent = new Map();
    const withCollector = parseEventimFeed(feed, NOW, undefined, artists);
    const without = parseEventimFeed(feed, NOW);
    expect(withCollector).toEqual(without);
    for (const e of withCollector) expect(Object.keys(e)).not.toContain('artists');
  });
});
