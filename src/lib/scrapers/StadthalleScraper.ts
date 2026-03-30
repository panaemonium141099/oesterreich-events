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
 * Wiener Stadthalle Scraper
 * Server-rendered, all events on single page, no pagination needed.
 */
export class StadthalleScraper extends BaseScraper {
  readonly name = 'stadthalle';
  private readonly BASE = 'https://www.stadthalle.com';
  private readonly URL = 'https://www.stadthalle.com/de-at/events/alle-events';

  // Fixed venue coordinates
  private readonly LAT = 48.2019;
  private readonly LNG = 16.3311;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Stadthalle Wien Scraping...');
    const html = await this.fetchPage(this.URL);
    const events = this.parsePage(html);
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Event items are li elements with event links
    $('a[href*="/events/alle-events/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';

        // Extract event ID from URL: /de/events/alle-events/50801/Sarah-Connor
        const idMatch = href.match(/\/alle-events\/(\d+)\//);
        if (!idMatch) return;
        const eventId = idMatch[1];
        if (seen.has(eventId)) return;
        seen.add(eventId);

        // Get parent container
        const $container = $link.closest('li').length ? $link.closest('li') : $link.parent();

        // Title from h3
        const title = $container.find('h3').first().text().trim()
          || $link.text().trim().split('\n')[0].trim();
        if (!title || title.length < 2) return;

        // Date from p elements: "Samstag, 28.03.2026"
        let startDate: string | null = null;
        $container.find('p').each((_, p) => {
          if (!startDate) {
            const pText = $(p).text().trim();
            startDate = this.parseDate(pText);
          }
        });

        // Also try from container text
        if (!startDate) {
          startDate = this.parseDate($container.text());
        }
        if (!startDate) return;

        // Check for cancelled/sold out
        const containerText = $container.text().toLowerCase();
        if (containerText.includes('abgesagt')) return;

        // Image
        let imageUrl: string | undefined;
        const $img = $container.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        if (imgSrc && !imgSrc.startsWith('data:')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`;
        }

        // Price from link text: "Tickets ab€ 70.9"
        let priceText: string | undefined;
        let priceMin: number | undefined;
        const priceMatch = containerText.match(/(?:ab\s*)?€\s*([\d,.]+)/);
        if (priceMatch) {
          priceMin = parseFloat(priceMatch[1].replace(',', '.'));
          priceText = `ab €${priceMin.toFixed(2)}`;
        }

        // Venue/Hall from p: "Halle D", "Halle F"
        let hall: string | undefined;
        $container.find('p').each((_, p) => {
          const t = $(p).text().trim();
          if (t.match(/^Halle\s+[A-Z]/)) hall = t;
        });

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `stadthalle-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: hall ? `Wiener Stadthalle ${hall}` : 'Wiener Stadthalle',
          address: 'Roland-Rainer-Platz 1, 1150 Wien',
          postal_code: '1150',
          bundesland: 'wien',
          district: '15. Rudolfsheim-Fünfhaus',
          latitude: this.LAT,
          longitude: this.LNG,
          category: categorizeEvent(title),
          price_text: priceText,
          price_min: priceMin,
          image_url: imageUrl,
        });
      } catch { /* skip */ }
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;

    // "28.03.2026" or "Samstag, 28.03.2026"
    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (n) {
      const [, day, mo, year] = n;
      return `${year}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // "28. März 2026"
    const m = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})/);
    if (m) {
      const [, day, month, year] = m;
      const mo = MONTHS[month.toLowerCase()];
      if (!mo) return null;
      return `${year}-${mo}-${day.padStart(2, '0')}`;
    }

    return null;
  }
}
