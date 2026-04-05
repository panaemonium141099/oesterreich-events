import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * FH St. Pölten (USTP) Scraper
 * Domain renamed from fhstp.ac.at to ustp.at.
 * Events at ustp.at/de/stories/events. "mehr laden" button for load-more.
 * Event links: /de/stories/events/{slug}
 * Date format: DD.MM.YYYY. Categories with # prefix.
 */
export class FHStPoeltenScraper extends UniBaseScraper {
  readonly name = 'fh-stpoelten';
  protected readonly shortName = 'FH-StPoelten';
  protected readonly baseUrl = 'https://ustp.at';
  protected readonly eventListUrl = 'https://ustp.at/de/stories/events';
  protected readonly city = 'St. Pölten';
  protected readonly bundesland = 'niederoesterreich';
  protected readonly defaultLat = 48.2054;
  protected readonly defaultLng = 15.6263;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte FH St. Pölten (USTP) Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }

      this.log(`${allEvents.size} Events gefunden`);
    } catch (err) {
      this.log(`Fehler: ${err instanceof Error ? err.message : err}`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Event links follow pattern /de/stories/events/{slug}
    $('a[href*="/de/stories/events/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        // Skip the list page itself
        if (href.endsWith('/events') || href.endsWith('/events/')) return;

        const title = $link.find('h2, h3, h4').first().text().trim()
          || $link.text().trim();
        if (!title || title.length < 3) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

        // Extract slug from URL
        const slugMatch = href.match(/events\/([^/?]+)/);
        const urlSlug = slugMatch ? slugMatch[1] : '';

        // Find date in surrounding context or within the link
        const $parent = $link.closest('article, div, li, section');
        const contextText = $parent.length ? $parent.text() : $link.text();
        const startDate = this.parseDatetime(contextText) || this.parseDate(contextText);
        if (!startDate) return;

        const slug = urlSlug || title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Extract location from text (pattern: "Campus-Platz 1 St. Pölten")
        const locMatch = contextText.match(/(Campus[^\n,]+(St\.\s*Pölten|Tulln|Krems)[^\n]*)/i);
        const locationName = locMatch ? locMatch[1].trim() : undefined;

        // Extract image
        const imgSrc = $link.find('img').first().attr('src')
          || $parent.find('img').first().attr('src');
        const imageUrl = imgSrc ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl)) : undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          locationName,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    return events;
  }
}
