import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Wiener Neustadt Scraper
 * Server-rendered event overview at /en/events.
 * Uses `article.event-overview__item` structure with h2 titles, date-box, category badges.
 * Campuses in Wiener Neustadt, Wieselburg, Tulln.
 */
export class FHWNScraper extends UniBaseScraper {
  readonly name = 'fh-wiener-neustadt';
  protected readonly shortName = 'FHWN';
  protected readonly baseUrl = 'https://www.fhwn.ac.at';
  protected readonly eventListUrl = 'https://www.fhwn.ac.at/en/events';
  protected readonly city = 'Wiener Neustadt';
  protected readonly bundesland = 'niederoesterreich';
  protected readonly defaultLat = 47.8142;
  protected readonly defaultLng = 16.2433;
  private readonly MAX_PAGES = 5;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FH Wiener Neustadt Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 0; page < this.MAX_PAGES; page++) {
      const url = page === 0
        ? this.eventListUrl
        : `${this.eventListUrl}?page=${page}`;
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        const htmlEvents = this.parseHtml(html);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        if (jsonLdEvents.length === 0 && htmlEvents.length === 0 && page > 0) break;
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // FHWN uses <article class="event-overview__item"> or with "my-4" prefix
    $('article.event-overview__item, article[class*="event-overview__item"]').each((_, el) => {
      try {
        const $el = $(el);

        // Title is in h2 inside the content column (not the date-box h2)
        const $contentCol = $el.find('.d-flex.flex-column, [class*="col-md"]:not(.event-overview__date-box):not(.event-overview__image)').first();
        const title = $contentCol.find('h2').first().text().trim()
          || $el.find('h2').last().text().trim();
        if (!title || title.length < 3) return;

        // Link wraps the entire article
        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date: from .event-overview__date-box h2 ("25. Apr 2026") or from the bold element
        const dateBoxText = $el.find('.event-overview__date-box h2').text().trim();
        const boldDateText = $el.find('b.pr-2, b:first').first().text().trim();
        const dateText = dateBoxText || boldDateText;
        const startDate = this.parseDate(dateText);
        if (!startDate) return;

        // Time: after the date bold, e.g. "4:00 PM" or "10:00 AM - 4:00 PM"
        const timeParent = $el.find('.event-overview__date-box > div, .d-flex.flex-column > div:first-child').first();
        const timeText = timeParent.text().replace(dateText, '').trim();

        // Category from badge
        const category = $el.find('.event-overview__category b').text().trim();

        // Description
        const desc = $el.find('p.py-3, .mt-2').first().text().trim();

        // Location from <small> tags
        const location = $el.find('small').first().text().trim();

        // Image from srcset (lazy-loaded via SVG placeholder)
        const imgSrcset = $el.find('img.picture__img').first().attr('srcset') || '';
        let imageUrl: string | undefined;
        if (imgSrcset) {
          // Get the highest resolution image from srcset
          const srcsetParts = imgSrcset.split(',').map(s => s.trim());
          const lastPart = srcsetParts[srcsetParts.length - 1];
          if (lastPart) {
            const imgPath = lastPart.split(' ')[0];
            if (imgPath && !imgPath.startsWith('data:')) {
              imageUrl = imgPath.startsWith('http') ? imgPath : `${this.baseUrl}${imgPath}`;
            }
          }
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate: timeText ? (this.parseDatetime(`${dateText} ${timeText}`) || startDate) : startDate,
          description: desc || (category ? `[${category}] ${location || ''}`.trim() : undefined),
          locationName: location || this.city,
          sourceUrl,
          imageUrl: imageUrl ? this.cleanImageUrl(imageUrl) : undefined,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
