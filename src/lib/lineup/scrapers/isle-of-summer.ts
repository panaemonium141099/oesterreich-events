/**
 * Isle of Summer Festival Lineup Scraper
 *
 * Source: https://www.isleofsummer.at/
 * Structure: Homepage with lineup section. Artists are typically listed
 *   as headings, images with alt text, or linked artist cards.
 *   The lineup may also appear in JSON-LD structured data.
 *
 * Location: Graz, Steiermark
 * Genre: Urban / Hip-Hop / Electronic
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.5
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

export class IsleOfSummerLineupScraper extends BaseLineupScraper {
  readonly name = 'IsleOfSummerLineup';
  readonly festivalSlug = 'isle-of-summer';
  readonly lineupUrl = 'https://www.isleofsummer.at/';

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

    // Strategy A: Look for a lineup section with artist headings or cards.
    // Common patterns: .lineup, #lineup, [data-section="lineup"],
    // section containing "lineup" in class or id.
    const lineupSection =
      $('section[id*="lineup" i], section[class*="lineup" i], ' +
        'div[id*="lineup" i], div[class*="lineup" i], ' +
        '#lineup, .lineup, [data-section="lineup"]');

    if (lineupSection.length > 0) {
      this.log(`Found lineup section(s): ${lineupSection.length}`);
      this.extractFromSection($, lineupSection, artists);
    }

    // Strategy B: Look for artist-specific links or cards anywhere on the page
    if (artists.length === 0) {
      this.log('No lineup section found, trying artist links/cards');
      this.extractFromArtistLinks($, artists);
    }

    // Strategy C: Fallback to heading-based extraction in the page body
    if (artists.length === 0) {
      this.log('No artist links found, trying heading-based extraction');
      this.extractFromHeadings($, artists);
    }

    this.log(`Parsed ${artists.length} artists from HTML`);
    return this.deduplicateArtists(artists);
  }

  /**
   * Extract artists from a lineup section container.
   */
  private extractFromSection(
    $: ReturnType<typeof this.loadHtml>,
    $section: ReturnType<ReturnType<typeof this.loadHtml>>,
    artists: FestivalArtist[]
  ): void {
    // Look for headings, linked items, or grid/list items within the section
    $section.find('h2, h3, h4').each((_, el) => {
      const name = $(el).text().trim();
      if (!name || name.toLowerCase().includes('lineup')) return;
      // Skip very long text that is likely a description not an artist name
      if (name.length > 80) return;

      artists.push(
        ...this.processArtistName(name, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });

    // Also check linked images with alt text
    if (artists.length === 0) {
      $section.find('a img[alt]').each((_, el) => {
        const alt = $(el).attr('alt')?.trim();
        if (!alt || alt.length > 80 || alt.toLowerCase().includes('logo')) return;

        artists.push(
          ...this.processArtistName(alt, {
            dayLabel: null,
            stageName: null,
            billing: null,
          })
        );
      });
    }
  }

  /**
   * Extract from artist-specific links across the page.
   */
  private extractFromArtistLinks(
    $: ReturnType<typeof this.loadHtml>,
    artists: FestivalArtist[]
  ): void {
    $('a[href*="/artist/"], a[href*="/kuenstler/"]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';
      if (!href.match(/\/(artist|kuenstler)\/[^/]+\/?$/)) return;

      const artistName =
        $link.find('h3, h2, h4').first().text().trim() ||
        $link.find('img').first().attr('alt')?.trim() ||
        $link.text().trim();

      if (!artistName || artistName.length > 80) return;

      artists.push(
        ...this.processArtistName(artistName, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });
  }

  /**
   * Fallback: Extract artist names from prominent headings.
   * Looks for heading clusters that likely represent a lineup list.
   */
  private extractFromHeadings(
    $: ReturnType<typeof this.loadHtml>,
    artists: FestivalArtist[]
  ): void {
    // Look for consecutive h2/h3 elements that are likely artist names
    // (short text, no common section titles like "Tickets", "Info", etc.)
    const skipWords = new Set([
      'lineup', 'line-up', 'tickets', 'info', 'anreise', 'kontakt',
      'impressum', 'datenschutz', 'partner', 'sponsoren', 'news',
      'gallery', 'galerie', 'programm', 'stages', 'camping',
      'about', 'newsletter', 'faq', 'shop', 'merch',
    ]);

    $('h2, h3').each((_, el) => {
      const name = $(el).text().trim();
      if (!name || name.length > 60) return;
      if (skipWords.has(name.toLowerCase())) return;
      // Skip if it looks like a date or section title
      if (/^\d{1,2}\.\s/.test(name)) return;

      artists.push(
        ...this.processArtistName(name, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });
  }
}
