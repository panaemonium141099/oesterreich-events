import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../connectors/json-ld-connector';

/**
 * kaernten.live Scraper
 * Carinthian ticket portal with JSON-LD Event schema.
 * SSR, all events on single page.
 */
export class KaerntenLiveScraper extends BaseScraper {
  readonly name = 'kaernten.live';
  private readonly BASE = 'https://www.kaernten.live';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte kaernten.live Scraping...');
    const html = await this.fetchPage(this.BASE);
    const events = this.parsePage(html);
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Extract JSON-LD Event objects
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : [json];

        for (const item of items) {
          if (!isEventType(item['@type'])) continue;

          const name = String(item.name || '').trim();
          if (!name) continue;

          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;

          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          if (seen.has(slug)) continue;
          seen.add(slug);

          const location = item.location as Record<string, unknown> | undefined;
          let locationName: string | undefined;
          let address: string | undefined;
          let postalCode: string | undefined;

          if (location) {
            locationName = location.name ? String(location.name) : undefined;
            if (typeof location.address === 'string') {
              address = location.address;
              const plzMatch = address.match(/(\d{4})/);
              if (plzMatch) postalCode = plzMatch[1];
            } else if (location.address) {
              const addr = location.address as Record<string, unknown>;
              address = addr.streetAddress ? String(addr.streetAddress) : undefined;
              postalCode = addr.postalCode ? String(addr.postalCode) : undefined;
            }
          }

          // Price from offers
          let priceText: string | undefined;
          let priceMin: number | undefined;
          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
            for (const offer of offers) {
              if (offer.price) {
                priceMin = parseFloat(String(offer.price));
                const currency = offer.priceCurrency || 'EUR';
                priceText = `ab €${priceMin.toFixed(2)}`;
                break;
              }
            }
          }

          events.push({
            source_id: `kaernten-live-${slug}`,
            source_name: this.name,
            source_url: item.url ? String(item.url) : this.BASE,
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            location_name: locationName,
            address,
            postal_code: postalCode,
            bundesland: 'kaernten',
            category: categorizeEvent(name, item.description ? String(item.description) : undefined),
            image_url: item.image ? String(typeof item.image === 'string' ? item.image : (item.image as Record<string, unknown>).url || '') : undefined,
            price_text: priceText,
            price_min: priceMin,
          });
        }
      } catch { /* skip invalid JSON-LD */ }
    });

    // Fallback: parse HTML event cards if no JSON-LD
    if (events.length === 0) {
      $('.eb-event-wrapper a, a[href*="/konzert/"], a[href*="/kultur/"], a[href*="/festival/"]').each((_, el) => {
        try {
          const $link = $(el);
          const href = $link.attr('href') || '';
          if (!href || href === '#' || href === '/') return;

          const $card = $link.closest('.eb-event-wrapper, div, li').first();
          const title = $card.find('h2, h3, h4, strong').first().text().trim() || $link.text().trim();
          if (!title || title.length < 3) return;

          const cardText = $card.text();
          const dateMatch = cardText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
          if (!dateMatch) return;

          const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          if (seen.has(slug)) return;
          seen.add(slug);

          const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

          events.push({
            source_id: `kaernten-live-${slug}`,
            source_name: this.name,
            source_url: sourceUrl,
            title,
            start_date: `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`,
            bundesland: 'kaernten',
            category: categorizeEvent(title),
          });
        } catch { /* skip */ }
      });
    }

    return events;
  }
}
