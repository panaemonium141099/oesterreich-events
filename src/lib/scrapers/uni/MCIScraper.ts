import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * MCI Management Center Innsbruck Scraper
 * Server-rendered Joomla site. Events use `div.event-card` structure
 * with event-card__label (ISO date), event-card__title, event-card__text, event-card__link.
 * Domain: mci.edu
 */
export class MCIScraper extends UniBaseScraper {
  readonly name = 'mci-innsbruck';
  protected readonly shortName = 'MCI';
  protected readonly baseUrl = 'https://www.mci.edu';
  protected readonly eventListUrl = 'https://www.mci.edu/en/events';
  protected readonly city = 'Innsbruck';
  protected readonly bundesland = 'tirol';
  protected readonly defaultLat = 47.2601;
  protected readonly defaultLng = 11.3955;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte MCI Innsbruck Scraping...');
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
      const deUrl = 'https://www.mci.edu/de/events';
      const deHtml = await this.fetchPage(deUrl);
      const deEvents = this.parseHtml(deHtml);
      for (const ev of deEvents) {
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

    // MCI uses div.event-card with event-card__label (date), event-card__title, event-card__text, event-card__link
    $('div.event-card').each((_, el) => {
      try {
        const $el = $(el);

        const title = $el.find('.event-card__title').first().text().trim();
        if (!title || title.length < 3) return;

        // Date is in event-card__label, format: "2026-04-16" (ISO)
        const dateText = $el.find('.event-card__label').first().text().trim();
        const startDate = this.parseDate(dateText);
        if (!startDate) return;

        // Link: event-card__link with href
        const href = $el.find('.event-card__link').attr('href')
          || $el.find('a[itemprop="url"]').attr('href')
          || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Description from event-card__text
        const desc = $el.find('.event-card__text').first().text().trim();

        // Image from event-card__image img
        const imgSrc = $el.find('.event-card__image img').first().attr('src');
        let imageUrl: string | undefined;
        if (imgSrc && !imgSrc.startsWith('data:')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `${this.baseUrl}${imgSrc}`;
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl,
          imageUrl: imageUrl ? this.cleanImageUrl(imageUrl) : undefined,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
