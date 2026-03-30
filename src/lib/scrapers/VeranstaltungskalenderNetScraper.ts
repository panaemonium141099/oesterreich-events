import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * veranstaltungskalender.net Scraper
 * Covers ALL of Oberösterreich AND Steiermark with SSR pages.
 * ~2000+ events total, pagination via ?seite=N
 *
 * HTML structure (confirmed March 2026):
 *   div.global_listeneintrag
 *     a[href="...detail.html"]
 *       div.image_block > img
 *       div.text_block
 *         h2.eintrag_titel[itemprop="name"]
 *         div.ver_zeit  (date/time)
 *         div[itemprop="location"]
 *           span[itemprop="name"] > b  (venue name)
 *           div[itemprop="address"]
 *             span[itemprop="postalCode"]
 *             span[itemprop="addressLocality"]
 *             span[itemprop="streetAddress"]
 *         div.beschreibung[itemprop="description"]
 */
export class VeranstaltungskalenderNetScraper extends BaseScraper {
  readonly name = 'veranstaltungskalender.net';
  private readonly BASE = 'https://www.veranstaltungskalender.net';
  private readonly MAX_PAGES = 200; // per region — some regions have 128+ pages

  private readonly REGIONS = [
    { path: '/oberoesterreich/', bundesland: 'oberoesterreich' },
    { path: '/steiermark/', bundesland: 'steiermark' },
    { path: '/niederoesterreich/', bundesland: 'niederoesterreich' },
    { path: '/salzburg/', bundesland: 'salzburg' },
    { path: '/kaernten/', bundesland: 'kaernten' },
    { path: '/tirol/', bundesland: 'tirol' },
    { path: '/vorarlberg/', bundesland: 'vorarlberg' },
    { path: '/wien/', bundesland: 'wien' },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte veranstaltungskalender.net Scraping (alle Bundesländer)...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (const region of this.REGIONS) {
      let emptyCount = 0;
      for (let page = 1; page <= this.MAX_PAGES; page++) {
        const url = page === 1
          ? `${this.BASE}${region.path}`
          : `${this.BASE}${region.path}?seite=${page}`;

        try {
          const html = await this.fetchPage(url);
          const events = this.parsePage(html, region.bundesland);

          if (events.length === 0) {
            emptyCount++;
            if (emptyCount >= 2) break;
          } else {
            emptyCount = 0;
            for (const ev of events) allEvents.set(ev.source_id, ev);
          }

          if (page % 10 === 0) {
            this.log(`${region.bundesland} Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
          }
          await this.sleep(800);
        } catch (err) {
          this.log(`${region.bundesland} Seite ${page} fehler: ${err instanceof Error ? err.message : err}`);
          emptyCount++;
          if (emptyCount >= 2) break;
        }
      }
      this.log(`${region.bundesland}: fertig (gesamt: ${allEvents.size})`);
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string, bundesland: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Each event is inside div.global_listeneintrag
    $('div.global_listeneintrag').each((_, el) => {
      try {
        const $container = $(el);

        // Skip ad containers (they have a child div.werbung_*)
        if ($container.find('[class*="werbung"]').length > 0) return;

        // The event link wraps everything inside the container
        const $link = $container.find('a[href$=".html"]').first();
        if (!$link.length) return;

        const href = $link.attr('href') || '';

        // Title from h2.eintrag_titel
        const title = $container.find('h2.eintrag_titel').first().text().trim();
        if (!title || title.length < 3 || title.length > 200) return;

        // Date from div.ver_zeit
        const dateText = $container.find('.ver_zeit').first().text().trim();
        if (!dateText) return;

        // Parse date — formats:
        //   "So 29.03.2026, von 10:00 bis 13:00 Uhr"
        //   "Sa 28.03.2026 10:00 Uhr, bis So 29.03.2026 17:00"
        //   "Mi 01.04.2026, 19:30 Uhr"
        const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (!dateMatch) return;

        let year = dateMatch[3];
        if (year.length === 2) year = `20${year}`;
        const startDate = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;

        // Skip past events
        const eventDate = new Date(startDate);
        if (eventDate < new Date('2025-01-01')) return;

        // End date (for multi-day events: "bis So 29.03.2026")
        let endDate: string | undefined;
        const endDateMatch = dateText.match(/bis\s+\w+\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (endDateMatch) {
          let endYear = endDateMatch[3];
          if (endYear.length === 2) endYear = `20${endYear}`;
          endDate = `${endYear}-${endDateMatch[2].padStart(2, '0')}-${endDateMatch[1].padStart(2, '0')}`;
        }

        // Time extraction — "von HH:MM" or standalone "HH:MM Uhr"
        const timeMatch = dateText.match(/(?:von\s+)?(\d{1,2}):(\d{2})(?:\s*(?:bis|Uhr))/);

        // End time
        const endTimeMatch = dateText.match(/bis\s+(\d{1,2}):(\d{2})\s*Uhr/);

        // Postal code from schema.org itemprop
        const postalCode = $container.find('[itemprop="postalCode"]').first().text().trim() || undefined;

        // Locality
        const locality = $container.find('[itemprop="addressLocality"]').first().text().trim() || undefined;

        // Street address
        const street = $container.find('[itemprop="streetAddress"]').first().text().trim() || undefined;

        // Build full address
        let address: string | undefined;
        if (postalCode || locality || street) {
          const parts: string[] = [];
          if (postalCode) parts.push(postalCode);
          if (locality) parts.push(locality);
          if (street) parts.push(street);
          address = parts.join(' ');
        }

        // Venue / location name
        const locationName = $container.find('[itemprop="location"] [itemprop="name"]').first().text().trim() || undefined;

        // Description
        const description = $container.find('.beschreibung').first().text().trim() || undefined;

        // Image
        const $img = $container.find('.image_block img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        const imageUrl = this.cleanImageUrl(
          imgSrc.startsWith('http') ? imgSrc : (imgSrc ? `${this.BASE}${imgSrc}` : undefined)
        );

        // Build source URL
        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        // Extract unique event ID from URL (e.g., "osterbrunch-796089.html" -> "796089")
        const idMatch = href.match(/(\d+)\.html$/);
        const eventId = idMatch ? idMatch[1] : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const sourceId = `vknet-${eventId}`;

        // Format start datetime
        let startDateTime = startDate;
        if (timeMatch) {
          startDateTime = `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
        }

        // Format end datetime
        let endDateTime: string | undefined;
        if (endDate && endTimeMatch) {
          endDateTime = `${endDate}T${endTimeMatch[1].padStart(2, '0')}:${endTimeMatch[2]}:00`;
        } else if (!endDate && endTimeMatch) {
          endDateTime = `${startDate}T${endTimeMatch[1].padStart(2, '0')}:${endTimeMatch[2]}:00`;
        } else if (endDate) {
          endDateTime = endDate;
        }

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          description,
          start_date: startDateTime,
          end_date: endDateTime,
          location_name: locationName,
          address,
          postal_code: postalCode,
          bundesland,
          category: categorizeEvent(title + (description ? ` ${description}` : '')),
          image_url: imageUrl,
        });
      } catch { /* skip malformed entry */ }
    });

    return events;
  }
}
