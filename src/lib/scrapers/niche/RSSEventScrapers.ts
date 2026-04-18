/**
 * RSS Event Scrapers
 *
 * Sources:
 * - stadtbekannt.at: Wien cultural events via RSS feed (WordPress)
 * - regionews.at: Regional news with event announcements via RSS feed
 */
import * as cheerio from 'cheerio';
import { BaseScraper } from '../BaseScraper';
import { categorizeEvent } from '../../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * stadtbekannt.at — Wien cultural events via RSS.
 * WordPress site with RSS 2.0 feed containing Wien-focused event content.
 */
export class StadtbekanntScraper extends BaseScraper {
  readonly name = 'stadtbekannt.at';
  private readonly FEED_URL = 'https://stadtbekannt.at/feed/';
  private readonly BASE = 'https://stadtbekannt.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte stadtbekannt.at RSS Scraping...');
    const events: ScrapedEvent[] = [];

    try {
      const xml = await this.fetchPage(this.FEED_URL);
      const $ = cheerio.load(xml, { xmlMode: true });

      $('item').each((_, el) => {
        const $item = $(el);
        const title = $item.find('title').first().text().trim();
        if (!title || title.length < 3) return;

        const link = $item.find('link').first().text().trim();
        const pubDate = $item.find('pubDate').first().text().trim();
        const description = $item.find('description').first().text().trim();
        const contentEncoded = $item.find('content\\:encoded, encoded').first().text().trim();

        // Parse date from pubDate (RFC 2822 format)
        const startDate = this.parseRSSDate(pubDate);
        if (!startDate) return;

        // Filter for event-like content
        const combined = `${title} ${description}`.toLowerCase();
        if (!this.isEventLike(combined)) return;

        // Extract image from content:encoded HTML
        let imageUrl: string | undefined;
        if (contentEncoded) {
          const $content = cheerio.load(contentEncoded);
          const imgSrc = $content('img').first().attr('src');
          if (imgSrc) imageUrl = this.cleanImageUrl(imgSrc);
        }

        // Clean description (strip HTML)
        const cleanDesc = description
          ? cheerio.load(description).text().trim().slice(0, 500)
          : undefined;

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        events.push({
          source_id: `stadtbekannt-${slug}-${startDate.slice(0, 10)}`,
          source_name: this.name,
          source_url: link || this.BASE,
          title,
          description: cleanDesc,
          start_date: startDate,
          bundesland: 'wien',
          category: categorizeEvent(title),
          image_url: imageUrl,
          tags: ['Wien', 'Kultur'],
        });
      });
    } catch (err) {
      this.log(`Fehler beim RSS-Feed: ${err instanceof Error ? err.message : err}`);
    }

    // Also try to scrape the main events page
    try {
      const eventsPageUrls = [
        `${this.BASE}/veranstaltungen/`,
        `${this.BASE}/events/`,
        `${this.BASE}/tipps/`,
      ];

      for (const url of eventsPageUrls) {
        try {
          const html = await this.fetchPage(url);
          const $ = cheerio.load(html);
          const pageEvents = this.parseHtmlPage($, url);
          events.push(...pageEvents);
          this.log(`${url}: ${pageEvents.length} Events`);
          await this.rateLimit();
        } catch {
          // URL might not exist, skip silently
        }
      }
    } catch {
      // Skip HTML fallback errors
    }

    // Deduplicate
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) {
      if (!seen.has(ev.source_id)) seen.set(ev.source_id, ev);
    }

    this.log(`Gesamt: ${seen.size} Wien-Events`);
    return Array.from(seen.values());
  }

  private parseHtmlPage($: ReturnType<typeof cheerio.load>, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
        for (const item of items) {
          if (!item || item['@type'] !== 'Event') continue;
          const name = String(item.name || '').trim();
          if (!name) continue;
          const startDate = String(item.startDate || '').slice(0, 19);
          if (!startDate) continue;
          const slug = name.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
          events.push({
            source_id: `stadtbekannt-${slug}-${startDate.slice(0, 10)}`,
            source_name: this.name,
            source_url: String(item.url || pageUrl),
            title: name,
            description: item.description ? String(item.description).slice(0, 500) : undefined,
            start_date: startDate,
            end_date: item.endDate ? String(item.endDate).slice(0, 19) : undefined,
            bundesland: 'wien',
            category: categorizeEvent(name),
            tags: ['Wien', 'Kultur'],
          });
        }
      } catch { /* skip */ }
    });

    if (events.length > 0) return events;

    // HTML fallback
    $('article, .event, .post, [class*="event"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, .title, .entry-title').first().text().trim();
      if (!title || title.length < 3) return;

      const href = $el.find('a').first().attr('href') || '';
      const sourceUrl = href.startsWith('http') ? href : href ? `${this.BASE}${href}` : pageUrl;

      const dateEl = $el.find('time, [datetime], .date').first();
      const dateText = dateEl.attr('datetime') || dateEl.text().trim();
      const startDate = this.parseDate(dateText);
      if (!startDate) return;

      const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
      events.push({
        source_id: `stadtbekannt-${slug}-${startDate.slice(0, 10)}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        start_date: startDate,
        bundesland: 'wien',
        category: categorizeEvent(title),
        tags: ['Wien', 'Kultur'],
      });
    });

    return events;
  }

  private isEventLike(text: string): boolean {
    const eventWords = [
      'event', 'veranstaltung', 'festival', 'konzert', 'ausstellung',
      'markt', 'messe', 'feier', 'party', 'show', 'theater',
      'vortrag', 'workshop', 'führung', 'tour', 'fest',
      'premiere', 'opening', 'eröffnung', 'vernissage',
      'flohmarkt', 'weihnachtsmarkt', 'christkindlmarkt',
      'open air', 'kino', 'lesung', 'brunch', 'tasting',
    ];
    return eventWords.some(w => text.includes(w));
  }

  private parseRSSDate(dateStr: string): string | null {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }

  private parseDate(text: string): string | null {
    if (!text) return null;
    const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return null;
  }
}

/**
 * regionews.at — Regional Austrian news with event announcements via RSS.
 * Covers multiple Bundesländer with regional news that includes event info.
 */
export class RegionewsScraper extends BaseScraper {
  readonly name = 'regionews.at';
  private readonly FEED_URL = 'https://www.regionews.at/rss/general.news.rss.php';
  private readonly BASE = 'https://www.regionews.at';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte regionews.at RSS Scraping...');
    const events: ScrapedEvent[] = [];

    try {
      const xml = await this.fetchPage(this.FEED_URL);
      const $ = cheerio.load(xml, { xmlMode: true });

      $('item').each((_, el) => {
        const $item = $(el);
        const title = $item.find('title').first().text().trim();
        if (!title || title.length < 3) return;

        const link = $item.find('link').first().text().trim();
        const pubDate = $item.find('pubDate').first().text().trim();
        const description = $item.find('description').first().text().trim();
        const category = $item.find('category').first().text().trim();

        // Parse date
        const startDate = this.parseRSSDate(pubDate);
        if (!startDate) return;

        // Filter for event-like content
        const combined = `${title} ${description} ${category}`.toLowerCase();
        if (!this.isEventLike(combined)) return;

        // Clean description
        const cleanDesc = description
          ? cheerio.load(description).text().trim().slice(0, 500)
          : undefined;

        // Extract image from description or enclosure
        let imageUrl: string | undefined;
        const enclosure = $item.find('enclosure').attr('url');
        if (enclosure) {
          imageUrl = this.cleanImageUrl(enclosure);
        }
        if (!imageUrl && description) {
          const $desc = cheerio.load(description);
          const imgSrc = $desc('img').first().attr('src');
          if (imgSrc) imageUrl = this.cleanImageUrl(imgSrc);
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const bundesland = this.detectBundesland(title, description);

        events.push({
          source_id: `regionews-${slug}-${startDate.slice(0, 10)}`,
          source_name: this.name,
          source_url: link || this.BASE,
          title,
          description: cleanDesc,
          start_date: startDate,
          bundesland,
          category: categorizeEvent(title),
          image_url: imageUrl,
          tags: ['Regional', 'Nachrichten'],
        });
      });
    } catch (err) {
      this.log(`Fehler beim RSS-Feed: ${err instanceof Error ? err.message : err}`);
    }

    // Deduplicate
    const seen = new Map<string, ScrapedEvent>();
    for (const ev of events) {
      if (!seen.has(ev.source_id)) seen.set(ev.source_id, ev);
    }

    this.log(`Gesamt: ${seen.size} Regional-Events`);
    return Array.from(seen.values());
  }

  private isEventLike(text: string): boolean {
    const eventWords = [
      'event', 'veranstaltung', 'festival', 'konzert', 'ausstellung',
      'markt', 'messe', 'feier', 'party', 'show', 'theater',
      'vortrag', 'workshop', 'führung', 'tour', 'fest', 'eröffnung',
      'premiere', 'vernissage', 'flohmarkt', 'weihnachtsmarkt',
      'christkindlmarkt', 'open air', 'kino', 'lesung', 'einladung',
      'benefiz', 'gala', 'ball', 'umzug', 'prozession',
    ];
    return eventWords.some(w => text.includes(w));
  }

  private parseRSSDate(dateStr: string): string | null {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }

  private detectBundesland(title: string, description: string): string | undefined {
    const combined = `${title} ${description}`.toLowerCase();
    if (combined.includes('wien') || combined.includes('vienna')) return 'wien';
    if (combined.includes('graz') || combined.includes('steiermark')) return 'steiermark';
    if (combined.includes('linz') || combined.includes('oberösterreich') || combined.includes('oberoesterreich')) return 'oberoesterreich';
    if (combined.includes('salzburg')) return 'salzburg';
    if (combined.includes('innsbruck') || combined.includes('tirol')) return 'tirol';
    if (combined.includes('klagenfurt') || combined.includes('kärnten') || combined.includes('kaernten')) return 'kaernten';
    if (combined.includes('bregenz') || combined.includes('vorarlberg')) return 'vorarlberg';
    if (combined.includes('eisenstadt') || combined.includes('burgenland')) return 'burgenland';
    if (combined.includes('niederösterreich') || combined.includes('niederoesterreich') || combined.includes('st. pölten')) return 'niederoesterreich';
    return undefined;
  }
}
