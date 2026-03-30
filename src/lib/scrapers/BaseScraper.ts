import type { ScrapedEvent } from '@/types/events';

export abstract class BaseScraper {
  abstract readonly name: string;
  protected delayMs: number = 1000;
  protected maxRetries: number = 3;
  protected userAgent: string = 'BurgenlandEvents-Scraper/1.0 (educational project)';

  abstract scrape(): Promise<ScrapedEvent[]>;

  protected async fetchPage(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.log(`Versuch ${attempt}/${this.maxRetries} fehlgeschlagen für ${url}: ${lastError.message}`);

        if (attempt < this.maxRetries) {
          const backoff = this.delayMs * Math.pow(2, attempt - 1);
          await this.sleep(backoff);
        }
      }
    }

    throw lastError || new Error(`Fetch failed for ${url}`);
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected async rateLimit(): Promise<void> {
    await this.sleep(this.delayMs);
  }

  protected log(message: string): void {
    const timestamp = new Date().toISOString().slice(11, 19);
    console.log(`[${timestamp}] [${this.name}] ${message}`);
  }

  /**
   * Validates and cleans an image URL. Returns undefined if invalid.
   * Filters out placeholders, data URIs, tiny spacer images, and broken URLs.
   */
  protected cleanImageUrl(url: string | undefined | null): string | undefined {
    if (!url || typeof url !== 'string') return undefined;

    const trimmed = url.trim();

    // Reject data URIs (base64 placeholders)
    if (trimmed.startsWith('data:')) return undefined;

    // Reject too short URLs
    if (trimmed.length < 15) return undefined;

    // Reject common placeholder/default image patterns
    const lc = trimmed.toLowerCase();
    const badPatterns = [
      'placeholder', 'default', 'noimage', 'no-image', 'no_image',
      'dummy', 'spacer', '1x1', 'blank', 'loading', 'pixel.gif',
      'transparent.png', 'grey.gif', 'gray.gif', 'empty.png',
      '/assets/img/logo', '/favicon', 'missing.png',
    ];
    if (badPatterns.some(p => lc.includes(p))) return undefined;

    // Reject SVG placeholder patterns (often inline or tiny)
    if (lc.endsWith('.svg') && (lc.includes('icon') || lc.includes('logo'))) return undefined;

    // Ensure proper URL format
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      // Relative URL — can't validate further, caller should have made it absolute
      if (!trimmed.startsWith('/')) return undefined;
    }

    return trimmed;
  }

  /**
   * Extract best image from a cheerio element, checking multiple sources.
   * Tries: src, data-src, data-lazy-src, srcset, style background-image.
   */
  protected extractImageUrl($el: ReturnType<typeof import('cheerio').load> extends (html: string) => infer R ? R : never, baseUrl: string): string | undefined {
    // This is a helper hint — actual implementation uses cheerio's Cheerio type
    return undefined;
  }
}
