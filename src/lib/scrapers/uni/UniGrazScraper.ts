import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Karl-Franzens-Universität Graz Scraper
 * Server-rendered HTML. Events are <a> links containing date text + title.
 * Pagination uses tx_news_pi1[currentPage].
 */
export class UniGrazScraper extends UniBaseScraper {
  readonly name = 'uni-graz';
  protected readonly shortName = 'UniGraz';
  protected readonly baseUrl = 'https://www.uni-graz.at';
  protected readonly eventListUrl = 'https://www.uni-graz.at/de/veranstaltungen/';
  protected readonly city = 'Graz';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.0777;
  protected readonly defaultLng = 15.4500;
  private readonly MAX_PAGES = 5;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Uni Graz Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?tx_news_pi1%5Bcontroller%5D=News&tx_news_pi1%5BcurrentPage%5D=${page}`;
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        const htmlEvents = this.parseHtml(html);
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

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // UniGraz: events are <a> tags linking to /de/veranstaltungen/SLUG/ with date + title text
    $('a[href*="/de/veranstaltungen/"]').each((_, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        // Skip pagination and non-event links
        if (href.includes('tx_news_pi1') || href === '/de/veranstaltungen/' || href.endsWith('/veranstaltungen/')) return;

        const fullText = $a.text().trim();
        if (!fullText || fullText.length < 5) return;

        // Text format: "09 Apr. 2026 09:00 - 16:00 Uhr Tag der offenen Tür"
        // or "30 März 2026 08:00 - 14:30 Uhr Helsinki Day - Master Posters extended!"
        const dateMatch = fullText.match(/(\d{1,2})\s+(\w+\.?)\s+(\d{4})/);
        if (!dateMatch) return;

        const dateText = `${dateMatch[1]}. ${dateMatch[2]} ${dateMatch[3]}`;
        const startDate = this.parseDatetime(fullText) || this.parseDate(dateText);
        if (!startDate) return;

        // Title is everything after the date+time pattern
        const titleMatch = fullText.match(/\d{4}\s+(?:\d{1,2}:\d{2}\s*(?:-\s*\d{1,2}:\d{2})?\s*(?:Uhr)?\s*)?(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : '';
        if (!title || title.length < 3) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
