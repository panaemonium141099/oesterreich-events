import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität für Weiterbildung Krems (Donau-Universität Krems) Scraper
 * Server-rendered. Events are <a> wrappers with <span>day</span><span>month</span><span>year</span> + <h3>title</h3>.
 * Has "Mehr laden" button (load more), but initial page has events in HTML.
 */
export class DonauUniKremsScraper extends UniBaseScraper {
  readonly name = 'donau-uni-krems';
  protected readonly shortName = 'DonauUniKrems';
  protected readonly baseUrl = 'https://www.donau-uni.ac.at';
  protected readonly eventListUrl = 'https://www.donau-uni.ac.at/de/aktuelles/veranstaltungen.html';
  protected readonly city = 'Krems';
  protected readonly bundesland = 'niederoesterreich';
  protected readonly defaultLat = 48.4084;
  protected readonly defaultLng = 15.5888;

  /** German abbreviated month map */
  private readonly MONTHS: Record<string, string> = {
    'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03', 'apr': '04',
    'mai': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'okt': '10', 'nov': '11', 'dez': '12',
  };

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Donau-Universität Krems Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

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

    // DonauUni: <a> wrappers with h3 titles, linking to event detail pages
    $('a[href*="/veranstaltungen/"]').each((_, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        // Skip the main veranstaltungen page link itself
        if (href.endsWith('/veranstaltungen.html') || href.endsWith('/veranstaltungen/')) return;

        const $h3 = $a.find('h3');
        if (!$h3.length) return;
        const title = $h3.text().trim();
        if (!title || title.length < 3) return;

        // Date from spans: <span>07</span><span>Apr</span><span>2026</span>
        const spans = $a.find('span');
        let day = '', month = '', year = '';
        spans.each((_, span) => {
          const text = $(span).text().trim().toLowerCase();
          if (/^\d{1,2}$/.test(text) && !day) {
            day = text;
          } else if (this.MONTHS[text]) {
            month = this.MONTHS[text];
          } else if (/^\d{4}$/.test(text) && !year) {
            year = text;
          }
        });

        if (!day || !month || !year) return;
        const startDate = `${year}-${month}-${day.padStart(2, '0')}`;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Description from <p> inside the link
        const desc = $a.find('p').first().text().trim();

        // Image
        const imgSrc = $a.find('img').first().attr('src');
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
