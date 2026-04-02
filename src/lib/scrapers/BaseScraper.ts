import type { ScrapedEvent } from '@/types/events';
import type { CheerioAPI } from 'cheerio';

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
      // Additional placeholder patterns
      'fallback', 'stock-photo', 'generic-image', 'default-event',
      'event-placeholder', 'kein-bild', 'no-photo', 'nophoto',
      'avatar-default', 'profile-default', 'thumbnail-default',
      'image-coming-soon', 'coming_soon', 'comingsoon',
      'sample-image', 'test-image', 'temp-image',
      '/images/logo', '/img/logo', '/static/logo',
      'platzhalter', 'standardbild', 'vorschaubild-fehlt',
    ];
    if (badPatterns.some(p => lc.includes(p))) return undefined;

    // Reject SVG placeholder patterns (often inline or tiny)
    if (lc.endsWith('.svg') && (lc.includes('icon') || lc.includes('logo'))) return undefined;

    // Reject common tracking/analytics pixels
    if (lc.includes('tracking') || lc.includes('analytics') || lc.includes('beacon')) return undefined;

    // Reject very common tiny image dimensions in URL (e.g., /1x1/, /2x2/, width=1)
    if (/[/&?](?:w|width|h|height)=(?:1|2)(?:&|$)/i.test(trimmed)) return undefined;

    // Reject URLs with spaces (often double-pasted URLs)
    if (trimmed.includes(' ')) return undefined;

    // Ensure proper URL format
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      // Relative URL — can't validate further, caller should have made it absolute
      if (!trimmed.startsWith('/')) return undefined;
    }

    return trimmed;
  }

  /**
   * Resolve a potentially relative URL to an absolute one.
   */
  protected resolveImageUrl(src: string, baseUrl: string): string {
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (src.startsWith('//')) return `https:${src}`;
    try {
      return new URL(src, baseUrl).href;
    } catch {
      return src;
    }
  }

  /**
   * Extract the best image URL from an HTML page using a cheerio instance.
   * Checks multiple sources in priority order:
   * 1. og:image meta tag
   * 2. JSON-LD image property
   * 3. Largest content image (img tags with reasonable dimensions)
   *
   * Returns cleaned, absolute URL or undefined.
   */
  protected extractImageUrl($: CheerioAPI, baseUrl: string): string | undefined {
    // 1. Try og:image meta tag (most reliable for event pages)
    const ogImage = $('meta[property="og:image"]').attr('content')
      || $('meta[name="og:image"]').attr('content');
    if (ogImage) {
      const resolved = this.resolveImageUrl(ogImage, baseUrl);
      const cleaned = this.cleanImageUrl(resolved);
      if (cleaned) return cleaned;
    }

    // Also try twitter:image
    const twitterImage = $('meta[name="twitter:image"]').attr('content')
      || $('meta[property="twitter:image"]').attr('content');
    if (twitterImage) {
      const resolved = this.resolveImageUrl(twitterImage, baseUrl);
      const cleaned = this.cleanImageUrl(resolved);
      if (cleaned) return cleaned;
    }

    // 2. Try JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, el) => {
      // Early return not possible in .each, handled via found variable
    });
    let jsonLdImage: string | undefined;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (jsonLdImage) return; // already found
      try {
        const text = $(el).html();
        if (!text) return;
        const data = JSON.parse(text);
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item) continue;
          const img = item.image;
          if (!img) continue;
          let url: string | undefined;
          if (typeof img === 'string') {
            url = img;
          } else if (Array.isArray(img) && img.length > 0) {
            const first = img[0];
            url = typeof first === 'string' ? first : first?.url || first?.contentUrl;
          } else if (typeof img === 'object') {
            url = img.url || img.contentUrl;
          }
          if (url) {
            const resolved = this.resolveImageUrl(url, baseUrl);
            const cleaned = this.cleanImageUrl(resolved);
            if (cleaned) {
              jsonLdImage = cleaned;
              return;
            }
          }
        }
      } catch {
        // Invalid JSON-LD, skip
      }
    });
    if (jsonLdImage) return jsonLdImage;

    // 3. Try large content images (skip icons, logos, tiny images)
    const candidates: Array<{ url: string; score: number }> = [];
    $('img').each((_, el) => {
      const $img = $(el);
      const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
      if (!src) return;

      const resolved = this.resolveImageUrl(src, baseUrl);
      const cleaned = this.cleanImageUrl(resolved);
      if (!cleaned) return;

      // Score images by likely relevance
      let score = 0;
      const width = parseInt($img.attr('width') || '0', 10);
      const height = parseInt($img.attr('height') || '0', 10);

      // Skip tiny images (likely icons/spacers)
      if ((width > 0 && width < 50) || (height > 0 && height < 50)) return;

      // Prefer larger images
      if (width >= 300 || height >= 200) score += 3;
      if (width >= 600 || height >= 400) score += 2;

      // Prefer images in article/main content areas
      const parent = $img.closest('article, main, .content, .event, [class*="event"], [class*="detail"]');
      if (parent.length > 0) score += 4;

      // Prefer images with alt text containing event-related words
      const alt = ($img.attr('alt') || '').toLowerCase();
      if (alt && alt.length > 5) score += 1;

      // Downgrade header/footer images
      const inHeader = $img.closest('header, nav, footer, .header, .footer, .nav').length > 0;
      if (inHeader) score -= 3;

      candidates.push({ url: cleaned, score });
    });

    // Also check srcset for higher-res versions
    $('img[srcset]').each((_, el) => {
      const $img = $(el);
      const srcset = $img.attr('srcset');
      if (!srcset) return;

      // Parse srcset and pick the largest
      const parts = srcset.split(',').map(s => s.trim());
      let bestUrl = '';
      let bestWidth = 0;
      for (const part of parts) {
        const [url, descriptor] = part.split(/\s+/);
        if (!url) continue;
        const w = parseInt(descriptor || '0', 10);
        if (w > bestWidth) {
          bestWidth = w;
          bestUrl = url;
        }
      }
      if (bestUrl && bestWidth >= 300) {
        const resolved = this.resolveImageUrl(bestUrl, baseUrl);
        const cleaned = this.cleanImageUrl(resolved);
        if (cleaned) {
          candidates.push({ url: cleaned, score: 5 });
        }
      }
    });

    // Return highest-scoring candidate
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].url;
    }

    return undefined;
  }

  /**
   * Validate an image URL by sending a HEAD request with a timeout.
   * Returns true if the URL resolves to a 2xx status with an image content type.
   */
  protected async validateImageUrl(url: string, timeoutMs: number = 5000): Promise<boolean> {
    if (!url) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          headers: { 'User-Agent': this.userAgent },
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timer);
        if (!response.ok) return false;
        const contentType = response.headers.get('content-type') || '';
        return contentType.startsWith('image/');
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }
}
