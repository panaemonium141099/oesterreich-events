/**
 * FM4 Frequency Festival Lineup Scraper
 *
 * Source: https://www.frequency.at/lineup/
 * Structure: WordPress site with artist links as <li><a href="/artist/...">
 *   containing artist name text, day label in <p>, and thumbnail image.
 * No JSON-LD performer data available.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

export class FrequencyLineupScraper extends BaseLineupScraper {
  readonly name = 'FrequencyLineup';
  readonly festivalSlug = 'frequency';
  readonly lineupUrl = 'https://www.frequency.at/lineup/';

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

    // 2. HTML fallback: parse artist links
    this.log('No JSON-LD found, falling back to HTML selectors');
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];

    // Frequency uses <li> elements containing <a href="/artist/...">
    // Inside each <a>: artist name as text, <p> with day, <img> with photo
    $('a[href*="/artist/"]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';

      // Skip non-artist links (e.g., /artist/ index page itself)
      if (!href.match(/\/artist\/[^/]+\/?$/)) return;

      // Extract artist name: the direct text content of the <a>, excluding
      // child elements like <p> and <img>
      const fullText = $link.text().trim();
      // The <p> contains the day label; extract it separately
      const dayText = $link.find('p').first().text().trim() || null;

      // Artist name is the text with day suffix stripped.
      // Some Frequency pages embed the day as a <p>, others as raw text.
      const $clone = $link.clone();
      $clone.find('p, img, picture, figure').remove();
      let artistName = $clone.text().replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

      // Strip day suffix if the scraper didn't catch it in a <p>
      artistName = artistName.replace(/\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*$/i, '').trim();

      if (!artistName) return;

      artists.push(
        ...this.processArtistName(artistName, {
          dayLabel: dayText,
          stageName: null,
          billing: null,
        })
      );
    });

    this.log(`Parsed ${artists.length} artists from HTML`);
    return this.deduplicateArtists(artists);
  }
}
