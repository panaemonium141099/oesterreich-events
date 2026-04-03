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

    it('prefers og:image over img tags', () => {
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
