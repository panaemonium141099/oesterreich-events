/**
 * Base class for festival lineup scrapers.
 *
 * Provides fetchPage() with retry/backoff, rateLimit(), and a run()
 * orchestration method. Subclasses implement scrapeLineup(html) to
 * extract FestivalArtist[] from the raw HTML of a lineup page.
 *
 * Pattern adapted from src/lib/scrapers/BaseScraper.ts.
 *
 * Task: fn-12-festival-lineup-ingestion-pipeline.4
 */

import * as cheerio from 'cheerio';
import type { FestivalArtist, FestivalLineupResult } from './types';
import { normalizeArtistName, splitCollaborativeBooking } from './normalize';

export { normalizeArtistName, splitCollaborativeBooking };

export abstract class BaseLineupScraper {
  /** Human-readable scraper name for logging */
  abstract readonly name: string;

  /** Festival slug used as festivalId in results */
  abstract readonly festivalSlug: string;

  /** Primary lineup URL to scrape */
  abstract readonly lineupUrl: string;

  /** Delay between requests to the same domain (ms) */
  protected delayMs: number = 1500;

  /** Max retry attempts per request */
  protected maxRetries: number = 3;

  /** Request timeout (ms) */
  protected fetchTimeoutMs: number = 30000;

  /** User-Agent header */
  protected userAgent: string =
    'BurgenlandEvents-LineupScraper/1.0 (educational project)';

  // ── Abstract method ──────────────────────────────────────────────────

  /**
   * Extract artist entries from a lineup page's HTML.
   * Subclasses parse the Cheerio DOM and return one FestivalArtist per
   * individual artist (collaborative bookings already split).
   */
  abstract scrapeLineup(html: string): FestivalArtist[];

  // ── Public orchestration ─────────────────────────────────────────────

  /**
   * Run the full scrape pipeline: fetch -> parse -> return result.
   */
  async run(): Promise<FestivalLineupResult> {
    const startedAt = new Date();
    this.log(`Starting lineup scrape from ${this.lineupUrl}`);

    try {
      const html = await this.fetchPage(this.lineupUrl);
      const artists = this.scrapeLineup(html);

      this.log(`Extracted ${artists.length} artists`);

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

  // ── Fetch with retry/backoff ─────────────────────────────────────────

  protected async fetchPage(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (controller.signal.aborted) {
          lastError = new Error(`Timeout after ${this.fetchTimeoutMs}ms for ${url}`);
        }
        this.log(
          `Attempt ${attempt}/${this.maxRetries} failed for ${url}: ${lastError.message}`
        );

        if (attempt < this.maxRetries) {
          const backoff = this.delayMs * Math.pow(2, attempt - 1);
          await this.sleep(backoff);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error(`Fetch failed for ${url}`);
  }

  // ── JSON-LD extraction helper ────────────────────────────────────────

  /**
   * Attempt to extract performer names from JSON-LD structured data.
   * Returns an array of raw artist names, or empty if no JSON-LD found.
   *
   * Checks for Event or MusicEvent types with `performer` arrays.
   */
  protected extractFromJsonLd(html: string): string[] {
    const $ = cheerio.load(html);
    const artists: string[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).html();
        if (!text) return;

        const data = JSON.parse(text);
        const items = Array.isArray(data)
          ? data
          : data['@graph']
            ? data['@graph']
            : [data];

        for (const item of items) {
          if (!item) continue;

          // Look for Event or MusicEvent with performer array
          const type = item['@type'];
          if (
            type === 'Event' ||
            type === 'MusicEvent' ||
            type === 'Festival' ||
            (Array.isArray(type) &&
              type.some(
                (t: string) =>
                  t === 'Event' || t === 'MusicEvent' || t === 'Festival'
              ))
          ) {
            const performers = item.performer || item.performers;
            if (Array.isArray(performers)) {
              for (const p of performers) {
                const name =
                  typeof p === 'string' ? p : p?.name || p?.['@name'];
                if (name && typeof name === 'string') {
                  artists.push(name.trim());
                }
              }
            }
          }
        }
      } catch {
        // Invalid JSON-LD, skip
      }
    });

    return artists;
  }

  // ── Collaborative booking processing ─────────────────────────────────

  /**
   * Process a raw artist name: split collaborative bookings and normalize
   * each resulting name. Returns one FestivalArtist per individual artist.
   */
  protected processArtistName(
    rawName: string,
    opts: {
      dayLabel: string | null;
      stageName: string | null;
      billing: 'headliner' | 'support' | null;
    }
  ): FestivalArtist[] {
    const parts = splitCollaborativeBooking(rawName);

    return parts.map((normalized) => ({
      artist_name_raw: parts.length > 1 ? normalized : rawName.trim(),
      artist_name_normalized: normalized,
      day_label: opts.dayLabel,
      stage_name: opts.stageName,
      billing: opts.billing,
      source_url: this.lineupUrl,
      source_type: 'official_lineup' as const,
      confidence_score: 1.0,
    }));
  }

  // ── Utilities ────────────────────────────────────────────────────────

  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async rateLimit(): Promise<void> {
    await this.sleep(this.delayMs);
  }

  protected log(message: string): void {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(`[${timestamp}] [${this.name}] ${message}`);
  }

  /**
   * Load HTML into a Cheerio instance. Convenience for subclasses.
   */
  protected loadHtml(html: string) {
    return cheerio.load(html);
  }

  /**
   * Deduplicate artists by normalized name within a single scrape result.
   * Keeps the first occurrence (preserves day/stage from first entry).
   */
  protected deduplicateArtists(artists: FestivalArtist[]): FestivalArtist[] {
    const seen = new Set<string>();
    return artists.filter((a) => {
      if (seen.has(a.artist_name_normalized)) return false;
      seen.add(a.artist_name_normalized);
      return true;
    });
  }
}
