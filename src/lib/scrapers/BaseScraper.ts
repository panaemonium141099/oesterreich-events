import type { ScrapedEvent } from '@/types/events';
import type { CheerioAPI } from 'cheerio';

/**
 * Pick the largest variant from a `srcset` string.
 *
 * Per the HTML spec each comma-separated candidate is `<url> <descriptor>`
 * where the descriptor is either `Nw` (intrinsic width in CSS px) or
 * `Nx` (pixel density). The two descriptor types should not be mixed
 * within a single srcset, but real-world HTML mixes them anyway, so
 * we handle both:
 *
 *   - If any candidate has a `w` descriptor → pick the largest `w` and
 *     report that as `width`. (Real pixels > device-pixel-ratio.)
 *   - If only `x` descriptors → pick the highest density and leave
 *     `width` undefined (descriptor doesn't carry pixel size).
 *   - If a candidate has no descriptor it implicitly means `1x`.
 *
 * Exported so tests can target it directly.
 */
export function pickLargestFromSrcset(
  srcset: string,
): { url: string; width?: number } | null {
  if (!srcset) return null;

  const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let bestWidth = 0;
  let bestWidthUrl = '';
  let bestDensity = 0;
  let bestDensityUrl = '';

  for (const part of parts) {
    // Split on whitespace; first token is URL, second (optional) is descriptor.
    const tokens = part.split(/\s+/);
    const url = tokens[0];
    if (!url) continue;
    const descriptor = tokens[1] ?? '1x';

    // Width descriptor: digits followed by literal `w`
    const wMatch = /^(\d+)w$/i.exec(descriptor);
    if (wMatch) {
      const w = parseInt(wMatch[1], 10);
      if (w > bestWidth) {
        bestWidth = w;
        bestWidthUrl = url;
      }
      continue;
    }

    // Density descriptor: number (with optional decimals) followed by `x`
    const xMatch = /^(\d+(?:\.\d+)?)x$/i.exec(descriptor);
    if (xMatch) {
      const d = parseFloat(xMatch[1]);
      if (d > bestDensity) {
        bestDensity = d;
        bestDensityUrl = url;
      }
      continue;
    }

    // Unknown descriptor — treat as 1x density candidate (lowest priority).
    if (bestDensity < 1) {
      bestDensity = 1;
      bestDensityUrl = url;
    }
  }

  // Width descriptor wins (real pixels). Otherwise density picker.
  if (bestWidth > 0) {
    return { url: bestWidthUrl, width: bestWidth };
  }
  if (bestDensityUrl) {
    return { url: bestDensityUrl };
  }
  return null;
}

export abstract class BaseScraper {
  abstract readonly name: string;
  protected delayMs: number = 1000;
  protected maxRetries: number = 3;
  protected userAgent: string = 'BurgenlandEvents-Scraper/1.0 (educational project)';

  abstract scrape(): Promise<ScrapedEvent[]>;

  /** Request timeout in milliseconds (default: 30s) */
  protected fetchTimeoutMs: number = 30000;

  protected async fetchPage(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
          lastError = new Error(`Timeout nach ${this.fetchTimeoutMs}ms für ${url}`);
        }
        this.log(`Versuch ${attempt}/${this.maxRetries} fehlgeschlagen für ${url}: ${lastError.message}`);

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
   *
   * **Sync boundary:** kept sync + return type unchanged so the ~300
   * existing scrapers don't need updating. New scrapers that want
   * width/height should call `extractImageCandidate()` instead — both
   * methods walk the same DOM but the candidate variant carries
   * dimensions through.
   */
  protected extractImageUrl($: CheerioAPI, baseUrl: string): string | undefined {
    return this.extractImageCandidate($, baseUrl)?.url;
  }

  /**
   * Like `extractImageUrl()` but returns the full candidate record
   * including width / height (when extractable from HTML attributes
   * or srcset descriptors) and the internal score.
   *
   * Score breakdown:
   *   og:image / twitter:image  → base 4
   *   JSON-LD image             → base 3
   *   srcset largest            → base 5
   *   <img> in content area     → base 5 if width ≥ 800, else 3
   *   + content-area bonus      → +4
   *   + alt-text bonus          → +1
   *   − header/footer penalty   → −3
   *
   * Returns the highest-scoring candidate, or `undefined` when none
   * could be extracted.
   */
  protected extractImageCandidate(
    $: CheerioAPI,
    baseUrl: string,
  ): { url: string; width?: number; height?: number; score: number } | undefined {
    const candidates: Array<{ url: string; width?: number; height?: number; score: number }> = [];

    // 1. og:image (most reliable for event pages)
    const ogImage = $('meta[property="og:image"]').attr('content')
      || $('meta[name="og:image"]').attr('content');
    if (ogImage) {
      const resolved = this.resolveImageUrl(ogImage, baseUrl);
      const cleaned = this.cleanImageUrl(resolved);
      if (cleaned) {
        const w = parseInt($('meta[property="og:image:width"]').attr('content') || '0', 10) || undefined;
        const h = parseInt($('meta[property="og:image:height"]').attr('content') || '0', 10) || undefined;
        candidates.push({ url: cleaned, width: w, height: h, score: 4 });
      }
    }

    // twitter:image
    const twitterImage = $('meta[name="twitter:image"]').attr('content')
      || $('meta[property="twitter:image"]').attr('content');
    if (twitterImage) {
      const resolved = this.resolveImageUrl(twitterImage, baseUrl);
      const cleaned = this.cleanImageUrl(resolved);
      if (cleaned) {
        candidates.push({ url: cleaned, score: 4 });
      }
    }

    // 2. JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, el) => {
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
          let width: number | undefined;
          let height: number | undefined;
          if (typeof img === 'string') {
            url = img;
          } else if (Array.isArray(img) && img.length > 0) {
            const first = img[0];
            if (typeof first === 'string') {
              url = first;
            } else if (first) {
              url = first.url || first.contentUrl;
              width = typeof first.width === 'number' ? first.width : undefined;
              height = typeof first.height === 'number' ? first.height : undefined;
            }
          } else if (typeof img === 'object') {
            url = img.url || img.contentUrl;
            width = typeof img.width === 'number' ? img.width : undefined;
            height = typeof img.height === 'number' ? img.height : undefined;
          }
          if (url) {
            const resolved = this.resolveImageUrl(url, baseUrl);
            const cleaned = this.cleanImageUrl(resolved);
            if (cleaned) {
              candidates.push({ url: cleaned, width, height, score: 3 });
            }
          }
        }
      } catch {
        // Invalid JSON-LD, skip
      }
    });

    // 3. <img> tags in body content
    $('img').each((_, el) => {
      const $img = $(el);
      const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
      if (!src) return;

      const resolved = this.resolveImageUrl(src, baseUrl);
      const cleaned = this.cleanImageUrl(resolved);
      if (!cleaned) return;

      const width = parseInt($img.attr('width') || '0', 10) || undefined;
      const height = parseInt($img.attr('height') || '0', 10) || undefined;

      // Skip tiny images (likely icons/spacers)
      if ((width !== undefined && width < 50) || (height !== undefined && height < 50)) return;

      // Base score: bigger image → higher base.
      let score = 0;
      if ((width ?? 0) >= 800) score = 5;
      else if ((width ?? 0) >= 300 || (height ?? 0) >= 200) score = 3;

      if ((width ?? 0) >= 600 || (height ?? 0) >= 400) score += 2;

      // Content-area bonus
      const parent = $img.closest('article, main, .content, .event, [class*="event"], [class*="detail"]');
      if (parent.length > 0) score += 4;

      // Alt-text bonus
      const alt = ($img.attr('alt') || '').toLowerCase();
      if (alt && alt.length > 5) score += 1;

      // Header/footer penalty
      const inHeader = $img.closest('header, nav, footer, .header, .footer, .nav').length > 0;
      if (inHeader) score -= 3;

      candidates.push({ url: cleaned, width, height, score });
    });

    // 4. srcset — pick the largest variant. Supports both `Nw` width
    //    descriptors and `Nx` density descriptors. Width descriptors
    //    win over density when both are present (real pixels > DPR).
    $('img[srcset], source[srcset]').each((_, el) => {
      const $img = $(el);
      const srcset = $img.attr('srcset');
      if (!srcset) return;

      const picked = pickLargestFromSrcset(srcset);
      if (!picked) return;

      const resolved = this.resolveImageUrl(picked.url, baseUrl);
      const cleaned = this.cleanImageUrl(resolved);
      if (!cleaned) return;

      candidates.push({
        url: cleaned,
        width: picked.width,
        score: 5,
      });
    });

    if (candidates.length === 0) return undefined;

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  /**
   * Convenience helper: given a cheerio `<img>` element, return its
   * cleaned URL plus any width/height attributes the markup carried.
   *
   * Used by scrapers that already locate the image via their own
   * selectors (rather than calling `extractImageCandidate()` on the
   * whole page) but still want HTML-attribute dims to flow into the
   * upsert. Returns `null` when the element has no usable URL.
   *
   * Pure / sync. Reads `src`, `data-src`, `data-lazy-src` (in that
   * order) plus `srcset` (largest variant wins via the same parser the
   * full-page extractor uses).
   */
  protected imageFromElement(
    // We accept an unknown cheerio element wrapper; the caller passes
    // either `$el` or a typed `Cheerio<Element>` — both expose the
    // attribute API we need.
    $img: { attr(name: string): string | undefined },
    baseUrl: string,
  ): { url: string; image_width?: number; image_height?: number } | null {
    if (!$img) return null;
    const direct = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
    let urlGuess: string | undefined = direct ? direct : undefined;
    let widthGuess = parseInt($img.attr('width') || '0', 10) || undefined;
    let heightGuess = parseInt($img.attr('height') || '0', 10) || undefined;

    // srcset wins when present (real pixels). Fall back to plain src.
    const srcset = $img.attr('srcset');
    if (srcset) {
      const picked = pickLargestFromSrcset(srcset);
      if (picked && picked.url) {
        urlGuess = picked.url;
        if (picked.width) widthGuess = picked.width;
      }
    }

    if (!urlGuess) return null;

    const resolved = this.resolveImageUrl(urlGuess, baseUrl);
    const cleaned = this.cleanImageUrl(resolved);
    if (!cleaned) return null;
    return {
      url: cleaned,
      ...(widthGuess ? { image_width: widthGuess } : {}),
      ...(heightGuess ? { image_height: heightGuess } : {}),
    };
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
