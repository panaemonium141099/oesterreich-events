import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

export class WienGvScraper extends BaseScraper {
  readonly name = 'wien-gv';
  private readonly BASE = 'https://www.wien.gv.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte wien.gv.at Scraping...');
    const events: ScrapedEvent[] = [];

    // Get listing page
    const html = await this.fetchPage(`${this.BASE}/veranstaltungen/`);
    const $ = cheerio.load(html);

    // Extract event detail URLs
    const urls = new Set<string>();
    $('a[href*="/veranstaltungen/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes('/suche') && !href.includes('/embed') && !href.includes('?') && href.match(/\/veranstaltungen\/[a-z0-9-]+$/)) {
        urls.add(href.startsWith('http') ? href : `${this.BASE}${href}`);
      }
    });

    this.log(`${urls.size} Event-Detailseiten gefunden`);

    for (const url of urls) {
      try {
        await this.rateLimit();
        const detail = await this.fetchPage(url);
        const event = this.parseDetail(detail, url);
        if (event) events.push(event);
      } catch (err) {
        this.log(`Fehler bei ${url}: ${err instanceof Error ? err.message : err}`);
      }
    }

    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseDetail(html: string, url: string): ScrapedEvent | null {
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim();
    if (!title) return null;

    // Extract JSON-LD
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jsonLd: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        if (data['@type'] === 'Event') jsonLd = data;
        if (data['@graph']) {
          const ev = data['@graph'].find((g: Record<string, unknown>) => g['@type'] === 'Event');
          if (ev) jsonLd = ev;
        }
      } catch { /* skip */ }
    });

    // Description
    const description = $('meta[name="description"]').attr('content') ||
      $('[class*="description"], [class*="text"], .content p').first().text().trim().slice(0, 500) || '';

    // Image
    const image = $('meta[property="og:image"]').attr('content') ||
      $('img[src*="/bilder/"]').first().attr('src') || '';
    const imageUrl = image && !image.startsWith('http') ? `${this.BASE}${image}` : image;

    // Location from content
    const locationText = $('[class*="location"], [class*="ort"], address').first().text().trim();

    // Dates - try JSON-LD first
    let startDate = '';
    let endDate: string | undefined;
    if (jsonLd) {
      startDate = (jsonLd.startDate as string) || '';
      endDate = (jsonLd.endDate as string) || undefined;
    }
    if (!startDate) {
      // Try og:event or meta tags
      startDate = $('meta[property="event:start_time"]').attr('content') || '';
    }
    if (!startDate) {
      // Try text parsing
      const dateText = $('time').first().attr('datetime') || '';
      if (dateText) startDate = dateText;
    }
    if (!startDate) {
      // Last resort: parse from page text
      const body = $.text();
      const match = body.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (match) startDate = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    }

    if (!startDate) return null;

    const slug = url.split('/').pop() || '';

    return {
      source_id: `wien-gv-${slug}`,
      source_name: this.name,
      source_url: url,
      title,
      description: description || undefined,
      start_date: startDate,
      end_date: endDate,
      location_name: locationText || 'Wien',
      bundesland: 'wien',
      latitude: 48.2082,
      longitude: 16.3738,
      category: categorizeEvent(title),
      image_url: imageUrl || undefined,
    };
  }
}
