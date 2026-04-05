/**
 * Tests for RegistryBasedScraper — the venue feed ingestion orchestrator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ingestVenueFeed,
  slugify,
} from '@/lib/scrapers/RegistryBasedScraper';
import type { Venue } from '@/types/venues';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: 'venue-001',
    name: 'Test Bar',
    name_normalized: 'test bar',
    type: 'bar',
    subtype: null,
    address: 'Testgasse 1',
    postal_code: '1010',
    city: 'Wien',
    bundesland: 'Wien',
    latitude: 48.2082,
    longitude: 16.3738,
    website: 'https://testbar.at',
    facebook_url: null,
    instagram_url: null,
    event_feed_url: null,
    event_feed_type: null,
    osm_id: null,
    osm_tags: null,
    registry_source: 'osm',
    is_student_relevant: false,
    localness_score: 50,
    last_scraped_at: null,
    scrape_status: 'pending',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('should convert venue name to URL-safe slug', () => {
    expect(slugify('Bier Bar')).toBe('bier-bar');
  });

  it('should handle German umlauts', () => {
    expect(slugify('Gasthof Grüner Baum')).toBe('gasthof-gruener-baum');
    expect(slugify('Café Bräunerhof')).toBe('caf-braeunerhof');
    expect(slugify('Heuriger Müllers Schänke')).toBe(
      'heuriger-muellers-schaenke'
    );
  });

  it('should handle ß', () => {
    expect(slugify('Straßenbahn')).toBe('strassenbahn');
  });

  it('should truncate to 60 chars', () => {
    const long = 'A'.repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it('should strip leading/trailing hyphens', () => {
    expect(slugify('  --Test--  ')).toBe('test');
  });
});

// ── ingestVenueFeed ──────────────────────────────────────────────────────────

describe('ingestVenueFeed', () => {
  it('should return error for venue with no feed URL', async () => {
    const venue = makeVenue({ event_feed_url: null, event_feed_type: null });
    const { events, errors } = await ingestVenueFeed(venue);
    expect(events).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('no feed URL');
  });

  it('should return error for unsupported feed type html', async () => {
    const venue = makeVenue({
      event_feed_url: 'https://example.com/events',
      event_feed_type: 'html',
    });
    const { events, errors } = await ingestVenueFeed(venue);
    expect(events).toHaveLength(0);
    expect(errors.some((e) => e.includes('not supported'))).toBe(true);
  });

  it('should return error for unsupported feed type api', async () => {
    const venue = makeVenue({
      event_feed_url: 'https://example.com/api/events',
      event_feed_type: 'api',
    });
    const { events, errors } = await ingestVenueFeed(venue);
    expect(events).toHaveLength(0);
    expect(errors.some((e) => e.includes('not supported'))).toBe(true);
  });

  it('should return error for rss feed type (not yet implemented)', async () => {
    const venue = makeVenue({
      event_feed_url: 'https://example.com/events.rss',
      event_feed_type: 'rss',
    });
    const { events, errors } = await ingestVenueFeed(venue);
    expect(events).toHaveLength(0);
    expect(errors.some((e) => e.includes('not yet implemented'))).toBe(true);
  });

  it('should handle fetch errors gracefully for ICS', async () => {
    // Mock global fetch to reject
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    try {
      const venue = makeVenue({
        event_feed_url: 'https://testbar.at/calendar.ics',
        event_feed_type: 'ics',
      });
      const { events, errors } = await ingestVenueFeed(venue);
      expect(events).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Network error');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should handle fetch errors gracefully for JSON-LD', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

    try {
      const venue = makeVenue({
        event_feed_url: 'https://testbar.at/events',
        event_feed_type: 'json-ld',
      });
      const { events, errors } = await ingestVenueFeed(venue);
      expect(events).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should parse ICS feed and attach venue_id', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10).replace(/-/g, '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Test//Test//EN',
      'BEGIN:VEVENT',
      `DTSTART:${dateStr}T200000Z`,
      `DTEND:${dateStr}T230000Z`,
      'SUMMARY:Pub Quiz Night',
      'LOCATION:Test Bar, Wien',
      'UID:test-event-001@testbar.at',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(icsContent, {
        status: 200,
        headers: { 'Content-Type': 'text/calendar' },
      })
    );

    try {
      const venue = makeVenue({
        event_feed_url: 'https://testbar.at/calendar.ics',
        event_feed_type: 'ics',
      });
      const { events, errors } = await ingestVenueFeed(venue);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].title).toBe('Pub Quiz Night');
      expect(events[0].source_name).toBe('registry:test-bar');
      // venue_id is attached as extra property
      expect((events[0] as unknown as Record<string, unknown>).venue_id).toBe('venue-001');
      expect(events[0].bundesland).toBe('Wien');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should parse JSON-LD page and attach venue_id', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    const isoDate = tomorrow.toISOString();

    const html = `
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Event",
          "name": "Live Jazz Night",
          "startDate": "${isoDate}",
          "location": {
            "@type": "Place",
            "name": "Test Bar"
          }
        }
        </script>
      </head>
      <body></body>
      </html>
    `;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    try {
      const venue = makeVenue({
        event_feed_url: 'https://testbar.at/events',
        event_feed_type: 'json-ld',
      });
      const { events, errors } = await ingestVenueFeed(venue);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].title).toBe('Live Jazz Night');
      expect(events[0].source_name).toBe('registry:test-bar');
      expect((events[0] as unknown as Record<string, unknown>).venue_id).toBe('venue-001');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
