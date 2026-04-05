import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Veterinärmedizinische Universität Wien Scraper
 * Server-rendered. Events are <a> wrappers with <p>category</p><p>date</p><h3>title</h3>.
 * Pagination: /veranstaltungen/page-N (path-based, up to page-10).
 */
export class VetMedUniScraper extends UniBaseScraper {
  readonly name = 'vetmeduni-wien';
  protected readonly shortName = 'VetMedUni';
  protected readonly baseUrl = 'https://www.vetmeduni.ac.at';
  protected readonly eventListUrl = 'https://www.vetmeduni.ac.at/veranstaltungen';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2576;
  protected readonly defaultLng = 16.4319;
  private readonly MAX_PAGES = 10;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte VetMedUni Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // /veranstaltungen redirects to /universitaet/infoservice/veranstaltungen
    const listPath = '/universitaet/infoservice/veranstaltungen';
    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? `${this.baseUrl}${listPath}`
        : `${this.baseUrl}${listPath}/page-${page}`;
      try {
        const html = await this.fetchPage(url);

        const jsonLdEvents = this.parseJsonLdEvents(html, url);
        for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

        const htmlEvents = this.parseHtml(html);
        for (const ev of htmlEvents) {
          if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
        }

        if (jsonLdEvents.length === 0 && htmlEvents.length === 0) break;
        this.log(`Seite ${page}: ${allEvents.size} Events`);
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

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // VetMedUni: events are in .news-list-item divs with itemscope Article
    // <time itemprop="datePublished" datetime="2026-04-07"> for date
    // <a class="news-headline-link"> with <p class="news-headline"> for title
    // Image in .news-img-wrapper
    $('.news-list-item').each((_, el) => {
      try {
        const $item = $(el);

        // Title from news-headline-link
        const $titleLink = $item.find('a.news-headline-link').first();
        if (!$titleLink.length) return;

        const title = ($titleLink.attr('title') || $titleLink.find('.news-headline').text() || $titleLink.text()).trim();
        if (!title || title.length < 3) return;

        const href = $titleLink.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Date from <time> element
        const $time = $item.find('time[datetime]').first();
        const datetime = $time.attr('datetime') || '';
        let startDate = '';
        if (datetime && datetime.match(/^\d{4}-\d{2}-\d{2}/)) {
          startDate = datetime.slice(0, 10);
        } else {
          // Fallback: parse text
          const dateText = $time.text().trim() || $item.text();
          startDate = this.parseDate(dateText) || '';
        }
        if (!startDate) return;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Image
        const imgSrc = $item.find('.news-img-wrapper img').first().attr('src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
