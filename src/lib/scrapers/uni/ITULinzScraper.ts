import * as cheerio from 'cheerio';
import { UniBaseScraper } from './UniBaseScraper';
import type { ScrapedEvent } from '@/types/events';

/**
 * IT:U Linz (Interdisciplinary Transformation University Austria) Scraper
 * WordPress-based, event cards with date/time in listing.
 * Uses JSON-LD on detail pages if available, HTML parsing on listing.
 */
export class ITULinzScraper extends UniBaseScraper {
  readonly name = 'itu-linz';
  protected readonly shortName = 'ITU-Linz';
  protected readonly baseUrl = 'https://it-u.at';
  protected readonly eventListUrl = 'https://it-u.at/en/events/';
  protected readonly city = 'Linz';
  protected readonly bundesland = 'ooe';
  protected readonly defaultLat = 48.3371;
  protected readonly defaultLng = 14.3190;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte IT:U Linz Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    try {
      const html = await this.fetchPage(this.eventListUrl);

      // Try JSON-LD first
      const jsonLdEvents = this.parseJsonLdEvents(html, this.eventListUrl);
      for (const ev of jsonLdEvents) allEvents.set(ev.source_id, ev);

      // HTML fallback
      const htmlEvents = this.parseHtml(html);
      for (const ev of htmlEvents) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
    } catch (err) {
      this.log(`Fehler: ${err instanceof Error ? err.message : err}`);
    }

    // Also try German page
    try {
      await this.rateLimit();
      const deUrl = 'https://it-u.at/de/events/';
      const deHtml = await this.fetchPage(deUrl);
      const deJsonLd = this.parseJsonLdEvents(deHtml, deUrl);
      for (const ev of deJsonLd) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
      const deHtml2 = this.parseHtml(deHtml);
      for (const ev of deHtml2) {
        if (!allEvents.has(ev.source_id)) allEvents.set(ev.source_id, ev);
      }
    } catch { /* skip */ }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parseHtml(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // IT:U uses .wp-block-atom-events-teaser with slick carousel slides
    // Each event is an <a> tag containing img, date (MM/DD), time, and title
    $('a[href*="/events/"]').each((_, el) => {
      try {
        const $el = $(el);
        const href = $el.attr('href') || '';
        // Skip the listing page itself
        if (href === this.eventListUrl || href === 'https://it-u.at/de/events/') return;
        if (!href.includes('/events/')) return;

        const text = $el.text().trim();
        if (!text || text.length < 5) return;

        // Extract title - last meaningful line of text (after date/time)
        const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== ':read more');
        if (lines.length === 0) return;

        // Date pattern: MM/DD
        const dateMatch = text.match(/(\d{2})\/(\d{2})/);
        // Time pattern: HH:MM
        const timeMatch = text.match(/(\d{1,2}):(\d{2})/);

        // Title is typically the longest line or last meaningful line
        const title = lines.find(l => l.length > 10 && !l.match(/^\d{2}\/\d{2}$/) && !l.match(/^\d{1,2}:\d{2}$/) && l !== ':read more')
          || lines[lines.length - 1];
        if (!title || title.length < 3) return;

        // Build date: assume current or next year
        let startDate: string | null = null;
        if (dateMatch) {
          const month = dateMatch[1];
          const day = dateMatch[2];
          const now = new Date();
          let year = now.getFullYear();
          const candidate = new Date(year, parseInt(month) - 1, parseInt(day));
          // If date is more than 2 months in the past, assume next year
          if (candidate.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
            year++;
          }
          startDate = `${year}-${month}-${day.padStart(2, '0')}`;
          if (timeMatch) {
            startDate = `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
          }
        }

        if (!startDate) {
          // Try standard date parsing
          startDate = this.parseDatetime(text) || this.parseDate(text);
        }
        if (!startDate) return;

        const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-lazy');
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
