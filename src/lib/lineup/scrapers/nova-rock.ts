/**
 * Nova Rock Festival Lineup Scraper
 *
 * Source: https://www.novarock.at/lineup/
 * Structure: WordPress with custom Mainstage blocks.
 *   - Day tabs link to #tab-YYYY-MM-DD anchors
 *   - Artist cards use .wp-block-mainstage-artist-card with <a href="/artist/...">, <img>, <h3>
 *   - Lineup container: .wp-block-mainstage-lineup
 * No JSON-LD performer data available.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

export class NovaRockLineupScraper extends BaseLineupScraper {
  readonly name = 'NovaRockLineup';
  readonly festivalSlug = 'nova-rock';
  readonly lineupUrl = 'https://www.novarock.at/lineup/';

  scrapeLineup(html: string): FestivalArtist[] {
    // 1. Try JSON-LD first
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

    // Try the custom Mainstage WordPress blocks first
    const artistCards = $('.wp-block-mainstage-artist-card');

    if (artistCards.length > 0) {
      this.log(
        `Found ${artistCards.length} artist cards via .wp-block-mainstage-artist-card`
      );

      // Build a map of day sections. Day tabs use #tab-YYYY-MM-DD anchors.
      // Artist cards inside each section inherit the day label.
      artistCards.each((_, el) => {
        const $card = $(el);
        const $link = $card.find('a[href*="/artist/"]').first();

        // Artist name from heading or link text
        const artistName =
          $card.find('h3').first().text().trim() ||
          $card.find('h2').first().text().trim() ||
          $link.text().trim() ||
          $card.find('img').first().attr('alt')?.trim() ||
          '';

        if (!artistName) return;

        // Try to determine which day section this card belongs to.
        // Walk up the DOM looking for a section with an id matching tab-YYYY-MM-DD
        const dayLabel = this.findDayLabel($, $card);

        artists.push(
          ...this.processArtistName(artistName, {
            dayLabel,
            stageName: null,
            billing: null,
          })
        );
      });
    } else {
      // Fallback: generic artist links
      this.log(
        'No .wp-block-mainstage-artist-card found, trying generic artist links'
      );

      $('a[href*="/artist/"]').each((_, el) => {
        const $link = $(el);
        const href = $link.attr('href') || '';
        if (!href.match(/\/artist\/[^/]+\/?$/)) return;

        // Artist name from heading inside the link, or alt text, or link text
        const artistName =
          $link.find('h3, h2').first().text().trim() ||
          $link.find('img').first().attr('alt')?.trim() ||
          $link.text().trim();

        if (!artistName) return;

        const dayLabel = this.findDayLabel($, $link);

        artists.push(
          ...this.processArtistName(artistName, {
            dayLabel,
            stageName: null,
            billing: null,
          })
        );
      });
    }

    this.log(`Parsed ${artists.length} artists from HTML`);
    return this.deduplicateArtists(artists);
  }

  /**
   * Walk up the DOM from an element to find the enclosing day section.
   * Looks for parent elements with id matching "tab-YYYY-MM-DD" or
   * data attributes indicating a day.
   */
  private findDayLabel(
    $: ReturnType<typeof this.loadHtml>,
    $el: ReturnType<ReturnType<typeof this.loadHtml>>
  ): string | null {
    // Check parent elements for tab IDs
    const $parents = $el.parents('[id^="tab-"]');
    if ($parents.length > 0) {
      const tabId = $parents.first().attr('id') || '';
      // Extract date from "tab-2026-06-11" -> "2026-06-11"
      const dateMatch = tabId.match(/tab-(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) return dateMatch[1];
    }

    // Also check for a preceding day header
    const $section = $el.closest('section, div[class*="lineup"]');
    if ($section.length > 0) {
      const sectionId = $section.attr('id') || '';
      const dateMatch = sectionId.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) return dateMatch[1];
    }

    return null;
  }
}
