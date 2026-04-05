import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität Wien Scraper
 * Event calendar at kalender.univie.ac.at (TYPO3 CMS, server-rendered).
 * Uses tx_univieevents_pi1 pagination. Events are h3>a with strong date text.
 */
export class UniWienScraper extends UniBaseScraper {
  readonly name = 'uni-wien';
  protected readonly shortName = 'UniWien';
  protected readonly baseUrl = 'https://kalender.univie.ac.at';
  protected readonly eventListUrl = 'https://kalender.univie.ac.at/';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2130;
  protected readonly defaultLng = 16.3600;
  private readonly MAX_PAGES = 5;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Universität Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();
    let nextUrl: string | null = this.eventListUrl;

    for (let page = 1; page <= this.MAX_PAGES && nextUrl; page++) {
      try {
        const html = await this.fetchPage(nextUrl);

        // Try JSON-LD first
        const jsonLdEvents = this.parseJsonLdEvents(html, nextUrl);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        // Also parse HTML structure
        const htmlEvents = this.parseHtml(html, nextUrl);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        if (jsonLdEvents.length === 0 && htmlEvents.length === 0) break;
        this.log(`Seite ${page}: ${allEvents.size} Events`);

        // Find "Weiter" (Next) link for pagination (contains cHash which is required)
        nextUrl = this.findNextPageUrl(html);
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

  private findNextPageUrl(html: string): string | null {
    const $ = cheerio.load(html);
    // Look for the "Weiter" link which contains the next page URL with cHash
    const weiterLink = $('a:contains("Weiter")').filter((_, el) => {
      const href = $(el).attr('href') || '';
      return href.includes('tx_univieevents_pi1') && href.includes('page');
    }).first();
    if (weiterLink.length) {
      const href = weiterLink.attr('href') || '';
      return href.startsWith('http') ? href : `${this.baseUrl}${href}`;
    }
    return null;
  }

  private parseHtml(html: string, _pageUrl: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // UniWien: events are in <div class="row bg-gray-lightest p-4 mb-6"> blocks
    // with <time itemprop="eventDate" datetime="2026-04-06 07:00"> for date
    // and <h3><a href="/einzelansicht?...">Title</a></h3> for title/link

    // First try: use <time> elements with itemprop="eventDate"
    $('time[itemprop="eventDate"]').each((_, el) => {
      try {
        const $time = $(el);
        const datetime = $time.attr('datetime') || '';
        if (!datetime) return;

        // Parse datetime like "2026-04-06 07:00"
        const startDate = datetime.replace(' ', 'T') + ':00';

        // Find the h3 > a link in the same event block
        const $block = $time.closest('div.row, div[class*="bg-gray"]');
        if (!$block.length) return;

        const $link = $block.find('h3 a, a[href*="einzelansicht"]').first();
        if (!$link.length) return;

        const title = $link.text().trim();
        if (!title || title.length < 3) return;

        const href = $link.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
        }));
      } catch { /* skip */ }
    });

    // Fallback: find links to /einzelansicht with event IDs
    if (events.length === 0) {
      $('a[href*="einzelansicht"]').each((_, el) => {
        try {
          const $a = $(el);
          const title = $a.text().trim();
          if (!title || title.length < 3) return;

          const href = $a.attr('href') || '';
          const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

          // Find date from parent context
          const $block = $a.closest('div.row, div[class*="bg-gray"]');
          const $time = $block.find('time[datetime]').first();
          let startDate = '';
          if ($time.length) {
            const dt = $time.attr('datetime') || '';
            startDate = dt.replace(' ', 'T') + ':00';
          } else {
            const contextText = $block.length ? $block.text() : $a.parent().parent().text();
            startDate = this.parseDatetime(contextText) || this.parseDate(contextText) || '';
          }
          if (!startDate) return;

          const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

          events.push(this.buildEvent({
            slug,
            title,
            startDate,
            sourceUrl,
          }));
        } catch { /* skip */ }
      });
    }

    return events;
  }
}
