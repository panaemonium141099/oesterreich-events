/**
 * Electric Love Festival Lineup Scraper
 *
 * Source: https://www.electriclove.at/en/line-up/
 * Structure: Client-side rendered via Algolia search. The HTML page embeds
 *   an Algolia configuration (appId + public search API key + index name).
 *   We query the Algolia REST API directly to get all artists.
 *
 * Algolia index: DEV_ARTISTS (appId: 5QVRQ5REXW, public search key embedded in page)
 *
 * Fallback: If Algolia fails or config changes, fall back to parsing
 * any artist links present in the static HTML.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

import { BaseLineupScraper } from '../BaseLineupScraper';
import type { FestivalArtist } from '../types';

/** Shape of an Algolia artist hit (subset of fields we care about) */
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
  readonly festivalSlug = 'electric-love';
  readonly lineupUrl = 'https://www.electriclove.at/en/line-up/';

  // Algolia public search credentials (embedded in the lineup page source)
  private algoliaAppId = '5QVRQ5REXW';
  private algoliaApiKey = '074690868e3c707f03aa1e755b866065';
  private algoliaIndex = 'DEV_ARTISTS';

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

    // 2. Try extracting Algolia config from HTML (in case it changed)
    this.extractAlgoliaConfig(html);

    // 3. Fall back to static HTML parsing (artist links)
    this.log('Attempting static HTML artist link extraction as fallback');
    return this.parseStaticHtml(html);
  }

  /**
   * Override run() to attempt Algolia API fetch first, then fall back to
   * standard HTML scraping.
   */
  async run(): Promise<ReturnType<BaseLineupScraper['run']>> {
    const startedAt = new Date();
    this.log(`Starting lineup scrape for Electric Love`);

    try {
      // First, fetch the HTML page to get current Algolia config
      const html = await this.fetchPage(this.lineupUrl);
      this.extractAlgoliaConfig(html);

      // Try Algolia API
      const algoliaArtists = await this.fetchFromAlgolia();
      if (algoliaArtists.length > 0) {
        this.log(`Fetched ${algoliaArtists.length} artists from Algolia API`);
        return {
          festivalId: this.festivalSlug,
          artists: algoliaArtists,
          scrapedAt: startedAt.toISOString(),
          success: true,
        };
      }

      // Fall back to HTML parsing
      this.log('Algolia returned 0 results, falling back to HTML');
      const artists = this.scrapeLineup(html);
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
   * Extract Algolia configuration from the page HTML.
   * Updates instance fields if found.
   */
  private extractAlgoliaConfig(html: string): void {
    // Look for Algolia app ID pattern
    const appIdMatch = html.match(
      /(?:appId|applicationId|app_id)\s*[:=]\s*['"]([A-Z0-9]{10})['"/]/i
    );
    if (appIdMatch) {
      this.algoliaAppId = appIdMatch[1];
    }

    // Look for API key
    const apiKeyMatch = html.match(
      /(?:apiKey|searchOnlyApiKey|search_api_key|api_key)\s*[:=]\s*['"]([a-f0-9]{32})['"]/i
    );
    if (apiKeyMatch) {
      this.algoliaApiKey = apiKeyMatch[1];
    }

    // Look for index name
    const indexMatch = html.match(
      /(?:indexName|index_name|index)\s*[:=]\s*['"]([\w_-]+ARTISTS[\w_-]*)['"]/i
    );
    if (indexMatch) {
      this.algoliaIndex = indexMatch[1];
    }
  }

  /**
   * Fetch all artists from the Algolia search API.
   * Pages through results (1000 per page max) until all are retrieved.
   */
  private async fetchFromAlgolia(): Promise<FestivalArtist[]> {
    const artists: FestivalArtist[] = [];
    let page = 0;
    const hitsPerPage = 1000;

    // eslint-disable-next-line no-constant-condition
    while (true) {
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
          body: JSON.stringify({
            query: '',
            hitsPerPage,
            page,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          this.log(
            `Algolia API returned ${response.status}: ${response.statusText}`
          );
          break;
        }

        const data: AlgoliaSearchResponse = await response.json();

        for (const hit of data.hits) {
          const name = hit.name || hit.title;
          if (!name) continue;

          const dayLabel = hit.day || hit.date || null;
          const stageName = hit.stage || hit.stage_name || null;
          const billing = this.inferBilling(hit);

          artists.push(
            ...this.processArtistName(name, {
              dayLabel,
              stageName,
              billing,
            })
          );
        }

        // Check if we need more pages
        if (page >= data.nbPages - 1 || data.hits.length < hitsPerPage) {
          break;
        }

        page++;
        await this.rateLimit();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`Algolia fetch error on page ${page}: ${msg}`);
        break;
      } finally {
        clearTimeout(timer);
      }
    }

    return this.deduplicateArtists(artists);
  }

  /**
   * Infer billing tier from Algolia hit data.
   */
  private inferBilling(
    hit: AlgoliaArtistHit
  ): 'headliner' | 'support' | null {
    const showType = (hit.show_type || hit.category || '').toLowerCase();
    if (showType.includes('headliner')) return 'headliner';
    if (showType.includes('support') || showType.includes('opener'))
      return 'support';
    return null;
  }

  /**
   * Parse artist names from static HTML (fallback when Algolia is unavailable).
   */
  private parseStaticHtml(html: string): FestivalArtist[] {
    const $ = this.loadHtml(html);
    const artists: FestivalArtist[] = [];

    // Electric Love uses <a href="/en/artist/..."> for artist links
    $('a[href*="/artist/"]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';
      if (!href.match(/\/artist\/[^/]+\/?$/)) return;

      const artistName =
        $link.find('h3, h2, h4').first().text().trim() ||
        $link.find('img').first().attr('alt')?.trim() ||
        $link.text().trim();

      if (!artistName) return;

      artists.push(
        ...this.processArtistName(artistName, {
          dayLabel: null,
          stageName: null,
          billing: null,
        })
      );
    });

    return this.deduplicateArtists(artists);
  }
}
