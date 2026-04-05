import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * IMC FH Krems Scraper
 * Server-rendered TYPO3 site. Events use `article.event.teaser` structure
 * with span.event-date (DD.MM.YYYY), h3 title, a.event-link, picture/img.
 * Also has a separate list view with `article.event` and data-category attribute.
 */
export class IMCKremsScraper extends UniBaseScraper {
  readonly name = 'imc-krems';
  protected readonly shortName = 'IMC-Krems';
  protected readonly baseUrl = 'https://www.imc.ac.at';
  protected readonly eventListUrl = 'https://www.imc.ac.at/en/about-us/media-press/events/';
  protected readonly city = 'Krems';
  protected readonly bundesland = 'niederoesterreich';
  protected readonly defaultLat = 48.4100;
  protected readonly defaultLng = 15.6025;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte IMC FH Krems Scraping...');
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
      const deUrl = 'https://www.imc.ac.at/ueber-uns/medien-presse/events/';
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

    // IMC Krems uses article.event (both teaser cards and list items)
    $('article.event').each((_, el) => {
      try {
        const $el = $(el);

        const title = $el.find('h3').first().text().trim();
        if (!title || title.length < 3) return;

        // Date: span.event-date contains text like "21.04.2026" or "21.04.2026 -\n 23.04.2026"
        const dateText = $el.find('.event-date').first().text().trim();
        // Extract first date (DD.MM.YYYY format)
        const startDate = this.parseDate(dateText);
        if (!startDate) return;

        // Check for end date in multi-day events
        let endDate: string | undefined;
        const dateMatch = dateText.match(/(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/);
        if (dateMatch) {
          endDate = this.parseDate(dateMatch[2]) || undefined;
        }

        // Link: a.event-link or first link in teaser-content
        const href = $el.find('a.event-link').attr('href')
          || $el.find('.teaser-content a').attr('href')
          || $el.find('a[href*="events/event/"]').attr('href')
          || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Image: use data-src (lazy loaded) from img
        const imgDataSrc = $el.find('img[data-src]').first().attr('data-src');
        const imgSrc = $el.find('img').first().attr('src');
        let imageUrl: string | undefined;
        const rawImg = imgDataSrc || imgSrc;
        if (rawImg && !rawImg.startsWith('data:')) {
          imageUrl = rawImg.startsWith('http') ? rawImg : `${this.baseUrl}${rawImg}`;
        }

        // Tags from data-category attribute
        const dataCategory = $el.attr('data-category') || '';

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          endDate,
          description: dataCategory ? dataCategory.trim() : undefined,
          sourceUrl,
          imageUrl: imageUrl ? this.cleanImageUrl(imageUrl) : undefined,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
