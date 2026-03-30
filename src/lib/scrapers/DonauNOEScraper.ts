import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * donau.com Niederösterreich Scraper
 * TYPO3 CMS, ~1100 events, SSR with ?page=N pagination.
 * Covers Wachau, Kremstal, Kamptal, Carnuntum, Marchfeld.
 */
export class DonauNOEScraper extends BaseScraper {
  readonly name = 'donau-noe';
  private readonly BASE = 'https://www.donau.com';
  private readonly LIST_URL = 'https://www.donau.com/de/donau-niederoesterreich/veranstaltungen-events/veranstaltungen-finden/';
  private readonly MAX_PAGES = 60;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte donau.com NÖ Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();
    let page = 1;
    let emptyCount = 0;

    while (page <= this.MAX_PAGES) {
      const url = page === 1 ? this.LIST_URL : `${this.LIST_URL}?page=${page}`;
      try {
        const html = await this.fetchPage(url);
        const events = this.parsePage(html);

        if (events.length === 0) {
          emptyCount++;
          if (emptyCount >= 2) break;
        } else {
          emptyCount = 0;
          for (const ev of events) allEvents.set(ev.source_id, ev);
        }

        this.log(`Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
        page++;
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        emptyCount++;
        if (emptyCount >= 2) break;
        page++;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Events are in <li> with h3 title, date, location, and "mehr erfahren" link
    $('li').each((_, el) => {
      try {
        const $li = $(el);
        const $title = $li.find('h3').first();
        if (!$title.length) return;

        const title = $title.text().trim();
        if (!title || title.length < 3) return;

        // Find detail link
        const $link = $li.find('a[href*="/veranstaltungen/"], a[href*="donau.com/veranstaltungen/"]').first();
        const href = $link.attr('href') || '';
        if (!href.includes('/veranstaltungen/')) return;
        if (href.includes('veranstaltungen-finden') || href.includes('veranstaltungen-events')) return;

        const slug = href.split('/').filter(Boolean).pop() || '';
        if (!slug || slug === 'veranstaltungen') return;

        const liText = $li.text();
        const startDate = this.parseDate(liText);
        if (!startDate) return;

        // Location with postal code: "Weingut Leth, 3481 Fels am Wagram"
        let locationName: string | undefined;
        let postalCode: string | undefined;
        const locMatch = liText.match(/([A-Za-zÄÖÜäöüß\s.-]+),\s*(\d{4})\s+([A-Za-zÄÖÜäöüß\s.-]+)/);
        if (locMatch) {
          locationName = `${locMatch[1].trim()}, ${locMatch[3].trim()}`;
          postalCode = locMatch[2];
        }

        let imageUrl: string | undefined;
        const $img = $li.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        if (imgSrc && !imgSrc.startsWith('data:')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`;
        }

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `donau-noe-${slug}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: locationName,
          postal_code: postalCode,
          bundesland: 'niederoesterreich',
          category: categorizeEvent(title),
          image_url: imageUrl,
        });
      } catch { /* skip */ }
    });

    return events;
  }

  private parseDate(text: string): string | null {
    if (!text) return null;

    // "27.03.26" or "27.03.2026"
    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (n) {
      let year = n[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`;
    }

    return null;
  }
}
