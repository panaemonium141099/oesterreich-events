/**
 * Museum Scrapers
 *
 * Sources:
 * - khm.at: Kunsthistorisches Museum Wien
 * - albertina.at: Albertina Wien
 * - mumok.at: Museum moderner Kunst Wien
 * - belvedere.at: Belvedere Wien
 * - nhm-wien.ac.at: Naturhistorisches Museum Wien
 * - technischesmuseum.at: Technisches Museum Wien
 * - leopoldmuseum.org: Leopold Museum Wien
 * - ars.electronica.art: Ars Electronica Center Linz
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEvent } from '../../categorize';
import type { ScrapedEvent } from '@/types/events';

/** Venue coordinate data for known museum locations */
interface MuseumVenue {
  name: string;
  lat: number;
  lon: number;
  bundesland: string;
}

const VENUES: Record<string, MuseumVenue> = {
  khm: { name: 'Kunsthistorisches Museum Wien', lat: 48.2037, lon: 16.3614, bundesland: 'wien' },
  albertina: { name: 'Albertina Wien', lat: 48.2047, lon: 16.3684, bundesland: 'wien' },
  mumok: { name: 'MUMOK Wien', lat: 48.2041, lon: 16.3575, bundesland: 'wien' },
  belvedere: { name: 'Belvedere Wien', lat: 48.1916, lon: 16.3808, bundesland: 'wien' },
  nhm: { name: 'Naturhistorisches Museum Wien', lat: 48.2054, lon: 16.3597, bundesland: 'wien' },
  tmw: { name: 'Technisches Museum Wien', lat: 48.1914, lon: 16.3179, bundesland: 'wien' },
  leopold: { name: 'Leopold Museum Wien', lat: 48.2036, lon: 16.3585, bundesland: 'wien' },
  ars: { name: 'Ars Electronica Center Linz', lat: 48.3094, lon: 14.2853, bundesland: 'oberoesterreich' },
};

/**
 * Abstract base for museum scrapers with shared parsing logic.
 */
abstract class MuseumBaseScraper extends BaseScraper {
  protected abstract readonly venueKey: string;
  protected abstract readonly BASE: string;
  protected abstract readonly scraperPrefix: string;
  protected abstract getUrls(): string[];

  protected get venue(): MuseumVenue {
    return VENUES[this.venueKey];
  }

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte ${this.name} Scraping...`);
    const events: ScrapedEvent[] = [];

    for (const url of this.getUrls()) {
      try {
        const html = await this.fetchPage(url);
        const $ = cheerio.load(html);
        const pageEvents = this.parsePage($, url);
        events.push(...pageEvents);
        this.log(`${url}: ${pageEvents.length} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) seen.set(ev.source_id, ev);
    this.log(`Gesamt: ${seen.size} Events`);
    return Array.from(seen.values());
  }

  protected parsePage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item) continue;
          const type = String(item['@type'] || '');
          if (type !== 'Event' && type !== 'ExhibitionEvent' && type !== 'MusicEvent') continue;
          const ev = this.parseJsonLdEvent(item, pageUrl);
          if (ev) events.push(ev);
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback: look for event/exhibition cards
    const selectors = [
      'article',
      '[class*="event"]',
      '[class*="exhibition"]',
      '[class*="ausstellung"]',
      '[class*="veranstaltung"]',
      '[class*="program"]',
      '.teaser',
      '.card',
    ].join(', ');

    $(selectors).each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, h4, .title, [class*="title"], [class*="name"], [class*="heading"]').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], [class*="date"], [class*="datum"], [class*="zeit"]').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      // Check for end date (exhibitions have date ranges)
      const endDateText = $el.find('[class*="end-date"], [class*="bis"]').first().text().trim();
      const endDate = endDateText ? (this.parseDate(endDateText) ?? undefined) : undefined;

      const description = $el.find('[class*="description"], [class*="text"], [class*="subtitle"], p').first().text().trim() || undefined;
      const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.BASE)) : undefined;

      const ticketHref = $el.find('a[href*="ticket"], a[href*="karten"], a[class*="ticket"]').first().attr('href') || '';
      const ticketUrl = ticketHref ? (ticketHref.startsWith('http') ? ticketHref : `${this.BASE}${ticketHref}`) : undefined;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      const v = this.venue;
      events.push({
        source_id: `${this.scraperPrefix}-${slug}-${startDate}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: description?.slice(0, 500),
        start_date: startDate,
        end_date: endDate,
        location_name: v.name,
        latitude: v.lat,
        longitude: v.lon,
        bundesland: v.bundesland,
        category: this.categorize(title),
        tags: this.getTags(),
        image_url: imageUrl,
        ticket_url: ticketUrl,
      });
    });

    return events;
  }

  protected parseJsonLdEvent(item: Record<string, unknown>, pageUrl: string): ScrapedEvent | null {
    const name = String(item.name || '').trim();
    if (!name) return null;
    const startDate = String(item.startDate || '').slice(0, 19);
    if (!startDate) return null;

    const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
    const img = item.image;
    let imageUrl: string | undefined;
    if (typeof img === 'string') imageUrl = this.cleanImageUrl(this.resolveImageUrl(img, pageUrl));
    else if (img && typeof img === 'object') {
      const imgObj = img as Record<string, unknown>;
      const u = String(imgObj.url || imgObj.contentUrl || '');
      if (u) imageUrl = this.cleanImageUrl(this.resolveImageUrl(u, pageUrl));
    }

    let ticketUrl: string | undefined;
    const offers = item.offers;
    if (offers && typeof offers === 'object') {
      const offersObj = offers as Record<string, unknown>;
      ticketUrl = String(offersObj.url || '') || undefined;
    }

    const v = this.venue;
    return {
      source_id: `${this.scraperPrefix}-${slug}-${startDate.slice(0, 10)}`,
      source_name: this.name,
      source_url: String(item.url || pageUrl),
      title: name,
      description: item.description ? String(item.description).slice(0, 500) : undefined,
      start_date: startDate,
      end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
      location_name: v.name,
      latitude: v.lat,
      longitude: v.lon,
      bundesland: v.bundesland,
      category: this.categorize(name),
      tags: this.getTags(),
      image_url: imageUrl,
      ticket_url: ticketUrl,
    };
  }

  protected parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    // Also try "DD. Monat YYYY" pattern common in German museum pages
    const deMonths: Record<string, string> = {
      'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03',
      'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
      'august': '08', 'september': '09', 'oktober': '10',
      'november': '11', 'dezember': '12',
    };
    const deMatch = text.match(/(\d{1,2})\.?\s*(\w+)\s+(\d{4})/i);
    if (deMatch) {
      const month = deMonths[deMatch[2].toLowerCase()];
      if (month) return `${deMatch[3]}-${month}-${deMatch[1].padStart(2, '0')}`;
    }
    return null;
  }

  protected categorize(title: string): string {
    return categorizeEvent(title) || 'Kultur';
  }

  protected getTags(): string[] {
    return ['Museum', 'Kultur', 'Ausstellung'];
  }
}

// --- Concrete Museum Scrapers ---

export class KHMScraper extends MuseumBaseScraper {
  readonly name = 'khm.at';
  protected readonly venueKey = 'khm';
  protected readonly BASE = 'https://www.khm.at';
  protected readonly scraperPrefix = 'khm';

  protected getUrls(): string[] {
    return [
      `${this.BASE}/besuchen/veranstaltungen/`,
      `${this.BASE}/besuchen/ausstellungen/`,
    ];
  }

  protected getTags(): string[] {
    return ['Museum', 'Kunst', 'Kultur', 'Ausstellung'];
  }
}

export class AlbertinaScraper extends MuseumBaseScraper {
  readonly name = 'albertina.at';
  protected readonly venueKey = 'albertina';
  protected readonly BASE = 'https://www.albertina.at';
  protected readonly scraperPrefix = 'albertina';

  protected getUrls(): string[] {
    return [
      `${this.BASE}/ausstellungen/`,
      `${this.BASE}/veranstaltungen/`,
    ];
  }

  protected getTags(): string[] {
    return ['Museum', 'Kunst', 'Kultur', 'Ausstellung'];
  }
}

export class MUMOKScraper extends MuseumBaseScraper {
  readonly name = 'mumok.at';
  protected readonly venueKey = 'mumok';
  protected readonly BASE = 'https://www.mumok.at';
  protected readonly scraperPrefix = 'mumok';

  protected getUrls(): string[] {
    return [
      `${this.BASE}/de/veranstaltungen`,
      `${this.BASE}/de/ausstellungen`,
    ];
  }

  protected getTags(): string[] {
    return ['Museum', 'Moderne Kunst', 'Kultur', 'Ausstellung'];
  }
}

export class BelvedereScraper extends MuseumBaseScraper {
  readonly name = 'belvedere.at';
  protected readonly venueKey = 'belvedere';
  protected readonly BASE = 'https://www.belvedere.at';
  protected readonly scraperPrefix = 'belvedere';

  protected getUrls(): string[] {
    return [
      `${this.BASE}/veranstaltungen`,
      `${this.BASE}/ausstellungen`,
    ];
  }

  protected getTags(): string[] {
    return ['Museum', 'Kunst', 'Kultur', 'Belvedere'];
  }
}

export class NHMScraper extends MuseumBaseScraper {
  readonly name = 'nhm-wien.ac.at';
  protected readonly venueKey = 'nhm';
  protected readonly BASE = 'https://www.nhm-wien.ac.at';
  protected readonly scraperPrefix = 'nhm';

  protected getUrls(): string[] {
    return [
      `${this.BASE}/veranstaltungen`,
      `${this.BASE}/ausstellungen`,
    ];
  }

  protected getTags(): string[] {
    return ['Museum', 'Natur', 'Wissenschaft', 'Kultur'];
  }
}

export class TechnischesMuseumScraper extends MuseumBaseScraper {
  readonly name = 'technischesmuseum.at';
  protected readonly venueKey = 'tmw';
  protected readonly BASE = 'https://www.technischesmuseum.at';
  protected readonly scraperPrefix = 'tmw';

  protected getUrls(): string[] {
    return [
      `${this.BASE}/veranstaltungen`,
      `${this.BASE}/ausstellungen`,
    ];
  }

  protected getTags(): string[] {
    return ['Museum', 'Technik', 'Wissenschaft', 'Kultur'];
  }
}

export class LeopoldMuseumScraper extends MuseumBaseScraper {
  readonly name = 'leopoldmuseum.org';
  protected readonly venueKey = 'leopold';
  protected readonly BASE = 'https://www.leopoldmuseum.org';
  protected readonly scraperPrefix = 'leopold';

  protected getUrls(): string[] {
    return [
      `${this.BASE}/de/ausstellungen`,
      `${this.BASE}/de/veranstaltungen`,
    ];
  }

  protected getTags(): string[] {
    return ['Museum', 'Kunst', 'Kultur', 'Ausstellung'];
  }
}

export class ArsElectronicaScraper extends MuseumBaseScraper {
  readonly name = 'ars-electronica.at';
  protected readonly venueKey = 'ars';
  protected readonly BASE = 'https://ars.electronica.art';
  protected readonly scraperPrefix = 'ars-electronica';

  protected getUrls(): string[] {
    return [
      `${this.BASE}/center/de/programm/`,
      `${this.BASE}/center/de/ausstellungen/`,
    ];
  }

  protected getTags(): string[] {
    return ['Museum', 'Technologie', 'Kunst', 'Kultur'];
  }

  protected categorize(title: string): string {
    return categorizeEvent(title) || 'Kultur';
  }
}
