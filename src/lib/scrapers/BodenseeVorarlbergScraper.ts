import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * bodensee-vorarlberg.com Scraper
 * Regional event calendar for Bregenz, Dornbirn, Feldkirch, Hohenems.
 * SSR with page-based pagination.
 */
export class BodenseeVorarlbergScraper extends BaseScraper {
  readonly name = 'bodensee-vorarlberg';
  private readonly BASE = 'https://www.bodensee-vorarlberg.com';
  private readonly LIST_URL = 'https://www.bodensee-vorarlberg.com/en/eventcalendar';
  private readonly MAX_PAGES = 30;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte bodensee-vorarlberg.com Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();
    let emptyCount = 0;

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1 ? this.LIST_URL : `${this.LIST_URL}?p=${page}`;
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
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        emptyCount++;
        if (emptyCount >= 2) break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Event cards with links
    $('a[href]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';

        // Skip navigation/non-event links
        if (!href || href === '#' || href.includes('eventcalendar') || href.includes('/en/') && href.split('/').length < 4) return;
        if (href.includes('javascript:') || href.includes('mailto:') || href.includes('.pdf')) return;

        const $card = $link.closest('div, article, li').first();
        if (!$card.length) return;

        const cardText = $card.text();

        let title = $card.find('h2, h3, h4').first().text().trim();
        if (!title) title = $link.text().trim().split('\n')[0].trim();
        if (!title || title.length < 3 || title.length > 200) return;

        // Must have a date to be an event
        const dateMatch = cardText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        if (!dateMatch) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Location from card
        let location: string | undefined;
        $card.find('[class*="location"], [class*="venue"], address').each((_, l) => {
          if (!location) location = $(l).text().trim();
        });

        // Category tags
        let tags: string[] = [];
        $card.find('[class*="tag"], [class*="badge"], [class*="category"]').each((_, t) => {
          tags.push($(t).text().trim());
        });

        let imageUrl: string | undefined;
        const $img = $card.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        if (imgSrc && !imgSrc.startsWith('data:')) {
          imageUrl = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`;
        }

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `bodensee-vbg-${slug}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`,
          location_name: location,
          bundesland: 'vorarlberg',
          category: categorizeEvent(title, undefined, tags.length > 0 ? tags : undefined),
          image_url: imageUrl,
        });
      } catch {}
    });

    return events;
  }
}
