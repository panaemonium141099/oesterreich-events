import { describe, it, expect } from 'vitest';
import { extractEventsFromHtml } from '@/lib/connectors/json-ld-connector';
import type { JsonLdExtractionResult } from '@/lib/connectors/json-ld-connector';

/** Helper: wrap JSON-LD in a minimal HTML page */
function wrapHtml(...jsonLdBlocks: unknown[]): string {
  const scripts = jsonLdBlocks
    .map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`)
    .join('\n');
  return `<html><head>${scripts}</head><body></body></html>`;
}

const PAGE_URL = 'https://example-venue.at/events';

describe('JSON-LD Connector', () => {
  describe('extractEventsFromHtml', () => {
    it('should extract a single direct Event object', () => {
      const html = wrapHtml({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'Pub Quiz Night',
        startDate: '2026-04-10T19:00:00+02:00',
        endDate: '2026-04-10T22:00:00+02:00',
        description: 'Weekly pub quiz at the local bar.',
        location: {
          '@type': 'Place',
          name: 'Beisl am Platz',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Hauptplatz 5',
            postalCode: '1010',
            addressLocality: 'Wien',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: 48.2082,
            longitude: 16.3738,
          },
        },
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.jsonLdBlocksFound).toBe(1);
      expect(result.eventsFound).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const event = result.events[0];
      expect(event.title).toBe('Pub Quiz Night');
      expect(event.start_date).toBe('2026-04-10T19:00:00+02:00');
      expect(event.end_date).toBe('2026-04-10T22:00:00+02:00');
      expect(event.description).toBe('Weekly pub quiz at the local bar.');
      expect(event.location_name).toBe('Beisl am Platz');
      expect(event.address).toBe('Hauptplatz 5, 1010, Wien');
      expect(event.postal_code).toBe('1010');
      expect(event.latitude).toBe(48.2082);
      expect(event.longitude).toBe(16.3738);
      expect(event.source_name).toBe('json-ld:example-venue.at');
    });

    it('should extract Events from @graph array', () => {
      const html = wrapHtml({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: 'Some Org' },
          { '@type': 'BreadcrumbList', itemListElement: [] },
          {
            '@type': 'Event',
            name: 'Jazz Night',
            startDate: '2026-04-15T20:00:00+02:00',
          },
          {
            '@type': 'MusicEvent',
            name: 'DJ Set',
            startDate: '2026-04-16T22:00:00+02:00',
          },
        ],
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.eventsFound).toBe(2);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].title).toBe('Jazz Night');
      expect(result.events[1].title).toBe('DJ Set');
    });

    it('should filter non-Event @types (BreadcrumbList, Organization, etc.)', () => {
      const html = wrapHtml(
        { '@type': 'Organization', name: 'Not an event' },
        { '@type': 'BreadcrumbList', itemListElement: [] },
        { '@type': 'WebPage', name: 'Some Page' },
      );

      const result = extractEventsFromHtml(html, PAGE_URL, null);

      expect(result.jsonLdBlocksFound).toBe(3);
      expect(result.eventsFound).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('should handle array @type with Event included', () => {
      const html = wrapHtml({
        '@type': ['Event', 'MusicEvent'],
        name: 'Multi-type Event',
        startDate: '2026-05-01T18:00:00+02:00',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Multi-type Event');
    });

    it('should extract multiple events from multiple JSON-LD blocks', () => {
      const html = wrapHtml(
        {
          '@type': 'Event',
          name: 'Event One',
          startDate: '2026-04-10T18:00:00+02:00',
        },
        {
          '@type': 'Event',
          name: 'Event Two',
          startDate: '2026-04-11T18:00:00+02:00',
        },
      );

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.jsonLdBlocksFound).toBe(2);
      expect(result.events).toHaveLength(2);
    });

    it('should filter events outside the date window', () => {
      const html = wrapHtml(
        {
          '@type': 'Event',
          name: 'Past Event',
          startDate: '2020-01-01T18:00:00+01:00',
        },
        {
          '@type': 'Event',
          name: 'Future Event',
          startDate: '2026-06-01T18:00:00+02:00',
        },
        {
          '@type': 'Event',
          name: 'Way Future Event',
          startDate: '2030-01-01T18:00:00+01:00',
        },
      );

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.eventsFound).toBe(3);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Future Event');
    });

    it('should use venue data as fallback when JSON-LD location is missing', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'No Location Event',
        startDate: '2026-04-20T20:00:00+02:00',
      });

      const venue = {
        name: 'Test Bar',
        city: 'Graz',
        bundesland: 'Steiermark',
        latitude: 47.0707,
        longitude: 15.4395,
        address: 'Testgasse 1',
        postal_code: '8010',
      };

      const result = extractEventsFromHtml(html, PAGE_URL, venue, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events).toHaveLength(1);
      const event = result.events[0];
      expect(event.location_name).toBe('Test Bar');
      expect(event.latitude).toBe(47.0707);
      expect(event.longitude).toBe(15.4395);
      expect(event.bundesland).toBe('Steiermark');
      expect(event.address).toBe('Testgasse 1');
      expect(event.postal_code).toBe('8010');
    });

    it('should prefer JSON-LD location over venue fallback', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Located Event',
        startDate: '2026-04-20T20:00:00+02:00',
        location: {
          '@type': 'Place',
          name: 'Special Venue',
          address: 'Am Graben 12, Wien',
        },
      });

      const venue = {
        name: 'Default Venue',
        city: 'Graz',
        bundesland: 'Steiermark',
        latitude: 47.0707,
        longitude: 15.4395,
        address: 'Fallback Address',
        postal_code: '8010',
      };

      const result = extractEventsFromHtml(html, PAGE_URL, venue, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].location_name).toBe('Special Venue');
      expect(result.events[0].address).toBe('Am Graben 12, Wien');
      // Venue bundesland still used since JSON-LD has no bundesland
      expect(result.events[0].bundesland).toBe('Steiermark');
    });

    it('should extract price from offers', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Paid Event',
        startDate: '2026-04-20T20:00:00+02:00',
        offers: {
          '@type': 'Offer',
          price: 15.5,
          priceCurrency: 'EUR',
          url: 'https://tickets.example.com/buy',
        },
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].price_text).toBe('15.50 EUR');
      expect(result.events[0].price_min).toBe(15.5);
      expect(result.events[0].ticket_url).toBe('https://tickets.example.com/buy');
    });

    it('should extract price range from multiple offers', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Range Event',
        startDate: '2026-04-20T20:00:00+02:00',
        offers: [
          { '@type': 'Offer', price: 10, priceCurrency: 'EUR' },
          { '@type': 'Offer', price: 25, priceCurrency: 'EUR' },
        ],
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].price_text).toBe('10.00 - 25.00 EUR');
      expect(result.events[0].price_min).toBe(10);
      expect(result.events[0].price_max).toBe(25);
    });

    it('should handle free events (price=0)', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Free Event',
        startDate: '2026-04-20T20:00:00+02:00',
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR' },
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].price_text).toBe('Gratis');
      expect(result.events[0].price_min).toBe(0);
    });

    it('should extract tags from keywords string', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Tagged Event',
        startDate: '2026-04-20T20:00:00+02:00',
        keywords: 'musik, jazz, live',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].tags).toEqual(['musik', 'jazz', 'live']);
    });

    it('should extract tags from keywords array', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Array Tags Event',
        startDate: '2026-04-20T20:00:00+02:00',
        keywords: ['rock', 'concert'],
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].tags).toEqual(['rock', 'concert']);
    });

    it('should extract organizer name', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Organized Event',
        startDate: '2026-04-20T20:00:00+02:00',
        organizer: {
          '@type': 'Organization',
          name: 'Wiener Kulturverein',
        },
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].organizer).toBe('Wiener Kulturverein');
    });

    it('should extract image from ImageObject', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Image Event',
        startDate: '2026-04-20T20:00:00+02:00',
        image: {
          '@type': 'ImageObject',
          url: 'https://example.com/event.jpg',
        },
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].image_url).toBe('https://example.com/event.jpg');
    });

    it('should extract image from string', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'String Image Event',
        startDate: '2026-04-20T20:00:00+02:00',
        image: 'https://example.com/photo.png',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].image_url).toBe('https://example.com/photo.png');
    });

    it('should extract image from array', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Array Image Event',
        startDate: '2026-04-20T20:00:00+02:00',
        image: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].image_url).toBe('https://example.com/img1.jpg');
    });

    it('should skip events without required name field', () => {
      const html = wrapHtml({
        '@type': 'Event',
        startDate: '2026-04-20T20:00:00+02:00',
        description: 'Event with no name',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.eventsFound).toBe(1);
      expect(result.events).toHaveLength(0);
    });

    it('should skip events without required startDate field', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'No Date Event',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.eventsFound).toBe(1);
      expect(result.events).toHaveLength(0);
    });

    it('should handle malformed JSON-LD gracefully', () => {
      const html = `<html><head>
        <script type="application/ld+json">{ invalid json }</script>
        <script type="application/ld+json">${JSON.stringify({
          '@type': 'Event',
          name: 'Valid Event',
          startDate: '2026-04-20T20:00:00+02:00',
        })}</script>
      </head><body></body></html>`;

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.jsonLdBlocksFound).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to parse JSON-LD block');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe('Valid Event');
    });

    it('should respect maxEventsPerPage option', () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        '@type': 'Event',
        name: `Event ${i + 1}`,
        startDate: `2026-04-${10 + i}T18:00:00+02:00`,
      }));

      const html = wrapHtml(...events);

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        maxEventsPerPage: 3,
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.eventsFound).toBe(5);
      expect(result.events).toHaveLength(3);
    });

    it('should handle string location', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'String Location Event',
        startDate: '2026-04-20T20:00:00+02:00',
        location: 'Cafe Central, Wien',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].location_name).toBe('Cafe Central, Wien');
    });

    it('should handle VirtualLocation in location array', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Hybrid Event',
        startDate: '2026-04-20T20:00:00+02:00',
        location: [
          { '@type': 'VirtualLocation', url: 'https://zoom.us/j/123' },
          {
            '@type': 'Place',
            name: 'Physical Venue',
            address: 'Teststr. 1',
          },
        ],
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].location_name).toBe('Physical Venue');
    });

    it('should handle lowPrice/highPrice in AggregateOffer', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Aggregate Offer Event',
        startDate: '2026-04-20T20:00:00+02:00',
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: '5',
          highPrice: '50',
          priceCurrency: 'EUR',
        },
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].price_min).toBe(5);
      expect(result.events[0].price_max).toBe(50);
      expect(result.events[0].price_text).toBe('5.00 - 50.00 EUR');
    });

    it('should extract subEvents', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Festival',
        startDate: '2026-04-20T12:00:00+02:00',
        subEvent: [
          {
            '@type': 'MusicEvent',
            name: 'Opening Act',
            startDate: '2026-04-20T14:00:00+02:00',
          },
          {
            '@type': 'MusicEvent',
            name: 'Headliner',
            startDate: '2026-04-20T20:00:00+02:00',
          },
        ],
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      // Parent + 2 sub-events = 3
      expect(result.eventsFound).toBe(3);
      expect(result.events).toHaveLength(3);
    });

    it('should handle page with no JSON-LD blocks', () => {
      const html = '<html><head></head><body><h1>No JSON-LD here</h1></body></html>';

      const result = extractEventsFromHtml(html, PAGE_URL, null);

      expect(result.jsonLdBlocksFound).toBe(0);
      expect(result.eventsFound).toBe(0);
      expect(result.events).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle geo coordinates as strings', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'String Geo Event',
        startDate: '2026-04-20T20:00:00+02:00',
        location: {
          '@type': 'Place',
          name: 'Test Place',
          geo: {
            '@type': 'GeoCoordinates',
            latitude: '48.2082',
            longitude: '16.3738',
          },
        },
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].latitude).toBe(48.2082);
      expect(result.events[0].longitude).toBe(16.3738);
    });

    it('should set source_name to json-ld:<hostname>', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Source Name Test',
        startDate: '2026-04-20T20:00:00+02:00',
      });

      const result = extractEventsFromHtml(
        html,
        'https://flex.at/programm',
        null,
        { minDate: '2026-04-01', maxDate: '2026-12-31' },
      );

      expect(result.events[0].source_name).toBe('json-ld:flex.at');
    });

    it('should use event URL as source_url when available', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'URL Test Event',
        startDate: '2026-04-20T20:00:00+02:00',
        url: 'https://example.com/events/42',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].source_url).toBe('https://example.com/events/42');
    });

    it('should handle Event subtypes (SportsEvent, TheaterEvent, etc.)', () => {
      const subtypes = ['SportsEvent', 'TheaterEvent', 'DanceEvent', 'EducationEvent', 'Festival'];

      for (const subtype of subtypes) {
        const html = wrapHtml({
          '@type': subtype,
          name: `${subtype} Test`,
          startDate: '2026-04-20T20:00:00+02:00',
        });

        const result = extractEventsFromHtml(html, PAGE_URL, null, {
          minDate: '2026-04-01',
          maxDate: '2026-12-31',
        });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].title).toBe(`${subtype} Test`);
      }
    });

    it('should strip HTML from descriptions', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'HTML Desc Event',
        startDate: '2026-04-20T20:00:00+02:00',
        description: '<p>A <strong>great</strong> event with <a href="#">links</a>.</p>',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].description).toBe('A great event with links.');
    });

    it('should add online tag for OnlineEventAttendanceMode', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Online Event',
        startDate: '2026-04-20T20:00:00+02:00',
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].tags).toContain('online');
    });

    it('should handle organizer as array', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'Multi Org Event',
        startDate: '2026-04-20T20:00:00+02:00',
        organizer: [
          { '@type': 'Organization', name: 'First Org' },
          { '@type': 'Organization', name: 'Second Org' },
        ],
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      // Takes the first organizer
      expect(result.events[0].organizer).toBe('First Org');
    });

    it('should handle organizer as plain string', () => {
      const html = wrapHtml({
        '@type': 'Event',
        name: 'String Org Event',
        startDate: '2026-04-20T20:00:00+02:00',
        organizer: 'Simple Org Name',
      });

      const result = extractEventsFromHtml(html, PAGE_URL, null, {
        minDate: '2026-04-01',
        maxDate: '2026-12-31',
      });

      expect(result.events[0].organizer).toBe('Simple Org Name');
    });
  });
});
