import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität Innsbruck Scraper
 * Server-rendered. Monthly URL pattern /events/YYYY/MM/.
 * Events grouped by day headings (h3) with links to /events/YYYY/MM/DD/slug.
 */
export class UniInnsbruckScraper extends UniBaseScraper {
  readonly name = 'uni-innsbruck';
  protected readonly shortName = 'UniInnsbruck';
  protected readonly baseUrl = 'https://www.uibk.ac.at';
  protected readonly eventListUrl = 'https://www.uibk.ac.at/de/events/';
  protected readonly city = 'Innsbruck';
  protected readonly bundesland = 'tirol';
  protected readonly defaultLat = 47.2640;
  protected readonly defaultLng = 11.3930;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Uni Innsbruck Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Fetch main page first, then monthly views
    const urls: string[] = [this.eventListUrl];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      urls.push(`${this.baseUrl}/events/${yyyy}/${mm}/`);
    }

    for (const url of urls) {
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        const htmlEvents = this.parseHtml(html);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        this.log(`${url}: ${allEvents.size} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`${url} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Events are links to /events/YYYY/MM/DD/slug with time + title text
    $('a[href*="/events/"]').each((_, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        // Only match event detail links like /de/events/2026/04/08/slug or /events/2026/04/08/slug
        if (!href.match(/\/events\/\d{4}\/\d{2}\/\d{2}\//)) return;

        const title = $a.text().trim();
        if (!title || title.length < 3) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Extract date from URL: /events/2026/04/08/
        const urlDateMatch = href.match(/\/events\/(\d{4})\/(\d{2})\/(\d{2})\//);
        if (!urlDateMatch) return;
        const startDate = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;

        // Try to get time from surrounding text
        const $parent = $a.parent();
        const parentText = $parent.text();
        const timeMatch = parentText.match(/(\d{1,2})[:\.](\d{2})/);
        const fullDate = timeMatch
          ? `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`
          : startDate;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate: fullDate,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
