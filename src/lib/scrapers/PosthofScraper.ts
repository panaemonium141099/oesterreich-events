import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

const MONTHS: Record<string, string> = {
  'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03', 'apr': '04',
  'mai': '05', 'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
  'sep': '09', 'okt': '10', 'oct': '10', 'nov': '11', 'dez': '12', 'dec': '12',
};

/**
 * posthof.at Scraper (Linz)
 * SSR with JSON-LD Event + Place schemas.
 * ~250 events/year. Fixed venue: POSTHOF - Zeitkultur am Hafen.
 */
export class PosthofScraper extends BaseScraper {
  readonly name = 'posthof';
  private readonly BASE = 'https://www.posthof.at';
  private readonly LATITUDE = 48.2850;
  private readonly LONGITUDE = 14.2900;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte posthof.at Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Load main page which lists upcoming events
    try {
      const html = await this.fetchPage(this.BASE);
      const eventLinks = this.extractEventLinks(html);
      this.log(`${eventLinks.length} Event-Links auf Hauptseite gefunden`);

      // Parse main page events via JSON-LD and HTML
      const mainEvents = this.parseListPage(html);
      for (const ev of mainEvents) allEvents.set(ev.source_id, ev);
      this.log(`${mainEvents.length} Events von Hauptseite geparst`);

      // Fetch detail pages for richer data (description, price)
      for (const link of eventLinks) {
        const slug = link.split('/').filter(Boolean).pop() || '';
        if (allEvents.has(`posthof-${slug}`)) {
          // Already have basic data, try to enrich
        }

        await this.rateLimit();
        try {
          const detailHtml = await this.fetchPage(link);
          const event = this.parseDetailPage(detailHtml, link);
          if (event) {
            allEvents.set(event.source_id, event);
          }
        } catch (err) {
          this.log(`Detail ${link} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        }
      }
    } catch (err) {
      this.log(`Hauptseite fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private extractEventLinks(html: string): string[] {
    const $ = cheerio.load(html);
    const links: string[] = [];
    const seen = new Set<string>();

    $('a[href*="/event/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href || href === '/event/' || href === '#') return;

      const fullUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        links.push(fullUrl);
      }
    });

    return links;
  }

  private parseListPage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Extract from JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : [json];

        for (const item of items) {
          if (item['@type'] !== 'Event') continue;

          const name = String(item.name || '').trim();
          if (!name) continue;

          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          if (seen.has(slug)) continue;
          seen.add(slug);

          const startDate = this.parsePosthofDate(String(item.startDate || ''));
          if (!startDate) continue;

          events.push({
            source_id: `posthof-${slug}`,
            source_name: this.name,
            source_url: item.url ? String(item.url) : this.BASE,
            title: name,
            start_date: startDate,
            location_name: 'POSTHOF - Zeitkultur am Hafen',
            address: 'Posthofstraße 43, 4020 Linz',
            postal_code: '4020',
            bundesland: 'oberoesterreich',
            latitude: this.LATITUDE,
            longitude: this.LONGITUDE,
            category: categorizeEvent(name),
          });
        }
      } catch { /* skip invalid JSON-LD */ }
    });

    return events;
  }

  private parseDetailPage(html: string, url: string): ScrapedEvent | null {
    const $ = cheerio.load(html);
    const slug = url.split('/').filter(Boolean).pop() || '';

    // Try JSON-LD first
    let title: string | undefined;
    let startDate: string | undefined;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item['@type'] === 'Event') {
            title = String(item.name || '').trim();
            startDate = this.parsePosthofDate(String(item.startDate || ''));
          }
        }
      } catch { /* skip */ }
    });

    // Fallback to HTML parsing
    if (!title) {
      title = $('h1, h2').first().text().trim();
    }
    if (!title || title.length < 3) return null;

    if (!startDate) {
      const bodyText = $('body').text();
      startDate = this.parseDateFromText(bodyText);
    }
    if (!startDate) return null;

    // Description
    const description = (
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('article p, .event-description p, main p').first().text().trim()
    )?.slice(0, 500) || undefined;

    // Image - try og:image first, then page images
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const pageImg = $('article img, main img, .event-image img').first().attr('src') || '';
    const rawImg = ogImage || (pageImg.startsWith('http') ? pageImg : pageImg ? `${this.BASE}${pageImg}` : '');
    const imageUrl = this.cleanImageUrl(rawImg);

    // Genre / category from page text
    const bodyText = $('body').text();
    const genreMatch = bodyText.match(/(?:Genre|Kategorie|Stil):\s*([^\n]+)/i);
    const genre = genreMatch ? genreMatch[1].trim() : undefined;

    // Price
    let priceText: string | undefined;
    let priceMin: number | undefined;
    const priceMatch = bodyText.match(/(?:GS|VVK|AK|Eintritt)?:?\s*€\s*([\d,.]+)/);
    if (priceMatch) {
      priceMin = parseFloat(priceMatch[1].replace(',', '.'));
      priceText = `ab €${priceMin.toFixed(2)}`;
    }

    // Time
    const timeMatch = bodyText.match(/(\d{1,2}):(\d{2})\s*(?:Uhr|h)?/);

    return {
      source_id: `posthof-${slug}`,
      source_name: this.name,
      source_url: url,
      title,
      description,
      start_date: startDate + (timeMatch ? `T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : ''),
      location_name: 'POSTHOF - Zeitkultur am Hafen',
      address: 'Posthofstraße 43, 4020 Linz',
      postal_code: '4020',
      bundesland: 'oberoesterreich',
      latitude: this.LATITUDE,
      longitude: this.LONGITUDE,
      category: categorizeEvent(title, description, genre ? [genre] : undefined),
      image_url: imageUrl,
      price_text: priceText,
      price_min: priceMin,
    };
  }

  /**
   * Parse posthof date format: "Fr 3 Apr 26" or "03 Apr 26" or "DD.MM.YYYY"
   */
  private parsePosthofDate(text: string): string | undefined {
    const trimmed = text.trim();

    // "Fr 03 Apr 26" or "3 Apr 26"
    const shortMatch = trimmed.match(/(?:[A-Za-z]{2}\s+)?(\d{1,2})\s+([A-Za-zäöü]{3})\s+(\d{2,4})/);
    if (shortMatch) {
      const day = shortMatch[1].padStart(2, '0');
      const monthKey = shortMatch[2].toLowerCase();
      const month = MONTHS[monthKey];
      if (!month) return undefined;

      let year = shortMatch[3];
      if (year.length === 2) year = `20${year}`;

      return `${year}-${month}-${day}`;
    }

    // "DD.MM.YYYY"
    const dotMatch = trimmed.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotMatch) {
      return `${dotMatch[3]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[1].padStart(2, '0')}`;
    }

    // ISO
    const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    return undefined;
  }

  private parseDateFromText(text: string): string | undefined {
    // Try DD.MM.YYYY
    const dotDate = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotDate) {
      return `${dotDate[3]}-${dotDate[2].padStart(2, '0')}-${dotDate[1].padStart(2, '0')}`;
    }

    // Try short format in body text
    const shortMatch = text.match(/(?:Mo|Di|Mi|Do|Fr|Sa|So)\s+(\d{1,2})\s+([A-Za-zäöü]{3})\s+(\d{2,4})/);
    if (shortMatch) {
      return this.parsePosthofDate(shortMatch[0]);
    }

    return undefined;
  }
}
