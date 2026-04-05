import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Medizinische Universität Graz Scraper
 * Events at medunigraz.at/en/events-1.
 * Uses .article-eventcalendar containers with:
 *   - .eventdatebox > time[datetime] for dates
 *   - h5 > a > span[itemprop=headline] for title
 *   - .news-img-wrap > a > img for images
 *   - .teaser-text for description
 * Detail links: /en/events-1/detail/{slug}
 * Paginated (pages 1-5+).
 */
export class MedUniGrazScraper extends UniBaseScraper {
  readonly name = 'meduni-graz';
  protected readonly shortName = 'MedUniGraz';
  protected readonly baseUrl = 'https://medunigraz.at';
  protected readonly eventListUrl = 'https://medunigraz.at/en/events-1';
  protected readonly city = 'Graz';
  protected readonly bundesland = 'steiermark';
  protected readonly defaultLat = 47.0816;
  protected readonly defaultLng = 15.4695;
  private readonly MAX_PAGES = 5;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte MedUni Graz Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1
        ? this.eventListUrl
        : `${this.eventListUrl}?page=${page}`;
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

    // Each event is in .article-eventcalendar with structured sub-elements
    $('.article-eventcalendar').each((_, el) => {
      try {
        const $article = $(el);

        // Title: h5 > a > span[itemprop=headline] or just h5 text
        const title = $article.find('span[itemprop="headline"]').first().text().trim()
          || $article.find('h5').first().text().trim();
        if (!title || title.length < 3) return;

        // Date: time[datetime] attribute (ISO format YYYY-MM-DD)
        const datetime = $article.find('time[datetime]').first().attr('datetime');
        const startDate = datetime ? datetime.slice(0, 10) : null;
        if (!startDate) return;

        // Detail link
        const href = $article.find('a[href*="/events-1/detail/"]').first().attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Extract slug from URL
        const slugMatch = href.match(/detail\/([^/?]+)/);
        const slug = slugMatch
          ? slugMatch[1]
          : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Image
        const imgSrc = $article.find('.news-img-wrap img').first().attr('src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        // Description
        const desc = $article.find('.teaser-text p, [itemprop="description"] p').first().text().trim();

        const ev = this.buildEvent({
          slug,
          title,
          startDate,
          description: desc || undefined,
          sourceUrl,
          imageUrl,
        });
        // Add Gesundheit tag for medical university
        if (ev.tags && !ev.tags.includes('Gesundheit')) {
          ev.tags.push('Gesundheit');
          if (ev.tags.length > 3) ev.tags.pop();
        }
        events.push(ev);
      } catch { /* skip */ }
    });

    return events;
  }
}
