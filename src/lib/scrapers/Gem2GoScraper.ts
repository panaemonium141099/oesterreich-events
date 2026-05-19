import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { GEM2GO_GEMEINDEN, type Gem2GoGemeinde } from './gemeinden/gem2goGemeinden';
import { extractGem2goDetail } from './gem2go-detail';
import type { ScrapedEvent } from '@/types/events';

/**
 * GEM2GO-Scraper: Scrapt Veranstaltungen von ~2.000 österreichischen Gemeinden,
 * die das GEM2GO CMS (RIS GmbH) nutzen.
 *
 * Alle GEM2GO-Websites haben die gleiche URL-Struktur:
 *   {website}/system/web/veranstaltung.aspx?sprache=1
 *
 * HTML-Layouts:
 * - Tabellen-Layout: .va_list_table mit tr-Zeilen (va_list_bez, va_list_day, etc.)
 * - Raster-Layout: .rasterList mit .rasterListEntry divs
 *
 * Paginierung via ?page=N (0-basiert in der URL, Seite 2 = page=1)
 */
export class Gem2GoScraper extends BaseScraper {
  readonly name = 'gem2go';

  /** Timeout pro Request in ms */
  private readonly timeoutMs = 8000;

  /** Pause zwischen Gemeinden in ms */
  private readonly gemeindeDelayMs = 1500;

  /** Maximale Seiten pro Gemeinde */
  private readonly maxPages = 6;

  /** Detail-Page enrichment toggle. When true, after listing parse we fetch
   *  each event's source_url and pull description, address, organizer, etc.
   *  out of the detail HTML (~10x more requests but materially better data).
   *  Default ON because the listing-only data is too sparse (most events
   *  end up with only title+date+town). */
  private readonly enrichFromDetail = true;

  /** Delay between detail-page fetches within the same gemeinde (ms). */
  private readonly detailDelayMs = 250;

  /** Per-detail-page fetch timeout. Generous because gemeinde sites are slow. */
  private readonly detailTimeoutMs = 10000;

  /** Deutsche Monatsnamen -> Monatsnummer */
  private readonly MONTHS: Record<string, string> = {
    'jänner': '01', 'januar': '01', 'februar': '02', 'märz': '03',
    'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
    'august': '08', 'september': '09', 'oktober': '10',
    'november': '11', 'dezember': '12',
  };

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte GEM2GO Scraping (${GEM2GO_GEMEINDEN.length} Gemeinden)...`);
    const allEvents: ScrapedEvent[] = [];
    let gemeindenScraped = 0;
    let gemeindenFailed = 0;
    let gemeindenNoEvents = 0;
    let gemeindenNotGem2Go = 0;

    for (let i = 0; i < GEM2GO_GEMEINDEN.length; i++) {
      const gemeinde = GEM2GO_GEMEINDEN[i];
      try {
        const baseUrl = this.buildEventsUrl(gemeinde);
        const html = await this.fetchWithTimeout(baseUrl, this.timeoutMs);

        if (!html) {
          gemeindenFailed++;
          continue;
        }

        // Check if this is actually a GEM2GO site
        if (!this.isGem2GoPage(html)) {
          gemeindenNotGem2Go++;
          continue;
        }

        // Parse first page
        const events = this.parseGem2GoPage(html, gemeinde, baseUrl);

        // Check for pagination and parse additional pages
        const hasMorePages = this.hasNextPage(html);
        if (hasMorePages && events.length > 0) {
          for (let page = 1; page < this.maxPages; page++) {
            try {
              const pageUrl = this.buildPageUrl(html, baseUrl, page);
              if (!pageUrl) break;

              const pageHtml = await this.fetchWithTimeout(pageUrl, this.timeoutMs);
              if (!pageHtml) break;

              const pageEvents = this.parseGem2GoPage(pageHtml, gemeinde, pageUrl);
              if (pageEvents.length === 0) break;

              events.push(...pageEvents);

              // Check if there are more pages
              if (!this.hasNextPage(pageHtml)) break;

              await this.sleep(500); // Short delay between pages of same site
            } catch {
              break; // Stop pagination on error
            }
          }
        }

        if (events.length > 0) {
          if (this.enrichFromDetail) {
            await this.enrichEventsFromDetailPages(events);
          }
          allEvents.push(...events);
          gemeindenScraped++;
          if ((i + 1) % 50 === 0 || events.length >= 5) {
            this.log(`[${i + 1}/${GEM2GO_GEMEINDEN.length}] ${gemeinde.name}: ${events.length} Events (gesamt: ${allEvents.length})`);
          }
        } else {
          gemeindenNoEvents++;
        }
      } catch {
        gemeindenFailed++;
      }

      // Rate-Limiting: Be nice to servers
      if ((i + 1) % 100 === 0) {
        this.log(`Fortschritt: ${i + 1}/${GEM2GO_GEMEINDEN.length} Gemeinden, ${allEvents.length} Events, ${gemeindenFailed} Fehler, ${gemeindenNotGem2Go} kein GEM2GO`);
      }
      await this.sleep(this.gemeindeDelayMs);
    }

    this.log(`Fertig: ${allEvents.length} Events von ${gemeindenScraped} Gemeinden`);
    this.log(`  ${gemeindenFailed} fehlgeschlagen, ${gemeindenNoEvents} ohne Events, ${gemeindenNotGem2Go} kein GEM2GO`);
    return allEvents;
  }

  // ─── DETAIL-PAGE ENRICHMENT ────────────────────────────────────────────────

  /**
   * For each event with a detail URL, fetch the detail page and merge any
   * extra fields (description, address, organizer, price) the listing didn't
   * carry. Listing values take precedence — we only fill what's missing.
   *
   * Errors per-event are swallowed: a broken detail page must not block the
   * rest of the gemeinde batch. The event keeps its listing-level data.
   */
  private async enrichEventsFromDetailPages(events: ScrapedEvent[]): Promise<void> {
    for (const e of events) {
      const detailUrl = e.source_url;
      if (!detailUrl) continue;
      // Skip if URL is just the listing page (no detail URL was extracted)
      if (/veranstaltung\.aspx\?sprache=1$/.test(detailUrl)) continue;

      try {
        const html = await this.fetchWithTimeout(detailUrl, this.detailTimeoutMs);
        if (!html) continue;
        const enrichment = extractGem2goDetail(html);

        // Only fill fields the listing left blank. The listing already knows
        // the gemeinde lat/lng/PLZ/Bundesland which are good defaults.
        if (!e.description && enrichment.description) e.description = enrichment.description;
        if (!e.address && enrichment.address) e.address = enrichment.address;
        if ((!e.postal_code || e.postal_code.length === 0) && enrichment.postal_code) {
          e.postal_code = enrichment.postal_code;
        }
        if (enrichment.location_name && (
          !e.location_name ||
          e.location_name === enrichment.location_name ||
          // Listing often defaults to gemeinde-name; detail venue is more specific.
          e.location_name.length < enrichment.location_name.length
        )) {
          e.location_name = enrichment.location_name;
        }
        if (!e.image_url && enrichment.image_url) e.image_url = enrichment.image_url;
        if (!e.price_text && enrichment.price_text) e.price_text = enrichment.price_text;
        if (e.price_min === undefined && enrichment.price_min !== undefined) {
          e.price_min = enrichment.price_min;
        }
        if (e.price_max === undefined && enrichment.price_max !== undefined) {
          e.price_max = enrichment.price_max;
        }
        if (!e.organizer && enrichment.organizer) e.organizer = enrichment.organizer;
      } catch {
        // Silent per-event failure — keep the listing data we already have.
      }

      await this.sleep(this.detailDelayMs);
    }
  }

  // ─── URL-BUILDING ──────────────────────────────────────────────────────────

  private buildEventsUrl(gemeinde: Gem2GoGemeinde): string {
    const base = gemeinde.website.replace(/\/+$/, '');
    return `${base}/system/web/veranstaltung.aspx?sprache=1`;
  }

  /**
   * Baut die URL für eine Paginierungs-Seite.
   * Extrahiert die vollständige Paginierungs-URL aus den Pager-Links im HTML.
   */
  private buildPageUrl(html: string, baseUrl: string, page: number): string | null {
    const $ = cheerio.load(html);
    // Find pager links and extract the URL pattern
    const pagerLinks = $('a.pager');
    if (pagerLinks.length === 0) return null;

    // Get the first pager link to extract the URL pattern
    const firstPagerHref = pagerLinks.first().attr('href');
    if (!firstPagerHref) return null;

    // Replace the page number in the URL
    const pageUrl = firstPagerHref.replace(/page=\d+/, `page=${page}`);

    try {
      return new URL(pageUrl, baseUrl).href;
    } catch {
      return null;
    }
  }

  // ─── GEM2GO DETECTION ──────────────────────────────────────────────────────

  /**
   * Prüft ob eine Seite ein GEM2GO-System ist.
   * Sucht nach typischen GEM2GO-Merkmalen im HTML.
   */
  private isGem2GoPage(html: string): boolean {
    const lower = html.toLowerCase();
    // Check for GEM2GO-specific patterns
    return (
      lower.includes('/system/web/') ||
      lower.includes('gem2go') ||
      lower.includes('va_list') ||
      lower.includes('rasterlist') ||
      lower.includes('veranstaltung.aspx') ||
      (lower.includes('ctl00_') && lower.includes('veranstaltung'))
    );
  }

  // ─── PAGINATION ────────────────────────────────────────────────────────────

  private hasNextPage(html: string): boolean {
    return html.includes('class="pager"');
  }

  // ─── PARSING ───────────────────────────────────────────────────────────────

  /**
   * Parst eine GEM2GO Veranstaltungsseite.
   * Unterstützt zwei Layout-Varianten:
   * 1. Tabellen-Layout (.va_list_table)
   * 2. Raster-Layout (.rasterList / .rasterListEntry)
   */
  private parseGem2GoPage(html: string, gemeinde: Gem2GoGemeinde, pageUrl: string): ScrapedEvent[] {
    const $ = cheerio.load(html);

    // Try table layout first (more common)
    if (html.includes('va_list_table') || html.includes('va_list_bez')) {
      return this.parseTableLayout($, gemeinde, pageUrl);
    }

    // Try raster/list layout
    if (html.includes('rasterListEntry') || html.includes('rasterList')) {
      return this.parseRasterLayout($, gemeinde, pageUrl);
    }

    // Try Bootstrap Card layout (newer GEM2GO version)
    if (html.includes('bemCard') || html.includes('bemEvent')) {
      return this.parseBemCardLayout($, gemeinde, pageUrl);
    }

    // Fallback: Try to find any event-like content
    return this.parseFallbackLayout($, gemeinde, pageUrl);
  }

  // ─── TABELLEN-LAYOUT ──────────────────────────────────────────────────────

  /**
   * Parst das GEM2GO Tabellen-Layout:
   * <table class="va_list_table">
   *   <tr class="odd/even">
   *     <td> Datum (va_list_day, va_list_month, va_list_year, va_list_time) </td>
   *     <td> Details (va_list_bez = Titel, va_list_text = Beschreibung, va_list_veranstaltungsort) </td>
   *     <td> Foto (va_list_foto) </td>
   *   </tr>
   * </table>
   */
  private parseTableLayout($: cheerio.CheerioAPI, gemeinde: Gem2GoGemeinde, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const baseOrigin = this.getOrigin(gemeinde.website);

    $('tr.odd, tr.even').each((_, row) => {
      try {
        const $row = $(row);

        // Extract title
        const $titleLink = $row.find('.va_list_bez a').first();
        const title = $titleLink.text().trim();
        if (!title || title.length < 2) return;

        // Extract date components
        const day = $row.find('.va_list_day').first().text().trim();
        const month = $row.find('.va_list_month').first().text().trim();
        const year = $row.find('.va_list_year').first().text().trim();
        const time = $row.find('.va_list_time').first().text().trim();

        if (!day || !month || !year) return;

        const startDate = this.buildDateString(day, month, year, time);
        if (!startDate) return;

        // Check for end date (multi-day events have two date blocks)
        let endDate: string | undefined;
        const allDays = $row.find('.va_list_day');
        const allMonths = $row.find('.va_list_month');
        const allYears = $row.find('.va_list_year');
        if (allDays.length > 1) {
          const endDay = $(allDays[1]).text().trim();
          const endMonth = $(allMonths[1]).text().trim();
          const endYear = $(allYears[1]).text().trim();
          if (endDay && endMonth && endYear) {
            endDate = this.buildDateString(endDay, endMonth, endYear) || undefined;
          }
        }

        // Extract description
        const description = $row.find('.va_list_text').first().text().trim() || undefined;

        // Extract location
        const locationRaw = $row.find('.va_list_veranstaltungsort').first().text().trim();
        const location = locationRaw
          ? locationRaw.replace(/^Veranstaltungsort\s*/i, '').trim()
          : undefined;

        // Extract image (carries width/height from HTML attrs into the upsert)
        const imageInfo = this.imageFromElement(
          $row.find('img.va_list_foto, td img').first(),
          baseOrigin,
        );

        // Extract event detail URL
        const href = $titleLink.attr('href');
        const eventUrl = href ? this.resolveUrl(href, baseOrigin) : pageUrl;

        const sourceId = this.buildSourceId(gemeinde, title, startDate);

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: eventUrl,
          title,
          description,
          start_date: startDate,
          end_date: endDate,
          location_name: location || gemeinde.name,
          latitude: gemeinde.lat,
          longitude: gemeinde.lng,
          postal_code: gemeinde.plz,
          bundesland: gemeinde.bundesland,
          district: gemeinde.bezirk,
          image_url: imageInfo?.url,
          image_width: imageInfo?.image_width,
          image_height: imageInfo?.image_height,
          category: categorizeEvent(title, description),
        });
      } catch {
        // Skip individual event parsing errors
      }
    });

    return events;
  }

  // ─── RASTER-LAYOUT ────────────────────────────────────────────────────────

  /**
   * Parst das GEM2GO Raster-Layout:
   * <div class="rasterList">
   *   <div class="rasterListEntry">
   *     <div class="rasterListImageContainer"><img .../></div>
   *     <div class="rasterListInfoContainer"><h2 class="rasterListInfoContainerTitel">...</h2></div>
   *     <div class="rasterListDateContainer">
   *       <p class="rasterListDateContainerDateTime">28. März 2026, </p>
   *       <p class="rasterListDateContainerTime">10:00 - 17:00 Uhr</p>
   *     </div>
   *     <div class="rasterListOrtContainer">
   *       <p class="rasterListOrtContainerStaette">...</p>
   *       <p class="rasterListOrtContainerAdresse">...</p>
   *     </div>
   *   </div>
   * </div>
   */
  private parseRasterLayout($: cheerio.CheerioAPI, gemeinde: Gem2GoGemeinde, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const baseOrigin = this.getOrigin(gemeinde.website);

    $('.rasterListEntry').each((_, entry) => {
      try {
        const $entry = $(entry);

        // Extract title
        const $titleEl = $entry.find('.rasterListInfoContainerTitel a, .rasterListInfoContainerTitel').first();
        const title = $titleEl.text().trim();
        if (!title || title.length < 2) return;

        // Extract date
        const dateTimeText = $entry.find('.rasterListDateContainerDateTime').first().text().trim();
        const timeText = $entry.find('.rasterListDateContainerTime').first().text().trim();

        const startDate = this.parseDateTimeText(dateTimeText);
        if (!startDate) return;

        // Extract location
        const venue = $entry.find('.rasterListOrtContainerStaette').first().text().trim() || undefined;
        const address = $entry.find('.rasterListOrtContainerAdresse').first().text().trim() || undefined;

        // Extract image (carries width/height from HTML attrs into the upsert)
        const imageInfo = this.imageFromElement(
          $entry.find('.rasterListImageContainer img').first(),
          baseOrigin,
        );

        // Extract event detail URL
        const $link = $entry.find('a').first();
        const href = $link.attr('href');
        const eventUrl = href ? this.resolveUrl(href, baseOrigin) : pageUrl;

        // Extract time info for description
        const description = timeText ? `${timeText}` : undefined;

        const sourceId = this.buildSourceId(gemeinde, title, startDate);

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: eventUrl,
          title,
          description,
          start_date: startDate,
          location_name: venue || gemeinde.name,
          address: address,
          latitude: gemeinde.lat,
          longitude: gemeinde.lng,
          postal_code: gemeinde.plz,
          bundesland: gemeinde.bundesland,
          district: gemeinde.bezirk,
          image_url: imageInfo?.url,
          image_width: imageInfo?.image_width,
          image_height: imageInfo?.image_height,
          category: categorizeEvent(title),
        });
      } catch {
        // Skip individual event parsing errors
      }
    });

    return events;
  }

  // ─── BEM CARD LAYOUT (neues GEM2GO) ──────────────────────────────────────

  /**
   * Parst das neuere GEM2GO Bootstrap-Card-Layout:
   * <div class="bemCard bemCard--list">
   *   <div class="card">
   *     <div class="card-body">
   *       <h5 class="card-title"><a href="...">Event Titel</a></h5>
   *       <p class="card-text">Datum, Ort, Beschreibung</p>
   *     </div>
   *   </div>
   * </div>
   */
  private parseBemCardLayout($: cheerio.CheerioAPI, gemeinde: Gem2GoGemeinde, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    $('.bemCard, .card').each((_, el) => {
      try {
        const $card = $(el);

        // Title from card-title or any heading with link
        const $titleLink = $card.find('.card-title a, h5 a, h4 a, h3 a').first();
        let title = $titleLink.text().trim();
        if (!title) title = $card.find('.card-title, h5, h4').first().text().trim();
        if (!title || title.length < 3) return;

        // Detail link
        const href = $titleLink.attr('href') || '';
        const detailUrl = href ? (href.startsWith('http') ? href : `${gemeinde.website}${href.startsWith('/') ? '' : '/'}${href}`) : pageUrl;

        // Extract event ID from URL
        const idMatch = href.match(/detailonr=(\d+)/);
        const eventId = idMatch ? idMatch[1] : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);

        // Card text contains date, location, description mixed together
        const cardText = $card.find('.card-text, .card-body').text();

        // Parse date
        const startDate = this.parseDateTimeText(cardText);
        if (!startDate) return;

        // Extract image (carries width/height from HTML attrs into the upsert)
        const imageInfo = this.imageFromElement(
          $card.find('img').first(),
          gemeinde.website,
        );

        events.push({
          source_id: `gem2go-${gemeinde.plz}-${eventId}`,
          source_name: this.name,
          source_url: detailUrl,
          title,
          start_date: startDate,
          location_name: gemeinde.name,
          postal_code: gemeinde.plz,
          bundesland: gemeinde.bundesland,
          district: gemeinde.bezirk,
          latitude: gemeinde.lat,
          longitude: gemeinde.lng,
          category: categorizeEvent(title),
          image_url: imageInfo?.url,
          image_width: imageInfo?.image_width,
          image_height: imageInfo?.image_height,
        });
      } catch { /* skip */ }
    });

    return events;
  }

  // ─── FALLBACK-LAYOUT ──────────────────────────────────────────────────────

  /**
   * Fallback-Parser: Versucht Events aus generischem GEM2GO HTML zu extrahieren.
   * Nutzt va_picture oder einfache Tabellen-Strukturen.
   */
  private parseFallbackLayout($: cheerio.CheerioAPI, gemeinde: Gem2GoGemeinde, pageUrl: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const baseOrigin = this.getOrigin(gemeinde.website);

    // Try va_picture layout (another GEM2GO variant)
    $('.va_picture_va, .va_contentlist tr').each((_, el) => {
      try {
        const $el = $(el);
        const text = $el.text();

        // Find a title (first link text or heading)
        const title = (
          $el.find('a').first().text().trim() ||
          $el.find('h2, h3, h4').first().text().trim()
        );
        if (!title || title.length < 2) return;

        // Extract date from text
        const dateStr = this.extractDateFromText(text);
        if (!dateStr) return;

        const href = $el.find('a').first().attr('href');
        const eventUrl = href ? this.resolveUrl(href, baseOrigin) : pageUrl;

        const sourceId = this.buildSourceId(gemeinde, title, dateStr);

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: eventUrl,
          title,
          start_date: dateStr,
          location_name: gemeinde.name,
          latitude: gemeinde.lat,
          longitude: gemeinde.lng,
          postal_code: gemeinde.plz,
          bundesland: gemeinde.bundesland,
          district: gemeinde.bezirk,
          category: categorizeEvent(title),
        });
      } catch {
        // Skip
      }
    });

    return events;
  }

  // ─── HILFSFUNKTIONEN ──────────────────────────────────────────────────────

  /**
   * Fetch mit Timeout via AbortSignal.
   * Gibt null zurück statt zu werfen bei Fehler.
   */
  private static GEM2GO_MARKERS = [
    'veranstaltungcmsliste', 'va_list', 'rasterlist', 'bemcard',
    'system/web/', 'gem2go', 'ctl00_', 'veranstaltung.aspx',
  ];

  private isGem2GoContent(html: string): boolean {
    const lower = html.toLowerCase();
    return Gem2GoScraper.GEM2GO_MARKERS.some(m => lower.includes(m));
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Handle redirects manually — block cross-domain redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return null;

        try {
          const redirectUrl = new URL(location, url);
          const originalHost = new URL(url).hostname;
          const redirectHost = redirectUrl.hostname;

          // Allow same-host HTTP→HTTPS upgrade and www/non-www variants
          const origBase = originalHost.replace(/^www\./, '');
          const redirBase = redirectHost.replace(/^www\./, '');

          // Block cross-domain redirects (tourism portals etc.)
          if (origBase !== redirBase &&
              !redirBase.endsWith('.' + origBase) &&
              !origBase.endsWith('.' + redirBase)) {
            return null;
          }

          // Follow same-domain redirect once
          const res2 = await fetch(redirectUrl.href, {
            headers: {
              'User-Agent': this.userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!res2.ok) return null;
          const html = await res2.text();
          return this.isGem2GoContent(html) ? html : null;
        } catch {
          return null;
        }
      }

      if (!response.ok) return null;
      const html = await response.text();
      return this.isGem2GoContent(html) ? html : null;
    } catch {
      return null;
    }
  }

  /**
   * Baut ein Datum-String aus Tag, Monat (deutsch), Jahr und optionaler Zeit.
   * Gibt ISO-Format YYYY-MM-DD zurück oder null.
   */
  private buildDateString(day: string, monthName: string, year: string, time?: string): string | null {
    const monthLower = monthName.toLowerCase().replace('.', '');
    const monthNum = this.MONTHS[monthLower];
    if (!monthNum) return null;

    const d = parseInt(day);
    const y = parseInt(year);
    if (isNaN(d) || isNaN(y) || d < 1 || d > 31 || y < 2024 || y > 2030) return null;

    const dayStr = String(d).padStart(2, '0');

    if (time) {
      // Try to extract HH:MM from time string like "10:00 - 11:00 Uhr"
      const timeMatch = time.match(/(\d{1,2}:\d{2})/);
      if (timeMatch) {
        return `${year}-${monthNum}-${dayStr}T${timeMatch[1]}`;
      }
    }

    return `${year}-${monthNum}-${dayStr}`;
  }

  /**
   * Parst Datum aus Raster-Layout Text wie "28. März 2026, "
   */
  private parseDateTimeText(text: string): string | null {
    if (!text) return null;

    // Pattern: "28. März 2026" or "28. März 2026, "
    const match = text.match(
      /(\d{1,2})\.\s*(Jänner|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i
    );
    if (match) {
      return this.buildDateString(match[1], match[2], match[3]);
    }

    // Pattern: DD.MM.YYYY
    const numMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (numMatch) {
      const d = numMatch[1].padStart(2, '0');
      const m = numMatch[2].padStart(2, '0');
      return `${numMatch[3]}-${m}-${d}`;
    }

    return null;
  }

  /**
   * Extrahiert ein Datum aus einem Textblock (Fallback).
   */
  private extractDateFromText(text: string): string | null {
    // DD.MM.YYYY
    const numMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (numMatch) {
      const d = numMatch[1].padStart(2, '0');
      const m = numMatch[2].padStart(2, '0');
      const y = parseInt(numMatch[3]);
      if (y >= 2024 && y <= 2030) {
        return `${numMatch[3]}-${m}-${d}`;
      }
    }

    // DD. Monat YYYY
    const writtenMatch = text.match(
      /(\d{1,2})\.\s*(Jänner|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i
    );
    if (writtenMatch) {
      return this.buildDateString(writtenMatch[1], writtenMatch[2], writtenMatch[3]);
    }

    return null;
  }

  /**
   * Erzeugt eine eindeutige Source-ID für ein Event.
   */
  private buildSourceId(gemeinde: Gem2GoGemeinde, title: string, date: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    return `gem2go-${gemeinde.gkz}-${slug}-${date.slice(0, 10)}`;
  }

  /**
   * Löst relative URLs gegen eine Basis-URL auf.
   */
  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return baseUrl;
    }
  }

  /**
   * Extrahiert den Origin (protocol + host) aus einer URL.
   */
  private getOrigin(url: string): string {
    try {
      const u = new URL(url);
      return u.origin;
    } catch {
      return url;
    }
  }
}
