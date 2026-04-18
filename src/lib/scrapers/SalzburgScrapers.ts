import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

const MONTHS: Record<string, string> = {
  'jänner': '01', 'januar': '01', 'jan': '01', 'februar': '02', 'feb': '02',
  'märz': '03', 'mär': '03', 'mar': '03', 'april': '04', 'apr': '04',
  'mai': '05', 'juni': '06', 'jun': '06', 'juli': '07', 'jul': '07',
  'august': '08', 'aug': '08', 'september': '09', 'sep': '09',
  'oktober': '10', 'okt': '10', 'november': '11', 'nov': '11',
  'dezember': '12', 'dez': '12',
};

/**
 * Rockhouse Salzburg Scraper
 * ~200 events/year, SSR, month-based navigation.
 */
export class RockhouseScraper extends BaseScraper {
  readonly name = 'rockhouse';
  private readonly BASE = 'https://www.rockhouse.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Rockhouse Salzburg Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Scrape current + next 6 months
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const url = `${this.BASE}/Veranstaltungen?month=${month}&year=${year}`;

      try {
        const html = await this.fetchPage(url);
        const events = this.parsePage(html);
        for (const ev of events) allEvents.set(ev.source_id, ev);
        this.log(`${year}-${month}: ${events.length} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`${year}-${month} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('a[href*="/Veranstaltungen//"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        const idMatch = href.match(/::(\d+)/);
        if (!idMatch) return;
        const eventId = idMatch[1];

        const $card = $link.closest('div, article, li').first();
        let title = $card.find('h2, h3, h4, strong').first().text().trim();
        if (!title) title = $link.text().trim().split('\n')[0].trim();
        if (!title || title.length < 3) return;

        const cardText = $card.text();
        const startDate = this.parseDate(cardText);
        if (!startDate) return;

        // Skip sold out
        if (cardText.toLowerCase().includes('ausverkauft')) return;

        // Price: "VVK: € 25,00 / AK: € 28,00"
        let priceText: string | undefined;
        let priceMin: number | undefined;
        const priceMatch = cardText.match(/€\s*([\d,.]+)/);
        if (priceMatch) {
          priceMin = parseFloat(priceMatch[1].replace(',', '.'));
          priceText = `ab €${priceMin.toFixed(2)}`;
        }

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `rockhouse-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: 'Rockhouse Salzburg',
          address: 'Schallmooser Hauptstraße 46, 5020 Salzburg',
          postal_code: '5020',
          bundesland: 'salzburg',
          latitude: 47.8065,
          longitude: 13.0550,
          category: categorizeEvent(title),
          price_text: priceText,
          price_min: priceMin,
        });
      } catch {}
    });

    return events;
  }

  private parseDate(text: string): string | null {
    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (n) return `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`;

    const m = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})/);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
    }
    return null;
  }
}

/**
 * ARGEkultur Salzburg Scraper
 * ~350 events/year, SSR.
 */
export class ARGEkulturScraper extends BaseScraper {
  readonly name = 'argekultur';
  private readonly BASE = 'https://www.argekultur.at';
  private readonly MAX_PAGES = 20;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte ARGEkultur Salzburg Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1 ? `${this.BASE}/events` : `${this.BASE}/events?page=${page}`;
      try {
        const html = await this.fetchPage(url);
        const events = this.parsePage(html);

        if (events.length === 0) break;
        for (const ev of events) allEvents.set(ev.source_id, ev);
        this.log(`Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
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

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('a[href*="/Event/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        const idMatch = href.match(/\/Event\/(\d+)\//);
        if (!idMatch) return;
        const eventId = idMatch[1];

        const $card = $link.closest('div, article, li').first();
        let title = $card.find('h2, h3, h4, strong').first().text().trim();
        if (!title) title = $link.text().trim().split('\n')[0].trim();
        if (!title || title.length < 3) return;

        const cardText = $card.text();
        const dateMatch = cardText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (!dateMatch) return;

        // Category from tags
        let tags: string[] = [];
        $card.find('[class*="tag"], [class*="badge"], [class*="category"]').each((_, t) => {
          tags.push($(t).text().trim());
        });

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `argekultur-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`,
          location_name: 'ARGEkultur',
          address: 'Ulrike-Gschwandtner-Straße 5, 5020 Salzburg',
          postal_code: '5020',
          bundesland: 'salzburg',
          latitude: 47.8017,
          longitude: 13.0372,
          category: categorizeEvent(title, undefined, tags.length > 0 ? tags : undefined),
          tags,
        });
      } catch {}
    });

    return events;
  }
}

/**
 * SZENE Salzburg Scraper
 * ~200 events/year (Tanz, Theater, Konzerte), SSR with month/genre filters.
 */
export class SzeneSalzburgScraper extends BaseScraper {
  readonly name = 'szene-salzburg';
  private readonly BASE = 'https://szene-salzburg.net';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte SZENE Salzburg Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Scrape current + next 6 months
    const monthNames = ['januar', 'februar', 'marz', 'april', 'mai', 'juni',
      'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
    const today = new Date();

    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthName = monthNames[d.getMonth()];
      const url = `${this.BASE}/programm/?monat=${monthName}`;

      try {
        const html = await this.fetchPage(url);
        const events = this.parsePage(html);
        for (const ev of events) allEvents.set(ev.source_id, ev);
        this.log(`${monthName}: ${events.length} Events`);
        await this.rateLimit();
      } catch (err) {
        this.log(`${monthName} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('a[href*="/programm/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        if (href === '/programm/' || !href.match(/\/programm\/.+\//)) return;

        const $card = $link.closest('div, article, li').first();
        let title = $card.find('h2, h3, h4, strong').first().text().trim();
        if (!title) title = $link.text().trim().split('\n')[0].trim();
        if (!title || title.length < 3) return;

        const slug = href.split('/').filter(Boolean).pop() || '';
        const cardText = $card.text();

        const dateMatch = cardText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (!dateMatch) return;

        // Genre from card
        let genre: string | undefined;
        $card.find('[class*="genre"], [class*="tag"], [class*="category"]').each((_, t) => {
          if (!genre) genre = $(t).text().trim();
        });

        let imageUrl: string | undefined;
        const $img = $card.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        if (imgSrc && !imgSrc.startsWith('data:')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`;
        }

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `szene-sbg-${slug}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`,
          location_name: 'SZENE Salzburg',
          address: 'Anton-Neumayr-Platz 2, 5020 Salzburg',
          postal_code: '5020',
          bundesland: 'salzburg',
          latitude: 47.7986,
          longitude: 13.0400,
          category: categorizeEvent(title, undefined, genre ? [genre] : undefined),
          image_url: imageUrl,
        });
      } catch {}
    });

    return events;
  }
}
