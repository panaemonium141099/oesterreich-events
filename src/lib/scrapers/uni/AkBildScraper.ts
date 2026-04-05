import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Akademie der bildenden Künste Wien Scraper
 * Server-rendered (Plone CMS). Events are <a> wrappers with date text "So 5.4.2026 10:30h"
 * and <h3>title</h3>. Pagination uses b_start:int offset (20 per page).
 */
export class AkBildScraper extends UniBaseScraper {
  readonly name = 'akbild-wien';
  protected readonly shortName = 'AkBild';
  protected readonly baseUrl = 'https://www.akbild.ac.at';
  protected readonly eventListUrl = 'https://www.akbild.ac.at/de/veranstaltungen';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2005;
  protected readonly defaultLng = 16.3688;
  private readonly MAX_PAGES = 5;
  private readonly PAGE_SIZE = 20;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Akademie der bildenden Künste Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();
    let nextUrl: string | null = this.eventListUrl;

    for (let page = 0; page < this.MAX_PAGES && nextUrl; page++) {
      try {
        const html = await this.fetchPage(nextUrl);

        const jsonLdEvents = this.parseJsonLdEvents(html, nextUrl);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        const prevSize = allEvents.size;
        const htmlEvents = this.parseHtml(html);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        // Stop if no new events were found
        if (allEvents.size === prevSize && jsonLdEvents.length === 0) break;
        this.log(`Seite ${page + 1}: ${allEvents.size} Events`);

        // Extract next page URL from pagination links (Plone uses hash-prefixed b_start)
        nextUrl = this.findNextPageUrl(html, nextUrl);
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${page + 1} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        break;
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private findNextPageUrl(html: string, currentUrl: string): string | null {
    const $ = cheerio.load(html);
    // Find pagination link with b_start that is different from current URL
    let nextHref: string | null = null;
    $('a[href*="b_start"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href !== currentUrl && href.includes('b_start')) {
        // Get the offset from this link
        const match = href.match(/b_start:int=(\d+)/);
        const currentMatch = currentUrl.match(/b_start:int=(\d+)/);
        const linkOffset = match ? parseInt(match[1]) : 0;
        const currentOffset = currentMatch ? parseInt(currentMatch[1]) : 0;
        // Only follow links with higher offsets
        if (linkOffset > currentOffset) {
          nextHref = href;
          return false; // break
        }
      }
    });
    return nextHref;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // AkBild (Plone): events are in <li class="list-group-item"> elements
    // Date: <time datetime="2026-04-05"> in .col-list-date
    // Time: <time datetime="10:30"> in .col-list-date
    // Title: <h3><a class="list-group-link" href="...">Title</a></h3> in a .col div
    // Image: <img> with @@images pattern
    $('li.list-group-item').each((_, el) => {
      try {
        const $li = $(el);

        // Title from h3 > a.list-group-link
        const $link = $li.find('a.list-group-link[href*="akbild.ac.at"]').first();
        if (!$link.length) return;

        // Skip filter links (contain collectionfilter param)
        const href = $link.attr('href') || '';
        if (href.includes('collectionfilter')) return;

        const title = $link.text().trim();
        if (!title || title.length < 3) return;

        // Date from <time datetime="YYYY-MM-DD"> element
        const $dateTime = $li.find('time[datetime]').first();
        const datetime = $dateTime.attr('datetime') || '';
        if (!datetime || !datetime.match(/^\d{4}-\d{2}-\d{2}/)) return;
        let startDate = datetime.slice(0, 10);

        // Time from second <time> element (or same li context)
        const $timeTags = $li.find('time[datetime]');
        let timeStr = '';
        $timeTags.each((_, t) => {
          const dt = $(t).attr('datetime') || '';
          if (dt.match(/^\d{1,2}:\d{2}/)) {
            timeStr = dt;
          }
        });
        if (timeStr) {
          const [h, m] = timeStr.split(':');
          startDate = `${startDate}T${h.padStart(2, '0')}:${m}:00`;
        }

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Description from list-group-small p
        const desc = $li.find('.list-group-small p').first().text().trim();

        // Image
        const imgSrc = $li.find('img').first().attr('src');
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
