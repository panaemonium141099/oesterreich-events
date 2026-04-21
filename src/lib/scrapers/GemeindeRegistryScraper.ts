import * as cheerio from 'cheerio';
import * as vm from 'vm';
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { detectNextPage, detectMonthNavigation, MAX_PAGES_PER_SITE } from './pagination';
import type { ScrapedEvent } from '@/types/events';
import { isEventType } from '../connectors/json-ld-connector';

export interface PaginationLogEntry {
  gemeinde: string;
  bundesland: string;
  strategy: string;
  url: string;
  pagesScraped: number;
  paginationType: 'next-link' | 'numbered' | 'wp-page' | 'month-nav' | 'none';
  /** If pagination was detected but a subsequent fetch failed */
  failedNextUrl?: string;
  eventsPage1: number;
  eventsTotal: number;
}

/**
 * GemeindeRegistryScraper: Scrapt Veranstaltungen von österreichischen Gemeinden
 * basierend auf einem handkuratierten JSON-Registry.
 *
 * Jede Gemeinde wird individuell recherchiert und die richtige Scraping-Strategie
 * im Registry dokumentiert. Der Scraper dispatcht pro Gemeinde an die passende
 * Parsing-Logik.
 *
 * Registry-Dateien: data/gemeinden-registry/{bundesland}.json
 *
 * Strategien:
 * - cities-iife: CITIES-Plattform (window.INITIAL_DATA)
 * - jsonld: JSON-LD Event Schema
 * - mec-html: WordPress Modern Events Calendar
 * - tribe-html: WordPress The Events Calendar (Tribe)
 * - gem2go: GEM2GO CMS Veranstaltungsseiten
 * - gemeinde24: Gemeinde24 CMS Veranstaltungskalender
 * - generic-dates: Datums-Pattern + Titel Extraktion
 */
export class GemeindeRegistryScraper extends BaseScraper {
  readonly name = 'gemeinde-registry';

  private readonly timeoutMs = 10000;
  private readonly gemeindeDelayMs = 1500;

  private readonly MONTHS: Record<string, string> = {
    'jänner': '01', 'januar': '01', 'februar': '02', 'märz': '03', 'marz': '03',
    'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
    'august': '08', 'september': '09', 'oktober': '10',
    'november': '11', 'dezember': '12',
    'jan': '01', 'feb': '02', 'mär': '03', 'apr': '04',
    'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09',
    'okt': '10', 'nov': '11', 'dez': '12',
  };

  private loadRegistry(): GemeindeRegistryEntry[] {
    const registryDir = join(process.cwd(), 'data', 'gemeinden-registry');
    try {
      const files = readdirSync(registryDir).filter(f => f.endsWith('.json'));
      const entries: GemeindeRegistryEntry[] = [];
      for (const file of files) {
        const content = readFileSync(join(registryDir, file), 'utf8');
        const parsed = JSON.parse(content) as GemeindeRegistryEntry[];
        entries.push(...parsed);
      }
      return entries;
    } catch {
      this.log('WARNUNG: Kein Registry-Verzeichnis oder keine JSON-Dateien gefunden');
      return [];
    }
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const registry = this.loadRegistry();
    const bundeslandFilter = process.env.REGISTRY_BUNDESLAND?.toLowerCase();
    const scrapeable = registry.filter(e =>
      (e.status === 'active' || e.status === 'empty') &&
      e.strategy !== 'none' &&
      e.eventUrl &&
      (!bundeslandFilter || e.bundesland.toLowerCase().includes(bundeslandFilter))
    );

    this.log(`Starte Registry-Scraping: ${scrapeable.length} scrapbare Gemeinden von ${registry.length} total${bundeslandFilter ? ` (Filter: ${bundeslandFilter})` : ''}`);

    const allEvents: ScrapedEvent[] = [];
    const paginationLog: PaginationLogEntry[] = [];
    let scraped = 0;
    let failed = 0;
    let fetchErrors = 0;
    let noEvents = 0;

    for (let i = 0; i < scrapeable.length; i++) {
      const entry = scrapeable[i];
      try {
        const result = await this.scrapeGemeinde(entry, paginationLog);
        if (result === 'fetch-error') {
          fetchErrors++;
          if ((i + 1) % 50 === 0 || fetchErrors <= 10) {
            this.log(`  [${i + 1}/${scrapeable.length}] ${entry.name}: FETCH FEHLER [${entry.strategy}] ${entry.eventUrl}`);
          }
        } else if (result.length > 0) {
          allEvents.push(...result);
          scraped++;
          this.log(`  [${i + 1}/${scrapeable.length}] ${entry.name}: ${result.length} Events [${entry.strategy}]`);
        } else {
          noEvents++;
        }
      } catch (err) {
        failed++;
        this.log(`  [${i + 1}/${scrapeable.length}] ${entry.name}: FEHLER - ${err instanceof Error ? err.message : err}`);
      }
      await this.sleep(this.gemeindeDelayMs);
    }

    this.log(`Registry-Scraping fertig: ${allEvents.length} Events von ${scraped} Gemeinden (${noEvents} ohne Events, ${fetchErrors} Fetch-Fehler, ${failed} Exceptions)`);

    // Write pagination log for the report generator
    try {
      const reportsDir = join(process.cwd(), 'reports');
      if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });
      writeFileSync(
        join(reportsDir, 'pagination-log.json'),
        JSON.stringify(paginationLog, null, 2),
      );
      const paginatedCount = paginationLog.filter(e => e.pagesScraped > 1).length;
      const failedPagCount = paginationLog.filter(e => e.failedNextUrl).length;
      this.log(`Pagination-Log: ${paginatedCount} paginiert, ${failedPagCount} fehlgeschlagen → reports/pagination-log.json`);
    } catch { /* non-critical */ }

    return allEvents;
  }

  private async scrapeGemeinde(entry: GemeindeRegistryEntry, paginationLog: PaginationLogEntry[]): Promise<ScrapedEvent[] | 'fetch-error'> {
    if (!entry.eventUrl) return [];

    const { html, error } = await this.fetchWithTimeout(entry.eventUrl);
    if (!html) return error ? 'fetch-error' : [];

    // Parse the first page
    const events = this.parsePage(html, entry);
    const eventsPage1 = events.length;
    let pagesScraped = 1;
    let paginationType: PaginationLogEntry['paginationType'] = 'none';
    let failedNextUrl: string | undefined;

    // Pagination: follow next pages (skip for cities-iife which handles its own data)
    if (entry.strategy !== 'cities-iife') {
      let currentUrl = entry.eventUrl;
      let currentHtml = html;
      for (let page = 1; page < MAX_PAGES_PER_SITE; page++) {
        const detection = detectNextPage(currentHtml, currentUrl);
        if (!detection.nextUrl) break;

        if (paginationType === 'none') paginationType = detection.type;

        await this.sleep(800);
        const nextResult = await this.fetchWithTimeout(detection.nextUrl);
        if (!nextResult.html) {
          failedNextUrl = detection.nextUrl;
          break;
        }

        const pageEvents = this.parsePage(nextResult.html, entry);
        if (pageEvents.length === 0) break; // empty page = stop

        pagesScraped++;
        events.push(...pageEvents);
        currentUrl = detection.nextUrl;
        currentHtml = nextResult.html;
      }

      // Month navigation: if initial page had few events, try upcoming months
      if (events.length < 5) {
        const monthUrls = detectMonthNavigation(html, entry.eventUrl);
        if (monthUrls.length > 0 && paginationType === 'none') paginationType = 'month-nav';
        for (const { url } of monthUrls.slice(0, 3)) {
          await this.sleep(800);
          const monthResult = await this.fetchWithTimeout(url);
          if (!monthResult.html) {
            if (!failedNextUrl) failedNextUrl = url;
            continue;
          }
          const monthEvents = this.parsePage(monthResult.html, entry);
          if (monthEvents.length > 0) pagesScraped++;
          events.push(...monthEvents);
        }
      }
    }

    // Log pagination info
    paginationLog.push({
      gemeinde: entry.name,
      bundesland: entry.bundesland,
      strategy: entry.strategy,
      url: entry.eventUrl,
      pagesScraped,
      paginationType,
      failedNextUrl,
      eventsPage1,
      eventsTotal: events.length,
    });

    return events;
  }

  private parsePage(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    switch (entry.strategy) {
      case 'cities-iife':
        return this.parseCities(html, entry);
      case 'jsonld':
        return this.parseJsonLd(html, entry);
      case 'mec-html':
        return this.parseMEC(html, entry);
      case 'tribe-html':
        return this.parseTribe(html, entry);
      case 'gem2go':
        return this.parseGem2Go(html, entry);
      case 'gemeinde24':
        return this.parseGemeinde24(html, entry);
      case 'fullcalendar-json':
        return this.parseFullCalendarJson(html, entry);
      case 'calendar-table':
        return this.parseCalendarTable(html, entry);
      case 'generic-dates':
        return this.parseGenericDates(html, entry);
      default:
        return [];
    }
  }

  // ── Strategy: CITIES (window.INITIAL_DATA) ──────────────────────

  private parseCities(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    // Try INITIAL_DATA first, then INITIAL_WEBSITE
    let data = this.evaluateIIFE(html, 'INITIAL_DATA');
    if (!data) data = this.evaluateIIFE(html, 'INITIAL_WEBSITE');
    if (!data) {
      // Fallback: CITIES pages without IIFE — parse as generic HTML
      return this.parseGenericDates(html, entry);
    }

    // CITIES has multiple data structures depending on URL type:
    // 1. citiesapps.com: data['page/events'].upcomingEvents[]
    // 2. citiesapps.com: data['city/events'].events.upcoming[]
    // 3. /events/upcoming: data['connected-page'].pageEvents.upcomingEvents[]
    // 4. Custom domains: data.pageEvents.upcomingEvents[]
    const connectedPage = data['connected-page'] as Record<string, unknown> | undefined;
    const pageSlashEvents = data['page/events'] as CitiesPageEvents | undefined;
    const cityEvents = data['city/events'] as { events?: { upcoming?: CitiesEvent[]; current?: CitiesEvent[] } } | undefined;
    const pageEvents = pageSlashEvents
      ?? (connectedPage?.pageEvents as CitiesPageEvents | undefined)
      ?? (data.pageEvents as CitiesPageEvents | undefined);

    const allCitiesEvents: CitiesEvent[] = [];

    if (pageEvents) {
      allCitiesEvents.push(...(pageEvents.upcomingEvents || []));
      allCitiesEvents.push(...(pageEvents.currentEvents || []));
    }
    if (cityEvents?.events) {
      allCitiesEvents.push(...(cityEvents.events.upcoming || []));
      allCitiesEvents.push(...(cityEvents.events.current || []));
    }

    if (allCitiesEvents.length === 0) {
      // No events found in INITIAL_DATA — fall back to generic HTML parsing
      return this.parseGenericDates(html, entry);
    }

    // Deduplicate by event ID
    const seenIds = new Set<string>();
    const dedupedEvents = allCitiesEvents.filter(evt => {
      if (!evt._id || seenIds.has(evt._id)) return false;
      seenIds.add(evt._id);
      return true;
    });

    for (const evt of dedupedEvents) {
      if (!evt.name || !evt.startsAt) continue;

      const startDate = this.parseCitiesDate(evt.startsAt, evt.hasStartTime);
      if (!startDate) continue;
      const endDate = evt.endsAt ? this.parseCitiesDate(evt.endsAt, evt.hasEndTime) ?? undefined : undefined;

      let lat = entry.lat;
      let lng = entry.lng;
      let address: string | undefined;
      let locationName = entry.name;

      const loc = evt.location;
      if (loc) {
        if (loc.location?.coordinates?.length === 2) {
          lng = loc.location.coordinates[0];
          lat = loc.location.coordinates[1];
        }
        if (loc.municipality) locationName = loc.municipality;
        const addrParts = [loc.street, loc.addressNumber].filter(Boolean);
        if (addrParts.length > 0) {
          address = addrParts.join(' ');
          if (loc.postalCode || loc.municipality) {
            address += ', ' + [loc.postalCode, loc.municipality].filter(Boolean).join(' ');
          }
        }
      }

      let imageUrl: string | undefined;
      if (evt.bannerImage?.url) {
        imageUrl = evt.bannerImage.url.replace(/^http:\/\//, 'https://');
      }

      const description = evt.plainDescription || this.stripHtml(evt.description || '');

      events.push({
        source_id: `registry-cities-${evt._id}`,
        source_name: this.name,
        source_url: entry.eventUrl!,
        title: evt.name.trim(),
        description: description || undefined,
        start_date: startDate,
        end_date: endDate,
        location_name: locationName,
        address,
        postal_code: loc?.postalCode || entry.plz,
        bundesland: entry.bundesland,
        district: entry.bezirk,
        latitude: lat,
        longitude: lng,
        category: categorizeEvent(evt.name, description || ''),
        image_url: imageUrl,
        organizer: evt.page?.name || evt.hosts?.[0]?.page?.name,
      });
    }

    return events;
  }

  private evaluateIIFE(html: string, varName: string): Record<string, unknown> | null {
    const tag = `window.${varName} = `;
    const start = html.indexOf(tag);
    if (start === -1) return null;

    const exprStart = start + tag.length;
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = exprStart; i < html.length; i++) {
      const ch = html[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (inString) { if (ch === stringChar) inString = false; continue; }
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          const expr = html.substring(exprStart, i + 1);
          try {
            return vm.runInNewContext(expr, {}, { timeout: 5000 }) as Record<string, unknown>;
          } catch { return null; }
        }
      }
    }
    return null;
  }

  private parseCitiesDate(isoStr: string, hasTime: boolean): string | null {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      const viennaStr = d.toLocaleString('sv-SE', { timeZone: 'Europe/Vienna' });
      const [datePart, timePart] = viennaStr.split(' ');
      return hasTime && timePart ? `${datePart}T${timePart}` : datePart;
    } catch { return null; }
  }

  // ── Strategy: JSON-LD ───────────────────────────────────────────

  private parseJsonLd(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;
        const data = JSON.parse(raw);
        const items = this.extractEventItems(data);

        for (const item of items) {
          if (!isEventType(item['@type'])) continue;
          if (!item.name || !item.startDate) continue;

          const dedupeKey = `${item.name}-${item.startDate}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          const startDate = this.parseIsoDate(item.startDate);
          if (!startDate) continue;

          const endDate = item.endDate ? this.parseIsoDate(item.endDate) ?? undefined : undefined;
          const description = this.stripHtml(item.description || '');
          const imageUrl = typeof item.image === 'string' ? item.image : item.image?.url;

          events.push({
            source_id: `registry-jsonld-${Buffer.from(item.name + startDate).toString('base64').substring(0, 24)}`,
            source_name: this.name,
            source_url: item.url || entry.eventUrl!,
            title: this.stripHtml(item.name).trim(),
            description: description || undefined,
            start_date: startDate,
            end_date: endDate,
            location_name: item.location?.name || entry.name,
            postal_code: entry.plz,
            bundesland: entry.bundesland,
            district: entry.bezirk,
            latitude: entry.lat,
            longitude: entry.lng,
            category: categorizeEvent(item.name, description),
            image_url: imageUrl,
            organizer: item.organizer?.name,
          });
        }
      } catch { /* skip malformed JSON-LD */ }
    });

    // Fallback: also try MEC or generic if JSON-LD yields nothing
    if (events.length === 0) return this.parseMEC(html, entry);
    return events;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractEventItems(data: any): any[] {
    if (Array.isArray(data)) return data.flatMap((d: unknown) => this.extractEventItems(d));
    if (typeof data !== 'object' || !data) return [];
    if (isEventType(data['@type'])) return [data];
    if (data['@graph'] && Array.isArray(data['@graph'])) return data['@graph'].flatMap((g: unknown) => this.extractEventItems(g));
    return [];
  }

  private parseIsoDate(dateStr: string): string | null {
    if (!dateStr) return null;
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}T/)) {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        const local = d.toLocaleString('sv-SE', { timeZone: 'Europe/Vienna' });
        const [date, time] = local.split(' ');
        return time && time !== '00:00:00' ? `${date}T${time}` : date;
      } catch { return null; }
    }
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
    return null;
  }

  // ── Strategy: MEC HTML ──────────────────────────────────────────

  private parseMEC(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    $('.mec-event-article, .mec-event-item, [data-mec-postid]').each((_, el) => {
      try {
        const $el = $(el);
        const titleEl = $el.find('h4.mec-event-title a, .mec-event-title a, .mec-event-title');
        const title = titleEl.text().trim();
        if (!title) return;

        const link = titleEl.attr('href') || $el.find('a[data-event-id]').attr('href') || $el.find('a').first().attr('href') || entry.eventUrl!;
        const dateText = $el.find('.mec-event-date, .mec-date-details').text().trim();
        const timeText = $el.find('.mec-time-details, .mec-event-time').text().trim();
        const startDate = this.parseMECDate(dateText, timeText);
        if (!startDate) return;

        const dedupeKey = `${title}-${startDate}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        let imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

        const locationText = $el.find('.mec-event-loc-place, .mec-event-location').text().trim();

        events.push({
          source_id: `registry-mec-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: link.startsWith('http') ? link : new URL(link, entry.eventUrl!).href,
          title,
          start_date: startDate,
          location_name: locationText || entry.name,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: categorizeEvent(title, ''),
          image_url: this.cleanImageUrl(imageUrl),
        });
      } catch { /* skip */ }
    });

    // Fallback to generic if MEC found nothing
    if (events.length === 0) return this.parseGenericDates(html, entry);
    return events;
  }

  private parseMECDate(dateText: string, timeText: string): string | null {
    const now = new Date();
    const currentYear = now.getFullYear();

    const fullMatch = dateText.match(/(\d{1,2})\.?\s*(\w+)\.?\s*(\d{4})/);
    if (fullMatch) {
      const day = fullMatch[1].padStart(2, '0');
      const month = this.MONTHS[fullMatch[2].toLowerCase()];
      if (month) return this.appendTime(`${fullMatch[3]}-${month}-${day}`, timeText);
    }

    const shortMatch = dateText.match(/(\d{1,2})\s*(\w{3,})/);
    if (shortMatch) {
      const day = shortMatch[1].padStart(2, '0');
      const monthKey = shortMatch[2].replace('.', '').toLowerCase();
      const month = this.MONTHS[monthKey];
      if (month) {
        let year = currentYear;
        const testDate = new Date(`${year}-${month}-${day}`);
        if (testDate < new Date(now.getTime() - 30 * 86400000)) year++;
        return this.appendTime(`${year}-${month}-${day}`, timeText);
      }
    }

    return null;
  }

  // ── Strategy: Tribe Events HTML ─────────────────────────────────

  private parseTribe(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Try JSON-LD first (Tribe often embeds Event schema)
    const jsonLdEvents = this.parseJsonLd(html, entry);
    if (jsonLdEvents.length > 0) return jsonLdEvents;

    // Fallback: parse Tribe HTML
    $('.tribe-events-list .type-tribe_events, .tribe-common-g-row').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('.tribe-events-list-event-title a, .tribe-events-calendar-list__event-title a').text().trim();
        if (!title) return;

        const link = $el.find('.tribe-events-list-event-title a, .tribe-events-calendar-list__event-title a').attr('href') || entry.eventUrl!;
        const dateAttr = $el.find('[datetime]').attr('datetime') || $el.find('.tribe-event-schedule-details').text().trim();
        const startDate = this.parseIsoDate(dateAttr) || this.parseGermanDate(dateAttr);
        if (!startDate) return;

        const dedupeKey = `${title}-${startDate}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        let imageUrl = $el.find('.tribe-events-event-image img').attr('src');
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

        events.push({
          source_id: `registry-tribe-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: link.startsWith('http') ? link : new URL(link, entry.eventUrl!).href,
          title,
          start_date: startDate,
          location_name: $el.find('.tribe-venue').text().trim() || entry.name,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: categorizeEvent(title, ''),
          image_url: this.cleanImageUrl(imageUrl),
        });
      } catch { /* skip */ }
    });

    if (events.length === 0) return this.parseGenericDates(html, entry);
    return events;
  }

  // ── Strategy: GEM2GO ────────────────────────────────────────────

  private parseGem2Go(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // GEM2GO BEM card layout (newer version: span.bemHeader--h5, .bemContainer--date)
    $('.bemCard').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('.bemHeader--h5, .bemHeader').first().text().trim();
        if (!title) return;

        const dateText = $el.find('.bemContainer--date').text().trim();
        const startDate = this.parseNumericDate(dateText);
        if (!startDate) return;

        const timeText = $el.find('.bemContainer--time').text().trim();
        const fullDate = timeText ? this.appendTime(startDate, timeText) : startDate;

        const dedupeKey = `${title}-${fullDate}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const link = $el.find('a.bemLink-detail, a.bemLink').first().attr('href');
        const sourceUrl = link ? (link.startsWith('http') ? link : new URL(link, entry.eventUrl!).href) : entry.eventUrl!;

        let imageUrl = $el.find('.bemContainer--image img, picture img').first().attr('src');
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

        const addressLi = $el.find('.fa-map-marker-alt').closest('li').text().replace(/Adresse/i, '').trim();
        const category = $el.find('.bemHeaderContainer small.text-muted').text().trim();

        events.push({
          source_id: `registry-gem2go-${Buffer.from(title + fullDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: fullDate,
          location_name: entry.name,
          address: addressLi || undefined,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: category ? categorizeEvent(category, '') : categorizeEvent(title, ''),
          image_url: this.cleanImageUrl(imageUrl),
        });
      } catch { /* skip */ }
    });

    // GEM2GO detail card layout (div.veranstaltung with h3 title)
    if (events.length === 0) $('.veranstaltung').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('h3').first().text().trim();
        if (!title) return;

        const text = $el.text();
        const startDate = this.parseNumericDate(text);
        if (!startDate) return;

        const dedupeKey = `${title}-${startDate}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const link = $el.find('a[href*="veranstaltung"]').attr('href');
        const sourceUrl = link ? (link.startsWith('http') ? link : new URL(link, entry.eventUrl!).href) : entry.eventUrl!;

        let imageUrl = $el.find('img').first().attr('src');
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

        // Extract location from address li
        const addressLi = $el.find('li:contains("Adresse")').text().replace('Adresse', '').trim();

        events.push({
          source_id: `registry-gem2go-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: entry.name,
          address: addressLi || undefined,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: categorizeEvent(title, ''),
          image_url: this.cleanImageUrl(imageUrl),
        });
      } catch { /* skip */ }
    });

    // GEM2GO table layout
    if (events.length === 0) $('tr').each((_, el) => {
      try {
        const $el = $(el);
        const dateCell = $el.find('.va_list_day, .va_list_bez, td').first().text().trim();
        const titleCell = $el.find('.va_list_bez a, td a').text().trim();
        if (!titleCell || !dateCell) return;

        const startDate = this.parseGermanDate(dateCell);
        if (!startDate) return;

        const dedupeKey = `${titleCell}-${startDate}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const link = $el.find('a').attr('href');
        const sourceUrl = link && link.startsWith('http') ? link : link ? new URL(link, entry.eventUrl!).href : entry.eventUrl!;

        let imageUrl = $el.find('.va_picture img, img').first().attr('src');
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

        events.push({
          source_id: `registry-gem2go-${Buffer.from(titleCell + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: sourceUrl,
          title: titleCell,
          start_date: startDate,
          location_name: entry.name,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: categorizeEvent(titleCell, ''),
          image_url: this.cleanImageUrl(imageUrl),
        });
      } catch { /* skip */ }
    });

    // GEM2GO list layout (li with .appointmentTextBlock containing spans)
    // Span order: 1=date ("Sa, 04.04.2026"), 2=title, 3=category, 4=time
    if (events.length === 0) {
      $('.appointmentTextBlock').each((_, el) => {
        try {
          const $block = $(el);
          const $li = $block.closest('li');
          const spans = $block.find('span');
          if (spans.length < 2) return;

          const dateSpan = $(spans[0]).text().trim();
          const title = $(spans[1]).text().trim();
          if (!title || title.length < 2) return;

          const startDate = this.parseNumericDate(dateSpan);
          if (!startDate) return;

          const timeSpan = spans.length >= 4 ? $(spans[3]).text().trim() : '';
          const fullDate = timeSpan ? this.appendTime(startDate, timeSpan) : startDate;

          const dedupeKey = `${title}-${fullDate}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);

          const link = $li.find('a').first().attr('href');
          const sourceUrl = link ? (link.startsWith('http') ? link : new URL(link, entry.eventUrl!).href) : entry.eventUrl!;

          let imageUrl = $li.find('img[src*="GetImage"], img[src*="GetRemoteImage"], img').first().attr('src');
          if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

          const categorySpan = spans.length >= 3 ? $(spans[2]).text().trim() : '';

          events.push({
            source_id: `registry-gem2go-${Buffer.from(title + fullDate).toString('base64').substring(0, 24)}`,
            source_name: this.name,
            source_url: sourceUrl,
            title,
            start_date: fullDate,
            location_name: entry.name,
            postal_code: entry.plz,
            bundesland: entry.bundesland,
            district: entry.bezirk,
            latitude: entry.lat,
            longitude: entry.lng,
            category: categorySpan ? categorizeEvent(categorySpan, '') : categorizeEvent(title, ''),
            image_url: this.cleanImageUrl(imageUrl),
          });
        } catch { /* skip */ }
      });
    }

    // GEM2GO raster layout
    if (events.length === 0) {
      $('.rasterListEntry, .bemCard').each((_, el) => {
        try {
          const $el = $(el);
          const title = $el.find('.rasterListInfoContainerTitel, .rasterListEntryTitle, .bemCardTitle, h2, h3, h4').first().text().trim();
          const dateText = $el.find('.rasterListDateContainerDateTime, .rasterListEntryDate, .bemCardDate').text().trim() || $el.text();

          if (!title) return;
          const startDate = this.parseGermanDate(dateText);
          if (!startDate) return;

          const dedupeKey = `${title}-${startDate}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);

          let imageUrl = $el.find('img').first().attr('src');
          if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

          events.push({
            source_id: `registry-gem2go-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
            source_name: this.name,
            source_url: entry.eventUrl!,
            title,
            start_date: startDate,
            location_name: entry.name,
            postal_code: entry.plz,
            bundesland: entry.bundesland,
            district: entry.bezirk,
            latitude: entry.lat,
            longitude: entry.lng,
            category: categorizeEvent(title, ''),
            image_url: this.cleanImageUrl(imageUrl),
          });
        } catch { /* skip */ }
      });
    }

    if (events.length === 0) return this.parseGenericDates(html, entry);
    return events;
  }

  // ── Strategy: Gemeinde24 ────────────────────────────────────────

  private parseGemeinde24(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Gemeinde24 uses card-based layouts with date, title, thumbnail
    $('.card, .event-card, .veranstaltung, article, .list-item, .col-md-6, .col-lg-4').each((_, el) => {
      try {
        const $el = $(el);
        const text = $el.text().trim();
        if (text.length < 10 || text.length > 3000) return;

        const title = $el.find('h2, h3, h4, h5, .card-title, .title, a[href*="veranstaltung"]').first().text().trim();
        if (!title || title.length < 3) return;

        const startDate = this.parseGermanDate(text) || this.parseNumericDate(text);
        if (!startDate) return;

        const dedupeKey = `${startDate}-${title.substring(0, 30)}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        if (new Date(startDate) < new Date(new Date().toISOString().split('T')[0])) return;

        const link = $el.find('a').first().attr('href');
        const sourceUrl = link && link.startsWith('http') ? link : link ? new URL(link, entry.eventUrl!).href : entry.eventUrl!;

        let imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

        events.push({
          source_id: `registry-g24-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: sourceUrl,
          title: this.cleanTitle(title),
          start_date: startDate,
          location_name: entry.name,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: categorizeEvent(title, ''),
          image_url: this.cleanImageUrl(imageUrl),
        });
      } catch { /* skip */ }
    });

    if (events.length === 0) return this.parseGenericDates(html, entry);
    return events;
  }

  // ── Strategy: Generic date pattern extraction ───────────────────

  private parseGenericDates(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    $('article, .card, .event-item, .veranstaltung, .acc-item, li, tr, .wp-block-group, .elementor-widget-container, .entry-content a, div[class*="event"], div[class*="veranstaltung"], .news-list-view').each((_, el) => {
      try {
        const $el = $(el);
        const text = $el.text().trim();
        if (text.length < 10 || text.length > 2000) return;

        let startDate = this.parseNumericDate(text);
        if (!startDate) startDate = this.parseGermanDate(text);
        if (!startDate) return;

        let title = $el.find('h2, h3, h4, h5, h6').first().text().trim()
          || $el.find('a').first().text().trim()
          || $el.find('strong, b').first().text().trim();

        if (title) title = this.cleanTitle(title);
        if (!title || title.length < 3 || title.length > 200) return;

        const dedupeKey = `${startDate}-${title.substring(0, 30)}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        if (new Date(startDate) < new Date(new Date().toISOString().split('T')[0])) return;

        const link = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
        const sourceUrl = link && link.startsWith('http') ? link : link ? new URL(link, entry.eventUrl!).href : entry.eventUrl!;

        let imageUrl = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

        events.push({
          source_id: `registry-gen-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: entry.name,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: categorizeEvent(title, ''),
          image_url: this.cleanImageUrl(imageUrl),
        });
      } catch { /* skip */ }
    });

    return events;
  }

  // ── Strategy: FullCalendar JSON (inline events array) ────────

  private parseFullCalendarJson(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Extract events: [...] from inline <script> tags
    const eventsMatch = html.match(/events\s*:\s*\[([\s\S]*?)\]\s*[,}]/);
    if (!eventsMatch) return this.parseGenericDates(html, entry);

    try {
      // Convert JS object notation to JSON (quote property names)
      let jsonStr = '[' + eventsMatch[1] + ']';
      jsonStr = jsonStr.replace(/(\w+)\s*:/g, '"$1":');
      jsonStr = jsonStr.replace(/'/g, '"');
      // Remove trailing commas
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');

      const fcEvents = JSON.parse(jsonStr) as { title?: string; start?: string; end?: string; url?: string }[];

      for (const fc of fcEvents) {
        if (!fc.title || !fc.start) continue;

        const title = fc.title.replace(/[,\s]+$/, '').trim();
        if (!title) continue;

        const startDate = this.parseIsoDate(fc.start) || fc.start;
        if (!startDate || !startDate.match(/^\d{4}-/)) continue;

        // Only future events
        if (new Date(startDate.split('T')[0]) < new Date(new Date().toISOString().split('T')[0])) continue;

        const dedupeKey = `${title}-${startDate}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const endDate = fc.end ? (this.parseIsoDate(fc.end) || fc.end) : undefined;

        events.push({
          source_id: `registry-fc-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: fc.url || entry.eventUrl!,
          title,
          start_date: startDate,
          end_date: endDate,
          location_name: entry.name,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: categorizeEvent(title, ''),
        });
      }
    } catch { /* JSON parse error — fall back */ }

    if (events.length === 0) return this.parseGenericDates(html, entry);
    return events;
  }

  // ── Strategy: Calendar Table (td > a with date in title attr) ──

  private parseCalendarTable(html: string, entry: GemeindeRegistryEntry): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    // Find links inside table cells that point to event detail pages
    $('td a[href*="veranstaltung"], td a[title]').each((_, el) => {
      try {
        const $a = $(el);
        const title = $a.text().trim();
        if (!title || title.length < 3) return;

        // Date from title attribute: "Sa, 04.04.2026<br>Event Name<br>"
        const titleAttr = $a.attr('title') || '';
        let startDate = this.parseNumericDate(titleAttr);

        // Fallback: get day from preceding <strong>, month/year from page context
        if (!startDate) {
          const dayText = $a.parent().find('strong').first().text().trim();
          const pageText = $('h1, h2, h3, .month-header, caption').text();
          const monthYear = pageText.match(/([\wä]+)\s+(\d{4})/i);
          if (dayText && monthYear) {
            const month = this.MONTHS[monthYear[1].toLowerCase()];
            if (month) startDate = `${monthYear[2]}-${month}-${dayText.padStart(2, '0')}`;
          }
        }

        if (!startDate) return;
        if (new Date(startDate) < new Date(new Date().toISOString().split('T')[0])) return;

        const dedupeKey = `${title}-${startDate}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const href = $a.attr('href') || '';
        const sourceUrl = href.startsWith('http') ? href : new URL(href, entry.eventUrl!).href;

        events.push({
          source_id: `registry-cal-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          location_name: entry.name,
          postal_code: entry.plz,
          bundesland: entry.bundesland,
          district: entry.bezirk,
          latitude: entry.lat,
          longitude: entry.lng,
          category: categorizeEvent(title, ''),
        });
      } catch { /* skip */ }
    });

    if (events.length === 0) return this.parseGenericDates(html, entry);
    return events;
  }

  // ── Shared helpers ──────────────────────────────────────────────

  private parseNumericDate(text: string): string | null {
    const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!match) return null;
    const [fullDateMatch, d, m, y] = match;
    if (parseInt(y) < 2025 || parseInt(y) > 2030) return null;
    if (parseInt(m) > 12 || parseInt(d) > 31) return null;
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    // Search for time AFTER the date match to avoid matching the date itself as time
    const textAfterDate = text.substring((match.index || 0) + fullDateMatch.length);
    const timeMatch = textAfterDate.match(/(\d{1,2}):(\d{2})(?:\s*(?:Uhr|h))?/);
    if (timeMatch && parseInt(timeMatch[1]) <= 23) {
      return `${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
    }
    return date;
  }

  private parseGermanDate(text: string): string | null {
    const match = text.match(/(\d{1,2})\.?\s*([\wäöü]+)\.?\s*(\d{4})/i);
    if (!match) return null;
    const dayNum = parseInt(match[1]);
    if (dayNum < 1 || dayNum > 31) return null;
    const day = match[1].padStart(2, '0');
    const monthKey = match[2].toLowerCase().replace('.', '');
    const month = this.MONTHS[monthKey];
    if (!month) return null;
    const year = match[3];
    if (parseInt(year) < 2025 || parseInt(year) > 2030) return null;
    // Validate the date is real
    const testDate = new Date(`${year}-${month}-${day}`);
    if (isNaN(testDate.getTime())) return null;
    return `${year}-${month}-${day}`;
  }

  private appendTime(date: string, timeText: string): string {
    const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) return `${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
    return date;
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\d{1,2}\.?\s*\w+\.?\s*\d{4}/g, '')
      .replace(/\d{1,2}\.\d{1,2}\.\d{4}/g, '')
      .replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '')
      .trim();
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async fetchWithTimeout(url: string): Promise<{ html: string | null; error?: string }> {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
        },
      });
      if (response.status !== 200) {
        return { html: null, error: `HTTP ${response.status}` };
      }
      return { html: await response.text() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const error = msg.includes('abort') || msg.includes('timeout') ? 'timeout' : msg.substring(0, 80);
      return { html: null, error };
    }
  }
}

// ── Types ───────────────────────────────────────────────────────────

interface GemeindeRegistryEntry {
  name: string;
  website: string;
  eventUrl: string | null;
  cms: string;
  strategy: string;
  plz: string;
  bezirk: string;
  bundesland: string;
  lat: number;
  lng: number;
  status: string;
  notes: string;
  verifiedAt: string;
}

interface CitiesPageEvents {
  upcomingEvents?: CitiesEvent[];
  currentEvents?: CitiesEvent[];
  pastEvents?: CitiesEvent[];
}

interface CitiesEvent {
  _id: string;
  name: string;
  description: string | null;
  plainDescription: string | null;
  bannerImage: { url: string } | null;
  page: { _id: string; name: string; slug: string } | null;
  startsAt: string;
  hasStartTime: boolean;
  endsAt: string | null;
  hasEndTime: boolean;
  location: {
    addressNumber: string | null;
    country: string;
    label: string;
    municipality: string;
    postalCode: string | null;
    street: string | null;
    location: { type: string; coordinates: [number, number] } | null;
  } | null;
  hosts: { page: { _id: string; name: string }; status: string }[];
}
