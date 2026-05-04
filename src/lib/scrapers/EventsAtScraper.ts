/**
 * EventsAtScraper — events.at sitemap-driven Schema.org Event ingest.
 *
 * Replaces the previous Wien-only month-page scraper (capped at ~72 events)
 * with a national sitemap walker. Source: `https://events.at/sitemaps_event.xml`
 * — declared in events.at's robots.txt as the canonical event index. Each
 * URL is a static event detail page with Schema.org `Event` JSON-LD which
 * we parse via the existing connector.
 *
 * Coverage: previously 72 events Wien. With this scraper we expect 5k events
 * per run (capped by MAX_EVENTS_PER_RUN), national coverage. The scrape job
 * runs multiple times per day so unstable URLs (some events drop out of the
 * sitemap when they pass) get refreshed continuously.
 *
 * Bot-protection note: events.at fronts Cloudflare and rejects the default
 * Node fetch User-Agent with HTTP 403. We send a recent Chrome UA + the
 * `de-AT` Accept-Language inherited from BaseScraper.
 *
 * Rate limit: events.at does NOT publish a crawl-delay; we default to 1.5s
 * to be polite. BaseScraper's exponential retry handles transient 429/5xx.
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { extractEventsFromHtml } from '../connectors/json-ld-connector';
import type { ScrapedEvent } from '@/types/events';

const EVENT_SITEMAP = 'https://events.at/sitemaps_event.xml';
const CRAWL_DELAY_MS = 1500;
const MAX_EVENTS_PER_RUN = 5000;

export class EventsAtScraper extends BaseScraper {
  readonly name = 'events.at';
  protected userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  protected delayMs = CRAWL_DELAY_MS;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte events.at Sitemap-Scrape…');

    // 1. Fetch the event sitemap. Either a sitemap-index (URLs end in .xml)
    //    or a flat urlset of detail pages.
    const xml = await this.fetchPage(EVENT_SITEMAP);
    const urls = this.parseSitemapXml(xml);

    let detailUrls: string[];
    const isIndex = urls.length > 0 && urls.every((u) => u.endsWith('.xml'));
    if (isIndex) {
      this.log(`Sitemap-Index: ${urls.length} Sub-Sitemaps`);
      detailUrls = [];
      for (const sub of urls) {
        try {
          const subXml = await this.fetchPage(sub);
          detailUrls.push(...this.parseSitemapXml(subXml));
        } catch (err) {
          this.log(`  Sub-Sitemap-Fehler ${sub}: ${err instanceof Error ? err.message : err}`);
        }
        await this.rateLimit();
        if (detailUrls.length >= MAX_EVENTS_PER_RUN * 2) break;
      }
    } else {
      detailUrls = urls;
    }
    this.log(`${detailUrls.length} Event-URLs zum Crawling`);

    // 2. Iterate detail pages, extract JSON-LD per event
    const events: ScrapedEvent[] = [];
    const cap = Math.min(detailUrls.length, MAX_EVENTS_PER_RUN);
    let fetchErrors = 0;
    let parseEmpty = 0;

    for (let i = 0; i < cap; i++) {
      const url = detailUrls[i];
      try {
        const html = await this.fetchPage(url);
        const result = extractEventsFromHtml(html, url, null);
        if (result.events.length === 0) {
          parseEmpty++;
        } else {
          for (const e of result.events) {
            e.source_name = this.name;
            if (!e.source_url) e.source_url = url;
            events.push(e);
          }
        }
      } catch (err) {
        fetchErrors++;
        if (fetchErrors <= 5 || (i + 1) % 100 === 0) {
          this.log(`  [${i + 1}/${cap}] FEHLER ${url}: ${err instanceof Error ? err.message : err}`);
        }
      }
      if ((i + 1) % 50 === 0) {
        this.log(`  Fortschritt: ${i + 1}/${cap} (${events.length} Events)`);
      }
      await this.rateLimit();
    }

    this.log(`Fertig: ${events.length} Events von ${cap} URLs (${parseEmpty} ohne JSON-LD, ${fetchErrors} Fetch-Fehler)`);
    return events;
  }

  private parseSitemapXml(xml: string): string[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];
    $('loc').each((_, el) => {
      const url = $(el).text().trim();
      if (url) urls.push(url);
    });
    return urls;
  }
}
