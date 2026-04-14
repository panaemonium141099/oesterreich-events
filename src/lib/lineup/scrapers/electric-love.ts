/**
 * Electric Love Festival Lineup Scraper
 *
 * Source: https://www.electriclove.at/en/line-up/
 * Structure: WordPress site with artist pages at /en/artist/[slug]/.
 *   Previously used Algolia DEV_ARTISTS index (now returns 404).
 *   Primary extraction: parse all <a href="/en/artist/[slug]/"> links
 *   and extract artist names from the slug (slugified artist name).
 *
 * Algolia fallback: Still attempted first in case the API returns.
 *
 * Location: Plainfeld bei Salzburg
 * Genre: EDM / Electronic / Dance
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist, FestivalLineupResult } from '../types';

/** Shape of an Algolia artist hit */
interface AlgoliaArtistHit {
  name?: string;
  title?: string;
  stage?: string;
  stage_name?: string;
  day?: string;
  date?: string;
  show_type?: string;
  category?: string;
}

interface AlgoliaSearchResponse {
  hits: AlgoliaArtistHit[];
  nbHits: number;
  nbPages: number;
}

export class ElectricLoveLineupScraper extends BaseLineupScraper {
  readonly name = 'ElectricLoveLineup';
  readonly festivalSlug = 'electric-love-festival';
  readonly lineupUrl = 'https://www.electriclove.at/en/line-up/';

  // Algolia public search credentials (may be outdated)
  private algoliaAppId = '5QVRQ5REXW';
  private algoliaApiKey = '074690868e3c707f03aa1e755b866065';
  private algoliaIndex = 'DEV_ARTISTS';

  /**
   * Override run() to attempt Algolia API first, then fall back to HTML.
   */
  async run(): Promise<FestivalLineupResult> {
    const startedAt = new Date();
    this.log(`Starting lineup scrape for Electric Love`);

    try {
      // Fetch the HTML page
      const html = await this.fetchPage(this.lineupUrl);
      this.extractAlgoliaConfig(html);

      // Try Algolia API (may fail with 404)
      let artists: FestivalArtist[] = [];
      try {
        artists = await this.fetchFromAlgolia();
        if (artists.length > 0) {
          this.log(`Fetched ${artists.length} artists from Algolia API`);
          return {
            festivalId: this.festivalSlug,
            artists,
            scrapedAt: startedAt.toISOString(),
            success: true,
          };
        }
      } catch {
        this.log('Algolia API unavailable, using HTML fallback');
      }

      // HTML fallback — primary extraction method
      artists = this.scrapeLineup(html);
      this.log(`Extracted ${artists.length} artists from HTML`);

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

  /**
   * Parse artists from static HTML.
   *
   * Primary pattern: <a href="/en/artist/[slug]/">
   * Artist name is derived from:
   *   1. Text content near the link (heading, span, adjacent text)
   *   2. URL slug (deslugified: "armin-van-buuren" -> "Armin Van Buuren")
   */
  scrapeLineup(html: string): FestivalArtist[] {
    // 1. Try JSON-LD first
    const jsonLdNames = this.extractFromJsonLd(html);
    if (jsonLdNames.length > 0) {
      this.log(`Found ${jsonLdNames.length} artists via JSON-LD`);
      const artists: FestivalArtist[] = [];
      for (const name of jsonLdNames) {
        artists.push(
          ...this.processArtistName(name, { dayLabel: null, stageName: null, billing: null })
        );
      }
      return this.deduplicateArtists(artists);
    }

    // 2. HTML: extract from /artist/ links
    this.log('Extracting artists from /artist/ links');
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];
    const seenSlugs = new Set<string>();

    $('a[href*="/artist/"]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';

      // Extract slug from URL: /en/artist/hugel/ -> "hugel"
      const slugMatch = href.match(/\/artist\/([^/]+)\/?$/);
      if (!slugMatch) return;
      const slug = slugMatch[1];

      // Skip duplicates
      if (seenSlugs.has(slug)) return;
      seenSlugs.add(slug);

      // Try to get the artist name from visible text
      let artistName = '';

      // Check for headings or text in the link's context
      const $parent = $link.closest('[class*="artist"], [class*="card"], article, li, div');
      if ($parent.length > 0) {
        artistName = $parent.find('h2, h3, h4, .title, .name').first().text().trim();
      }

      // Try link text (filter out generic "View artist" text)
      if (!artistName) {
        const linkText = $link.text().trim();
        if (linkText && !linkText.toLowerCase().includes('view artist') && linkText.length < 60) {
          artistName = linkText;
        }
      }

      // Fall back to deslugifying the URL
      if (!artistName) {
        artistName = this.deslugify(slug);
      }

      if (!artistName || artistName.length < 2) return;

      // Try to extract stage/date from nearby elements
      let stageName: string | null = null;
      let dayLabel: string | null = null;
      if ($parent.length > 0) {
        const stageText = $parent.find('[class*="stage"]').first().text().trim();
        if (stageText && stageText.length < 30) stageName = stageText;
        const dateText = $parent.find('[class*="date"], time').first().text().trim();
        if (dateText && dateText.length < 30) dayLabel = dateText;
      }

      artists.push(
        ...this.processArtistName(artistName, {
          dayLabel,
          stageName,
          billing: null,
        })
      );
    });

    // 3. Fallback: look for artist names in page text near "line-up" sections
    if (artists.length === 0) {
      this.log('No /artist/ links found, trying text extraction');

      $('h2, h3, h4').each((_, el) => {
        const text = $(el).text().trim();
        if (!text || text.length < 2 || text.length > 60) return;
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
   * Convert a URL slug back to a readable name.
   * "armin-van-buuren" -> "Armin Van Buuren"
   * "kshmr" -> "KSHMR" (all-caps if 5 chars or less)
   */
  private deslugify(slug: string): string {
    const words = slug.split('-');
    return words.map((w) => {
      if (w.length <= 4 && w === w.toLowerCase()) {
        // Short words that are likely acronyms/DJ names: uppercase
        return w.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  /** Extract Algolia config from page HTML */
  private extractAlgoliaConfig(html: string): void {
    const appIdMatch = html.match(/(?:appId|applicationId)\s*[:=]\s*['"]([A-Z0-9]{10})['"]/i);
    if (appIdMatch) this.algoliaAppId = appIdMatch[1];

    const apiKeyMatch = html.match(/(?:apiKey|searchOnlyApiKey)\s*[:=]\s*['"]([a-f0-9]{32})['"]/i);
    if (apiKeyMatch) this.algoliaApiKey = apiKeyMatch[1];

    const indexMatch = html.match(/(?:indexName|index)\s*[:=]\s*['"]([\w_-]+ARTISTS[\w_-]*)['"]/i);
    if (indexMatch) this.algoliaIndex = indexMatch[1];
  }

  /** Fetch artists from Algolia API (may fail if index is gone) */
  private async fetchFromAlgolia(): Promise<FestivalArtist[]> {
    const url = `https://${this.algoliaAppId}-dsn.algolia.net/1/indexes/${this.algoliaIndex}/query`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': this.algoliaAppId,
          'X-Algolia-API-Key': this.algoliaApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: '', hitsPerPage: 1000, page: 0 }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.log(`Algolia API returned ${response.status}`);
        return [];
      }

      const data: AlgoliaSearchResponse = await response.json();
      const artists: FestivalArtist[] = [];

      for (const hit of data.hits) {
        const name = hit.name || hit.title;
        if (!name) continue;

        artists.push(
          ...this.processArtistName(name, {
            dayLabel: hit.day || hit.date || null,
            stageName: hit.stage || hit.stage_name || null,
            billing: this.inferBilling(hit),
          })
        );
      }

      return this.deduplicateArtists(artists);
    } finally {
      clearTimeout(timer);
    }
  }

  private inferBilling(hit: AlgoliaArtistHit): 'headliner' | 'support' | null {
    const showType = (hit.show_type || hit.category || '').toLowerCase();
    if (showType.includes('headliner')) return 'headliner';
    if (showType.includes('support') || showType.includes('opener')) return 'support';
    return null;
  }

  private isSkipText(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const skip = [
      'line-up', 'lineup', 'tickets', 'info', 'anreise', 'kontakt',
      'electric love', 'festival', 'view artist', 'load more',
      'filter', 'search', 'all stages', 'all dates',
    ];
    return skip.some((w) => lower === w);
  }
}
