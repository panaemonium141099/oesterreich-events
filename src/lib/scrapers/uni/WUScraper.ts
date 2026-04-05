import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Wirtschaftsuniversität Wien (WU) Scraper
 * TYPO3 CMS, server-rendered. ~16 events in eventDates array.
 */
export class WUScraper extends UniBaseScraper {
  readonly name = 'wu-wien';
  protected readonly shortName = 'WU';
  protected readonly baseUrl = 'https://www.wu.ac.at';
  protected readonly eventListUrl = 'https://www.wu.ac.at/universitaet/news-und-events/events';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2134;
  protected readonly defaultLng = 16.4089;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte WU Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      // Try JSON-LD
      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      // HTML fallback
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

    // WU uses div.item[data-id] event cards with:
    //   div.date > div.day + div.month
    //   h3.u__h4 (title)
    //   div.description > p (description)
    //   div.schedule (date/time text like "07.04.2026 14:00 - 16:00")
    //   div.image > picture > img
    $('div.item[data-id]').each((_, el) => {
      try {
        const $el = $(el);
        const dataId = $el.attr('data-id') || '';
        const title = $el.find('h3, h4, .u__h4').first().text().trim();
        if (!title || title.length < 3) return;

        // Build source URL from TYPO3 news API pattern
        const sourceUrl = dataId
          ? `${this.baseUrl}/?type=9901&tx_news_pi1[news]=${dataId}`
          : this.eventListUrl;

        // Date from .schedule element: "07.04.2026 14:00 - 16:00"
        const scheduleText = $el.find('.schedule').first().text().trim();
        let startDate = this.parseDatetime(scheduleText) || this.parseDate(scheduleText);

        // Fallback: date from .date > .day + .month (e.g. "07" + "Apr")
        if (!startDate) {
          const day = $el.find('.date .day').text().trim();
          const month = $el.find('.date .month').text().trim();
          if (day && month) {
            const year = new Date().getFullYear();
            startDate = this.parseDate(`${day}. ${month} ${year}`);
          }
        }
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.description p, .description').first().text().trim();
        const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
