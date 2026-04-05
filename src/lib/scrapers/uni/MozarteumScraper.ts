import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität Mozarteum Salzburg Scraper
 * Server-rendered. Events are <li> with <h3><a>title</a></h3> and date text.
 * Pagination uses ?p=N.
 */
export class MozarteumScraper extends UniBaseScraper {
  readonly name = 'mozarteum-salzburg';
  protected readonly shortName = 'Mozarteum';
  protected readonly baseUrl = 'https://www.moz.ac.at';
  protected readonly eventListUrl = 'https://www.moz.ac.at/de/veranstaltungen';
  protected readonly city = 'Salzburg';
  protected readonly bundesland = 'salzburg';
  protected readonly defaultLat = 47.8015;
  protected readonly defaultLng = 13.0427;
  private readonly MAX_PAGES = 12;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Mozarteum Salzburg Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?p=${page}`;
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

    // Mozarteum: <li> elements containing <h3><a href="/de/veranstaltungen/...">title</a></h3>
    // with date text like "10.4.2026" or "14.4.2026 18:00 Uhr"
    $('a[href*="/de/veranstaltungen/"]').each((_, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        // Skip pagination and list page links
        if (href === '/de/veranstaltungen' || href === '/de/veranstaltungen/') return;
        if (!href.match(/\/de\/veranstaltungen\/\d{4}\//)) return;

        const title = $a.text().trim();
        if (!title || title.length < 3) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date is in parent <li> text content, e.g. "10.4.2026" or "10.4.—11.4.2026"
        const $li = $a.closest('li');
        const liText = $li.text();

        // Try to extract date: D.M.YYYY pattern
        const dateMatch = liText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (!dateMatch) return;
        const startDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;

        // Try time
        const timeMatch = liText.match(/(\d{1,2}):(\d{2})\s*Uhr/);
        const fullDate = timeMatch
          ? `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`
          : startDate;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Get description from remaining text in the li
        const allText = $li.find('p').map((_, p) => $(p).text().trim()).get().join(' ');
        const desc = allText.slice(0, 500) || undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate: fullDate,
          description: desc,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
