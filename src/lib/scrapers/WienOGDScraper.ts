import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import type { ScrapedEvent } from '@/types/events';

/**
 * Wien Open Government Data (OGD) Events Scraper
 *
 * Complements the existing WienVADBScraper by querying the Wien city VADB RSS
 * feed with category-specific queries. The VADB RSS IS the official Wien OGD
 * events source (data.gv.at/katalog/dataset/stadt-wien_veranstaltungenwien).
 *
 * While WienVADBScraper fetches a general date-windowed listing (up to 500 per
 * window), this scraper queries by VADB category to capture events that may
 * exceed the 500-per-query limit in the general listing.
 *
 * VADB categories (Typgruppe): K=Konzert, T=Theater, V=Vortrag, A=Ausstellung,
 * M=Messe, F=Fest, S=Sport, K=Kinder, P=Führung, B=Buchpräsentation, etc.
 *
 * Source: https://digitales.wien.gv.at/beschreibung-des-rss-feeds-fuer-die-wien-at-veranstaltungsdatenbank/
 * License: CC-BY 4.0 (Stadt Wien, Open Data)
 */

/** VADB Typgruppen (event categories in the Wien city database) */
const VADB_CATEGORIES = [
  { code: 'KO', label: 'Konzert' },
  { code: 'TH', label: 'Theater' },
  { code: 'VO', label: 'Vortrag' },
  { code: 'AU', label: 'Ausstellung' },
  { code: 'FE', label: 'Fest' },
  { code: 'SP', label: 'Sport' },
  { code: 'KI', label: 'Kinder' },
  { code: 'FU', label: 'Führung' },
  { code: 'KU', label: 'Kurs' },
  { code: 'LE', label: 'Lesung' },
  { code: 'ME', label: 'Messe' },
  { code: 'FL', label: 'Flohmärkte' },
];

export class WienOGDScraper extends BaseScraper {
  readonly name = 'wien-ogd';
  private readonly BASE_URL = 'https://www.wien.gv.at/vadb/internet/AdvPrSrv.asp';

  private formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }

  /** Parse German date string "DD.MM.YYYY [HH:MM]" to ISO string */
  private parseGermanDate(raw: string): string | null {
    if (!raw) return null;
    const m = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    const [, d, mo, y, h, min] = m;
    if (h && min) {
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min}:00`;
    }
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Wien OGD category-based VADB Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    const now = new Date();
    const sixMonthsLater = new Date(now);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    const fromStr = this.formatDate(now);
    const toStr = this.formatDate(sixMonthsLater);

    for (const cat of VADB_CATEGORIES) {
      try {
        const params = new URLSearchParams({
          Layout: 'rss-vadb_neu',
          Type: 'R',
          GANZJAEHRIG: 'ja',
          hmwd: 'd',
          'vie_range-from': fromStr,
          'vie_range-to': toStr,
          'ssession_typgruppe': cat.code,
          SrvRecCnt: '500',
        });
        const url = `${this.BASE_URL}?${params.toString()}`;

        this.log(`Kategorie ${cat.label} (${cat.code})...`);
        const xml = await this.fetchPage(url);
        const parsed = this.parseRSS(xml, cat.label);

        let newCount = 0;
        for (const ev of parsed) {
          if (!allEvents.has(ev.source_id)) {
            allEvents.set(ev.source_id, ev);
            newCount++;
          }
        }

        this.log(`  ${cat.label}: ${parsed.length} geparst, ${newCount} neu (gesamt: ${allEvents.size})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`  ${cat.label}: FEHLER - ${msg}`);
      }

      await this.rateLimit();
    }

    this.log(`Wien OGD scrape complete: ${allEvents.size} unique events`);
    return Array.from(allEvents.values());
  }

  private parseRSS(xml: string, vadbCategory: string): ScrapedEvent[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    const events: ScrapedEvent[] = [];

    $('item').each((_, el) => {
      try {
        const title = $('title', el).first().text().trim();
        if (!title) return;

        const link = $('link', el).first().text().trim()
          || $('link', el).first().next().text().trim();
        const description = $('description', el).first().text().trim();
        const guid = $('guid', el).first().text().trim() || link;

        // Date fields
        const startRaw = $('vadb\\:startdate', el).first().text().trim()
          || $('[localName="startdate"]', el).first().text().trim();
        const endRaw = $('vadb\\:enddate', el).first().text().trim()
          || $('[localName="enddate"]', el).first().text().trim();
        const timeRaw = $('vadb\\:time', el).first().text().trim()
          || $('[localName="time"]', el).first().text().trim();

        const pubDate = $('pubDate', el).first().text().trim();

        let startDate = '';
        if (startRaw) {
          const withTime = timeRaw ? `${startRaw} ${timeRaw}` : startRaw;
          startDate = this.parseGermanDate(withTime) || '';
        }
        if (!startDate && pubDate) {
          try {
            startDate = new Date(pubDate).toISOString().slice(0, 10);
          } catch { /* skip */ }
        }
        if (!startDate) return;

        const endDate = endRaw ? this.parseGermanDate(endRaw) || undefined : undefined;

        // Location
        const locationRaw = $('vadb\\:location', el).first().text().trim()
          || $('[localName="location"]', el).first().text().trim();
        const addressRaw = $('vadb\\:address', el).first().text().trim()
          || $('[localName="address"]', el).first().text().trim();
        const bezirkRaw = $('vadb\\:bezirk', el).first().text().trim()
          || $('[localName="bezirk"]', el).first().text().trim();

        // Image
        const imageRaw = $('vadb\\:image', el).first().text().trim()
          || $('[localName="image"]', el).first().text().trim()
          || $('enclosure', el).first().attr('url') || '';
        const imageUrl = imageRaw ? this.cleanImageUrl(imageRaw) : undefined;

        // Organizer
        const organizer = $('vadb\\:organizer', el).first().text().trim()
          || $('[localName="organizer"]', el).first().text().trim() || undefined;

        // Price
        const priceRaw = $('vadb\\:price', el).first().text().trim()
          || $('[localName="price"]', el).first().text().trim() || undefined;

        // Tags
        const catRaw = $('category', el).first().text().trim();
        const tags = [vadbCategory];
        if (catRaw && catRaw !== vadbCategory) tags.push(catRaw);

        const category = categorizeEvent(title, description, tags);

        // Deterministic source_id using guid
        const sourceId = `wien-ogd-${guid.replace(/\W+/g, '-').slice(-60)}`;

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: link || 'https://www.wien.gv.at/veranstaltungen/',
          title,
          description: description || undefined,
          start_date: startDate,
          end_date: endDate,
          location_name: locationRaw || 'Wien',
          address: addressRaw || undefined,
          bundesland: 'Wien',
          // Wien center — geocoding happens in the pipeline
          latitude: 48.2082,
          longitude: 16.3738,
          category,
          price_text: priceRaw,
          image_url: imageUrl,
          organizer,
          tags,
        });
      } catch (err) {
        this.log(`Fehler beim Parsen: ${err}`);
      }
    });

    return events;
  }
}
