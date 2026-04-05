import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FHWien der WKW Scraper
 * German events page at /veranstaltungen/. WordPress-based.
 * Uses .block__news_and_events__item containers.
 * Date format: "8. April 2026, 16:00 – 19:30"
 * Event detail links: /veranstaltungen/{slug}/
 */
export class FHWienWKWScraper extends UniBaseScraper {
  readonly name = 'fh-wien-wkw';
  protected readonly shortName = 'FH-Wien-WKW';
  protected readonly baseUrl = 'https://www.fh-wien.ac.at';
  protected readonly eventListUrl = 'https://www.fh-wien.ac.at/veranstaltungen/';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2333;
  protected readonly defaultLng = 16.3388;
  private readonly MAX_PAGES = 3;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FHWien der WKW Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}page/${page}/`;
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

    // WordPress uses .block__news_and_events__item or links to /veranstaltungen/{slug}/
    // Also try generic article/event selectors
    const processedSlugs = new Set<string>();

    $('a[href*="/veranstaltungen/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';

        // Skip the list page itself and pagination links
        if (href.endsWith('/veranstaltungen/') || href.match(/\/page\/\d+\//)) return;
        // Must be a detail page (has slug after /veranstaltungen/)
        const slugMatch = href.match(/veranstaltungen\/([^/?]+)\/?$/);
        if (!slugMatch) return;

        const urlSlug = slugMatch[1];
        if (processedSlugs.has(urlSlug)) return;
        processedSlugs.add(urlSlug);

        // Get container
        const $container = $link.closest('.block__news_and_events__item, article, .event-item, div');
        const title = $container.find('h2, h3, h4').first().text().trim()
          || $link.text().trim();
        if (!title || title.length < 3) return;
        // Skip "Weiterlesen" links
        if (title.toLowerCase().startsWith('weiterlesen')) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Parse date from context - format: "8. April 2026, 16:00 – 19:30"
        const contextText = $container.length ? $container.text() : '';
        const startDate = this.parseDatetime(contextText) || this.parseDate(contextText);
        if (!startDate) return;

        const slug = urlSlug || title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Extract description
        const desc = $container.find('p').first().text().trim();

        // Extract category
        const category = $container.find('.category, [class*="category"]').first().text().trim();

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || category || undefined,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
