import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Medizinische Universität Wien Scraper
 * Server-rendered, ~20 events per month. Filterable by date range.
 */
export class MedUniWienScraper extends UniBaseScraper {
  readonly name = 'meduni-wien';
  protected readonly shortName = 'MedUniWien';
  protected readonly baseUrl = 'https://www.meduniwien.ac.at';
  protected readonly eventListUrl = 'https://www.meduniwien.ac.at/web/ueber-uns/events/';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2175;
  protected readonly defaultLng = 16.3472;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte MedUni Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }

      this.log(`${allEvents.size} Events gefunden`);
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

    $('article, .event-item, [class*="event"], .news-list-item, .veranstaltung, .list-item').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .event-title').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        const dateText = $el.find('time, .date, [class*="date"]').first().text().trim()
          || $el.find('[datetime]').first().attr('datetime') || '';
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.teaser, .description, p').first().text().trim();
        const imgSrc = $el.find('img').first().attr('src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        // MedUni events often get "Gesundheit" tag too
        const ev = this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl,
          imageUrl,
        });
        // Add Gesundheit tag for medical university events
        if (ev.tags && !ev.tags.includes('Gesundheit')) {
          ev.tags.push('Gesundheit');
          if (ev.tags.length > 3) ev.tags.pop();
        }
        events.push(ev);
      } catch { /* skip */ }
    });

    return events;
  }
}
