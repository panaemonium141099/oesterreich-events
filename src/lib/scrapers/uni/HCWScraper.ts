import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Hochschule Campus Wien (HCW, formerly FH Campus Wien) Scraper
 * Server-rendered TYPO3 site. Events use `article.event` structure
 * with event-list-date-day, event-list-date-monthyear, event-list-content, h4 title.
 * Date format: "07" + "Apr. 26" -> 07.04.2026
 */
export class HCWScraper extends UniBaseScraper {
  readonly name = 'hcw-wien';
  protected readonly shortName = 'HCW';
  protected readonly baseUrl = 'https://www.hcw.ac.at';
  protected readonly eventListUrl = 'https://www.hcw.ac.at/alle-events';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.1717;
  protected readonly defaultLng = 16.3882;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Hochschule Campus Wien (HCW) Scraping...');
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

    // HCW uses <article class="event"> with event-list-date and event-list-content
    $('article.event').each((_, el) => {
      try {
        const $el = $(el);

        // Title from h4 inside event-list-content
        const title = $el.find('.event-list-content h4').first().text().trim()
          || $el.find('h4').first().text().trim();
        if (!title || title.length < 3) return;

        // Link from the <a> wrapping the h4
        const href = $el.find('.event-list-content a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date: event-list-date-day ("07") + event-list-date-monthyear ("Apr. 26")
        const day = $el.find('.event-list-date-day').first().text().trim();
        const monthYear = $el.find('.event-list-date-monthyear').first().text().trim();
        // monthYear format is like "Apr. 26" -> need to convert to proper date
        const startDate = this.parseHcwDate(day, monthYear);
        if (!startDate) return;

        // Categories from event-list-categories ul > li
        const categories: string[] = [];
        $el.find('.event-list-categories li').each((_, li) => {
          const cat = $(li).text().trim();
          if (cat) categories.push(cat);
        });

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: categories.length > 0 ? categories.join(', ') : undefined,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }

  /**
   * Parse HCW's date format: day="07", monthYear="Apr. 26"
   * Returns ISO date string like "2026-04-07"
   */
  private parseHcwDate(day: string, monthYear: string): string | null {
    if (!day || !monthYear) return null;

    const monthMap: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03', 'apr': '04',
      'mai': '05', 'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'okt': '10', 'oct': '10', 'nov': '11', 'dez': '12', 'dec': '12',
    };

    // monthYear like "Apr. 26" or "Mär. 26"
    const match = monthYear.match(/([A-Za-zÄäÖöÜü]+)\.?\s+(\d{2,4})/);
    if (!match) return null;

    const monthStr = match[1].toLowerCase();
    const yearStr = match[2];

    const month = monthMap[monthStr];
    if (!month) return null;

    const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }
}
