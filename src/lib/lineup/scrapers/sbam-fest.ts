/**
 * SBAM Fest Lineup Scraper
 *
 * Source: https://fest.sbam.rocks/
 * Structure: The SBAM Fest homepage or lineup page lists punk/hardcore/
 *   ska/indie bands. SBAM (Scheiss Bock Auf Morgen) is a DIY punk
 *   label that also runs a festival.
 *
 * Location: Wieselburg, Niederösterreich
 * Genre: Punk / Hardcore / Ska / Indie
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.5
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

export class SbamFestLineupScraper extends BaseLineupScraper {
  readonly name = 'SbamFestLineup';
  readonly festivalSlug = 'sbam-fest';
  readonly lineupUrl = 'https://fest.sbam.rocks/';

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

    // Strategy A: Look for a lineup section or band listing.
    // SBAM sites tend to use simple layouts with band names as headings
    // or in grid/list elements.
    const lineupSection = $(
      'section[id*="lineup" i], section[class*="lineup" i], ' +
        'div[id*="lineup" i], div[class*="lineup" i], ' +
        'section[id*="bands" i], section[class*="bands" i], ' +
        'div[id*="bands" i], div[class*="bands" i], ' +
        '#lineup, .lineup, #bands, .bands'
    );

    if (lineupSection.length > 0) {
      this.log(`Found lineup/bands section(s): ${lineupSection.length}`);

      lineupSection.find('h2, h3, h4, li, a').each((_, el) => {
        const $el = $(el);
        const tagName = el.tagName?.toLowerCase() || '';

        let name: string;
        if (tagName === 'a') {
          // For links, get text content excluding images
          const $clone = $el.clone();
          $clone.find('img, picture, svg').remove();
          name = $clone.text().trim();
        } else {
          name = $el.text().trim();
        }

        if (!name || name.length > 80 || name.length < 2) return;
        if (this.isSkipText(name)) return;

        artists.push(
          ...this.processArtistName(name, {
            dayLabel: null,
            stageName: null,
            billing: null,
          })
        );
      });
    }

    // Strategy B: Artist links or band links
    if (artists.length === 0) {
      this.log('No lineup section found, trying band/artist links');

      $('a[href*="/band/"], a[href*="/artist/"], a[href*="/acts/"]').each(
        (_, el) => {
          const $link = $(el);
          const href = $link.attr('href') || '';

          // Skip index pages
          if (
            href.endsWith('/bands/') ||
            href.endsWith('/artists/') ||
            href.endsWith('/acts/')
          ) {
            return;
          }

          const artistName =
            $link.find('h2, h3, h4').first().text().trim() ||
            $link.find('img').first().attr('alt')?.trim() ||
            $link.text().trim();

          if (!artistName || artistName.length > 80) return;
          if (this.isSkipText(artistName)) return;

          artists.push(
            ...this.processArtistName(artistName, {
              dayLabel: null,
              stageName: null,
              billing: null,
            })
          );
        }
      );
    }

    // Strategy C: Heading-based extraction from the page body.
    // Punk/DIY festival sites often just list band names as headings
    // or in bold text.
    if (artists.length === 0) {
      this.log('Trying broad heading/bold extraction');

      const content = $('main, .content, .entry-content, article, body');

      // Track if we are inside a lineup-like section
      let inLineupSection = false;

      content.find('h1, h2, h3, h4, strong, b, li').each((_, el) => {
        const $el = $(el);
        const tagName = el.tagName?.toLowerCase() || '';
        const text = $el.text().trim();

        if (!text) return;

        // Detect section headers
        if (
          (tagName === 'h1' || tagName === 'h2') &&
          /lineup|bands|acts|programm/i.test(text)
        ) {
          inLineupSection = true;
          return;
        }

        // Exit section on next unrelated h1/h2
        if (
          (tagName === 'h1' || tagName === 'h2') &&
          inLineupSection &&
          !/lineup|bands|acts/i.test(text)
        ) {
          inLineupSection = false;
          return;
        }

        // Only extract from the lineup section, or from h3/h4 if no section found
        if (!inLineupSection && tagName !== 'h3' && tagName !== 'h4') return;

        if (text.length > 60 || text.length < 2) return;
        if (this.isSkipText(text)) return;

        artists.push(
          ...this.processArtistName(text, {
            dayLabel: null,
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
   * Check if text should be skipped (navigation, section titles, etc.).
   */
  private isSkipText(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const skipWords = [
      'lineup', 'line-up', 'bands', 'acts', 'programm', 'tickets',
      'info', 'anreise', 'kontakt', 'impressum', 'datenschutz',
      'partner', 'sponsoren', 'news', 'gallery', 'galerie', 'camping',
      'about', 'newsletter', 'faq', 'shop', 'merch', 'mehr',
      'more acts', 'tba', 'to be announced', 'coming soon',
      'sbam fest', 'sbam records', 'sbam booking',
    ];
    return skipWords.some((w) => lower === w);
  }
}
