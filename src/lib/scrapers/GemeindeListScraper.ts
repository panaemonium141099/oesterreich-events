import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { GEMEINDEN, type GemeindeInfo } from './gemeinden/gemeindeList';
import type { ScrapedEvent } from '@/types/events';
import { detectNextPage, detectMonthNavigation, MAX_PAGES_PER_SITE } from './pagination';
import { isEventType } from '../connectors/json-ld-connector';

/**
 * Meta-Scraper der systematisch österreichische Gemeinde-Websites
 * nach Veranstaltungskalendern durchsucht und Events extrahiert.
 *
 * Ablauf:
 * 1. Für jede Gemeinde: Teste bekannte Kalender-URL-Pfade
 * 2. Wenn ein Kalender gefunden wird: Parse die Events mit mehreren Strategien
 * 3. Jedes Event bekommt die GPS-Koordinaten der Gemeinde zugewiesen
 */
export class GemeindeListScraper extends BaseScraper {
  readonly name = 'gemeinden';

  /** Timeout pro einzelner URL-Probe in ms */
  private readonly probeTimeoutMs = 5000;

  /** Pause zwischen Gemeinden in ms */
  private readonly gemeindeDelayMs = 2000;

  /** Bekannte Kalender-Pfade, sortiert nach Häufigkeit */
  private readonly calendarPaths = [
    '/veranstaltungen',
    '/events',
    '/termine',
    '/kalender',
    '/veranstaltungskalender',
    '/aktuelles/veranstaltungen',
    '/freizeit/veranstaltungen',
    '/kultur/veranstaltungen',
    '/tourismus/veranstaltungen',
    '/leben/veranstaltungen',
    '/freizeit-kultur/veranstaltungen',
    '/freizeit/events',
  ];

  /** Deutsche Monatsnamen für Datum-Parsing */
  private readonly MONTHS: Record<string, string> = {
    'jänner': '01', 'januar': '01', 'februar': '02', 'märz': '03',
    'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
    'august': '08', 'september': '09', 'oktober': '10',
    'november': '11', 'dezember': '12',
  };

  async scrape(): Promise<ScrapedEvent[]> {
    this.log(`Starte Gemeinde-Scraping für ${GEMEINDEN.length} Gemeinden...`);
    const allEvents: ScrapedEvent[] = [];
    let gemeindenMitKalender = 0;
    let gemeindenOhneKalender = 0;
    let gemeindenFehler = 0;

    for (let i = 0; i < GEMEINDEN.length; i++) {
      const gemeinde = GEMEINDEN[i];
      try {
        this.log(`[${i + 1}/${GEMEINDEN.length}] ${gemeinde.name} (${gemeinde.bundesland})...`);

        // 1. Finde den Event-Kalender
        const calendarUrl = await this.findCalendarUrl(gemeinde);
        if (!calendarUrl) {
          gemeindenOhneKalender++;
          continue;
        }

        this.log(`  Kalender gefunden: ${calendarUrl}`);
        gemeindenMitKalender++;

        // 2. Scrape die Events
        const events = await this.scrapeCalendar(calendarUrl, gemeinde);
        allEvents.push(...events);

        this.log(`  ${gemeinde.name}: ${events.length} Events gefunden`);
      } catch (err) {
        gemeindenFehler++;
        // Skip failed Gemeinden silently — don't crash the whole scraper
        this.log(`  ${gemeinde.name}: Fehler — ${err instanceof Error ? err.message : String(err)}`);
      }

      // Rate-Limiting: Sei nett zu kleinen Gemeinde-Servern
      await this.sleep(this.gemeindeDelayMs);
    }

    this.log(`\nZusammenfassung:`);
    this.log(`  ${gemeindenMitKalender} Gemeinden mit Kalender`);
    this.log(`  ${gemeindenOhneKalender} Gemeinden ohne Kalender`);
    this.log(`  ${gemeindenFehler} Gemeinden mit Fehler`);
    this.log(`  ${allEvents.length} Events insgesamt`);

    return allEvents;
  }

  // ─── KALENDER-URL FINDEN ─────────────────────────────────────────────────

  /**
   * Testet bekannte Kalender-Pfade für eine Gemeinde-Website.
   * Gibt die erste funktionierende URL zurück, oder null.
   */
  private async findCalendarUrl(gemeinde: GemeindeInfo): Promise<string | null> {
    for (const path of this.calendarPaths) {
      const url = gemeinde.website + path;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(this.probeTimeoutMs),
        });

        if (response.ok) {
          const html = await response.text();
          if (this.looksLikeEventPage(html)) {
            return url;
          }
        }
      } catch {
        // Timeout, DNS-Fehler, etc. → nächsten Pfad probieren
        continue;
      }
    }

    return null;
  }

  /**
   * Prüft ob eine HTML-Seite nach einem Event-Kalender aussieht.
   * Muss sowohl Datumsangaben als auch Event-bezogene Wörter enthalten.
   */
  private looksLikeEventPage(html: string): boolean {
    const lower = html.toLowerCase();

    // Muss Datums-Patterns enthalten
    const hasNumericDate = /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(html);
    const hasWrittenDate = /\d{1,2}\.\s*(jänner|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{2,4}/i.test(html);
    const hasDate = hasNumericDate || hasWrittenDate;

    // Muss Event-bezogene Wörter enthalten
    const hasEventWords =
      lower.includes('veranstaltung') ||
      lower.includes('event') ||
      lower.includes('termin') ||
      lower.includes('kalender') ||
      lower.includes('programm');

    // Mindestens 200 Zeichen Content (nicht nur ein leeres Template)
    const hasContent = html.length > 2000;

    return hasDate && hasEventWords && hasContent;
  }

  // ─── KALENDER SCRAPEN ────────────────────────────────────────────────────

  /**
   * Scrapt eine Kalender-Seite mit mehreren Strategien + Pagination.
   * Folgt "Nächste Seite"-Links und Monats-Navigation.
   */
  private async scrapeCalendar(url: string, gemeinde: GemeindeInfo): Promise<ScrapedEvent[]> {
    let html: string;
    try {
      html = await this.fetchPage(url);
    } catch {
      return [];
    }

    // Parse first page
    let allEvents = this.parseCalendarPage(html, url, gemeinde);
    const visitedUrls = new Set<string>([url]);

    // Follow pagination links (next page)
    if (allEvents.length > 0) {
      let currentHtml = html;
      let currentUrl = url;

      for (let p = 1; p < MAX_PAGES_PER_SITE; p++) {
        const { nextUrl } = detectNextPage(currentHtml, currentUrl);
        if (!nextUrl || visitedUrls.has(nextUrl)) break;
        visitedUrls.add(nextUrl);

        try {
          const nextHtml = await this.fetchPage(nextUrl);
          const nextEvents = this.parseCalendarPage(nextHtml, nextUrl, gemeinde);
          if (nextEvents.length === 0) break;

          allEvents.push(...nextEvents);
          currentHtml = nextHtml;
          currentUrl = nextUrl;
          await this.sleep(500);
        } catch {
          break;
        }
      }
    }

    // Try month navigation for calendars with few events (month-view)
    if (allEvents.length > 0 && allEvents.length < 5) {
      const monthUrls = detectMonthNavigation(html, url);
      for (const mu of monthUrls) {
        if (visitedUrls.has(mu.url)) continue;
        visitedUrls.add(mu.url);

        try {
          const mHtml = await this.fetchPage(mu.url);
          const mEvents = this.parseCalendarPage(mHtml, mu.url, gemeinde);
          allEvents.push(...mEvents);
          await this.sleep(500);
        } catch {
          continue;
        }
      }
    }

    // Koordinaten und Metadaten für alle Events setzen
    return allEvents.map(e => ({
      ...e,
      latitude: e.latitude ?? gemeinde.lat,
      longitude: e.longitude ?? gemeinde.lng,
      postal_code: e.postal_code ?? gemeinde.plz,
      bundesland: e.bundesland ?? gemeinde.bundesland,
      district: e.district ?? gemeinde.bezirk,
      location_name: e.location_name ?? gemeinde.name,
    }));
  }

  /** Parse a single calendar page with all 4 strategies */
  private parseCalendarPage(html: string, url: string, gemeinde: GemeindeInfo): ScrapedEvent[] {
    const $ = cheerio.load(html);
    let events: ScrapedEvent[] = [];

    const jsonLdEvents = this.extractJsonLdEvents($, url, gemeinde);
    if (jsonLdEvents.length > 0) events = jsonLdEvents;
    if (events.length === 0) events = this.extractStructuredEvents($, url, gemeinde);
    if (events.length === 0) events = this.extractTableListEvents($, url, gemeinde);
    if (events.length === 0) events = this.extractLinkEvents($, url, gemeinde);

    return events;
  }

  // ─── STRATEGIE 1: JSON-LD ───────────────────────────────────────────────

  private extractJsonLdEvents($: cheerio.CheerioAPI, pageUrl: string, gemeinde: GemeindeInfo): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;

        const data = JSON.parse(raw);
        const items = this.findJsonLdEvents(data);

        for (const item of items) {
          if (!item.name || !item.startDate) continue;

          const title = String(item.name).trim();
          if (title.length < 3) continue;

          const slug = this.slugify(title);
          const event: ScrapedEvent = {
            source_id: `gemeinde-${gemeinde.plz}-${slug}`,
            source_name: this.name,
            source_url: pageUrl,
            title,
            description: item.description ? String(item.description).replace(/<[^>]*>/g, '').trim() : undefined,
            start_date: this.normalizeDate(String(item.startDate)),
            end_date: item.endDate ? this.normalizeDate(String(item.endDate)) : undefined,
            location_name: (item.location as Record<string, unknown>)?.name as string || gemeinde.name,
            image_url: this.extractJsonLdImage(item),
            category: categorizeEvent(title),
          };

          events.push(event);
        }
      } catch {
        // JSON parse error — skip
      }
    });

    return events;
  }

  /** Findet Event-Objekte in verschiedenen JSON-LD Strukturen */
  private findJsonLdEvents(data: unknown): Record<string, unknown>[] {
    const results: Record<string, unknown>[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        results.push(...this.findJsonLdEvents(item));
      }
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;

      // @graph Array
      if (Array.isArray(obj['@graph'])) {
        for (const item of obj['@graph']) {
          results.push(...this.findJsonLdEvents(item));
        }
      }

      // Direkt ein Event
      const type = obj['@type'];
      if (isEventType(type)) {
        results.push(obj);
      }
    }

    return results;
  }

  private extractJsonLdImage(item: Record<string, unknown>): string | undefined {
    const image = item.image;
    if (typeof image === 'string') return this.cleanImageUrl(image);
    if (Array.isArray(image) && typeof image[0] === 'string') return this.cleanImageUrl(image[0]);
    if (image && typeof image === 'object') {
      const imgObj = image as Record<string, unknown>;
      return this.cleanImageUrl(
        (imgObj.contentUrl || imgObj.url || imgObj['@id']) as string | undefined
      );
    }
    return undefined;
  }

  // ─── STRATEGIE 2: STRUKTURIERTE CONTAINER ────────────────────────────────

  private extractStructuredEvents($: cheerio.CheerioAPI, pageUrl: string, gemeinde: GemeindeInfo): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seenTitles = new Set<string>();

    // Suche nach verschiedenen Event-Container-Selektoren
    const selectors = [
      'article.event', 'article.veranstaltung', 'article.termin',
      '.event-item', '.event-entry', '.event-card', '.event-list-item',
      '.veranstaltung', '.veranstaltung-item', '.veranstaltungen-item',
      '.termin-item', '.termin-entry',
      '[itemtype*="Event"]',
      '.news-list-item', // Viele CMS nutzen News-Listen für Events
    ];

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const $el = $(el);
        const text = $el.text();

        // Titel extrahieren: h2, h3, h4, .title, a
        const title = (
          $el.find('h2, h3, h4').first().text().trim() ||
          $el.find('.title, .event-title, .termin-title').first().text().trim() ||
          $el.find('a').first().text().trim()
        );

        if (!title || title.length < 3) return;
        if (seenTitles.has(title)) return;

        // Datum extrahieren
        const dateStr = this.extractDateFromText(text);
        if (!dateStr) return;

        seenTitles.add(title);

        // Bild extrahieren
        const imgSrc = $el.find('img').first().attr('src') ||
                       $el.find('img').first().attr('data-src');
        const imageUrl = imgSrc ? this.resolveUrl(imgSrc, pageUrl) : undefined;

        // Link extrahieren
        const linkHref = $el.find('a').first().attr('href');
        const eventUrl = linkHref ? this.resolveUrl(linkHref, pageUrl) : pageUrl;

        const slug = this.slugify(title);
        events.push({
          source_id: `gemeinde-${gemeinde.plz}-${slug}`,
          source_name: this.name,
          source_url: eventUrl,
          title,
          start_date: dateStr,
          image_url: this.cleanImageUrl(imageUrl),
          category: categorizeEvent(title),
        });
      });

      // Wenn eine Strategie Events gefunden hat, nicht weiterprobieren
      if (events.length > 0) break;
    }

    return events;
  }

  // ─── STRATEGIE 3: TABELLEN UND LISTEN ────────────────────────────────────

  private extractTableListEvents($: cheerio.CheerioAPI, pageUrl: string, gemeinde: GemeindeInfo): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seenTitles = new Set<string>();

    // Tabellen-Zeilen mit Datum
    $('tr').each((_, el) => {
      const $row = $(el);
      const text = $row.text();
      const dateStr = this.extractDateFromText(text);
      if (!dateStr) return;

      // Titel aus der Zeile extrahieren (längste Zelle die kein Datum ist)
      let title = '';
      $row.find('td, th').each((__, cell) => {
        const cellText = $(cell).text().trim();
        if (cellText.length > title.length && !/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(cellText)) {
          title = cellText;
        }
      });

      // Fallback: Link-Text
      if (!title || title.length < 3) {
        title = $row.find('a').first().text().trim();
      }

      if (!title || title.length < 3 || seenTitles.has(title)) return;
      seenTitles.add(title);

      const linkHref = $row.find('a').first().attr('href');
      const eventUrl = linkHref ? this.resolveUrl(linkHref, pageUrl) : pageUrl;

      const slug = this.slugify(title);
      events.push({
        source_id: `gemeinde-${gemeinde.plz}-${slug}`,
        source_name: this.name,
        source_url: eventUrl,
        title,
        start_date: dateStr,
        category: categorizeEvent(title),
      });
    });

    // Listen-Einträge mit Datum
    if (events.length === 0) {
      $('li, .list-item').each((_, el) => {
        const $li = $(el);
        const text = $li.text();
        const dateStr = this.extractDateFromText(text);
        if (!dateStr) return;

        // Titel: Link-Text oder gesamter Text minus Datum
        let title = $li.find('a').first().text().trim();
        if (!title || title.length < 3) {
          title = text.replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, '').trim();
          // Nimm nur die erste Zeile
          title = title.split('\n')[0].trim();
        }

        if (!title || title.length < 3 || title.length > 200 || seenTitles.has(title)) return;
        seenTitles.add(title);

        const linkHref = $li.find('a').first().attr('href');
        const eventUrl = linkHref ? this.resolveUrl(linkHref, pageUrl) : pageUrl;

        const slug = this.slugify(title);
        events.push({
          source_id: `gemeinde-${gemeinde.plz}-${slug}`,
          source_name: this.name,
          source_url: eventUrl,
          title,
          start_date: dateStr,
          category: categorizeEvent(title),
        });
      });
    }

    return events;
  }

  // ─── STRATEGIE 4: LINKS MIT DATUM ────────────────────────────────────────

  private extractLinkEvents($: cheerio.CheerioAPI, pageUrl: string, gemeinde: GemeindeInfo): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seenTitles = new Set<string>();

    $('a').each((_, el) => {
      const $a = $(el);
      const title = $a.text().trim();
      if (!title || title.length < 3 || title.length > 200) return;

      // Prüfe ob im Elternelement ein Datum steht
      const parent = $a.parent();
      const parentText = parent.text();
      const dateStr = this.extractDateFromText(parentText);
      if (!dateStr) return;

      if (seenTitles.has(title)) return;
      seenTitles.add(title);

      const href = $a.attr('href');
      if (!href || href === '#' || href.startsWith('javascript:')) return;
      const eventUrl = this.resolveUrl(href, pageUrl);

      const slug = this.slugify(title);
      events.push({
        source_id: `gemeinde-${gemeinde.plz}-${slug}`,
        source_name: this.name,
        source_url: eventUrl,
        title,
        start_date: dateStr,
        category: categorizeEvent(title),
      });
    });

    return events;
  }

  // ─── HILFSFUNKTIONEN ────────────────────────────────────────────────────

  /**
   * Extrahiert ein Datum aus einem Text-Block.
   * Unterstützt: DD.MM.YYYY, DD.MM.YY, DD. Monat YYYY
   * Gibt ISO-Format YYYY-MM-DD zurück oder null.
   */
  private extractDateFromText(text: string): string | null {
    // Pattern 1: DD.MM.YYYY oder DD.MM.YY
    const numericMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (numericMatch) {
      const day = numericMatch[1].padStart(2, '0');
      const month = numericMatch[2].padStart(2, '0');
      let year = numericMatch[3];
      if (year.length === 2) {
        year = `20${year}`;
      }

      // Plausibilitätsprüfung
      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);
      if (y >= 2024 && y <= 2030 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    // Pattern 2: DD. Monat YYYY (z.B. "15. März 2026")
    const writtenMatch = text.match(
      /(\d{1,2})\.\s*(jänner|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})/i
    );
    if (writtenMatch) {
      const day = writtenMatch[1].padStart(2, '0');
      const monthName = writtenMatch[2].toLowerCase();
      const month = this.MONTHS[monthName];
      const year = writtenMatch[3];

      if (month) {
        const y = parseInt(year);
        if (y >= 2024 && y <= 2030) {
          return `${year}-${month}-${day}`;
        }
      }
    }

    return null;
  }

  /**
   * Normalisiert verschiedene Datumsformate zu ISO YYYY-MM-DD.
   */
  private normalizeDate(dateStr: string): string {
    // Schon im ISO-Format?
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.slice(0, 10);
    }

    // DD.MM.YYYY
    const extracted = this.extractDateFromText(dateStr);
    if (extracted) return extracted;

    // Fallback: Heutiges Datum
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Erzeugt einen URL-sicheren Slug aus einem Titel.
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
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
}
