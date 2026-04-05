import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Medizinische Universität Innsbruck Scraper
 * WordPress-based event listing at events.i-med.ac.at/all/
 * Events link to /event/<slug>/ detail pages with date, description, images.
 */
export class MedUniInnsbruckScraper extends UniBaseScraper {
  readonly name = 'meduni-innsbruck';
  protected readonly shortName = 'MedUni-Innsbruck';
  protected readonly baseUrl = 'https://events.i-med.ac.at';
  protected readonly eventListUrl = 'https://events.i-med.ac.at/all/';
  protected readonly city = 'Innsbruck';
  protected readonly bundesland = 'tirol';
  protected readonly defaultLat = 47.2620;
  protected readonly defaultLng = 11.3960;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Med Uni Innsbruck Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      // Try JSON-LD first
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

    // WordPress event links — each event links to /event/<slug>/
    $('a[href*="/event/"]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        if (!href.includes('/event/')) return;
        // Skip anchors that are just "read more" or navigation
        const text = $el.text().trim();

        // Find the title — look for heading or strong text within the link
        let title = $el.find('h1, h2, h3, h4, h5').first().text().trim();
        if (!title) title = text;
        if (!title || title.length < 5) return;
        // Skip generic link texts
        if (/^(mehr|read more|details|weiterlesen|mehr infos)$/i.test(title)) return;

        // Extract date from surrounding text (DD.MM.YYYY format)
        const parentText = $el.parent().text() || text;
        const startDate = this.parseDatetime(parentText) || this.parseDate(parentText);
        if (!startDate) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Image
        const imgSrc = $el.find('img').first().attr('src');
        const imageUrl = imgSrc
          ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl))
          : undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    // Fallback: generic selectors
    if (events.length === 0) {
      $('article, .event-item, [class*="event"], .veranstaltung, .wp-block-group').each((_, el) => {
        try {
          const $el = $(el);
          const title = $el.find('h2, h3, h4, .title').first().text().trim();
          if (!title || title.length < 3) return;

          const href = $el.find('a').first().attr('href') || '';
          const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

          const dateText = $el.find('time, .date, [class*="date"]').first().text().trim()
            || $el.find('[datetime]').first().attr('datetime') || '';
          const bodyText = $el.text();
          const startDate = this.parseDatetime(dateText) || this.parseDate(dateText)
            || this.parseDatetime(bodyText) || this.parseDate(bodyText);
          if (!startDate) return;

          const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const desc = $el.find('p, .description').first().text().trim();
          const imgSrc = $el.find('img').first().attr('src');
          const imageUrl = imgSrc
            ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl))
            : undefined;

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
    }

    return events;
  }
}
