import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../connectors/json-ld-connector';

/**
 * popculture.at Scraper (Graz)
 * Concert/party events with JSON-LD per event.
 * SSR, ~50-100 events/year.
 */
export class PopcultureScraper extends BaseScraper {
  readonly name = 'popculture';
  private readonly BASE = 'https://popculture.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte popculture.at Graz Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Main events page
    const url = `${this.BASE}/events/`;
    try {
      const html = await this.fetchPage(url);

      // Extract JSON-LD events
      const jsonLdEvents = this.parseJsonLd(html);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);
      this.log(`JSON-LD: ${jsonLdEvents.length} Events`);

      // Also collect event detail links for additional scraping
      const $ = cheerio.load(html);
      const detailUrls: string[] = [];
      $('a[href*="/event/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.match(/\/event\/[a-z0-9-]+\/?$/i)) {
          const fullUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;
          if (!detailUrls.includes(fullUrl)) detailUrls.push(fullUrl);
        }
      });

      // Scrape detail pages for more JSON-LD data
      for (const detailUrl of detailUrls) {
        try {
          const detailHtml = await this.fetchPage(detailUrl);
          const detailEvents = this.parseJsonLd(detailHtml, detailUrl);
          for (const ev of detailEvents) allEvents.set(ev.source_id, ev);
          await this.sleep(800);
        } catch {}
      }
    } catch (err) {
      this.log(`Fehler: ${err instanceof Error ? err.message : err}`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseJsonLd(html: string, pageUrl?: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : json['@graph'] || [json];

        for (const item of items) {
          if (!isEventType(item['@type'])) continue;
          const name = String(item.name || '').trim();
          if (!name) continue;

          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;

          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const location = item.location as Record<string, unknown> | undefined;

          let priceText: string | undefined;
          let priceMin: number | undefined;
          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            for (const offer of offers) {
              if (offer.price) {
                priceMin = parseFloat(String(offer.price));
                priceText = `ab €${priceMin.toFixed(2)}`;
                break;
              }
            }
          }

          events.push({
            source_id: `popculture-${slug}`,
            source_name: this.name,
            source_url: item.url ? String(item.url) : (pageUrl || `${this.BASE}/events/`),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            location_name: location?.name ? String(location.name) : 'Graz',
            bundesland: 'steiermark',
            latitude: 47.0707,
            longitude: 15.4395,
            category: categorizeEvent(name, item.description ? String(item.description) : undefined),
            image_url: item.image ? String(typeof item.image === 'string' ? item.image : (item.image as Record<string, unknown>).url || '') : undefined,
            price_text: priceText,
            price_min: priceMin,
          });
        }
      } catch {}
    });

    return events;
  }
}
