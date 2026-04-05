import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Shared helper for PH (Pädagogische Hochschule) scrapers.
 * PHs have simple event pages, typically server-rendered WordPress or TYPO3.
 */
abstract class PHBaseScraper extends UniBaseScraper {
  protected readonly MAX_PAGES = 3;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte ${this.shortName} Scraping...`);
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?page=${page}`;
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        const htmlEvents = this.parseHtml(html);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        if (jsonLdEvents.length === 0 && htmlEvents.length === 0) break;
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  /**
   * Extract date from PH event elements.
   * Handles three patterns:
   * 1. TYPO3 events_eventlist with span.date > span.day/month/year (kph-edith-stein)
   * 2. TYPO3 events_eventlist with span.event-date "DD.MM." no year (ph-kaernten)
   * 3. TYPO3 tx_news with <time datetime="..."> (ph-burgenland)
   */
  private extractDate($el: ReturnType<cheerio.CheerioAPI>, $: cheerio.CheerioAPI): string | null {
    // Pattern 1: span.date with day/month/year sub-spans (kph-edith-stein style)
    const $dateSpan = $el.find('span.date');
    if ($dateSpan.length) {
      const day = $dateSpan.find('.day').text().trim();
      const monthName = $dateSpan.find('.month').text().trim();
      const year = $dateSpan.find('.year').text().trim();
      if (day && monthName && year) {
        const dateStr = `${day}. ${monthName} ${year}`;
        return this.parseDatetime(dateStr) || this.parseDate(dateStr);
      }
    }

    // Pattern 2: <time datetime="..."> element (ph-burgenland TYPO3 news)
    const $time = $el.find('time[datetime]');
    if ($time.length) {
      const dt = $time.attr('datetime') || '';
      if (dt) return dt.slice(0, 19); // ISO format
    }

    // Pattern 3: span.event-date with "DD. MM." format, no year (ph-kaernten)
    const $eventDate = $el.find('.event-date');
    if ($eventDate.length) {
      // Text like "01.\u200904." — contains thin space, remove it
      const raw = $eventDate.text().replace(/[\u2009\u00a0\s]+/g, '').trim();
      const m = raw.match(/(\d{1,2})\.(\d{1,2})\./);
      if (m) {
        const year = new Date().getFullYear();
        return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      }
    }

    // Pattern 4: span.time with "Beginn HH:MM Uhr" (kph-edith-stein)
    // (handled after date extraction below)

    // Fallback: generic date/time selectors
    const dateText = $el.find('.date, [class*="date"], .termin-datum').first().text().trim()
      || $el.find('[datetime]').first().attr('datetime') || '';
    return this.parseDatetime(dateText) || this.parseDate(dateText);
  }

  protected parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Match TYPO3 event articles, news list items, and generic patterns
    $('article.event, .news-list-item, article, .event-item, [class*="event"], .veranstaltung, .news-item, .termin, li.termine').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .event-title').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        let startDate = this.extractDate($el, $);
        if (!startDate) return;

        // Append time from span.time "Beginn HH:MM Uhr" if date has no time component
        if (!startDate.includes('T')) {
          const timeText = $el.find('span.time, .event-time').text().trim();
          const timeMatch = timeText.match(/(\d{1,2})[:\.](\d{2})/);
          if (timeMatch) {
            startDate = `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
          }
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.teaser, .lead, .description, p').first().text().trim();
        const imgSrc = $el.find('img').first().attr('src');
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

/**
 * PH Niederösterreich Scraper
 * Department-level event pages. Baden.
 */
export class PHNOEScraper extends PHBaseScraper {
  readonly name = 'ph-noe';
  protected readonly shortName = 'PH-NOE';
  protected readonly baseUrl = 'https://www.ph-noe.ac.at';
  protected readonly eventListUrl = 'https://www.ph-noe.ac.at/de/ph-noe/veranstaltungen';
  protected readonly city = 'Baden';
  protected readonly bundesland = 'niederoesterreich';
  protected readonly defaultLat = 48.0077;
  protected readonly defaultLng = 16.2310;
}

/**
 * PH Salzburg Stefan Zweig Scraper
 * Termine page with category filtering. Calendar view available.
 */
export class PHSalzburgScraper extends PHBaseScraper {
  readonly name = 'ph-salzburg';
  protected readonly shortName = 'PH-Salzburg';
  protected readonly baseUrl = 'https://phsalzburg.at';
  protected readonly eventListUrl = 'https://phsalzburg.at/termine/';
  protected readonly city = 'Salzburg';
  protected readonly bundesland = 'salzburg';
  protected readonly defaultLat = 47.7963;
  protected readonly defaultLng = 13.0522;
}

/**
 * PH Kärnten – Viktor Frankl Hochschule Scraper
 * Dedicated events page under media/communication section.
 */
export class PHKaerntenScraper extends PHBaseScraper {
  readonly name = 'ph-kaernten';
  protected readonly shortName = 'PH-Kaernten';
  protected readonly baseUrl = 'https://www.phk.ac.at';
  protected readonly eventListUrl = 'https://www.phk.ac.at/ueber-uns/medien-kommunikation/events';
  protected readonly city = 'Klagenfurt';
  protected readonly bundesland = 'kaernten';
  protected readonly defaultLat = 46.6189;
  protected readonly defaultLng = 14.2641;
}

/**
 * PH Burgenland Scraper
 * Termine page with upcoming events. Also research events.
 */
export class PHBurgenlandScraper extends PHBaseScraper {
  readonly name = 'ph-burgenland';
  protected readonly shortName = 'PH-Burgenland';
  protected readonly baseUrl = 'https://www.ph-burgenland.at';
  protected readonly eventListUrl = 'https://www.ph-burgenland.at/termine';
  protected readonly city = 'Eisenstadt';
  protected readonly bundesland = 'burgenland';
  protected readonly defaultLat = 47.8454;
  protected readonly defaultLng = 16.5278;
}

/**
 * KPH Wien/Krems Scraper
 * Kirchliche PH. Termine page with events. Wien.
 */
export class KPHWienScraper extends PHBaseScraper {
  readonly name = 'kph-wien';
  protected readonly shortName = 'KPH-Wien';
  protected readonly baseUrl = 'https://kphvie.ac.at';
  protected readonly eventListUrl = 'https://kphvie.ac.at/termine.html';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2900;
  protected readonly defaultLng = 16.3880;
}

/**
 * PPH Augustinum Scraper
 * Calendar page with conferences, summer education events. Graz.
 */
export class PPHAugustinumScraper extends PHBaseScraper {
  readonly name = 'pph-augustinum-graz';
  protected readonly shortName = 'PPH-Augustinum';
  protected readonly baseUrl = 'https://pph-augustinum.at';
  protected readonly eventListUrl = 'https://pph-augustinum.at/kalender/';
  protected readonly city = 'Graz';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.0696;
  protected readonly defaultLng = 15.4345;
}

/**
 * KPH Edith Stein Scraper
 * Kirchliche PH. Termine page. Innsbruck.
 */
export class KPHEdithSteinScraper extends PHBaseScraper {
  readonly name = 'kph-edith-stein';
  protected readonly shortName = 'KPH-EdithStein';
  protected readonly baseUrl = 'https://www.kph-es.at';
  protected readonly eventListUrl = 'https://www.kph-es.at/kph-edith-stein/termine/';
  protected readonly city = 'Innsbruck';
  protected readonly bundesland = 'tirol';
  protected readonly defaultLat = 47.2640;
  protected readonly defaultLng = 11.3920;
}
