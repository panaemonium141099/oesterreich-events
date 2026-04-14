/**
 * SBAM Fest Lineup Scraper
 *
 * Source: https://fest.sbam.rocks/
 * Structure: WordPress + Elementor. The lineup is published primarily
 *   as a poster image (lineup-poster-final.jpg), NOT as semantic HTML.
 *   We cannot extract from the image.
 *
 *   Alternative extraction strategies:
 *   1. Look for any text-based band listings in Elementor containers
 *   2. Check for a separate /lineup/ or /bands/ subpage
 *   3. Extract from meta/OG tags or page description
 *
 * Location: Wieselburg, Niederösterreich
 * Genre: Punk / Hardcore / Ska / Indie
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.5
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist, FestivalLineupResult } from '../types';

export class SbamFestLineupScraper extends BaseLineupScraper {
  readonly name = 'SbamFestLineup';
  readonly festivalSlug = 'sbam-fest';
  readonly lineupUrl = 'https://fest.sbam.rocks/';

  /** Additional URLs to check for text-based lineup */
  private readonly altUrls = [
    'https://fest.sbam.rocks/lineup/',
    'https://fest.sbam.rocks/bands/',
    'https://fest.sbam.rocks/line-up/',
    'https://fest.sbam.rocks/programm/',
  ];

  /**
   * Override run() to try multiple pages.
   */
  async run(): Promise<FestivalLineupResult> {
    const startedAt = new Date();
    this.log(`Starting lineup scrape from ${this.lineupUrl}`);

    try {
      // Try main page first
      const html = await this.fetchPage(this.lineupUrl);
      let artists = this.scrapeLineup(html);

      // If main page yielded nothing, try alternate URLs
      if (artists.length === 0) {
        for (const url of this.altUrls) {
          try {
            await this.rateLimit();
            const altHtml = await this.fetchPage(url);
            artists = this.scrapeLineup(altHtml);
            if (artists.length > 0) {
              this.log(`Found ${artists.length} artists from ${url}`);
              break;
            }
          } catch {
            // Alt URL doesn't exist, continue
          }
        }
      }

      // If still nothing, try extracting from meta tags / OG description
      if (artists.length === 0) {
        artists = this.extractFromMetaTags(html);
      }

      this.log(`Extracted ${artists.length} artists total`);
      return {
        festivalId: this.festivalSlug,
        artists,
        scrapedAt: startedAt.toISOString(),
        success: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Scrape failed: ${message}`);

      return {
        festivalId: this.festivalSlug,
        artists: [],
        scrapedAt: startedAt.toISOString(),
        success: false,
        error: message,
      };
    }
  }

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

    // Strategy A: Elementor text widgets with band names
    // Elementor uses .elementor-text-editor, .elementor-heading-title
    $('.elementor-heading-title, .elementor-text-editor h2, .elementor-text-editor h3').each((_, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 2 || text.length > 80) return;
      if (this.isSkipText(text)) return;

      artists.push(
        ...this.processArtistName(text, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });

    // Strategy B: Look for lineup section by ID/class
    if (artists.length === 0) {
      $('[id*="lineup" i], [id*="bands" i], [class*="lineup" i], [class*="bands" i]').find('h2, h3, h4, li, a').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        if (!text || text.length < 2 || text.length > 80) return;
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

    // Strategy C: Links to /band/ or /artist/ pages
    if (artists.length === 0) {
      $('a[href*="/band/"], a[href*="/artist/"], a[href*="/acts/"]').each((_, el) => {
        const $link = $(el);
        const href = $link.attr('href') || '';
        if (href.endsWith('/bands/') || href.endsWith('/artists/')) return;

        const name = $link.find('h2, h3, h4').first().text().trim()
          || $link.find('img').first().attr('alt')?.trim()
          || $link.text().trim();

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

    // Strategy D: Alt-text from lineup poster image (may contain band list)
    if (artists.length === 0) {
      $('img[src*="lineup"], img[alt*="lineup" i], img[alt*="bands" i]').each((_, el) => {
        const alt = $(el).attr('alt')?.trim() || '';
        // Some sites put band names in alt text separated by commas or newlines
        if (alt.length > 20 && alt.includes(',')) {
          const names = alt.split(/[,\n]+/).map((n) => n.trim()).filter((n) => n.length > 1 && n.length < 60);
          for (const name of names) {
            if (this.isSkipText(name)) continue;
            artists.push(
              ...this.processArtistName(name, {
                dayLabel: null,
                stageName: null,
                billing: null,
              })
            );
          }
        }
      });
    }

    this.log(`Parsed ${artists.length} artists from HTML`);
    return this.deduplicateArtists(artists);
  }

  /**
   * Try to extract artist names from meta tags (OG description, etc.)
   * Some festival sites list bands in their page description.
   */
  private extractFromMetaTags(html: string): FestivalArtist[] {
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];

    const description = $('meta[property="og:description"]').attr('content')
      || $('meta[name="description"]').attr('content')
      || '';

    if (description.length > 30) {
      // Look for comma-separated or bullet-separated band lists
      const parts = description.split(/[,•|]+/).map((p) => p.trim());
      for (const part of parts) {
        if (part.length < 2 || part.length > 60) continue;
        // Skip if it looks like a sentence (too many spaces)
        if (part.split(/\s+/).length > 5) continue;
        if (this.isSkipText(part)) continue;

        artists.push(
          ...this.processArtistName(part, {
            dayLabel: null,
            stageName: null,
            billing: null,
          })
        );
      }
    }

    return this.deduplicateArtists(artists);
  }

  private isSkipText(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const skipWords = [
      'lineup', 'line-up', 'bands', 'acts', 'programm', 'tickets',
      'info', 'anreise', 'kontakt', 'impressum', 'datenschutz',
      'partner', 'sponsoren', 'news', 'gallery', 'galerie', 'camping',
      'about', 'newsletter', 'faq', 'shop', 'merch', 'mehr',
      'tba', 'to be announced', 'coming soon',
      'sbam fest', 'sbam records', 'sbam booking', 'sbam',
      'wieselburg', 'niederösterreich', 'niederoesterreich',
    ];
    return skipWords.some((w) => lower === w);
  }
}
