/**
 * Woodstock der Blasmusik Lineup Scraper
 *
 * Sources:
 *   - Artists page: https://www.woodstockderblasmusik.at/kuenstlerinnen/
 *   - Timetable page: https://www.woodstockderblasmusik.at/spielplan/
 *
 * Structure: TWO pages that need to be merged.
 *   - kuenstlerinnen/ lists all performing artists/bands
 *   - spielplan/ provides the schedule with day/stage assignments
 *   Merge strategy: scrape artists from kuenstlerinnen/, then enrich
 *   with day/stage data from spielplan/ where available.
 *
 * Location: Ort im Innkreis, Oberösterreich
 * Genre: Blasmusik / Volksmusik / Schlager
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.5
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist, FestivalLineupResult } from '../types';

export class WoodstockBlasmusikLineupScraper extends BaseLineupScraper {
  readonly name = 'WoodstockBlasmusikLineup';
  readonly festivalSlug = 'woodstock-blasmusik';
  readonly lineupUrl = 'https://www.woodstockderblasmusik.at/kuenstlerinnen/';

  /** Second URL for the timetable / Spielplan */
  private readonly spielplanUrl =
    'https://www.woodstockderblasmusik.at/spielplan/';

  /**
   * Override run() to fetch and merge both pages (artists + timetable).
   */
  async run(): Promise<FestivalLineupResult> {
    const startedAt = new Date();
    this.log(`Starting lineup scrape (2-page merge)`);

    try {
      // Fetch both pages
      const [artistsHtml, spielplanHtml] = await this.fetchBothPages();

      // Extract base artist list from kuenstlerinnen page
      const artists = this.scrapeLineup(artistsHtml);
      this.log(`Extracted ${artists.length} artists from kuenstlerinnen page`);

      // Parse timetable and enrich artists with day/stage info
      const enriched = this.enrichWithTimetable(artists, spielplanHtml);
      this.log(`Enriched with timetable data`);

      return {
        festivalId: this.festivalSlug,
        artists: enriched,
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

  /**
   * Fetch both the artists page and timetable page with rate limiting.
   */
  private async fetchBothPages(): Promise<[string, string]> {
    const artistsHtml = await this.fetchPage(this.lineupUrl);
    await this.rateLimit();
    const spielplanHtml = await this.fetchPage(this.spielplanUrl);
    return [artistsHtml, spielplanHtml];
  }

  /**
   * Scrape artist names from the kuenstlerinnen (artists) page.
   */
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

    // Strategy A: Artist cards/links with dedicated artist paths
    $('a[href*="/kuenstler"], a[href*="/artist/"], a[href*="/band/"]').each(
      (_, el) => {
        const $link = $(el);
        const href = $link.attr('href') || '';

        // Skip the index pages themselves
        if (
          href.endsWith('/kuenstlerinnen/') ||
          href.endsWith('/kuenstler/') ||
          href.endsWith('/artists/')
        ) {
          return;
        }

        const artistName =
          $link.find('h2, h3, h4').first().text().trim() ||
          $link.find('img').first().attr('alt')?.trim() ||
          $link.text().trim();

        if (!artistName || artistName.length > 100) return;
        if (this.isNavigationText(artistName)) return;

        artists.push(
          ...this.processArtistName(artistName, {
            dayLabel: null,
            stageName: null,
            billing: null,
          })
        );
      }
    );

    // Strategy B: Heading-based extraction from content area
    if (artists.length === 0) {
      this.log('No artist links found, trying heading/list extraction');

      const content = $(
        '.entry-content, .page-content, article, main, ' +
          '[class*="artist"], [class*="lineup"], [class*="kuenstler"]'
      );

      content.find('h2, h3, h4, li').each((_, el) => {
        const text = $(el).text().trim();
        if (!text || text.length > 80 || text.length < 2) return;
        if (this.isNavigationText(text)) return;

        artists.push(
          ...this.processArtistName(text, {
            dayLabel: null,
            stageName: null,
            billing: null,
          })
        );
      });
    }

    // Strategy C: Grid items (image cards with names)
    if (artists.length === 0) {
      this.log('Trying grid/card-based extraction');

      $(
        '[class*="grid"] > *, [class*="artist"] > *, ' +
          '[class*="lineup"] > *, [class*="band"] > *'
      ).each((_, el) => {
        const $item = $(el);
        const name =
          $item.find('h2, h3, h4, .title, .name').first().text().trim() ||
          $item.find('img').first().attr('alt')?.trim();

        if (!name || name.length > 80) return;
        if (this.isNavigationText(name)) return;

        artists.push(
          ...this.processArtistName(name, {
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
   * Enrich artists with day and stage information from the Spielplan page.
   * Builds a lookup map from the timetable, then updates matching artists.
   */
  private enrichWithTimetable(
    artists: FestivalArtist[],
    spielplanHtml: string
  ): FestivalArtist[] {
    const timetable = this.parseTimetable(spielplanHtml);

    if (timetable.size === 0) {
      this.log('No timetable data extracted, returning unenriched artists');
      return artists;
    }

    this.log(
      `Timetable contains ${timetable.size} entries, enriching artists`
    );

    return artists.map((artist) => {
      const scheduleInfo = timetable.get(artist.artist_name_normalized);
      if (scheduleInfo) {
        return {
          ...artist,
          day_label: scheduleInfo.day || artist.day_label,
          stage_name: scheduleInfo.stage || artist.stage_name,
        };
      }
      return artist;
    });
  }

  /**
   * Parse the Spielplan (timetable) page into a map of normalized artist
   * name -> { day, stage }.
   */
  private parseTimetable(
    html: string
  ): Map<string, { day: string | null; stage: string | null }> {
    const $ = this.loadHtml(html);
    const map = new Map<
      string,
      { day: string | null; stage: string | null }
    >();

    let currentDay: string | null = null;
    let currentStage: string | null = null;

    // Walk through the timetable structure. Common patterns:
    // - Day headings (h2/h3): "Donnerstag", "Freitag", "Samstag"
    // - Stage headings (h3/h4): "Hauptbühne", "Festzelt"
    // - Artist entries: table rows, list items, or spans
    const content = $(
      '.entry-content, .page-content, main, article, ' +
        '[class*="spielplan"], [class*="timetable"], [class*="schedule"]'
    );

    content.find('h2, h3, h4, tr, li, p').each((_, el) => {
      const $el = $(el);
      const tagName = el.tagName?.toLowerCase() || '';
      const text = $el.text().trim();

      if (!text) return;

      // Detect day headings
      if (
        (tagName === 'h2' || tagName === 'h3') &&
        this.isDayLabel(text)
      ) {
        currentDay = text;
        return;
      }

      // Detect stage headings
      if (
        (tagName === 'h3' || tagName === 'h4') &&
        this.isStageLabel(text)
      ) {
        currentStage = text;
        return;
      }

      // Extract artist name from timetable rows or list items
      if (tagName === 'tr' || tagName === 'li') {
        // For table rows, skip header rows
        if ($el.find('th').length > 0) return;

        // Get the artist name (usually the main text cell)
        const cells = $el.find('td');
        let name: string;
        if (cells.length > 0) {
          // Typically: time | artist | stage  or  artist | time
          name =
            cells.length >= 2
              ? $(cells[1]).text().trim() || $(cells[0]).text().trim()
              : $(cells[0]).text().trim();
        } else {
          name = text;
        }

        if (name && name.length > 1 && name.length < 80) {
          // Normalize for lookup
          const processed = this.processArtistName(name, {
            dayLabel: currentDay,
            stageName: currentStage,
            billing: null,
          });
          for (const p of processed) {
            map.set(p.artist_name_normalized, {
              day: currentDay,
              stage: currentStage,
            });
          }
        }
      }
    });

    return map;
  }

  /**
   * Check if text is a day label.
   */
  private isDayLabel(text: string): boolean {
    return /^(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|tag\s*\d|day\s*\d)/i.test(
      text.trim()
    );
  }

  /**
   * Check if text is a stage label.
   */
  private isStageLabel(text: string): boolean {
    return /stage|bühne|buhne|festzelt|hauptbühne|zelt|floor|area/i.test(
      text.trim()
    );
  }

  /**
   * Check if text is a navigation or section label to skip.
   */
  private isNavigationText(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const skipWords = [
      'kuenstlerinnen', 'künstlerinnen', 'künstler', 'artists',
      'spielplan', 'timetable', 'programm', 'lineup', 'line-up',
      'tickets', 'info', 'anreise', 'kontakt', 'impressum',
      'datenschutz', 'partner', 'sponsoren', 'news', 'gallery',
      'galerie', 'camping', 'about', 'newsletter', 'faq', 'shop',
      'merch', 'mehr erfahren', 'read more', 'alle anzeigen',
    ];
    return skipWords.some((w) => lower === w);
  }
}
