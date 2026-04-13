/**
 * Shutdown Festival Lineup Scraper
 *
 * Source: https://www.shutdownfestival.at/en/line-up/
 * Structure: Grid of linked artist cards in A-Z order.
 *   <a href="/line-up/[artist-slug]/">
 *     <img src="..." alt="[Artist Name]">
 *     [Artist Name]
 *   </a>
 * No JSON-LD performer data available (only WebPage schema).
 * No day/stage divisions in the HTML.
 *
 * Note: Shutdown shares a platform with Electric Love (same WordPress + Barba.js
 * setup), but unlike Electric Love, the lineup is rendered server-side.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

export class ShutdownLineupScraper extends BaseLineupScraper {
  readonly name = 'ShutdownLineup';
  readonly festivalSlug = 'shutdown';
  readonly lineupUrl = 'https://www.shutdownfestival.at/en/line-up/';

  scrapeLineup(html: string): FestivalArtist[] {
    // 1. Try JSON-LD first (spec requirement)
    const jsonLdNames = this.extractFromJsonLd(html);
    if (jsonLdNames.length > 0) {
      this.log(`Found ${jsonLdNames.length} artists via JSON-LD`);
      const artists: FestivalArtist[] = [];
      for (const name of jsonLdNames) {
        artists.push(
          ...this.processArtistName(name, {
            dayLabel: null,
            stageName: null,
            billing: null,
          })
        );
      }
      return this.deduplicateArtists(artists);
    }

    // 2. HTML fallback
    this.log('No JSON-LD found, falling back to HTML selectors');
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];

    // Shutdown uses <a href="/line-up/[slug]/"> links.
    // Each contains an <img alt="Artist Name"> and bare text with the artist name.
    $('a[href*="/line-up/"]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';

      // Filter to individual artist pages (not the lineup index itself)
      // Match: /line-up/some-slug/ but not /line-up/ or /en/line-up/
      if (!href.match(/\/line-up\/[^/]+\/?$/) || href.endsWith('/line-up/')) {
        return;
      }

      // Also skip links to the line-up page itself (language variants)
      if (
        href.endsWith('/en/line-up/') ||
        href.endsWith('/de/line-up/') ||
        href === '/line-up/'
      ) {
        return;
      }

      // Extract artist name from alt text or link text
      const imgAlt = $link.find('img').first().attr('alt')?.trim() || '';

      // Get text content excluding image elements
      const $clone = $link.clone();
      $clone.find('img, picture, figure, svg').remove();
      const textContent = $clone.text().trim();

      // Prefer the visible text; fall back to img alt
      const artistName = textContent || imgAlt;

      if (!artistName) return;

      // Skip navigation/UI-related links that might match the pattern
      if (
        artistName.toLowerCase() === 'line-up' ||
        artistName.toLowerCase() === 'lineup' ||
        artistName.toLowerCase() === 'full line-up'
      ) {
        return;
      }

      artists.push(
        ...this.processArtistName(artistName, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });

    this.log(`Parsed ${artists.length} artists from HTML`);
    return this.deduplicateArtists(artists);
  }
}
