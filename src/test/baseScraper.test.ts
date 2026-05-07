import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';

// We need to test BaseScraper's protected methods via a concrete subclass
class TestScraper {
  // Expose protected methods for testing by re-implementing the logic
  // We import BaseScraper dynamically to test the actual code
}

// Import the actual BaseScraper and create a test subclass
import { BaseScraper } from '@/lib/scrapers/BaseScraper';
import type { ScrapedEvent } from '@/types/events';

class TestableBaseScraper extends BaseScraper {
  readonly name = 'test-scraper';
  async scrape(): Promise<ScrapedEvent[]> {
    return [];
  }

  // Expose protected methods
  public testCleanImageUrl(url: string | undefined | null): string | undefined {
    return this.cleanImageUrl(url);
  }

  public testExtractImageUrl($: ReturnType<typeof cheerio.load>, baseUrl: string): string | undefined {
    return this.extractImageUrl($, baseUrl);
  }

  public testExtractImageCandidate(
    $: ReturnType<typeof cheerio.load>,
    baseUrl: string,
  ): { url: string; width?: number; height?: number; score: number } | undefined {
    return this.extractImageCandidate($, baseUrl);
  }

  public testResolveImageUrl(src: string, baseUrl: string): string {
    return this.resolveImageUrl(src, baseUrl);
  }

  public testValidateImageUrl(url: string, timeoutMs?: number): Promise<boolean> {
    return this.validateImageUrl(url, timeoutMs);
  }
}

describe('BaseScraper', () => {
  const scraper = new TestableBaseScraper();

  describe('cleanImageUrl', () => {
    it('returns undefined for null/undefined/empty', () => {
      expect(scraper.testCleanImageUrl(null)).toBeUndefined();
      expect(scraper.testCleanImageUrl(undefined)).toBeUndefined();
      expect(scraper.testCleanImageUrl('')).toBeUndefined();
    });

    it('returns undefined for data URIs', () => {
      expect(scraper.testCleanImageUrl('data:image/png;base64,abc')).toBeUndefined();
    });

    it('returns undefined for short URLs', () => {
      expect(scraper.testCleanImageUrl('http://x.co')).toBeUndefined();
    });

    it('returns undefined for placeholder patterns', () => {
      expect(scraper.testCleanImageUrl('https://example.com/placeholder.jpg')).toBeUndefined();
      expect(scraper.testCleanImageUrl('https://example.com/noimage.png')).toBeUndefined();
      expect(scraper.testCleanImageUrl('https://example.com/default-event.jpg')).toBeUndefined();
      expect(scraper.testCleanImageUrl('https://example.com/kein-bild.png')).toBeUndefined();
      expect(scraper.testCleanImageUrl('https://example.com/fallback.jpg')).toBeUndefined();
      expect(scraper.testCleanImageUrl('https://example.com/coming_soon.jpg')).toBeUndefined();
    });

    it('returns undefined for tracking pixels', () => {
      expect(scraper.testCleanImageUrl('https://example.com/tracking/pixel.gif')).toBeUndefined();
      expect(scraper.testCleanImageUrl('https://example.com/analytics.gif')).toBeUndefined();
    });

    it('returns undefined for tiny dimension URLs', () => {
      expect(scraper.testCleanImageUrl('https://example.com/img?w=1&h=1')).toBeUndefined();
    });

    it('returns valid URLs as-is', () => {
      expect(scraper.testCleanImageUrl('https://example.com/event-photo.jpg')).toBe('https://example.com/event-photo.jpg');
      expect(scraper.testCleanImageUrl('https://cdn.example.com/images/large/concert.webp')).toBe('https://cdn.example.com/images/large/concert.webp');
    });

    it('trims whitespace', () => {
      expect(scraper.testCleanImageUrl('  https://example.com/photo.jpg  ')).toBe('https://example.com/photo.jpg');
    });

    it('accepts absolute paths', () => {
      expect(scraper.testCleanImageUrl('/images/event/large-photo.jpg')).toBe('/images/event/large-photo.jpg');
    });
  });

  describe('resolveImageUrl', () => {
    it('returns absolute URLs unchanged', () => {
      expect(scraper.testResolveImageUrl('https://cdn.example.com/img.jpg', 'https://example.com'))
        .toBe('https://cdn.example.com/img.jpg');
    });

    it('resolves protocol-relative URLs', () => {
      expect(scraper.testResolveImageUrl('//cdn.example.com/img.jpg', 'https://example.com'))
        .toBe('https://cdn.example.com/img.jpg');
    });

    it('resolves relative URLs against base', () => {
      expect(scraper.testResolveImageUrl('/images/photo.jpg', 'https://example.com/events/123'))
        .toBe('https://example.com/images/photo.jpg');
    });
  });

  describe('extractImageUrl', () => {
    it('extracts og:image', () => {
      const html = `
        <html>
          <head><meta property="og:image" content="https://example.com/og-photo.jpg"></head>
          <body><p>Hello</p></body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/og-photo.jpg');
    });

    it('extracts twitter:image when no og:image', () => {
      const html = `
        <html>
          <head><meta name="twitter:image" content="https://example.com/twitter-photo.jpg"></head>
          <body><p>Hello</p></body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/twitter-photo.jpg');
    });

    it('extracts from JSON-LD', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@type": "Event", "name": "Concert", "image": "https://example.com/jsonld-photo.jpg"}
            </script>
          </head>
          <body><p>Hello</p></body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/jsonld-photo.jpg');
    });

    it('extracts from JSON-LD @graph', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@graph": [{"@type": "Event", "image": {"url": "https://example.com/graph-photo.jpg"}}]}
            </script>
          </head>
          <body><p>Hello</p></body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/graph-photo.jpg');
    });

    it('extracts from img tags in content area', () => {
      const html = `
        <html>
          <body>
            <article class="event">
              <img src="https://example.com/event-photo.jpg" width="800" height="600" alt="Event photo">
            </article>
          </body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/event-photo.jpg');
    });

    it('prefers a large content <img> in an article over og:image (best-of-source scoring)', () => {
      // fn-14.5: extractImageUrl is no longer og-first. og:image scores 4
      // (sharing-oriented), while a >=800w content image inside <article>
      // scores 5 + 4 (content-area) = 9, so it wins. The Detail-Hero gets
      // a real photograph instead of the typically-cropped 1200x630 og.
      const html = `
        <html>
          <head><meta property="og:image" content="https://example.com/og-photo.jpg"></head>
          <body>
            <article>
              <img src="https://example.com/body-photo.jpg" width="800" height="600">
            </article>
          </body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/body-photo.jpg');
    });

    it('falls back to og:image when no large content <img> exists', () => {
      const html = `
        <html>
          <head><meta property="og:image" content="https://example.com/og-photo.jpg"></head>
          <body>
            <p>Some text, no image candidates.</p>
          </body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/og-photo.jpg');
    });

    it('skips placeholder og:image and falls through', () => {
      const html = `
        <html>
          <head><meta property="og:image" content="https://example.com/placeholder.jpg"></head>
          <body>
            <article>
              <img src="https://example.com/real-photo.jpg" width="600" height="400">
            </article>
          </body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/real-photo.jpg');
    });

    it('resolves relative og:image URLs', () => {
      const html = `
        <html>
          <head><meta property="og:image" content="/uploads/event-photo.jpg"></head>
          <body><p>Hello</p></body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/uploads/event-photo.jpg');
    });

    it('returns undefined when no valid images found', () => {
      const html = `<html><body><p>No images here</p></body></html>`;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBeUndefined();
    });

    it('handles data-src for lazy-loaded images', () => {
      const html = `
        <html>
          <body>
            <main>
              <img data-src="https://example.com/lazy-photo.jpg" width="600" height="400">
            </main>
          </body>
        </html>
      `;
      const $ = cheerio.load(html);
      expect(scraper.testExtractImageUrl($, 'https://example.com')).toBe('https://example.com/lazy-photo.jpg');
    });
  });

  describe('validateImageUrl', () => {
    it('returns false for empty URL', async () => {
      expect(await scraper.testValidateImageUrl('')).toBe(false);
    });

    // Note: network-dependent tests would need mocking in a real test suite
    // We test the timeout and error handling paths
    it('returns false for unreachable URLs', async () => {
      expect(await scraper.testValidateImageUrl('https://thisdomaindoesnotexist12345.com/img.jpg', 1000)).toBe(false);
    });
  });

  describe('extractImageCandidate (fn-14.5)', () => {
    it('returns width/height from og:image:width / og:image:height meta', () => {
      const html = `
        <html><head>
          <meta property="og:image" content="https://example.com/og.jpg">
          <meta property="og:image:width" content="1200">
          <meta property="og:image:height" content="630">
        </head><body><p>x</p></body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate?.url).toBe('https://example.com/og.jpg');
      expect(candidate?.width).toBe(1200);
      expect(candidate?.height).toBe(630);
    });

    it('extracts width/height from <img> tags', () => {
      const html = `
        <html><body>
          <article>
            <img src="https://example.com/photo.jpg" width="1024" height="768" alt="Concert">
          </article>
        </body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate?.url).toBe('https://example.com/photo.jpg');
      expect(candidate?.width).toBe(1024);
      expect(candidate?.height).toBe(768);
    });

    it('parses srcset with width descriptors and picks the largest', () => {
      const html = `
        <html><body>
          <article>
            <img srcset="small.jpg 400w, medium.jpg 800w, large.jpg 1600w" alt="event">
          </article>
        </body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate?.url).toBe('https://example.com/large.jpg');
      expect(candidate?.width).toBe(1600);
    });

    it('parses srcset with density descriptors when no widths are present', () => {
      const html = `
        <html><body>
          <article>
            <img src="base.jpg" srcset="base.jpg 1x, retina.jpg 2x, hires.jpg 3x" alt="event">
          </article>
        </body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate?.url).toBe('https://example.com/hires.jpg');
      expect(candidate?.width).toBeUndefined();
    });

    it('prefers w over x when srcset mixes them', () => {
      const html = `
        <html><body>
          <article>
            <img srcset="dpr.jpg 2x, real.jpg 1200w" alt="event">
          </article>
        </body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate?.url).toBe('https://example.com/real.jpg');
      expect(candidate?.width).toBe(1200);
    });

    it('skips tiny images (icons / spacers)', () => {
      const html = `
        <html><body>
          <img src="https://example.com/icon.png" width="20" height="20">
        </body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate).toBeUndefined();
    });

    it('penalises images in headers/footers', () => {
      const html = `
        <html><body>
          <header>
            <img src="https://example.com/logo.jpg" width="800" height="200" alt="site logo">
          </header>
          <article>
            <img src="https://example.com/event.jpg" width="800" height="600" alt="event">
          </article>
        </body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate?.url).toBe('https://example.com/event.jpg');
    });

    it('picks srcset variant over src when both are on the same element (Codex regression test)', () => {
      // <img src="small" srcset="large 1600w"> inside <article> must
      // pick `large` AND get the article bonus — the small src
      // candidate must not steal the score.
      const html = `
        <html><body>
          <article>
            <img src="https://example.com/small.jpg"
                 srcset="https://example.com/large.jpg 1600w"
                 width="400" height="300"
                 alt="Concert hall">
          </article>
        </body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate?.url).toBe('https://example.com/large.jpg');
      expect(candidate?.width).toBe(1600);
      // Height NOT carried from the rendered-box attr — the variant
      // we picked has its own intrinsic ratio, the layout box dim
      // would be misleading.
      expect(candidate?.height).toBeUndefined();
    });

    it('picks <picture><source srcset> over fallback <img src> with content bonuses (Codex regression test)', () => {
      // <picture> with multiple <source> media-queries plus an <img>
      // fallback. The largest source URL must win AND inherit the
      // surrounding <article> content bonus — without this fix, a
      // small fallback <img> in the article scored higher than the
      // flat-scored <source> variant.
      const html = `
        <html><body>
          <article>
            <picture>
              <source srcset="https://example.com/desktop-1600.jpg 1600w" media="(min-width: 800px)">
              <source srcset="https://example.com/tablet-1024.jpg 1024w" media="(min-width: 500px)">
              <img src="https://example.com/mobile-fallback.jpg"
                   width="400" height="300"
                   alt="Concert poster">
            </picture>
          </article>
        </body></html>
      `;
      const $ = cheerio.load(html);
      const candidate = scraper.testExtractImageCandidate($, 'https://example.com');
      expect(candidate?.url).toBe('https://example.com/desktop-1600.jpg');
      expect(candidate?.width).toBe(1600);
    });
  });
});

describe('categoryImages', () => {
  it('getEventImage returns event image when provided', async () => {
    const { getEventImage } = await import('@/lib/categoryImages');
    expect(getEventImage('https://example.com/photo.jpg', 'Musik')).toBe('https://example.com/photo.jpg');
  });

  it('getEventImage falls back to category image', async () => {
    const { getEventImage } = await import('@/lib/categoryImages');
    const result = getEventImage(undefined, 'Musik', 'test');
    expect(result).toMatch(/\/images\/categories\/musik-\d\.jpg/);
  });

  it('getEventImage falls back to default for unknown category', async () => {
    const { getEventImage } = await import('@/lib/categoryImages');
    const result = getEventImage(undefined, 'UnknownCategory', 'test');
    expect(result).toMatch(/\/images\/categories\/default-\d\.jpg/);
  });

  it('getEventImage falls back to default for null category', async () => {
    const { getEventImage } = await import('@/lib/categoryImages');
    const result = getEventImage(null, null, 'test');
    expect(result).toMatch(/\/images\/categories\/default-\d\.jpg/);
  });

  it('getCategoryFallbackImage handles Maerkte alias', async () => {
    const { getCategoryFallbackImage } = await import('@/lib/categoryImages');
    const result = getCategoryFallbackImage('Märkte', 'test');
    expect(result).toMatch(/\/images\/categories\/maerkte-\d\.jpg/);
    const defaultResult = getCategoryFallbackImage(null, 'test');
    expect(result).not.toBe(defaultResult);
  });

  it('different seeds produce different image variants', async () => {
    const { getCategoryFallbackImage } = await import('@/lib/categoryImages');
    const variants = new Set();
    for (let i = 0; i < 20; i++) {
      variants.add(getCategoryFallbackImage('Musik', `event-title-${i}`));
    }
    expect(variants.size).toBeGreaterThan(1);
  });
});
