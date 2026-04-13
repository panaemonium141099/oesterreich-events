/**
 * Tests for BaseLineupScraper and lineup types.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

import { describe, it, expect } from 'vitest';
import { BaseLineupScraper } from '@/lib/lineup/BaseLineupScraper';
import type { FestivalArtist } from '@/lib/lineup/types';

// Concrete test implementation of BaseLineupScraper
class TestLineupScraper extends BaseLineupScraper {
  readonly name = 'TestScraper';
  readonly festivalSlug = 'test-festival';
  readonly lineupUrl = 'https://example.com/lineup';

  // Make protected methods public for testing
  public testProcessArtistName = this.processArtistName.bind(this);
  public testDeduplicateArtists = this.deduplicateArtists.bind(this);
  public testExtractFromJsonLd = this.extractFromJsonLd.bind(this);
  public testLoadHtml = this.loadHtml.bind(this);

  scrapeLineup(_html: string): FestivalArtist[] {
    return [];
  }
}

describe('BaseLineupScraper', () => {
  const scraper = new TestLineupScraper();

  describe('processArtistName', () => {
    it('returns a single FestivalArtist for a simple name', () => {
      const result = scraper.testProcessArtistName('Metallica', {
        dayLabel: 'Friday',
        stageName: 'Mainstage',
        billing: 'headliner',
      });

      expect(result).toHaveLength(1);
      expect(result[0].artist_name_raw).toBe('Metallica');
      expect(result[0].artist_name_normalized).toBe('metallica');
      expect(result[0].day_label).toBe('Friday');
      expect(result[0].stage_name).toBe('Mainstage');
      expect(result[0].billing).toBe('headliner');
      expect(result[0].source_type).toBe('official_lineup');
      expect(result[0].confidence_score).toBe(1.0);
    });

    it('splits collaborative bookings (b2b)', () => {
      const result = scraper.testProcessArtistName('DJ A b2b DJ B', {
        dayLabel: null,
        stageName: null,
        billing: null,
      });

      expect(result).toHaveLength(2);
      expect(result[0].artist_name_normalized).toBe('dj a');
      expect(result[1].artist_name_normalized).toBe('dj b');
    });

    it('splits collaborative bookings (vs.)', () => {
      const result = scraper.testProcessArtistName('Artist One vs. Artist Two', {
        dayLabel: 'Saturday',
        stageName: null,
        billing: null,
      });

      expect(result).toHaveLength(2);
      expect(result[0].artist_name_normalized).toBe('artist one');
      expect(result[1].artist_name_normalized).toBe('artist two');
      expect(result[0].day_label).toBe('Saturday');
      expect(result[1].day_label).toBe('Saturday');
    });

    it('does not split known ampersand bands', () => {
      const result = scraper.testProcessArtistName('Above & Beyond', {
        dayLabel: null,
        stageName: null,
        billing: null,
      });

      expect(result).toHaveLength(1);
      expect(result[0].artist_name_normalized).toBe('above & beyond');
    });

    it('strips performance modifiers before splitting', () => {
      const result = scraper.testProcessArtistName('DJ A b2b DJ B (DJ Set)', {
        dayLabel: null,
        stageName: null,
        billing: null,
      });

      expect(result).toHaveLength(2);
      expect(result[0].artist_name_normalized).toBe('dj a');
      expect(result[1].artist_name_normalized).toBe('dj b');
    });

    it('strips diacritics in normalized name', () => {
      const result = scraper.testProcessArtistName('Wanda (Live)', {
        dayLabel: null,
        stageName: null,
        billing: null,
      });

      expect(result).toHaveLength(1);
      expect(result[0].artist_name_normalized).toBe('wanda');
    });

    it('preserves source_url from scraper lineupUrl', () => {
      const result = scraper.testProcessArtistName('Test Artist', {
        dayLabel: null,
        stageName: null,
        billing: null,
      });

      expect(result[0].source_url).toBe('https://example.com/lineup');
    });
  });

  describe('deduplicateArtists', () => {
    it('removes duplicate normalized names', () => {
      const artists: FestivalArtist[] = [
        {
          artist_name_raw: 'Metallica',
          artist_name_normalized: 'metallica',
          day_label: 'Friday',
          stage_name: 'Mainstage',
          billing: 'headliner',
          source_url: 'https://example.com',
          source_type: 'official_lineup',
          confidence_score: 1.0,
        },
        {
          artist_name_raw: 'METALLICA',
          artist_name_normalized: 'metallica',
          day_label: 'Saturday',
          stage_name: 'Tent',
          billing: null,
          source_url: 'https://example.com',
          source_type: 'official_lineup',
          confidence_score: 1.0,
        },
      ];

      const result = scraper.testDeduplicateArtists(artists);
      expect(result).toHaveLength(1);
      expect(result[0].day_label).toBe('Friday'); // keeps first
    });

    it('keeps distinct artists', () => {
      const artists: FestivalArtist[] = [
        {
          artist_name_raw: 'Artist A',
          artist_name_normalized: 'artist a',
          day_label: null,
          stage_name: null,
          billing: null,
          source_url: 'https://example.com',
          source_type: 'official_lineup',
          confidence_score: 1.0,
        },
        {
          artist_name_raw: 'Artist B',
          artist_name_normalized: 'artist b',
          day_label: null,
          stage_name: null,
          billing: null,
          source_url: 'https://example.com',
          source_type: 'official_lineup',
          confidence_score: 1.0,
        },
      ];

      const result = scraper.testDeduplicateArtists(artists);
      expect(result).toHaveLength(2);
    });
  });

  describe('extractFromJsonLd', () => {
    it('extracts performer names from MusicEvent JSON-LD', () => {
      const html = `
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "MusicEvent",
            "name": "Test Festival",
            "performer": [
              {"@type": "MusicGroup", "name": "Band One"},
              {"@type": "MusicGroup", "name": "Band Two"},
              {"@type": "Person", "name": "Solo Artist"}
            ]
          }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = scraper.testExtractFromJsonLd(html);
      expect(result).toEqual(['Band One', 'Band Two', 'Solo Artist']);
    });

    it('handles @graph structure', () => {
      const html = `
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Event",
                "name": "Festival",
                "performer": [
                  {"@type": "MusicGroup", "name": "Artist X"}
                ]
              }
            ]
          }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = scraper.testExtractFromJsonLd(html);
      expect(result).toEqual(['Artist X']);
    });

    it('handles string performers', () => {
      const html = `
        <html>
        <head>
          <script type="application/ld+json">
          {
            "@type": "Event",
            "performer": ["Band A", "Band B"]
          }
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = scraper.testExtractFromJsonLd(html);
      expect(result).toEqual(['Band A', 'Band B']);
    });

    it('returns empty array for non-event JSON-LD', () => {
      const html = `
        <html>
        <head>
          <script type="application/ld+json">
          {"@type": "WebPage", "name": "Test"}
          </script>
        </head>
        <body></body>
        </html>
      `;

      const result = scraper.testExtractFromJsonLd(html);
      expect(result).toEqual([]);
    });

    it('returns empty array for invalid JSON', () => {
      const html = `
        <html>
        <head>
          <script type="application/ld+json">not valid json{</script>
        </head>
        <body></body>
        </html>
      `;

      const result = scraper.testExtractFromJsonLd(html);
      expect(result).toEqual([]);
    });
  });
});
