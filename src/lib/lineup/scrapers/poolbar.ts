/**
 * Poolbar Festival Lineup Scraper
 *
 * Source: https://www.poolbar.at/programm
 * Structure: The programm page lists all events including concerts,
 *   cultural events, workshops, etc. We need to filter for music-only
 *   entries, as the spec says "filter for music" explicitly.
 *
 * Location: Feldkirch, Vorarlberg
 * Genre: Indie / Alternative / Electronic (mixed cultural festival)
 *
 * Filtering: Poolbar mixes concerts and cultural events. We filter
 *   for music by checking event categories, tags, or by identifying
 *   music-related indicators (genre labels, "Konzert", etc.).
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.5
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

export class PoolbarLineupScraper extends BaseLineupScraper {
  readonly name = 'PoolbarLineup';
  readonly festivalSlug = 'poolbar';
  readonly lineupUrl = 'https://www.poolbar.at/programm';

  /** Keywords indicating a music event (German + English) */
  private static readonly MUSIC_KEYWORDS = new Set([
    'konzert', 'concert', 'musik', 'music', 'band', 'dj', 'live',
    'hip-hop', 'hiphop', 'hip hop', 'rap', 'electronic', 'elektronisch',
    'indie', 'rock', 'pop', 'punk', 'metal', 'jazz', 'blues', 'soul',
    'funk', 'reggae', 'dancehall', 'techno', 'house', 'drum and bass',
    'dnb', 'dubstep', 'trap', 'singer-songwriter', 'singer/songwriter',
    'acoustic', 'akustik', 'folk', 'country', 'r&b', 'rnb',
    'klassik', 'classical', 'world music', 'weltmusik',
  ]);

  /** Keywords indicating a NON-music event to exclude */
  private static readonly NON_MUSIC_KEYWORDS = new Set([
    'workshop', 'lesung', 'reading', 'vortrag', 'talk', 'lecture',
    'diskussion', 'discussion', 'panel', 'ausstellung', 'exhibition',
    'theater', 'kabarett', 'comedy', 'film', 'kino', 'cinema',
    'yoga', 'kinderprogramm', 'children', 'brunch', 'markt', 'market',
    'architektur', 'architecture', 'design', 'mode', 'fashion',
    'literatur', 'literature', 'tanz', 'dance class',
  ]);

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

    // 2. HTML fallback with music filtering
    this.log('No JSON-LD found, falling back to HTML selectors with music filter');
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];

    // Strategy A: Event cards/items with category or genre metadata
    const eventItems = $(
      '[class*="event"], [class*="programm"], [class*="program"], ' +
        'article, .entry, .item, [class*="card"]'
    );

    if (eventItems.length > 0) {
      this.log(`Found ${eventItems.length} potential event items`);

      eventItems.each((_, el) => {
        const $item = $(el);
        const fullText = $item.text().toLowerCase();

        // Get event title/artist name
        const title =
          $item.find('h2, h3, h4, .title, .name, .event-title').first().text().trim() ||
          $item.find('a').first().text().trim();

        if (!title || title.length > 100 || title.length < 2) return;

        // Get category/tag text for filtering
        const category =
          $item.find('.category, .tag, .genre, .type, [class*="category"], [class*="tag"]')
            .text()
            .toLowerCase() || '';

        // Apply music filter: include only music events
        if (!this.isMusicEvent(title, category, fullText)) return;

        // Extract day label if present
        const dayLabel = this.extractDayFromItem($, $item);

        // Extract stage name if present
        const stageName = this.extractStageFromItem($, $item);

        artists.push(
          ...this.processArtistName(title, {
            dayLabel,
            stageName,
            billing: null,
          })
        );
      });
    }

    // Strategy B: Links to individual event pages with music filtering
    if (artists.length === 0) {
      this.log('No event items found, trying linked events');

      $('a[href*="/programm/"], a[href*="/event/"], a[href*="/veranstaltung/"]').each(
        (_, el) => {
          const $link = $(el);
          const href = $link.attr('href') || '';

          // Skip the programm index itself
          if (href.endsWith('/programm/') || href.endsWith('/programm')) return;

          const title =
            $link.find('h2, h3, h4').first().text().trim() ||
            $link.text().trim();

          if (!title || title.length > 100 || title.length < 2) return;

          // Check parent or sibling context for category info
          const parentText = $link.parent().text().toLowerCase();
          const category =
            $link.parent().find('.category, .tag, .genre').text().toLowerCase() || '';

          if (!this.isMusicEvent(title, category, parentText)) return;

          artists.push(
            ...this.processArtistName(title, {
              dayLabel: null,
              stageName: null,
              billing: null,
            })
          );
        }
      );
    }

    // Strategy C: Simple heading-based fallback for lineup sections
    if (artists.length === 0) {
      this.log('Trying heading-based extraction from music sections');

      const musicSection = $(
        '[class*="musik"], [class*="music"], [class*="konzert"], ' +
          '[id*="musik"], [id*="music"], [id*="konzert"]'
      );

      musicSection.find('h3, h4, li').each((_, el) => {
        const name = $(el).text().trim();
        if (!name || name.length > 80 || name.length < 2) return;
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

    this.log(`Parsed ${artists.length} music artists from HTML`);
    return this.deduplicateArtists(artists);
  }

  /**
   * Determine if an event entry is a music event based on its title,
   * category, and surrounding text.
   *
   * Logic:
   *  - If NON_MUSIC keywords are found and no MUSIC keywords are found, exclude.
   *  - If MUSIC keywords are found, include.
   *  - If no keywords match either way, include (default to music since
   *    Poolbar is primarily a music festival).
   */
  private isMusicEvent(
    title: string,
    category: string,
    fullText: string
  ): boolean {
    const combined = `${title} ${category} ${fullText}`.toLowerCase();

    // Check for explicit non-music indicators
    const hasNonMusic = [...PoolbarLineupScraper.NON_MUSIC_KEYWORDS].some(
      (kw) => combined.includes(kw)
    );

    // Check for explicit music indicators
    const hasMusic = [...PoolbarLineupScraper.MUSIC_KEYWORDS].some(
      (kw) => combined.includes(kw)
    );

    // If explicitly non-music and not also music-tagged, exclude
    if (hasNonMusic && !hasMusic) return false;

    // Otherwise include (music events, or ambiguous defaults to include)
    return true;
  }

  /**
   * Try to extract a day label from an event item.
   */
  private extractDayFromItem(
    $: ReturnType<typeof this.loadHtml>,
    $item: ReturnType<ReturnType<typeof this.loadHtml>>
  ): string | null {
    const dateEl = $item.find(
      '.date, .datum, [class*="date"], time, [datetime]'
    ).first();

    if (dateEl.length > 0) {
      const datetime = dateEl.attr('datetime');
      if (datetime) return datetime.slice(0, 10); // YYYY-MM-DD
      const text = dateEl.text().trim();
      if (text && text.length < 30) return text;
    }

    return null;
  }

  /**
   * Try to extract a stage name from an event item.
   */
  private extractStageFromItem(
    $: ReturnType<typeof this.loadHtml>,
    $item: ReturnType<ReturnType<typeof this.loadHtml>>
  ): string | null {
    const stageEl = $item.find(
      '.stage, .venue, .location, .ort, ' +
        '[class*="stage"], [class*="venue"], [class*="location"]'
    ).first();

    if (stageEl.length > 0) {
      const text = stageEl.text().trim();
      if (text && text.length < 50) return text;
    }

    return null;
  }

  /**
   * Check if text is a navigation or section label to skip.
   */
  private isNavigationText(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const skipWords = [
      'programm', 'lineup', 'tickets', 'info', 'anreise', 'kontakt',
      'impressum', 'datenschutz', 'partner', 'sponsoren', 'news',
      'archiv', 'archive', 'alle events', 'mehr', 'more',
    ];
    return skipWords.some((w) => lower === w);
  }
}
