import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

const MONTHS: Record<string, string> = {
  'jänner': '01', 'januar': '01', 'februar': '02', 'märz': '03',
  'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
  'august': '08', 'september': '09', 'oktober': '10',
  'november': '11', 'dezember': '12',
};

/**
 * tirol.at Official Events Scraper
 * ~2400+ events, SSR, pagination via listpos parameter.
 */
export class TirolScraper extends BaseScraper {
  readonly name = 'tirol.at';
  private readonly BASE = 'https://www.tirol.at';
  private readonly LIST_URL = 'https://www.tirol.at/aktivitaeten/events/alle-events';
  private readonly MAX_PAGES = 100;
  private readonly PAGE_SIZE = 25;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte tirol.at Events Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();
    let offset = 0;
    let hasMore = true;
    let emptyCount = 0;

    while (hasMore && offset < this.MAX_PAGES * this.PAGE_SIZE) {
      const url = offset === 0 ? this.LIST_URL : `${this.LIST_URL}?listpos=${offset}`;
      try {
        const html = await this.fetchPage(url);
        const events = this.parsePage(html);

        if (events.length === 0) {
          emptyCount++;
          if (emptyCount >= 2) hasMore = false;
        } else {
          emptyCount = 0;
          for (const ev of events) allEvents.set(ev.source_id, ev);
        }

        this.log(`Offset ${offset}: ${events.length} Events (gesamt: ${allEvents.size})`);
        offset += this.PAGE_SIZE;
        await this.rateLimit();
      } catch (err) {
        this.log(`Offset ${offset} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        emptyCount++;
        if (emptyCount >= 2) hasMore = false;
        offset += this.PAGE_SIZE;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Events are in card-like blocks with title, location, date text
    // Try multiple strategies to find event blocks

    // Strategy 1: Find h2/h3 headings that look like event titles
    $('h2, h3').each((_, el) => {
      try {
        const $heading = $(el);
        const title = $heading.text().trim();
        if (!title || title.length < 5 || title.length > 200) return;
        // Skip navigation/section headings
        if (['Events', 'Alle Events', 'Veranstaltungen', 'Filter', 'Sortieren'].includes(title)) return;

        // Get container (parent block)
        const $card = $heading.parent();
        const cardText = $card.text();

        // Must have a date
        const startDate = this.parseDate(cardText);
        if (!startDate) return;

        // Skip past events
        if (cardText.includes('leider verpasst')) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Location: "Ort: Innsbruck" or just city name near date
        const ortMatch = cardText.match(/Ort:\s*([^\n:]+)/);
        const location = ortMatch ? ortMatch[1].trim() : undefined;

        // Image
        let imageUrl: string | undefined;
        const $img = $card.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        if (imgSrc && !imgSrc.startsWith('data:')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`;
        }

        // Link
        const $link = $card.find('a[href]').first();
        const href = $link.attr('href') || '';
        const sourceUrl = href && href !== '#' ? (href.startsWith('http') ? href : `${this.BASE}${href}`) : this.LIST_URL;

        events.push({
          source_id: `tirol-${slug}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: location,
          bundesland: 'tirol',
          category: categorizeEvent(title),
          image_url: imageUrl,
        });
      } catch { /* skip */ }
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;

    const m = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})/);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
    }

    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (n) return `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`;

    return null;
  }
}
