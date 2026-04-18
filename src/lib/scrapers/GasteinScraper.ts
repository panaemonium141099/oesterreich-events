import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * gastein.com Scraper (Gasteinertal / Salzburg)
 * TYPO3-based event calendar with AJAX pagination.
 * ~2500 events, POST-API for page loading.
 * tx_webxbookingemo plugin with ajaxReloadEvents action.
 */
export class GasteinScraper extends BaseScraper {
  readonly name = 'gastein';
  private readonly BASE = 'https://www.gastein.com';
  private readonly AJAX_URL = 'https://www.gastein.com/index.php?id=389&L=0&no_cache=1';
  private readonly LIST_URL = 'https://www.gastein.com/events/eventkalender/';
  private readonly PER_PAGE = 12;
  private readonly MAX_PAGES = 50; // Safety limit (~600 events)

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte gastein.com Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // First load the initial page to get events and understand structure
    try {
      const html = await this.fetchPage(this.LIST_URL);
      const events = this.parseEventList(html);
      for (const ev of events) allEvents.set(ev.source_id, ev);
      this.log(`Seite 1 (initial): ${events.length} Events`);

      // Extract total count if available
      const totalMatch = html.match(/von\s+(\d+)/);
      const totalEvents = totalMatch ? parseInt(totalMatch[1], 10) : 2500;
      const totalPages = Math.min(Math.ceil(totalEvents / this.PER_PAGE), this.MAX_PAGES);
      this.log(`Geschätzt ${totalEvents} Events auf ${totalPages} Seiten`);

      // Paginate via AJAX POST
      for (let page = 2; page <= totalPages; page++) {
        await this.rateLimit();
        try {
          const pageHtml = await this.fetchAjaxPage(page);
          if (!pageHtml) break;

          const pageEvents = this.parseEventList(pageHtml);
          if (pageEvents.length === 0) break;

          for (const ev of pageEvents) allEvents.set(ev.source_id, ev);

          if (page % 10 === 0) {
            this.log(`Seite ${page}/${totalPages}: ${pageEvents.length} Events (gesamt: ${allEvents.size})`);
          }
        } catch (err) {
          this.log(`Seite ${page} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
          break;
        }
      }
    } catch (err) {
      this.log(`Initial page fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private async fetchAjaxPage(page: number): Promise<string | null> {
    const formData = new URLSearchParams();
    formData.append('tx_webxbookingemo_event[action]', 'ajaxReloadEvents');
    formData.append('tx_webxbookingemo_event[controller]', 'Event');
    formData.append('tx_webxbookingemo_event[data]', '');
    formData.append('tx_webxbookingemo_event[data_sorting]', '');
    formData.append('tx_webxbookingemo_event[paginate_currentpage]', String(page));
    formData.append('tx_webxbookingemo_event[tt]', String(Date.now()));

    const response = await fetch(this.AJAX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent,
        'Accept': 'text/html, */*',
        'Referer': this.LIST_URL,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`AJAX HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text || text.trim().length < 50) return null;

    return text;
  }

  private parseEventList(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Event items with class .event-item or links to event detail pages
    const selectors = [
      '.event-item',
      'a[href*="/erlebnisse-events/veranstaltungen/detail/event/"]',
      '[class*="event"]',
    ];

    const processedSlugs = new Set<string>();

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        try {
          const $el = $(el);

          // Find the detail link
          let href: string;
          if ($el.is('a')) {
            href = $el.attr('href') || '';
          } else {
            href = $el.find('a[href*="/detail/event/"]').first().attr('href') ||
                   $el.find('a').first().attr('href') || '';
          }

          // Extract slug from URL
          const slugMatch = href.match(/\/detail\/event\/([^/]+)\/?/);
          const slug = slugMatch ? slugMatch[1] : '';
          if (!slug || processedSlugs.has(slug)) return;
          processedSlugs.add(slug);

          // Title
          const title = (
            $el.find('h3, h4, h2').first().text().trim() ||
            $el.find('a').first().text().trim()
          );
          if (!title || title.length < 3) return;

          // Get all text from the item
          const cardText = $el.text();

          // Date: look for DD.MM pattern or day name patterns
          const startDate = this.parseDate(cardText);
          if (!startDate) return;

          // Time
          let time: string | undefined;
          const timeMatch = cardText.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
          }

          // Location from card text (appears as "Location - City")
          let locationName: string | undefined;
          const $locationEl = $el.find('p, .location, .venue').first();
          const locationText = $locationEl.text().trim();
          if (locationText && !locationText.match(/^\d/) && locationText.length > 3) {
            locationName = locationText.split(' - ')[0].trim();
          }

          // Image
          const $img = $el.find('img').first();
          const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
          let imageUrl: string | undefined;
          if (imgSrc) {
            const fullImg = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`;
            imageUrl = this.cleanImageUrl(fullImg);
          }

          const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

          events.push({
            source_id: `gastein-${slug}`,
            source_name: this.name,
            source_url: sourceUrl,
            title,
            start_date: time ? `${startDate}T${time}` : startDate,
            location_name: locationName || 'Gasteinertal',
            bundesland: 'salzburg',
            category: categorizeEvent(title),
            image_url: imageUrl,
          });
        } catch { /* skip invalid entries */ }
      });

      // If we found events with this selector, don't try others
      if (events.length > 0) break;
    }

    return events;
  }

  private parseDate(text: string): string | null {
    // DD.MM.YYYY
    const fullDate = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (fullDate) {
      return `${fullDate[3]}-${fullDate[2].padStart(2, '0')}-${fullDate[1].padStart(2, '0')}`;
    }

    // DD.MM. (without year — assume current or next year)
    const shortDate = text.match(/(\d{1,2})\.(\d{1,2})\./);
    if (shortDate) {
      const now = new Date();
      const month = parseInt(shortDate[2], 10);
      const day = parseInt(shortDate[1], 10);
      let year = now.getFullYear();
      // If the date is in the past, assume next year
      if (month < now.getMonth() + 1 || (month === now.getMonth() + 1 && day < now.getDate())) {
        year++;
      }
      return `${year}-${shortDate[2].padStart(2, '0')}-${shortDate[1].padStart(2, '0')}`;
    }

    return null;
  }
}
