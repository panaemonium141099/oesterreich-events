/**
 * Woodstock der Blasmusik Lineup Scraper
 *
 * Sources:
 *   - Artists page: https://www.woodstockderblasmusik.at/programm/kuenstlerinnen/
 *   - Timetable page: https://www.woodstockderblasmusik.at/programm/spielplan/
 *
 * Structure: TWO pages that need to be merged.
 *   - kuenstlerinnen/ lists artists as linked figure cards:
 *     <a href="/programm/kuenstler/[slug]/"><figure><img><figcaption><h3>Name</h3></figcaption></figure></a>
 *   - spielplan/ provides schedule with day/stage assignments
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
  readonly festivalSlug = 'woodstock-der-blasmusik-festival';
  readonly lineupUrl = 'https://www.woodstockderblasmusik.at/programm/kuenstlerinnen/';

  /** Second URL for the timetable / Spielplan */
  private readonly spielplanUrl =
    'https://www.woodstockderblasmusik.at/programm/spielplan/';

  /**
   * Override run() to fetch and merge both pages (artists + timetable).
   */
  async run(): Promise<FestivalLineupResult> {
    const startedAt = new Date();
    this.log(`Starting lineup scrape (2-page merge)`);

    try {
      // Fetch artists page first
      const artistsHtml = await this.fetchPage(this.lineupUrl);
      const artists = this.scrapeLineup(artistsHtml);
      this.log(`Extracted ${artists.length} artists from kuenstlerinnen page`);

      // Try timetable enrichment (non-fatal if it fails)
      try {
        await this.rateLimit();
        const spielplanHtml = await this.fetchPage(this.spielplanUrl);
        const enriched = this.enrichWithTimetable(artists, spielplanHtml);
        this.log(`Enriched with timetable data`);

        return {
          festivalId: this.festivalSlug,
          artists: enriched,
          scrapedAt: startedAt.toISOString(),
          success: true,
        };
      } catch {
        this.log('Timetable fetch failed, returning unenriched artists');
        return {
          festivalId: this.festivalSlug,
          artists,
          scrapedAt: startedAt.toISOString(),
          success: true,
        };
      }
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
   * Scrape artist names from the kuenstlerinnen (artists) page.
   *
   * DOM structure:
   *   <a href="/programm/kuenstler/[slug]/">
   *     <figure>
   *       <img src="..." alt="Artist Name">
   *       <figcaption><h3>Artist Name</h3></figcaption>
   *     </figure>
   *   </a>
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

    // 2. HTML fallback — primary strategy: artist links with figcaption/h3
    this.log('No JSON-LD found, falling back to HTML selectors');
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];

    // Strategy A: Links to /programm/kuenstler/[slug]/ with figcaption>h3 or img alt
    $('a[href*="/programm/kuenstler/"], a[href*="/kuenstler/"]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';

      // Skip the index page itself
      if (href.endsWith('/kuenstlerinnen/') || href.endsWith('/kuenstler/')) return;

      // Extract name: h3 in figcaption > img alt > link text
      const artistName =
        $link.find('figcaption h3').first().text().trim() ||
        $link.find('h3, h2, h4').first().text().trim() ||
        $link.find('img').first().attr('alt')?.trim() ||
        $link.text().trim();

      if (!artistName || artistName.length > 100 || artistName.length < 2) return;
      if (this.isNavigationText(artistName)) return;

      artists.push(
        ...this.processArtistName(artistName, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });

    // Strategy B: figure elements with h3 (if links don't have /kuenstler/ path)
    if (artists.length === 0) {
      this.log('No kuenstler links found, trying figure>figcaption>h3 pattern');

      $('figure figcaption h3').each((_, el) => {
        const name = $(el).text().trim();
        if (!name || name.length > 100 || name.length < 2) return;
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

    // Strategy C: Any h3 inside main content
    if (artists.length === 0) {
      this.log('Trying h3 extraction from main content');

      $('main h3, .entry-content h3, article h3').each((_, el) => {
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

    this.log(`Parsed ${artists.length} artists from HTML`);
    return this.deduplicateArtists(artists);
  }

  /**
   * Enrich artists with day and stage information from the Spielplan page.
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

    this.log(`Timetable contains ${timetable.size} entries, enriching artists`);

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
   * Parse the Spielplan (timetable) page into a lookup map.
   */
  private parseTimetable(
    html: string
  ): Map<string, { day: string | null; stage: string | null }> {
    const $ = this.loadHtml(html);
    const map = new Map<string, { day: string | null; stage: string | null }>();

    let currentDay: string | null = null;
    let currentStage: string | null = null;

    const content = $('main, .entry-content, article, body');

    content.find('h2, h3, h4, tr, li, p, a').each((_, el) => {
      const $el = $(el);
      const tagName = el.tagName?.toLowerCase() || '';
      const text = $el.text().trim();

      if (!text) return;

      // Detect day headings
      if ((tagName === 'h2' || tagName === 'h3') && this.isDayLabel(text)) {
        currentDay = text;
        return;
      }

      // Detect stage headings
      if ((tagName === 'h3' || tagName === 'h4') && this.isStageLabel(text)) {
        currentStage = text;
        return;
      }

      // Extract artist name from schedule entries
      if (tagName === 'tr' || tagName === 'li' || tagName === 'a') {
        if ($el.find('th').length > 0) return;

        let name: string;
        const cells = $el.find('td');
        if (cells.length > 0) {
          name = cells.length >= 2
            ? $(cells[1]).text().trim() || $(cells[0]).text().trim()
            : $(cells[0]).text().trim();
        } else {
          name = tagName === 'a'
            ? ($el.find('h3').text().trim() || $el.text().trim())
            : text;
        }

        if (name && name.length > 1 && name.length < 80) {
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

  private isDayLabel(text: string): boolean {
    return /^(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|tag\s*\d|day\s*\d)/i.test(text.trim());
  }

  private isStageLabel(text: string): boolean {
    return /stage|bühne|buhne|festzelt|hauptbühne|zelt|floor|area/i.test(text.trim());
  }

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
