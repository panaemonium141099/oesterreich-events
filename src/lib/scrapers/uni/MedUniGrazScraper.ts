import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Medizinische Universität Graz Scraper
 * MEDonline events system. Also has RSS feed.
 */
export class MedUniGrazScraper extends UniBaseScraper {
  readonly name = 'meduni-graz';
  protected readonly shortName = 'MedUniGraz';
  protected readonly baseUrl = 'https://www.medunigraz.at';
  protected readonly eventListUrl = 'https://online.medunigraz.at/mug_online/vag.veranstaltungen?corg=1';
  protected readonly city = 'Graz';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.0816;
  protected readonly defaultLng = 15.4695;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte MedUni Graz Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }

      // Also try the RSS feed for additional events
      await this.rateLimit();
      try {
        const rssUrl = 'https://www.medunigraz.at/calendarRss/veranstaltungen/';
        const rssXml = await this.fetchPage(rssUrl);
        const rssEvents = this.parseRss(rssXml);
        for (const ev of rssEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }
      } catch {
        this.log('RSS Feed nicht verfügbar, überspringe');
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

    // MEDonline uses table-based layout typically
    $('tr, article, .event-item, [class*="event"], .veranstaltung').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('a, h2, h3, h4, .title').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `https://online.medunigraz.at${href}`;

        const dateText = $el.find('td, time, .date, [class*="date"]').first().text().trim();
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        const ev = this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
        });
        // Add Gesundheit tag for medical university
        if (ev.tags && !ev.tags.includes('Gesundheit')) {
          ev.tags.push('Gesundheit');
          if (ev.tags.length > 3) ev.tags.pop();
        }
        events.push(ev);
      } catch { /* skip */ }
    });

    return events;
  }

  private parseRss(xml: string): ScrapedEvent[] {
    const $ = cheerio.load(xml, { xml: true });
    const events: ScrapedEvent[] = [];

    $('item').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('title').first().text().trim();
        if (!title || title.length < 3) return;

        const link = $el.find('link').first().text().trim();
        const desc = $el.find('description').first().text().trim();
        const pubDate = $el.find('pubDate').first().text().trim();

        let startDate: string | null = null;
        if (pubDate) {
          try {
            const d = new Date(pubDate);
            startDate = d.toISOString().slice(0, 19);
          } catch { /* skip */ }
        }
        if (!startDate) {
          startDate = this.parseDatetime(desc) || this.parseDate(desc);
        }
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        const ev = this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl: link || this.eventListUrl,
        });
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
