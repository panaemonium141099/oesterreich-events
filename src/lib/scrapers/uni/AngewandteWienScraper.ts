import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * Universität für angewandte Kunst Wien (die Angewandte) Scraper
 * Event calendar at dieangewandte.at/veranstaltungen is JS-rendered.
 * The /rss page (HTML, not actual RSS) lists current events and exhibitions
 * with links to aktuell_detail and ausstellungen_detail pages.
 * Also scrapes the main veranstaltungen page for any JSON-LD data.
 */
export class AngewandteWienScraper extends UniBaseScraper {
  readonly name = 'angewandte-wien';
  protected readonly shortName = 'Angewandte';
  protected readonly baseUrl = 'https://dieangewandte.at';
  protected readonly eventListUrl = 'https://dieangewandte.at/veranstaltungen';
  protected readonly city = 'Wien';
  protected readonly bundesland = 'wien';
  protected readonly defaultLat = 48.2006;
  protected readonly defaultLng = 16.3738;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Angewandte Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Primary source: the /rss page has server-rendered event listings
    try {
      const rssUrl = 'https://dieangewandte.at/rss';
      const html = await this.fetchPage(rssUrl);

      const jsonLdEvents = this.parseJsonLdEvents(html, rssUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }

      this.log(`RSS-Seite: ${allEvents.size} Events`);
    } catch (err) {
      this.log(`RSS-Seite Fehler: ${err instanceof Error ? err.message : err}`);
    }

    // Also try the main veranstaltungen page for JSON-LD
    try {
      await this.rateLimit();
      const html = await this.fetchPage(this.eventListUrl);
      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);
    } catch { /* skip */ }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Angewandte pages use links to aktuell_detail, ausstellungen_detail pages
    // Each event item typically has an image, title, date range, and "More information" link
    $('a[href*="aktuell_detail"], a[href*="ausstellungen_detail"], a[href*="artikel_id"]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        if (!href) return;

        // Extract article ID for dedup
        const idMatch = href.match(/artikel_id=(\d+)/);
        const articleId = idMatch ? idMatch[1] : href;
        if (seen.has(articleId)) return;
        seen.add(articleId);

        // Get title from the link text or nearby heading
        let title = $el.text().trim();
        // If this is a "More information" link, look for title in parent/sibling
        if (!title || title.length < 5 || /^(more|mehr|details|weiterlesen)/i.test(title)) {
          const $parent = $el.parent();
          title = $parent.find('h2, h3, h4, strong').first().text().trim()
            || $parent.prev().find('h2, h3, h4, strong').first().text().trim()
            || $parent.prev().text().trim();
        }
        if (!title || title.length < 3) return;
        // Clean up title — take first line if multi-line
        title = title.split('\n')[0].trim();
        if (title.length > 120) title = title.slice(0, 120);

        // Look for dates in surrounding text
        const $container = $el.closest('div, article, section, li') || $el.parent();
        const containerText = $container.text() || '';

        let startDate = this.parseDatetime(containerText) || this.parseDate(containerText);
        if (!startDate) {
          // Try the title itself for embedded dates
          startDate = this.parseDate(title);
        }
        if (!startDate) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = idMatch
          ? `angewandte-${idMatch[1]}`
          : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Image from nearby img tag
        const imgSrc = $container.find('img').first().attr('src');
        const imageUrl = imgSrc
          ? this.cleanImageUrl(this.resolveImageUrl(imgSrc, this.baseUrl))
          : undefined;

        events.push(this.buildEvent({
          slug,
          title,
          startDate,
          sourceUrl,
          imageUrl,
        }));
      } catch { /* skip */ }
    });

    // Fallback: generic article/event selectors
    if (events.length === 0) {
      $('article, .event-item, [class*="event"], .veranstaltung').each((_, el) => {
        try {
          const $el = $(el);
          const title = $el.find('h2, h3, h4, .title').first().text().trim();
          if (!title || title.length < 3) return;

          const href = $el.find('a').first().attr('href') || '';
          const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

          const dateText = $el.find('time, .date, [class*="date"]').first().text().trim()
            || $el.find('[datetime]').first().attr('datetime') || '';
          const bodyText = $el.text();
          const startDate = this.parseDatetime(dateText) || this.parseDate(dateText)
            || this.parseDatetime(bodyText) || this.parseDate(bodyText);
          if (!startDate) return;

          const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          const desc = $el.find('.teaser, .description, p').first().text().trim();

          events.push(this.buildEvent({
            slug,
            title,
            startDate,
            description: desc || undefined,
            sourceUrl,
          }));
        } catch { /* skip */ }
      });
    }

    return events;
  }
}
