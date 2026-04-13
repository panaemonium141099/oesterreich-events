/**
 * One Love Festival Lineup Scraper
 *
 * Source: https://www.onelovefestival.at/lineup-programm/
 * Structure: WordPress-based site with lineup/programm page.
 *   Artists are listed as headings or card elements, possibly with
 *   day/stage groupings.
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
  readonly festivalSlug = 'one-love';
  readonly lineupUrl = 'https://www.onelovefestival.at/lineup-programm/';

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

    // Track current day/stage context for attribution
    let currentDay: string | null = null;
    let currentStage: string | null = null;

    // Strategy A: Look for day/stage sections with artist lists.
    // Common WordPress patterns: .entry-content with headings for days,
    // lists or grids of artist names.
    const content = $('.entry-content, .page-content, article .content, main');

    if (content.length > 0) {
      // Walk through elements in document order to track day/stage context
      content.find('h1, h2, h3, h4, h5, p, li, a, span, div').each((_, el) => {
        const $el = $(el);
        const tagName = el.tagName?.toLowerCase() || '';
        const text = $el.clone().children().remove().end().text().trim() ||
                     $el.text().trim();

        if (!text) return;

        // Check if this is a day heading (e.g., "Freitag", "Samstag", "Day 1")
        if ((tagName === 'h2' || tagName === 'h3') && this.isDayLabel(text)) {
          currentDay = text;
          return;
        }

        // Check if this is a stage heading
        if ((tagName === 'h3' || tagName === 'h4') && this.isStageLabel(text)) {
          currentStage = text;
          return;
        }

        // Skip navigation/section headings
        if (this.isSkipHeading(text)) return;

        // Artist names: in <li> elements, short <p> or <h3>/<h4> within content
        const isArtistCandidate =
          tagName === 'li' ||
          (tagName === 'h3' && text.length < 60) ||
          (tagName === 'h4' && text.length < 60) ||
          (tagName === 'h5' && text.length < 60);

        if (isArtistCandidate && text.length > 1 && text.length < 80) {
          artists.push(
            ...this.processArtistName(text, {
              dayLabel: currentDay,
              stageName: currentStage,
              billing: null,
            })
          );
        }
      });
    }

    // Strategy B: Artist links
    if (artists.length === 0) {
      this.log('No artist entries found in content, trying artist links');
      $('a[href*="/artist/"], a[href*="/kuenstler/"], a[href*="/lineup/"]').each(
        (_, el) => {
          const $link = $(el);
          const href = $link.attr('href') || '';
          // Skip the lineup page itself
          if (href.endsWith('/lineup-programm/') || href.endsWith('/lineup/')) return;

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
        }
      );
    }

    this.log(`Parsed ${artists.length} artists from HTML`);
    return this.deduplicateArtists(artists);
  }

  /**
   * Check if a text is a day label (German weekday or "Day N" pattern).
   */
  private isDayLabel(text: string): boolean {
    const lower = text.toLowerCase();
    return /^(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|day\s*\d|tag\s*\d)/i.test(lower) ||
      /^\d{1,2}\.\s*(janu|febru|m[aä]rz|april|mai|juni|juli|august|septe|okto|novem|dezem)/i.test(lower);
  }

  /**
   * Check if a text is a stage label.
   */
  private isStageLabel(text: string): boolean {
    const lower = text.toLowerCase();
    return /stage|bühne|floor|tent|zelt|area|main\s*stage/i.test(lower);
  }

  /**
   * Check if a heading should be skipped (navigation/section titles).
   */
  private isSkipHeading(text: string): boolean {
    const lower = text.toLowerCase();
    const skipWords = [
      'lineup', 'line-up', 'programm', 'tickets', 'info', 'anreise',
      'kontakt', 'impressum', 'datenschutz', 'partner', 'sponsoren',
      'news', 'gallery', 'galerie', 'camping', 'about', 'newsletter',
      'faq', 'shop', 'merch', 'more acts', 'weitere acts', 'tba',
      'to be announced', 'coming soon',
    ];
    return skipWords.some((w) => lower === w || lower.startsWith(w + ' '));
  }
}
