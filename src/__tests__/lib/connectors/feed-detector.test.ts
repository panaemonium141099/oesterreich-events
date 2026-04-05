import { describe, it, expect } from 'vitest';
import { detectFeedsFromHtml } from '@/lib/connectors/feed-detector';

const BASE_URL = 'https://example-venue.at';

/** Helper: build a minimal HTML page with custom <head> and <body> content */
function html(headContent: string, bodyContent = ''): string {
  return `<!DOCTYPE html><html><head>${headContent}</head><body>${bodyContent}</body></html>`;
}

describe('Feed Detector', () => {
  describe('detectFeedsFromHtml', () => {
    // ── ICS detection ──────────────────────────────────────────────────

    it('should detect ICS feed from <link type="text/calendar">', () => {
      const page = html(
        '<link rel="alternate" type="text/calendar" href="/events.ics">',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0]).toEqual({
        type: 'ics',
        url: 'https://example-venue.at/events.ics',
        confidence: 'high',
      });
      expect(result.best).toEqual(result.feeds[0]);
    });

    it('should convert webcal:// protocol to https://', () => {
      const page = html(
        '<link rel="alternate" type="text/calendar" href="webcal://example-venue.at/cal.ics">',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0].url).toBe('https://example-venue.at/cal.ics');
      expect(result.feeds[0].type).toBe('ics');
    });

    it('should detect ICS from <a> links with .ics extension (heuristic)', () => {
      const page = html(
        '',
        '<a href="/calendar/export.ics">Download Calendar</a>',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0]).toEqual({
        type: 'ics',
        url: 'https://example-venue.at/calendar/export.ics',
        confidence: 'medium',
      });
    });

    it('should detect ICS from <a> links with format=ical parameter', () => {
      const page = html(
        '',
        '<a href="/events?format=ical">iCal Export</a>',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0].type).toBe('ics');
      expect(result.feeds[0].confidence).toBe('medium');
    });

    it('should not scan <a> links for ICS if <link> ICS already found', () => {
      const page = html(
        '<link rel="alternate" type="text/calendar" href="/main.ics">',
        '<a href="/backup.ics">Backup Cal</a>',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      // Only the <link> feed, not the <a> link
      expect(result.feeds.filter((f) => f.type === 'ics')).toHaveLength(1);
      expect(result.feeds[0].url).toBe('https://example-venue.at/main.ics');
      expect(result.feeds[0].confidence).toBe('high');
    });

    // ── JSON-LD detection ──────────────────────────────────────────────

    it('should detect JSON-LD Event on the page', () => {
      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'Pub Quiz',
        startDate: '2026-05-01T19:00:00+02:00',
      });
      const page = html(`<script type="application/ld+json">${jsonLd}</script>`);
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.jsonLdBlocksFound).toBe(1);
      expect(result.hasJsonLdEvents).toBe(true);
      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0]).toEqual({
        type: 'json-ld',
        url: BASE_URL,
        confidence: 'high',
      });
    });

    it('should detect Event inside @graph array', () => {
      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'BreadcrumbList', itemListElement: [] },
          {
            '@type': 'MusicEvent',
            name: 'Jazz Night',
            startDate: '2026-06-15T20:00:00+02:00',
          },
        ],
      });
      const page = html(`<script type="application/ld+json">${jsonLd}</script>`);
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.hasJsonLdEvents).toBe(true);
      expect(result.feeds.some((f) => f.type === 'json-ld')).toBe(true);
    });

    it('should not detect JSON-LD for non-Event types (Organization, BreadcrumbList)', () => {
      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Example Bar',
        url: 'https://example-venue.at',
      });
      const page = html(`<script type="application/ld+json">${jsonLd}</script>`);
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.jsonLdBlocksFound).toBe(1);
      expect(result.hasJsonLdEvents).toBe(false);
      expect(result.feeds).toHaveLength(0);
    });

    it('should handle malformed JSON-LD gracefully', () => {
      const page = html(
        '<script type="application/ld+json">{not valid json}</script>',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.jsonLdBlocksFound).toBe(1);
      expect(result.hasJsonLdEvents).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to parse JSON-LD');
    });

    // ── RSS/Atom detection ─────────────────────────────────────────────

    it('should detect RSS feed from <link type="application/rss+xml">', () => {
      const page = html(
        '<link rel="alternate" type="application/rss+xml" title="Events Feed" href="/feed/events.rss">',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0]).toEqual({
        type: 'rss',
        url: 'https://example-venue.at/feed/events.rss',
        confidence: 'high',
      });
    });

    it('should detect Atom feed from <link type="application/atom+xml">', () => {
      const page = html(
        '<link rel="alternate" type="application/atom+xml" title="Veranstaltungen" href="/atom.xml">',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0].type).toBe('rss');
      expect(result.feeds[0].confidence).toBe('high');
    });

    it('should assign medium confidence to RSS without event-related title', () => {
      const page = html(
        '<link rel="alternate" type="application/rss+xml" title="Blog" href="/blog.rss">',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds).toHaveLength(1);
      expect(result.feeds[0].confidence).toBe('medium');
    });

    it('should assign high confidence to RSS with event-related title keywords', () => {
      const cases = ['Events RSS', 'Veranstaltungen', 'Termine', 'Kalender', 'Calendar', 'Programm'];
      for (const title of cases) {
        const page = html(
          `<link rel="alternate" type="application/rss+xml" title="${title}" href="/feed.rss">`,
        );
        const result = detectFeedsFromHtml(page, BASE_URL);
        expect(result.feeds[0].confidence).toBe('high');
      }
    });

    // ── Priority ordering ──────────────────────────────────────────────

    it('should prioritize ICS > JSON-LD > RSS', () => {
      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'Test',
        startDate: '2026-05-01',
      });
      const page = html(
        [
          '<link rel="alternate" type="application/rss+xml" href="/feed.rss">',
          `<script type="application/ld+json">${jsonLd}</script>`,
          '<link rel="alternate" type="text/calendar" href="/events.ics">',
        ].join('\n'),
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds.length).toBeGreaterThanOrEqual(3);
      // Best should be ICS
      expect(result.best!.type).toBe('ics');
      // Check order
      const types = result.feeds.map((f) => f.type);
      const icsIdx = types.indexOf('ics');
      const jsonLdIdx = types.indexOf('json-ld');
      const rssIdx = types.indexOf('rss');
      expect(icsIdx).toBeLessThan(jsonLdIdx);
      expect(jsonLdIdx).toBeLessThan(rssIdx);
    });

    // ── Edge cases ─────────────────────────────────────────────────────

    it('should return empty result for page with no feeds', () => {
      const page = html('<title>A Bar</title>', '<p>Welcome to our bar!</p>');
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds).toHaveLength(0);
      expect(result.best).toBeNull();
      expect(result.hasJsonLdEvents).toBe(false);
      expect(result.jsonLdBlocksFound).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty HTML', () => {
      const result = detectFeedsFromHtml('', BASE_URL);
      expect(result.feeds).toHaveLength(0);
      expect(result.best).toBeNull();
    });

    it('should resolve relative URLs against the base URL', () => {
      const page = html(
        '<link rel="alternate" type="text/calendar" href="calendar.ics">',
      );
      const result = detectFeedsFromHtml(page, 'https://example-venue.at/events/');

      expect(result.feeds[0].url).toBe('https://example-venue.at/events/calendar.ics');
    });

    it('should handle absolute feed URLs', () => {
      const page = html(
        '<link rel="alternate" type="text/calendar" href="https://calendar.example.com/venue.ics">',
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      expect(result.feeds[0].url).toBe('https://calendar.example.com/venue.ics');
    });

    it('should deduplicate ICS feeds found via webcal:// link tag', () => {
      const page = html(
        [
          '<link rel="alternate" type="text/calendar" href="webcal://example-venue.at/cal.ics">',
          '<link href="webcal://example-venue.at/cal.ics">',
        ].join('\n'),
      );
      const result = detectFeedsFromHtml(page, BASE_URL);

      const icsFeeds = result.feeds.filter((f) => f.type === 'ics');
      expect(icsFeeds).toHaveLength(1);
    });

    it('should detect multiple Event subtypes in JSON-LD', () => {
      const subtypes = ['MusicEvent', 'SportsEvent', 'TheaterEvent', 'Festival', 'Hackathon'];
      for (const subtype of subtypes) {
        const jsonLd = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': subtype,
          name: 'Test Event',
          startDate: '2026-05-01',
        });
        const page = html(`<script type="application/ld+json">${jsonLd}</script>`);
        const result = detectFeedsFromHtml(page, BASE_URL);
        expect(result.hasJsonLdEvents).toBe(true);
      }
    });

    it('should handle array @type in JSON-LD', () => {
      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': ['Event', 'SocialEvent'],
        name: 'Meetup',
        startDate: '2026-05-01',
      });
      const page = html(`<script type="application/ld+json">${jsonLd}</script>`);
      const result = detectFeedsFromHtml(page, BASE_URL);
      expect(result.hasJsonLdEvents).toBe(true);
    });
  });
});
