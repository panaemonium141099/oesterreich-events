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

  protected parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('article, .event-item, [class*="event"], .veranstaltung, .news-item, .termin, li.termine').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h2, h3, h4, .title, .event-title').first().text().trim();
        if (!title || title.length < 3) return;

        const href = $el.find('a').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        const dateText = $el.find('time, .date, [class*="date"], .termin-datum').first().text().trim()
          || $el.find('[datetime]').first().attr('datetime') || '';
        const startDate = this.parseDatetime(dateText) || this.parseDate(dateText);
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const desc = $el.find('.teaser, .description, p').first().text().trim();
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
