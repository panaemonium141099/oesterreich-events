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
 * ganz-wien.at Scraper
 * TYPO3-based event magazine for Vienna.
 * Scrapes event detail pages from category listing pages.
 * ~200-500 events (Konzerte, Festivals, Theater, etc.)
 */
export class GanzWienScraper extends BaseScraper {
  readonly name = 'ganz-wien';
  private readonly BASE = 'https://www.ganz-wien.at';

  // Category pages to scrape
  private readonly CATEGORIES = [
    '/veranstaltungen/konzerte.html',
    '/veranstaltungen/festival.html',
    '/veranstaltungen/theater-kabarett.html',
    '/veranstaltungen/klassik-oper.html',
    '/veranstaltungen/baelle.html',
    '/veranstaltungen/stadthalle.html',
    '/veranstaltungen/musical.html',
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte ganz-wien.at Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (const catPath of this.CATEGORIES) {
      try {
        const url = `${this.BASE}${catPath}`;
        const html = await this.fetchPage(url);
        const links = this.extractEventLinks(html);
        this.log(`${catPath}: ${links.length} Event-Links gefunden`);

        for (const link of links) {
          if (allEvents.has(link)) continue;
          await this.rateLimit();

          try {
            const detailHtml = await this.fetchPage(link);
            const event = this.parseDetailPage(detailHtml, link);
            if (event) {
              allEvents.set(link, event);
            }
          } catch (err) {
            this.log(`Detail fehlgeschlagen ${link}: ${err instanceof Error ? err.message : err}`);
          }
        }
      } catch (err) {
        this.log(`Kategorie ${catPath} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private extractEventLinks(html: string): string[] {
    const $ = cheerio.load(html);
    const links: string[] = [];
    const seen = new Set<string>();

    $('a[href*="/veranstaltungen/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href || href === '#') return;

      // Only detail pages (not category pages)
      // Detail pages have deeper paths like /veranstaltungen/konzerte/event-name.html
      const segments = href.replace(/\.html$/, '').split('/').filter(Boolean);
      if (segments.length < 3) return; // need at least veranstaltungen/category/event

      const fullUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        links.push(fullUrl);
      }
    });

    return links;
  }

  private parseDetailPage(html: string, url: string): ScrapedEvent | null {
    const $ = cheerio.load(html);

    // Title from h1 or og:title
    let title = $('h1').first().text().trim();
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || '';
    }
    if (!title || title.length < 3) return null;

    // Extract date from page content
    const bodyText = $('body').text();
    const startDate = this.extractDate(bodyText);
    if (!startDate) return null;

    // Extract end date if date range
    const endDate = this.extractEndDate(bodyText);

    // Description
    const description = (
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('article p, .ce-bodytext p, .frame-default p').first().text().trim()
    )?.slice(0, 500) || undefined;

    // Image
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const imgSrc = $('article img, .ce-bodytext img, .frame-default img').first().attr('src') || '';
    const rawImg = ogImage || (imgSrc.startsWith('http') ? imgSrc : imgSrc ? `${this.BASE}${imgSrc}` : '');
    const imageUrl = this.cleanImageUrl(rawImg);

    // Location - look for venue info in the text
    const locationName = this.extractLocation(bodyText);

    // Address
    const addressMatch = bodyText.match(/(\w[\w\s-]+(?:straße|gasse|platz|weg|ring)\s+\d+[a-z]?)\s*,?\s*(\d{4})\s+(\w+)/i);
    const address = addressMatch ? addressMatch[0] : undefined;
    const postalCode = addressMatch ? addressMatch[2] : undefined;

    // Price
    let priceText: string | undefined;
    let priceMin: number | undefined;
    const priceMatch = bodyText.match(/(?:ab|Tickets?|Preis|Eintritt|€)\s*(?:ab\s*)?€?\s*(\d+[,.]?\d*)/i) ||
                       bodyText.match(/€\s*(\d+[,.]?\d*)/);
    if (priceMatch) {
      priceMin = parseFloat(priceMatch[1].replace(',', '.'));
      priceText = `ab €${priceMin.toFixed(2)}`;
    }

    // Generate source_id from URL slug
    const slug = url.split('/').pop()?.replace('.html', '') || '';
    const sourceId = `ganz-wien-${slug}`;

    return {
      source_id: sourceId,
      source_name: this.name,
      source_url: url,
      title,
      description,
      start_date: startDate,
      end_date: endDate,
      location_name: locationName,
      address,
      postal_code: postalCode,
      bundesland: 'wien',
      category: categorizeEvent(title, description),
      image_url: imageUrl,
      price_text: priceText,
      price_min: priceMin,
    };
  }

  private extractDate(text: string): string | null {
    // Try "DD. Monat YYYY" (e.g. "28. März 2026")
    const longDate = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})/);
    if (longDate) {
      const mo = MONTHS[longDate[2].toLowerCase()];
      if (mo) return `${longDate[3]}-${mo}-${longDate[1].padStart(2, '0')}`;
    }

    // Try DD.MM.YYYY
    const dotDate = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotDate) {
      return `${dotDate[3]}-${dotDate[2].padStart(2, '0')}-${dotDate[1].padStart(2, '0')}`;
    }

    return null;
  }

  private extractEndDate(text: string): string | undefined {
    // Date ranges: "11.-14.6.2026" or "11. - 14. Juni 2026" or "20.-22.8.2026"
    const rangeMatch = text.match(/\d{1,2}\.?\s*[-–]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (rangeMatch) {
      return `${rangeMatch[3]}-${rangeMatch[2].padStart(2, '0')}-${rangeMatch[1].padStart(2, '0')}`;
    }

    const rangeMonthMatch = text.match(/\d{1,2}\.?\s*[-–]\s*(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})/);
    if (rangeMonthMatch) {
      const mo = MONTHS[rangeMonthMatch[2].toLowerCase()];
      if (mo) return `${rangeMonthMatch[3]}-${mo}-${rangeMonthMatch[1].padStart(2, '0')}`;
    }

    return undefined;
  }

  private extractLocation(text: string): string | undefined {
    // Known Vienna venues
    const venues = [
      'Wiener Stadthalle', 'Ernst-Happel-Stadion', 'Donauinsel',
      'Konzerthaus', 'Musikverein', 'Volkstheater', 'Burgtheater',
      'Ronacher', 'Raimund Theater', 'Theater an der Wien',
      'Arena Wien', 'Gasometer', 'Flex', 'WUK', 'Porgy & Bess',
      'Prater', 'Szene Wien', 'Marx Halle', 'Ottakringer Brauerei',
    ];

    for (const venue of venues) {
      if (text.includes(venue)) return venue;
    }

    return undefined;
  }
}
