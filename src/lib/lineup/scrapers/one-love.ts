/**
 * One Love Festival Lineup Scraper
 *
 * Source: https://www.onelovefestival.at/lineup-programm/
 * Structure: WordPress-based site. Artists are listed as h2 headings
 *   decorated with emoji patterns: "❤️💛💚 Alpha Blondy ❤️💛💚"
 *   The lineup schedule is published as JPG images (not scrapeable).
 *
 * Location: Wiesen, Burgenland
 * Genre: Reggae / Dancehall / World Music
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.5
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

export class OneLoveLineupScraper extends BaseLineupScraper {
  readonly name = 'OneLoveLineup';
  readonly festivalSlug = 'one-love-festival';
  readonly lineupUrl = 'https://www.onelovefestival.at/lineup-programm/';

  /** Emoji pattern used to decorate artist headings */
  private static readonly EMOJI_PATTERN = /[❤️💛💚🧡💜🤍🖤💙\u2764\uFE0F\u{1F49B}\u{1F49A}\u{1F9E1}\u{1F49C}\u{1F90D}\u{1F5A4}\u{1F499}\s]+/gu;

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

    // 2. HTML fallback — artist names in h2 headings with emoji decoration
    this.log('No JSON-LD found, falling back to HTML selectors');
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];

    // Strategy A: h2 headings with emoji hearts — primary pattern
    // Pattern: <h2>❤️💛💚 Alpha Blondy ❤️💛💚</h2>
    const content = $('.entry-content, .page-content, article, main');

    content.find('h2').each((_, el) => {
      const rawText = $(el).text().trim();
      if (!rawText) return;

      // Strip emoji decorations to get clean artist name
      const cleaned = rawText
        .replace(OneLoveLineupScraper.EMOJI_PATTERN, ' ')
        .trim();

      if (!cleaned || cleaned.length < 2 || cleaned.length > 100) return;
      if (this.isSkipText(cleaned)) return;

      artists.push(
        ...this.processArtistName(cleaned, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });

    // Strategy B: h3/h4 headings (some artists may use smaller headings)
    if (artists.length === 0) {
      this.log('No h2 artists found, trying h3/h4');

      content.find('h3, h4').each((_, el) => {
        const rawText = $(el).text().trim();
        if (!rawText) return;

        const cleaned = rawText
          .replace(OneLoveLineupScraper.EMOJI_PATTERN, ' ')
          .trim();

        if (!cleaned || cleaned.length < 2 || cleaned.length > 80) return;
        if (this.isSkipText(cleaned)) return;

        artists.push(
          ...this.processArtistName(cleaned, {
            dayLabel: null,
            stageName: null,
            billing: null,
          })
        );
      });
    }

    // Strategy C: strong/b tags (some WP themes use bold for artist names)
    if (artists.length === 0) {
      this.log('Trying strong/bold extraction');

      content.find('strong, b').each((_, el) => {
        const text = $(el).text().trim()
          .replace(OneLoveLineupScraper.EMOJI_PATTERN, ' ')
          .trim();

        if (!text || text.length < 2 || text.length > 80) return;
        // Skip if it looks like a description (too many words)
        if (text.split(/\s+/).length > 6) return;
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

  private isSkipText(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const skipWords = [
      'lineup', 'line-up', 'programm', 'tickets', 'info', 'anreise',
      'kontakt', 'impressum', 'datenschutz', 'partner', 'sponsoren',
      'news', 'gallery', 'galerie', 'camping', 'about', 'newsletter',
      'faq', 'shop', 'merch', 'more acts', 'tba', 'coming soon',
      'one love festival', 'one love', 'wiesen', 'burgenland',
      'eine legende', 'reggae', 'dancehall',
    ];
    return skipWords.some((w) => lower === w || lower === w + '!');
  }
}
