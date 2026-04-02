import * as cheerio from 'cheerio';
import * as vm from 'vm';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

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
    const scrapeable = registry.filter(e =>
      (e.status === 'active' || e.status === 'empty') &&
      e.strategy !== 'none' &&
      e.eventUrl
    );

    this.log(`Starte Registry-Scraping: ${scrapeable.length} scrapbare Gemeinden von ${registry.length} total`);

    const allEvents: ScrapedEvent[] = [];
    let scraped = 0;
    let failed = 0;
    let noEvents = 0;

    for (let i = 0; i < scrapeable.length; i++) {
      const entry = scrapeable[i];
      try {
        const events = await this.scrapeGemeinde(entry);
        if (events.length > 0) {
          allEvents.push(...events);
          scraped++;
          this.log(`  [${i + 1}/${scrapeable.length}] ${entry.name}: ${events.length} Events [${entry.strategy}]`);
        } else {
          noEvents++;
        }
      } catch (err) {
        failed++;
        this.log(`  [${i + 1}/${scrapeable.length}] ${entry.name}: FEHLER - ${err instanceof Error ? err.message : err}`);
      }
      await this.sleep(this.gemeindeDelayMs);
    }

    this.log(`Registry-Scraping fertig: ${allEvents.length} Events von ${scraped} Gemeinden (${noEvents} ohne Events, ${failed} fehlgeschlagen)`);
    return allEvents;
  }

  private async scrapeGemeinde(entry: GemeindeRegistryEntry): Promise<ScrapedEvent[]> {
    if (!entry.eventUrl) return [];

    const html = await this.fetchWithTimeout(entry.eventUrl);
    if (!html) return [];

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

    const connectedPage = data['connected-page'] as Record<string, unknown> | undefined;
    const pageEvents = (connectedPage?.pageEvents ?? data.pageEvents) as CitiesPageEvents | undefined;
    if (!pageEvents) {
      // INITIAL_DATA/WEBSITE found but no pageEvents — try generic dates fallback
      return this.parseGenericDates(html, entry);
    }

    const allCitiesEvents = [
      ...(pageEvents.upcomingEvents || []),
      ...(pageEvents.currentEvents || []),
    ];

    for (const evt of allCitiesEvents) {
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
          if (item['@type'] !== 'Event' && !item['@type']?.includes?.('Event')) continue;
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
    if (data['@type'] === 'Event' || (Array.isArray(data['@type']) && data['@type'].includes('Event'))) return [data];
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

    $('.mec-event-article, .mec-event-item').each((_, el) => {
      try {
        const $el = $(el);
        const titleEl = $el.find('.mec-event-title a, .mec-event-title');
        const title = titleEl.text().trim();
        if (!title) return;

        const link = titleEl.attr('href') || $el.find('a').first().attr('href') || entry.eventUrl!;
        const dateText = $el.find('.mec-event-date').text().trim();
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

    // GEM2GO table layout
    $('tr').each((_, el) => {
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

    // GEM2GO list layout (li > a with appointmentTextBlock)
    if (events.length === 0) {
      $('li').each((_, el) => {
        try {
          const $el = $(el);
          const textBlock = $el.find('.appointmentTextBlock');
          if (textBlock.length === 0) return;

          const title = $el.find('a').first().contents().filter(function() { return this.type === 'text'; }).text().trim()
            || textBlock.find('span').first().text().trim();
          if (!title) return;

          const text = $el.text();
          const startDate = this.parseNumericDate(text);
          if (!startDate) return;

          const dedupeKey = `${title}-${startDate}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);

          const link = $el.find('a').attr('href');
          const sourceUrl = link && link.startsWith('http') ? link : link ? new URL(link, entry.eventUrl!).href : entry.eventUrl!;

          let imageUrl = $el.find('img').first().attr('src');
          if (imageUrl && !imageUrl.startsWith('http')) imageUrl = new URL(imageUrl, entry.eventUrl!).href;

          events.push({
            source_id: `registry-gem2go-${Buffer.from(title + startDate).toString('base64').substring(0, 24)}`,
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
    }

    // GEM2GO raster layout
    if (events.length === 0) {
      $('.rasterListEntry, .bemCard').each((_, el) => {
        try {
          const $el = $(el);
          const title = $el.find('.rasterListEntryTitle, .bemCardTitle, h3, h4').first().text().trim();
          const dateText = $el.find('.rasterListEntryDate, .bemCardDate').text().trim() || $el.text();

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

    $('article, .event-item, .veranstaltung, li, tr, .wp-block-group, .elementor-widget-container, .entry-content a, div[class*="event"], div[class*="veranstaltung"]').each((_, el) => {
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

  // ── Shared helpers ──────────────────────────────────────────────

  private parseNumericDate(text: string): string | null {
    const match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!match) return null;
    const [, d, m, y] = match;
    if (parseInt(y) < 2025 || parseInt(y) > 2030) return null;
    const timeMatch = text.match(/(\d{1,2})[:.:](\d{2})\s*(?:Uhr|h)?/);
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (timeMatch) return `${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
    return date;
  }

  private parseGermanDate(text: string): string | null {
    const match = text.match(/(\d{1,2})\.?\s*([\wäöü]+)\.?\s*(\d{4})/i);
    if (!match) return null;
    const day = match[1].padStart(2, '0');
    const monthKey = match[2].toLowerCase().replace('.', '');
    const month = this.MONTHS[monthKey];
    if (!month) return null;
    const year = match[3];
    if (parseInt(year) < 2025 || parseInt(year) > 2030) return null;
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

  private async fetchWithTimeout(url: string): Promise<string | null> {
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
      if (response.status !== 200) return null;
      return await response.text();
    } catch {
      return null;
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
