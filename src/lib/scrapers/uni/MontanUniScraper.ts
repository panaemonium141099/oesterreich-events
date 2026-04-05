import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Montanuniversität Leoben Scraper
 * Server-rendered, very few events (~2). Small university.
 */
export class MontanUniScraper extends UniBaseScraper {
  readonly name = 'montanuni-leoben';
  protected readonly shortName = 'MontanUni';
  protected readonly baseUrl = 'https://www.unileoben.ac.at';
  protected readonly eventListUrl = 'https://www.unileoben.ac.at/universitaet/veranstaltungen/';
  protected readonly city = 'Leoben';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.3838;
  protected readonly defaultLng = 15.0903;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Montanuni Leoben Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }

      // Also try English page
      await this.rateLimit();
      try {
        const enUrl = 'https://www.unileoben.ac.at/en/university/events/';
        const enHtml = await this.fetchPage(enUrl);
        const enEvents = this.parseJsonLdEvents(enHtml, enUrl);
        for (const ev of enEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }
        const enHtmlEvents = this.parseHtml(enHtml);
        for (const ev of enHtmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }
      } catch { /* skip */ }

      this.log(`${allEvents.size} Events gefunden`);
    } catch (err) {
      this.log(`Fehler: ${err instanceof Error ? err.message : err}`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  /**
   * Map German/English month names to month numbers for MontanUni's compact date format.
   */
  private readonly monthMap: Record<string, string> = {
    'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03',
    'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
    'august': '08', 'september': '09', 'oktober': '10',
    'november': '11', 'dezember': '12',
    'january': '01', 'february': '02', 'march': '03', 'may': '05',
    'june': '06', 'july': '07', 'october': '10', 'december': '12',
  };

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const year = new Date().getFullYear();

    // MontanUni uses .event-item divs with .date, h3, and p elements
    // Also try generic selectors
    $('article, .event-item, [class*="event"], .veranstaltung, .news-list-item, .list-item').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .event-title').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date from .date element or text — format may be "April16" (month+day concatenated)
        let dateText = $el.find('.date, time, [class*="date"]').first().text().trim()
          || $el.find('[datetime]').first().attr('datetime') || '';

        let startDate = this.parseDatetime(dateText) || this.parseDate(dateText);

        // Handle compact "MonthDD" format like "April16" or "Mai04"
        if (!startDate && dateText) {
          const compactMatch = dateText.match(/^([A-Za-zÄäÖöÜü]+?)(\d{1,2})$/);
          if (compactMatch) {
            const monthNum = this.monthMap[compactMatch[1].toLowerCase()];
            if (monthNum) {
              startDate = `${year}-${monthNum}-${compactMatch[2].padStart(2, '0')}`;
            }
          }
        }
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.teaser, .description, p').first().text().trim();
        const imgSrc = $el.find('img').first().attr('src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        // Time from description text, e.g. "When: 6:30 pm" or "18.30 Uhr"
        if (!startDate.includes('T')) {
          const allText = $el.text();
          const timeMatch = allText.match(/(\d{1,2})[:\.](\d{2})(?:\s*(?:Uhr|pm|am))?/);
          if (timeMatch) {
            startDate = `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
          }
        }

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
