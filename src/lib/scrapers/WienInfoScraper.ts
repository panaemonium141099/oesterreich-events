import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categories';
import { geocodeLocation } from '../geocoding';
import { getSharedBrowser } from './puppeteerBrowser';
import type { ScrapedEvent } from '@/types/events';

/**
 * wien.info Official Tourism Scraper
 * Dynamic content loading — uses Puppeteer.
 * High-quality Wien event data from official tourism portal.
 */
export class WienInfoScraper extends BaseScraper {
  readonly name = 'wien.info';
  private readonly URL = 'https://www.wien.info/de/aktuell/veranstaltungen';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte wien.info Scraping via Puppeteer...');

    try {
      const browser = await getSharedBrowser();
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

      // Try to find and intercept API calls
      const apiData: unknown[] = [];
      page.on('response', async (res) => {
        const url = res.url();
        if ((url.includes('api') || url.includes('veranstaltungen') || url.includes('events')) && res.status() === 200) {
          try {
            const contentType = res.headers()['content-type'] || '';
            if (contentType.includes('json')) {
              const data = await res.json();
              apiData.push(data);
            }
          } catch {}
        }
      });

      await page.goto(this.URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.sleep(5000);

      // Scroll to load more events
      for (let i = 0; i < 8; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await this.sleep(1500);
      }

      // Click "Mehr laden" button if present
      try {
        const moreButton = await page.$('button[class*="more"], a[class*="more"], [class*="load-more"]');
        if (moreButton) {
          for (let i = 0; i < 5; i++) {
            await moreButton.click();
            await this.sleep(2000);
          }
        }
      } catch {}

      // Extract events from rendered DOM
      const events = await page.evaluate(() => {
        const items: Array<{
          title: string;
          url: string;
          image: string;
          date: string;
          venue: string;
          description: string;
        }> = [];

        // wien.info uses tile components for events
        const selectors = [
          '.tile_link', 'a[href*="/veranstaltungen/"]', 'a[href*="/event/"]',
          '.event-card', '.event-item', 'article', '.teaser',
          '[class*="tile"]', '[class*="card"]',
        ];

        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(el => {
            const link = el instanceof HTMLAnchorElement ? el : el.querySelector('a');
            const href = link?.href || link?.getAttribute('href') || '';
            if (!href || href === '#') return;

            const title = el.querySelector('h2, h3, h4, [class*="title"]')?.textContent?.trim() || '';
            if (!title || title.length < 3) return;

            const imgEl = el.querySelector('img');
            const image = imgEl?.src || imgEl?.getAttribute('data-src') || '';

            const dateEl = el.querySelector('[class*="date"], time, [class*="when"]');
            const date = dateEl?.textContent?.trim() || '';

            const venueEl = el.querySelector('[class*="location"], [class*="venue"], address');
            const venue = venueEl?.textContent?.trim() || '';

            const descEl = el.querySelector('p, [class*="desc"], [class*="text"]');
            const description = descEl?.textContent?.trim()?.slice(0, 300) || '';

            items.push({ title, url: href, image, date, venue, description });
          });

          if (items.length > 5) break;
        }

        return items;
      });

      await page.close();

      const scrapedEvents: ScrapedEvent[] = [];
      const seen = new Set<string>();

      for (const ev of events) {
        const slug = ev.url.replace(/.*\//, '').replace(/[?#].*/, '')
          || ev.title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        if (seen.has(slug)) continue;
        seen.add(slug);

        const startDate = this.parseDate(ev.date);
        if (!startDate) continue;

        const sourceUrl = ev.url.startsWith('http') ? ev.url : `https://www.wien.info${ev.url}`;

        scrapedEvents.push({
          source_id: `wien-info-${slug}`,
          source_name: this.name,
          source_url: sourceUrl,
          title: ev.title,
          description: ev.description || undefined,
          start_date: startDate,
          location_name: ev.venue || 'Wien',
          latitude: 48.2082,
          longitude: 16.3738,
          bundesland: 'wien',
          category: categorizeEvent(ev.title, ev.description),
          image_url: ev.image || undefined,
        });
      }

      // Geocode venues
      const venueCache = new Map<string, { lat: number; lon: number } | null>();
      for (const ev of scrapedEvents) {
        const key = ev.location_name || '';
        if (!key || key === 'Wien') continue;
        if (!venueCache.has(key)) {
          const coords = await geocodeLocation(`${key}, Wien`, 'Wien, Austria');
          venueCache.set(key, coords ? { lat: coords.latitude, lon: coords.longitude } : null);
          await this.sleep(1100);
        }
        const c = venueCache.get(key);
        if (c) {
          ev.latitude = c.lat;
          ev.longitude = c.lon;
        }
      }

      this.log(`${scrapedEvents.length} Events gescrapt, ${venueCache.size} Venues geocodiert`);
      return scrapedEvents;
    } catch (err) {
      this.log(`Puppeteer fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private parseDate(text: string): string | null {
    if (!text) return null;

    const MONTHS: Record<string, string> = {
      'jänner': '01', 'januar': '01', 'februar': '02', 'märz': '03',
      'april': '04', 'mai': '05', 'juni': '06', 'juli': '07',
      'august': '08', 'september': '09', 'oktober': '10',
      'november': '11', 'dezember': '12',
      'jan': '01', 'feb': '02', 'mär': '03', 'apr': '04',
      'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09',
      'okt': '10', 'nov': '11', 'dez': '12',
    };

    // "28.03.2026"
    const n = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (n) return `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`;

    // "28. März 2026"
    const m = text.match(/(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})/);
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
    }

    // ISO
    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];

    return null;
  }
}
