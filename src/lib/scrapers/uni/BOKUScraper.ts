import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität für Bodenkultur Wien (BOKU) Scraper
 * Server-rendered, 200+ events. Chronological listing.
 */
export class BOKUScraper extends UniBaseScraper {
  readonly name = 'boku-wien';
  protected readonly shortName = 'BOKU';
  protected readonly baseUrl = 'https://boku.ac.at';
  protected readonly eventListUrl = 'https://boku.ac.at/en/event/list';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2374;
  protected readonly defaultLng = 16.3340;
  private readonly MAX_MONTHS = 6;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte BOKU Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Fetch current month + next N months
    const now = new Date();
    for (let m = 0; m < this.MAX_MONTHS; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const url = m === 0
        ? this.eventListUrl
        : `${this.eventListUrl}/${year}/${month}`;
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        const htmlEvents = this.parseHtml(html, year);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        this.log(`Monat ${year}/${month}: ${allEvents.size} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Monat fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string, fallbackYear?: number): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const year = fallbackYear || new Date().getFullYear();

    // BOKU uses <a href="/en/event/details/ID"> containing <time>, <h4>, <span>
    $('a[href*="/event/details/"]').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h4').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date from <time> element, e.g. "01. Apr"
        const dateText = $el.find('time').first().text().trim();
        // Try full date parsing first, then parse abbreviated "DD. Mon" format
        let startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate && dateText) {
          // Parse "01. Apr" format with current year
          const shortMatch = dateText.match(/(\d{1,2})\.\s*(\w+)/);
          if (shortMatch) {
            startDate = this.parseDate(`${shortMatch[1]}. ${shortMatch[2]} ${year}`);
          }
        }
        if (!startDate) return;

        // Time from first <span>, e.g. "08:35 - 11:15" or "14:00 - 18:00"
        const timeText = $el.find('span').first().text().trim();
        const timeMatch = timeText.match(/(\d{1,2})[:\.](\d{2})/);
        if (timeMatch && !startDate.includes('T')) {
          startDate = `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        // Event type from second <span>
        const desc = $el.find('span').eq(1).text().trim() || undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: desc,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
