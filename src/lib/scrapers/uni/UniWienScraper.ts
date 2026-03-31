import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität Wien Scraper
 * Event calendar at kalender.univie.ac.at (TYPO3 CMS, server-rendered).
 */
export class UniWienScraper extends UniBaseScraper {
  readonly name = 'uni-wien';
  protected readonly shortName = 'UniWien';
  protected readonly baseUrl = 'https://kalender.univie.ac.at';
  protected readonly eventListUrl = 'https://kalender.univie.ac.at/';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2130;
  protected readonly defaultLng = 16.3600;
  private readonly MAX_PAGES = 5;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Universität Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?tx_cal_controller%5Bpage%5D=${page}`;
      try {
        const html = await this.fetchPage(url);

        // Try JSON-LD
        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        if (jsonLdEvents.length > 0) {
          for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);
        }

        // Also parse HTML structure
        const htmlEvents = this.parseHtml(html, url);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        if (jsonLdEvents.length === 0 && htmlEvents.length === 0) break;
        this.log(`Seite ${page}: ${allEvents.size} Events`);
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

  private parseHtml(html: string, pageUrl: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Look for event items in typical TYPO3 calendar structures
    $('article, .event-item, .cal-event, [class*="event"], .news-list-item, .veranstaltung').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .event-title, .title').first().text().trim();
        if (!title || title.length < 3) return;

        const link = $el.find('a').first().attr('href') || '';
        const sourceUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;

        const dateText = $el.find('.date, .event-date, time, [class*="date"]').first().text().trim()
          || $el.text();
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.description, .teaser, .summary, p').first().text().trim();

        const imageUrl = this.extractImageUrl($, sourceUrl);

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
