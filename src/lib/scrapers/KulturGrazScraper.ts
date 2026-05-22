import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * kultur.graz.at Scraper (Graz / Steiermark)
 * Kulturserver der Stadt Graz — SSR calendar with daily views.
 * 200-400 events/month, 10 categories, 70+ venues.
 * Uses /kalender/tag/YYYYMMDD for daily views.
 */
export class KulturGrazScraper extends BaseScraper {
  readonly name = 'kultur-graz';
  private readonly BASE = 'https://kultur.graz.at';
  private readonly DAYS_AHEAD = 60;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte kultur.graz.at Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    const today = new Date();

    // Scrape daily pages for the next N days
    for (let i = 0; i < this.DAYS_AHEAD; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const dateStr = this.formatDateForUrl(date);
      const url = `${this.BASE}/kalender/tag/${dateStr}`;
      const isoDate = this.formatIsoDate(date);

      try {
        const html = await this.fetchPage(url);
        const events = this.parseDayPage(html, isoDate);

        for (const ev of events) allEvents.set(ev.source_id, ev);

        if (i % 7 === 0) {
          this.log(`Tag ${dateStr}: ${events.length} Events (gesamt: ${allEvents.size})`);
        }

        await this.rateLimit();
      } catch (err) {
        this.log(`Tag ${dateStr} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);

    if (events.length > 0) {
      const summary = await this.enrichFromDetail(events);
      this.log(`detail-enrich: ${JSON.stringify(summary)}`);
    }
    return events;
  }

  private parseDayPage(html: string, fallbackDate: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Events are listed as linked entries with pattern: time, title (link to /kalender/event/ID), venue, category
    $('a[href*="/kalender/event/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        const idMatch = href.match(/\/kalender\/event\/(\d+)/);
        if (!idMatch) return;

        const eventId = idMatch[1];
        if (seen.has(eventId)) return;
        seen.add(eventId);

        // Title is the link text
        const title = $link.text().trim();
        if (!title || title.length < 3) return;

        // Navigate up to find the containing context
        const $parent = $link.parent();
        const $container = $parent.parent();
        const containerText = $container.text();
        const parentText = $parent.text();

        // Time — look for HH:MM pattern before the link
        let time: string | undefined;
        const timeMatch = containerText.match(/(\d{1,2}):(\d{2})\s*Uhr/);
        if (timeMatch) {
          time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        }

        // Start date with optional time
        const startDate = time ? `${fallbackDate}T${time}` : fallbackDate;

        // Location / Venue — text after the title, before category
        let locationName: string | undefined;
        // The structure seems to be: time | title | venue | category
        // Try extracting from sibling text or context
        const textParts = containerText.split(/\n/).map(s => s.trim()).filter(Boolean);
        // Look for venue-like text (not the title, not the time, not a category)
        for (const part of textParts) {
          if (part === title) continue;
          if (/^\d{1,2}:\d{2}/.test(part)) continue;
          if (this.isCategory(part)) continue;
          if (part.length > 3 && part.length < 100 && !part.includes('Uhr')) {
            locationName = part;
            break;
          }
        }

        // Category from text (known Graz categories)
        let categoryTag: string | undefined;
        for (const part of textParts) {
          if (this.isCategory(part)) {
            categoryTag = part;
            break;
          }
        }

        // Image
        const $img = $container.find('img').first();
        const imgSrc = $img.attr('src') || '';
        let imageUrl: string | undefined;
        if (imgSrc) {
          const fullImg = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`;
          // Prefer large version
          imageUrl = this.cleanImageUrl(fullImg.replace('-thumbnail', '-large'));
        }

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `kultur-graz-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: locationName || 'Graz',
          bundesland: 'steiermark',
          category: categorizeEvent(title, undefined, categoryTag ? [categoryTag] : undefined),
          image_url: imageUrl,
        });
      } catch { /* skip invalid entries */ }
    });

    return events;
  }

  private isCategory(text: string): boolean {
    const categories = [
      'Musik', 'Theater/Tanz', 'Kabarett/Kleinkunst', 'Ausstellungen',
      'Film', 'Literatur', 'Wissenschaft', 'Kinder/Jugend',
      'Feste/Festivals', 'Sonstiges',
    ];
    return categories.some(c => text.trim() === c || text.trim().startsWith(c));
  }

  private formatDateForUrl(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private formatIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
