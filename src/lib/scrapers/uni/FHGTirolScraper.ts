import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Gesundheit Tirol (FHG) Scraper
 * ColdFusion-based (page.cfm). Termine page with upcoming events.
 * Health sciences focus.
 */
export class FHGTirolScraper extends UniBaseScraper {
  readonly name = 'fhg-tirol';
  protected readonly shortName = 'FHG-Tirol';
  protected readonly baseUrl = 'https://www.fhg-tirol.ac.at';
  protected readonly eventListUrl = 'https://www.fhg-tirol.ac.at/page.cfm?vpath=termine';
  protected readonly city = 'Innsbruck';
  protected readonly bundesland = 'tirol';
  protected readonly defaultLat = 47.2632;
  protected readonly defaultLng = 11.3929;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FH Gesundheit Tirol Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
    } catch (err) {
      this.log(`Fehler: ${err instanceof Error ? err.message : err}`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('table tr, .event-item, [class*="event"], .veranstaltung, article').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .event-title, td:nth-child(2), strong').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href
          : href ? `${this.baseUrl}/${href.replace(/^\//, '')}` : this.eventListUrl;

        const dateText = $el.find('time, .date, [class*="date"], td:first-child').first().text().trim()
          || $el.find('[datetime]').first().attr('datetime') || '';
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.teaser, .description, p').first().text().trim();

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
