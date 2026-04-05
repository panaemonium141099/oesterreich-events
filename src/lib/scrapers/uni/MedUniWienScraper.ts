import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Medizinische Universität Wien Scraper
 * Server-rendered. Events are <strong>date</strong> followed by <a>title</a>.
 * Monthly pagination with ?ed=YYYY-MM.
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

    // Fetch current month and next 2 months
    const urls: string[] = [this.eventListUrl];
    const now = new Date();
    for (let i = 1; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      urls.push(`${this.eventListUrl}?ed=${yyyy}-${mm}`);
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

        this.log(`${url.includes('ed=') ? url.split('ed=')[1] : 'current'}: ${allEvents.size} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler: ${err instanceof Error ? err.message : err}`);
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // MedUniWien: events are in .calendar__item blocks
    // with .calendar__date (date text) and .calendar__time (time text)
    // and a.calendar__title for the link
    $('.calendar__item').each((_, el) => {
      try {
        const $item = $(el);

        const $titleLink = $item.find('a.calendar__title').first();
        if (!$titleLink.length) return;

        const title = $titleLink.attr('title') || $titleLink.text().trim();
        if (!title || title.length < 3) return;

        const href = $titleLink.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date from .calendar__date and .calendar__time
        const dateText = $item.find('.calendar__date').first().text().trim();
        const timeText = $item.find('.calendar__time').first().text().trim();
        if (!dateText) return;

        const fullDateText = timeText ? `${dateText} ${timeText}` : dateText;
        const startDate = this.parseDatetime(fullDateText) || this.parseDate(fullDateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        const ev = this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
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
