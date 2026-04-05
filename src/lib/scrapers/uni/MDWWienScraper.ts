import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität für Musik und darstellende Kunst Wien (mdw) Scraper
 * Server-rendered event listing at mdw.ac.at/6/
 * Events in <ul class="VerUeb"> with <li> items containing:
 *   <a href="/veranstaltung/?v=ID&g=GID">
 *     <img>, <time>, <h3> title, genre spans, <address>
 *   </a>
 * Rich source with concerts, lectures, masterclasses.
 */
export class MDWWienScraper extends UniBaseScraper {
  readonly name = 'mdw-wien';
  protected readonly shortName = 'MDW';
  protected readonly baseUrl = 'https://www.mdw.ac.at';
  protected readonly eventListUrl = 'https://www.mdw.ac.at/6/';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2010;
  protected readonly defaultLng = 16.3750;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte MDW Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      // Try JSON-LD first
      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      // HTML parsing — mdw uses a structured list
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

    // MDW uses <ul class="VerUeb"> with <li> items
    // Each <li> contains an <a> wrapping: <img>, date text, <h3> title, <address>
    $('ul.VerUeb li, .VerUeb li').each((_, el) => {
      try {
        const $el = $(el);
        const $link = $el.find('a').first();
        const href = $link.attr('href') || '';
        if (!href) return;

        const title = $el.find('h3').first().text().trim();
        if (!title || title.length < 3) return;

        // Date/time: look for <time> element or text like "06. Apr, 09:00"
        const timeEl = $el.find('time').first();
        let dateText = timeEl.attr('datetime') || timeEl.text().trim();
        if (!dateText) {
          // Fallback: extract date from the link text before h3
          dateText = $link.text().trim();
        }

        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText)
          || this.parseMdwDate(dateText);
        if (!startDate) return;

        // Location from <address> element
        const locationName = $el.find('address').first().text().trim() || undefined;

        // Image
        const imgSrc = $el.find('img').first().attr('src');
        const imageUrl = imgSrc
          ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl))
          : undefined;

        // Build source URL
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Extract event ID from URL for stable slug
        const idMatch = href.match(/[?&]v=(\d+)/);
        const slug = idMatch
          ? `mdw-${idMatch[1]}`
          : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          locationName,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    // Fallback: generic selectors if VerUeb not found
    if (events.length === 0) {
      $('a[href*="/veranstaltung/"]').each((_, el) => {
        try {
          const $el = $(el);
          const href = $el.attr('href') || '';
          const title = $el.find('h3, h4').first().text().trim() || $el.text().trim();
          if (!title || title.length < 5) return;

          const parentText = $el.parent().text() || $el.text();
          const startDate = this.parseDatetime(parentText) || this.parseDate(parentText)
            || this.parseMdwDate(parentText);
          if (!startDate) return;

          const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

          events.push(this.buildEvent({
            slug,
            title,
            startDate,
            sourceUrl,
          }));
        } catch { /* skip */ }
      });
    }

    return events;
  }

  /**
   * Parse mdw-specific short date format: "06. Apr, 09:00" or "06. Apr"
   */
  private parseMdwDate(text: string): string | null {
    const months: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03', 'apr': '04',
      'mai': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'okt': '10', 'oct': '10', 'nov': '11', 'dez': '12', 'dec': '12',
    };

    // Pattern: DD. Mon, HH:MM or DD. Mon
    const match = text.match(/(\d{1,2})\.\s*(Jan|Feb|Mär|Mar|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Dez|Dec)[\.,]?\s*(?:(\d{1,2}):(\d{2}))?/i);
    if (!match) return null;

    const day = match[1].padStart(2, '0');
    const monthKey = match[2].toLowerCase();
    const month = months[monthKey];
    if (!month) return null;

    // Determine year: assume current year, bump to next if date is >2 months in the past
    const now = new Date();
    let year = now.getFullYear();
    const candidate = new Date(year, parseInt(month) - 1, parseInt(day));
    if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
      year++;
    }

    let dateStr = `${year}-${month}-${day}`;
    if (match[3] && match[4]) {
      dateStr = `${dateStr}T${match[3].padStart(2, '0')}:${match[4]}:00`;
    }
    return dateStr;
  }
}
