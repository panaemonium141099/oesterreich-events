/**
 * Poolbar Festival Lineup Scraper
 *
 * Source: https://www.poolbar.at/programm
 * Structure: Next.js React Server Components. Artist data is embedded
 *   in serialized React/RSC payload (not traditional HTML). We extract
 *   from the RSC JSON payload or fall back to any rendered text.
 *
 *   Individual event pages link to /programm/[slug] with artist names
 *   and "Open Air" / concert type markers.
 *
 * Location: Feldkirch, Vorarlberg
 * Genre: Indie / Alternative / Electronic (mixed cultural festival)
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.5
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

export class PoolbarLineupScraper extends BaseLineupScraper {
  readonly name = 'PoolbarLineup';
  readonly festivalSlug = 'poolbar-festival';
  readonly lineupUrl = 'https://www.poolbar.at/programm';

  /** Keywords indicating a NON-music event to exclude */
  private static readonly NON_MUSIC_KEYWORDS = [
    'workshop', 'lesung', 'reading', 'vortrag', 'talk', 'lecture',
    'diskussion', 'discussion', 'panel', 'ausstellung', 'exhibition',
    'theater', 'kabarett', 'film', 'kino', 'cinema',
    'yoga', 'kinderprogramm', 'brunch', 'markt', 'market',
    'architektur', 'architecture', 'design', 'mode', 'fashion',
    'literatur', 'tanz', 'dance class',
  ];

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

    // 2. Try extracting from RSC/Next.js serialized data
    this.log('No JSON-LD found, trying RSC payload extraction');
    const rscArtists = this.extractFromRscPayload(html);
    if (rscArtists.length > 0) {
      this.log(`Found ${rscArtists.length} artists from RSC payload`);
      return this.deduplicateArtists(rscArtists);
    }

    // 3. HTML fallback — look for any rendered artist names
    this.log('No RSC data, falling back to HTML selectors');
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];

    // Strategy A: Card-based layout with h2/h3 titles
    $('h2, h3').each((_, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 2 || text.length > 80) return;
      if (this.isNonMusic(text)) return;
      if (this.isSkipText(text)) return;

      artists.push(
        ...this.processArtistName(text, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });

    // Strategy B: Links to /programm/[slug]
    if (artists.length === 0) {
      $('a[href*="/programm/"]').each((_, el) => {
        const $link = $(el);
        const href = $link.attr('href') || '';
        if (href === '/programm' || href === '/programm/') return;
        // Must have a slug segment
        if (!href.match(/\/programm\/[^/]+/)) return;

        const title = $link.find('h2, h3, h4').first().text().trim()
          || $link.text().trim();
        if (!title || title.length < 2 || title.length > 80) return;
        if (this.isNonMusic(title)) return;
        if (this.isSkipText(title)) return;

        artists.push(
          ...this.processArtistName(title, {
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
   * Extract artist data from Next.js RSC (React Server Components) payload.
   * RSC data is embedded as serialized JSON in the HTML source, often in
   * <script> tags or as inline data attributes.
   */
  private extractFromRscPayload(html: string): FestivalArtist[] {
    const artists: FestivalArtist[] = [];

    // Pattern 1: Look for JSON arrays/objects containing event titles
    // Next.js RSC embeds data as escaped JSON strings
    const titleMatches = html.matchAll(/"title"\s*:\s*"([^"]{2,80})"/g);
    const seenTitles = new Set<string>();

    for (const match of titleMatches) {
      let title = match[1];
      // Unescape common JSON escapes
      title = title.replace(/\\u[\dA-Fa-f]{4}/g, (m) =>
        String.fromCharCode(parseInt(m.slice(2), 16))
      ).replace(/\\n/g, ' ').replace(/\\"/g, '"').trim();

      if (!title || title.length < 2 || title.length > 80) continue;
      if (seenTitles.has(title.toLowerCase())) continue;
      seenTitles.add(title.toLowerCase());

      if (this.isNonMusic(title)) continue;
      if (this.isSkipText(title)) continue;

      // Clean up common suffixes like "Open Air", "Live"
      const cleanedTitle = title
        .replace(/\s*[-–]\s*(Open Air|Live|Konzert|Concert)\s*$/i, '')
        .trim();

      if (cleanedTitle.length < 2) continue;

      artists.push(
        ...this.processArtistName(cleanedTitle, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    }

    // Pattern 2: Look for "name" fields in RSC payload
    if (artists.length === 0) {
      const nameMatches = html.matchAll(/"name"\s*:\s*"([^"]{2,60})"/g);
      for (const match of nameMatches) {
        let name = match[1];
        name = name.replace(/\\u[\dA-Fa-f]{4}/g, (m) =>
          String.fromCharCode(parseInt(m.slice(2), 16))
        ).trim();

        if (!name || name.length < 2) continue;
        if (seenTitles.has(name.toLowerCase())) continue;
        seenTitles.add(name.toLowerCase());
        if (this.isNonMusic(name)) continue;
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

    return artists;
  }

  private isNonMusic(text: string): boolean {
    const lower = text.toLowerCase();
    return PoolbarLineupScraper.NON_MUSIC_KEYWORDS.some((kw) => lower.includes(kw));
  }

  private isSkipText(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const skipWords = [
      'programm', 'lineup', 'tickets', 'info', 'anreise', 'kontakt',
      'impressum', 'datenschutz', 'partner', 'sponsoren', 'news',
      'archiv', 'alle events', 'mehr', 'more', 'poolbar',
      'poolbar festival', 'feldkirch', 'vorarlberg', 'open air',
      'alte fabrik', 'reichenfeld',
    ];
    return skipWords.some((w) => lower === w);
  }
}
