import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH Salzburg Scraper
 * Server-rendered TYPO3 site. Events use `div.event` inside `div.event-list`.
 * Date structure: span.day + span.month-and-year, title in h3.event-title, time in div.event-time.
 */
export class FHSalzburgScraper extends UniBaseScraper {
  readonly name = 'fh-salzburg';
  protected readonly shortName = 'FH-Salzburg';
  protected readonly baseUrl = 'https://www.fh-salzburg.ac.at';
  protected readonly eventListUrl = 'https://www.fh-salzburg.ac.at/en/about-fh-salzburg/news-and-events/events';
  protected readonly city = 'Puch/Salzburg';
  protected readonly bundesland = 'salzburg';
  protected readonly defaultLat = 47.7250;
  protected readonly defaultLng = 13.0893;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FH Salzburg Scraping...');
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

    // Also try German URL
    try {
      await this.rateLimit();
      const deUrl = 'https://www.fh-salzburg.ac.at/ueber-die-fh-salzburg/news-und-events/veranstaltungen';
      const deHtml = await this.fetchPage(deUrl);
      const deEvents = this.parseJsonLdEvents(deHtml, deUrl);
      for (const ev of deEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
      const deHtmlEvents = this.parseHtml(deHtml);
      for (const ev of deHtmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
    } catch { /* skip */ }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // FH Salzburg: div.event-list > div.event
    $('div.event-list div.event, div.event').each((_, el) => {
      try {
        const $el = $(el);
        // Skip if this is not an event container (no title)
        const $titleLink = $el.find('h3.event-title a').first();
        const title = $titleLink.text().trim() || $el.find('h3.event-title').first().text().trim();
        if (!title || title.length < 3) return;

        // Link
        const href = $titleLink.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date: first .event-date has span.day and span.month-and-year
        const $firstDate = $el.find('.event-date').first();
        const day = $firstDate.find('.day').text().trim();
        const monthYear = $firstDate.find('.month-and-year').text().trim().replace(/\s+/g, ' ');
        // monthYear is like "Mar\n2026" or "Apr\n2026"
        const dateText = `${day}. ${monthYear.replace(/\n/g, ' ')}`;
        const startDate = this.parseDate(dateText);
        if (!startDate) return;

        // End date from second .event-date if present (for multi-day events)
        let endDate: string | undefined;
        const $dates = $el.find('.event-date');
        if ($dates.length > 1) {
          const $lastDate = $dates.last();
          const endDay = $lastDate.find('.day').text().trim();
          const endMonthYear = $lastDate.find('.month-and-year').text().trim().replace(/\s+/g, ' ');
          const endDateText = `${endDay}. ${endMonthYear.replace(/\n/g, ' ')}`;
          endDate = this.parseDate(endDateText) || undefined;
        }

        // Time from event-time
        const timeText = $el.find('.event-time').first().text().trim();

        // Build datetime if time available
        let startDatetime = startDate;
        if (timeText) {
          const parsed = this.parseDatetime(`${dateText} ${timeText}`);
          if (parsed) startDatetime = parsed;
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate: startDatetime,
          endDate,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
