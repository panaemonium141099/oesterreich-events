import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import { geocodeLocation } from '../geocoding';
import type { ScrapedEvent } from '@/types/events';

/**
 * Wien VADB (Veranstaltungsdatenbank) RSS Scraper
 * Uses the official Wien city events RSS feed with up to 500 events per query.
 * Ref: https://digitales.wien.gv.at/beschreibung-des-rss-feeds-fuer-die-wien-at-veranstaltungsdatenbank/
 */
export class WienVADBScraper extends BaseScraper {
  readonly name = 'wien-vadb';
  private readonly BASE_URL = 'https://www.wien.gv.at/vadb/internet/AdvPrSrv.asp';

  private formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  }

  /** Parse German date string "DD.MM.YYYY [HH:MM]" → ISO string */
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

  private buildUrl(from: Date, to: Date): string {
    const params = new URLSearchParams({
      Layout: 'rss-vadb_neu',
      Type: 'R',
      GANZJAEHRIG: 'ja',
      hmwd: 'd',
      'vie_range-from': this.formatDate(from),
      'vie_range-to': this.formatDate(to),
      SrvRecCnt: '500',
    });
    return `${this.BASE_URL}?${params.toString()}`;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Wien VADB RSS Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    // Fetch in 3-month windows up to 9 months ahead
    const windows = 3;
    const windowMonths = 3;
    const now = new Date();

    for (let i = 0; i < windows; i++) {
      const from = new Date(now);
      from.setMonth(from.getMonth() + i * windowMonths);
      const to = new Date(from);
      to.setMonth(to.getMonth() + windowMonths);

      try {
        const url = this.buildUrl(from, to);
        this.log(`Fenster ${i + 1}/${windows}: ${this.formatDate(from)} – ${this.formatDate(to)}`);
        const xml = await this.fetchPage(url);
        const parsed = this.parseRSS(xml);
        for (const ev of parsed) {
          allEvents.set(ev.source_id, ev);
        }
        this.log(`  → ${parsed.length} Events geparst (gesamt: ${allEvents.size})`);
      } catch (err) {
        this.log(`Fenster ${i + 1} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }

      await this.rateLimit();
    }

    // Geocode events without coordinates
    const events = Array.from(allEvents.values());
    let geocoded = 0;
    for (const ev of events) {
      if (!ev.latitude && ev.address) {
        const coords = await geocodeLocation(ev.address, 'Wien, Austria');
        if (coords) {
          ev.latitude = coords.latitude;
          ev.longitude = coords.longitude;
          geocoded++;
        }
        await this.sleep(1100); // Nominatim rate limit
      } else if (!ev.latitude && ev.location_name && ev.location_name !== 'Wien') {
        const coords = await geocodeLocation(ev.location_name + ', Wien', 'Wien, Austria');
        if (coords) {
          ev.latitude = coords.latitude;
          ev.longitude = coords.longitude;
          geocoded++;
        }
        await this.sleep(1100);
      }
    }

    this.log(`${events.length} Events total, ${geocoded} neu geocodiert`);
    return events;
  }

  private parseRSS(xml: string): ScrapedEvent[] {
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

        // Date fields — VADB uses custom "vadb:" namespace
        const startRaw = $('vadb\\:startdate', el).first().text().trim()
          || $('[localName="startdate"]', el).first().text().trim();
        const endRaw = $('vadb\\:enddate', el).first().text().trim()
          || $('[localName="enddate"]', el).first().text().trim();
        const timeRaw = $('vadb\\:time', el).first().text().trim()
          || $('[localName="time"]', el).first().text().trim();

        // Also try standard pubDate
        const pubDate = $('pubDate', el).first().text().trim();

        let startDate = '';
        if (startRaw) {
          const withTime = timeRaw ? `${startRaw} ${timeRaw}` : startRaw;
          startDate = this.parseGermanDate(withTime) || '';
        }
        if (!startDate && pubDate) {
          // pubDate is RFC2822 format
          try {
            startDate = new Date(pubDate).toISOString().slice(0, 10);
          } catch { /* skip */ }
        }
        if (!startDate) return; // Skip events without date

        const endDate = endRaw ? this.parseGermanDate(endRaw) || undefined : undefined;

        // Location
        const locationRaw = $('vadb\\:location', el).first().text().trim()
          || $('[localName="location"]', el).first().text().trim();
        const addressRaw = $('vadb\\:address', el).first().text().trim()
          || $('[localName="address"]', el).first().text().trim();
        const bezirkRaw = $('vadb\\:bezirk', el).first().text().trim()
          || $('[localName="bezirk"]', el).first().text().trim();
        const districtNum = bezirkRaw ? bezirkRaw.replace(/\D/g, '') : '';
        const district = districtNum ? `${parseInt(districtNum, 10).toString().padStart(2, '0')}. Bezirk` : undefined;

        // Category
        const catRaw = $('category', el).first().text().trim();
        const tags = catRaw ? [catRaw] : [];

        // Image
        const imageRaw = $('vadb\\:image', el).first().text().trim()
          || $('[localName="image"]', el).first().text().trim()
          || $('enclosure', el).first().attr('url') || '';
        const imageUrl = imageRaw || undefined;

        // Organizer
        const organizer = $('vadb\\:organizer', el).first().text().trim()
          || $('[localName="organizer"]', el).first().text().trim() || undefined;

        const sourceId = `wien-vadb-${guid.replace(/\W+/g, '-').slice(-60)}`;

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
          district,
          // Wien center as fallback — will be replaced by geocoding above
          latitude: 48.2082,
          longitude: 16.3738,
          category: categorizeEvent(title, description, tags),
          image_url: imageUrl,
          organizer,
          tags,
          bundesland: 'wien',
        });
      } catch (err) {
        this.log(`Fehler beim Parsen eines Items: ${err}`);
      }
    });

    return events;
  }
}
