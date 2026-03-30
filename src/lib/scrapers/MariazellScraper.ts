import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

// Mariazell coordinates and metadata (shared across all 3 sources)
const MARIAZELL_LAT = 47.7733;
const MARIAZELL_LNG = 15.3161;
const MARIAZELL_DISTRICT = 'Bruck-Mürzzuschlag';
const MARIAZELL_PLZ = '8630';
const MARIAZELL_BUNDESLAND = 'steiermark';

/**
 * mariazell.at Scraper (PRIMARY)
 * WordPress event listings with pagination.
 * ~140 events across ~7 pages.
 */
export class MariazellAtScraper extends BaseScraper {
  readonly name = 'mariazell.at';
  private readonly BASE = 'https://www.mariazell.at';
  private readonly LIST_URL = 'https://www.mariazell.at/veranstaltungen/';
  private readonly MAX_PAGES = 10;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte mariazell.at Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const url = page === 1 ? this.LIST_URL : `${this.LIST_URL}page/${page}/`;
      try {
        const html = await this.fetchPage(url);
        const events = this.parseListPage(html);

        if (events.length === 0) {
          this.log(`Seite ${page}: keine Events, Ende der Pagination`);
          break;
        }

        for (const ev of events) allEvents.set(ev.source_id, ev);
        this.log(`Seite ${page}: ${events.length} Events (gesamt: ${allEvents.size})`);
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

  private parseListPage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // Each event has an h5 > a with the link and title
    $('h5 > a[href*="/veranstaltungen/"]').each((_, el) => {
      try {
        const $link = $(el);
        const href = $link.attr('href') || '';
        const title = $link.text().trim();
        if (!title || title.length < 3) return;

        // Navigate up to the parent container to find date/time/location/image
        // Structure: <div class='content-column three_fourth last_column'> contains h5, p with date
        const $textCol = $link.closest('.content-column, div').first();
        // The image column is the preceding sibling
        const $parentRow = $textCol.parent();

        // Extract image from the one_fourth column
        let imageUrl: string | undefined;
        const $imgEl = $parentRow.find('img').first();
        if ($imgEl.length) {
          const src = $imgEl.attr('src') || $imgEl.attr('data-src') || '';
          imageUrl = this.cleanImageUrl(src);
        }

        // Extract date and time from <p> text: "Am Tag, DD.M.YYYY um HH:MM Uhr"
        const $dateP = $textCol.find('p').first();
        const dateText = $dateP.text().trim();

        const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        const timeMatch = dateText.match(/um\s+(\d{1,2}:\d{2})/);

        if (!dateMatch) return;

        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        const startDate = `${year}-${month}-${day}`;
        const time = timeMatch ? timeMatch[1] : undefined;

        // Extract location: text after <br /> in the date paragraph
        let locationName: string | undefined;
        const dateHtml = $dateP.html() || '';
        const brParts = dateHtml.split(/<br\s*\/?>/i);
        if (brParts.length > 1) {
          // Location is the text after the <br>, strip HTML tags
          const locText = brParts.slice(1).join(' ').replace(/<[^>]*>/g, '').trim();
          if (locText && locText.length > 2) {
            locationName = locText;
          }
        }

        // Build slug-based source_id from the URL
        const slugMatch = href.match(/\/veranstaltungen\/([^/]+)\/?$/);
        const sourceId = slugMatch ? `mz-at-${slugMatch[1]}` : `mz-at-${title.toLowerCase().replace(/\W+/g, '-').slice(0, 60)}`;

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: href.startsWith('http') ? href : `${this.BASE}${href}`,
          title,
          start_date: time ? `${startDate}T${time}:00` : startDate,
          location_name: locationName,
          image_url: imageUrl,
          bundesland: MARIAZELL_BUNDESLAND,
          district: MARIAZELL_DISTRICT,
          postal_code: MARIAZELL_PLZ,
          latitude: MARIAZELL_LAT,
          longitude: MARIAZELL_LNG,
          category: categorizeEvent(title),
        });
      } catch { /* skip malformed entries */ }
    });

    return events;
  }
}

/**
 * basilika-mariazell.at Scraper
 * siteswift CMS monthly calendar. ~180+ events per month.
 * Scrapes current month (future months require CSRF tokens that are session-bound).
 */
export class BasilikaMariazellScraper extends BaseScraper {
  readonly name = 'basilika-mariazell';
  private readonly BASE = 'https://www.basilika-mariazell.at';
  private readonly CALENDAR_URL = 'https://www.basilika-mariazell.at/site/de/kalendertermine';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte basilika-mariazell.at Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Scrape main calendar page (current month)
    const html = await this.fetchPage(this.CALENDAR_URL);
    const $ = cheerio.load(html);

    const monthYearText = $('.swcalendarMonth .topHeader .dateInfo').text().trim();
    this.log(`Scrape Monat: ${monthYearText}`);

    const { events } = this.parseCalendarPage($, monthYearText);
    for (const ev of events) allEvents.set(ev.source_id, ev);
    this.log(`${events.length} Events im Monat`);

    // Try navigating to next months (siteswift uses CSRF tokens, may fail with 403)
    const nextLink = this.findNextMonthLink($);
    if (nextLink) {
      const nextUrl = nextLink.startsWith('http') ? nextLink : `${this.BASE}${nextLink}`;
      try {
        await this.rateLimit();
        const savedRetries = this.maxRetries;
        this.maxRetries = 1; // Don't retry on CSRF failure
        const nextHtml = await this.fetchPage(nextUrl);
        this.maxRetries = savedRetries;
        const $next = cheerio.load(nextHtml);
        const nextMonthText = $next('.swcalendarMonth .topHeader .dateInfo').text().trim();
        const { events: nextEvents } = this.parseCalendarPage($next, nextMonthText);
        for (const ev of nextEvents) allEvents.set(ev.source_id, ev);
        this.log(`Nächster Monat (${nextMonthText}): ${nextEvents.length} Events`);
      } catch {
        this.log('Navigation zu weiteren Monaten nicht möglich (CSRF-geschützt)');
      }
    }

    const result = Array.from(allEvents.values());
    this.log(`${result.length} Events gescrapt`);
    return result;
  }

  private parseCalendarPage($: cheerio.CheerioAPI, monthYearText: string): { events: ScrapedEvent[]; yearMonth: string } {
    const events: ScrapedEvent[] = [];

    // Parse month/year from "März 2026" style header
    const monthMap: Record<string, string> = {
      'jänner': '01', 'januar': '01', 'februar': '02', 'märz': '03',
      'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
      'august': '08', 'september': '09', 'oktober': '10',
      'november': '11', 'dezember': '12',
    };

    let year = new Date().getFullYear().toString();
    let monthNum = (new Date().getMonth() + 1).toString().padStart(2, '0');

    const headerMatch = monthYearText.toLowerCase().match(/(\w+)\s+(\d{4})/);
    if (headerMatch) {
      year = headerMatch[2];
      monthNum = monthMap[headerMatch[1]] || monthNum;
    }
    const yearMonth = `${year}-${monthNum}`;

    // Track current day as we iterate rows
    let currentDay = '';
    let currentMonth = monthNum;

    // Each event is in a .row inside .container-fluid
    $('.swcalendarMonth .container-fluid .row').each((_, row) => {
      try {
        const $row = $(row);

        // Check if this row has a new date
        const $date = $row.find('.date');
        if ($date.length) {
          const dayText = $date.find('.day').text().trim().replace('.', '');
          const monthText = $date.find('.month').text().trim().toLowerCase();
          if (dayText) {
            currentDay = dayText.padStart(2, '0');
          }
          if (monthText && monthMap[monthText]) {
            currentMonth = monthMap[monthText];
          }
        }

        // Extract title
        const title = $row.find('.title').text().trim();
        if (!title || !currentDay) return;

        // Extract time
        const timeText = $row.find('.time').text().trim() || $row.find('.time-xs').text().trim();
        const timeMatch = timeText.match(/(\d{1,2}:\d{2})/);
        const time = timeMatch ? timeMatch[1] : undefined;

        // Extract location
        const location = $row.find('.standort').text().trim() || undefined;

        const dateStr = `${year}-${currentMonth}-${currentDay}`;
        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 50);
        const sourceId = `basilika-${dateStr}-${time || '0000'}-${slug}`;

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: this.CALENDAR_URL,
          title,
          start_date: time ? `${dateStr}T${time}:00` : dateStr,
          location_name: location || 'Basilika Mariazell',
          bundesland: MARIAZELL_BUNDESLAND,
          district: MARIAZELL_DISTRICT,
          postal_code: MARIAZELL_PLZ,
          latitude: MARIAZELL_LAT,
          longitude: MARIAZELL_LNG,
          category: categorizeEvent(title),
        });
      } catch { /* skip malformed rows */ }
    });

    return { events, yearMonth };
  }

  private findNextMonthLink($: cheerio.CheerioAPI): string | null {
    // The "nächster Monat" link in the calendar header
    let nextUrl: string | null = null;

    $('a').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('nächster monat') || text.includes('nchster monat')) {
        nextUrl = $(el).attr('href') || null;
        return false; // break
      }
    });

    return nextUrl;
  }
}

/**
 * mariazell.gv.at Scraper
 * Stadtgemeinde Mariazell event calendar. WordPress with custom template.
 * ~70+ events on a single page (no pagination observed).
 */
export class MariazellGvScraper extends BaseScraper {
  readonly name = 'mariazell.gv.at';
  private readonly BASE = 'https://www.mariazell.gv.at';
  private readonly LIST_URL = 'https://www.mariazell.gv.at/aktuelles/veranstaltungskalender/';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte mariazell.gv.at Scraping...');

    const html = await this.fetchPage(this.LIST_URL);
    const events = this.parsePage(html);

    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  private parsePage(html: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    // The page structure: inside <main> / .entry-content
    // Date headers: <hr><p><strong>Tag, DD.MM.YYYY</strong></p>
    // Then event blocks with: one_third (image) + two_third (title, date/time/location)
    // Description in <div class="panel">

    const $content = $('.entry-content');
    if (!$content.length) {
      this.log('Kein .entry-content gefunden');
      return events;
    }

    // Track current date header as we iterate
    let currentDateStr = '';

    // Process children sequentially to track date headers
    $content.children().each((_, child) => {
      const $child = $(child);

      // Check if this is an <hr> (date separator) - the next sibling <p> has the date
      if ($child.is('hr')) return; // skip, date follows

      // Check for date header: <p><strong>Tag, DD.MM.YYYY</strong></p>
      const strongText = $child.find('strong').first().text().trim();
      const dateHeaderMatch = strongText.match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
      if (dateHeaderMatch && $child.is('p') && !$child.find('a').length) {
        const day = dateHeaderMatch[1].padStart(2, '0');
        currentDateStr = `${dateHeaderMatch[3]}-${dateHeaderMatch[2]}-${day}`;
        return;
      }

      // Check for event content-column blocks
      if (!$child.hasClass('content-column')) return;

      // The event comes in pairs: one_third (image) + two_third/three_fourth (text)
      // Check if this is the text column (has <strong> title inside)
      const isTextCol = $child.hasClass('two_third') || $child.hasClass('three_fourth');
      if (!isTextCol) return;

      try {
        const titleEl = $child.find('p > strong').first();
        const title = titleEl.text().trim();
        if (!title || title === 'Weitere Informationen...') return;

        // The image is in the previous sibling (one_third)
        const $imgCol = $child.prev('.content-column');
        let imageUrl: string | undefined;
        const $img = $imgCol.find('img').first();
        if ($img.length) {
          imageUrl = this.cleanImageUrl($img.attr('src') || '');
        }

        // Extract date/time from text: "Am Tag, DD.MM.YYYY um HH:MM Uhr"
        const paragraphs = $child.find('p');
        let dateStr = currentDateStr;
        let time: string | undefined;
        let locationName: string | undefined;

        paragraphs.each((_, p) => {
          const pText = $(p).text().trim();
          const pHtml = $(p).html() || '';

          // Match date+time pattern
          const dtMatch = pText.match(/(\d{1,2})\.(\d{2})\.(\d{4})\s+um\s+(\d{1,2}:\d{2})/);
          if (dtMatch) {
            const day = dtMatch[1].padStart(2, '0');
            dateStr = `${dtMatch[3]}-${dtMatch[2]}-${day}`;
            time = dtMatch[4];
          } else {
            const dateOnlyMatch = pText.match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
            if (dateOnlyMatch) {
              const day = dateOnlyMatch[1].padStart(2, '0');
              dateStr = `${dateOnlyMatch[3]}-${dateOnlyMatch[2]}-${day}`;
            }
          }

          // Location: text after <br> in the date paragraph
          const brParts = pHtml.split(/<br\s*\/?>/i);
          if (brParts.length > 1) {
            const locText = brParts.slice(1).join(' ').replace(/<[^>]*>/g, '').trim();
            if (locText && locText.length > 2 && !locText.match(/^\d/)) {
              locationName = locText;
            }
          }
        });

        if (!dateStr) return;

        // Extract description from the panel div
        const $panel = $child.find('.panel');
        let description: string | undefined;
        if ($panel.length) {
          description = $panel.text().trim().slice(0, 500);
        }

        const slug = title.toLowerCase().replace(/\W+/g, '-').slice(0, 50);
        const sourceId = `mz-gv-${dateStr}-${slug}`;

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: this.LIST_URL,
          title,
          description: description || undefined,
          start_date: time ? `${dateStr}T${time}:00` : dateStr,
          location_name: locationName,
          image_url: imageUrl,
          bundesland: MARIAZELL_BUNDESLAND,
          district: MARIAZELL_DISTRICT,
          postal_code: MARIAZELL_PLZ,
          latitude: MARIAZELL_LAT,
          longitude: MARIAZELL_LNG,
          category: categorizeEvent(title, description),
        });
      } catch { /* skip malformed entries */ }
    });

    return events;
  }
}
