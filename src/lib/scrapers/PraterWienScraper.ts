import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { getSharedBrowser } from './puppeteerBrowser';
import type { ScrapedEvent } from '@/types/events';

/**
 * Prater Wien Scraper
 * AJAX-based content loading — uses Puppeteer.
 * Fixed location: Prater, 1020 Wien.
 */
export class PraterWienScraper extends BaseScraper {
  readonly name = 'praterwien';
  private readonly URL = 'https://www.praterwien.com/veranstaltungen/aktuelle-veranstaltungen';
  private readonly LAT = 48.2166;
  private readonly LNG = 16.3964;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Prater Wien Scraping via Puppeteer...');

    try {
      const browser = await getSharedBrowser();
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

      await page.goto(this.URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.sleep(3000);

      // Scroll to trigger lazy loading of AJAX content
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await this.sleep(1500);
      }

      const events = await page.evaluate(() => {
        const items: Array<{
          title: string;
          url: string;
          image: string;
          date: string;
          location: string;
        }> = [];

        // Try multiple selector strategies
        const selectors = [
          '.event-item', '.event', 'article', '.teaser',
          '[class*="event"]', '.content-item', '.list-item',
          'a[href*="veranstaltung"]', 'a[href*="event"]',
        ];

        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(card => {
            const link = card instanceof HTMLAnchorElement ? card : card.querySelector('a');
            const title = card.querySelector('h2, h3, h4, .title')?.textContent?.trim() || link?.textContent?.trim() || '';
            if (!title || title.length < 3) return;

            const href = link?.href || link?.getAttribute('href') || '';
            const imgEl = card.querySelector('img');
            const image = imgEl?.src || imgEl?.getAttribute('data-src') || '';
            const dateEl = card.querySelector('.date, time, [class*="date"]');
            const date = dateEl?.textContent?.trim() || '';
            const locEl = card.querySelector('.location, [class*="location"]');
            const location = locEl?.textContent?.trim() || '';

            if (title.length > 3) {
              items.push({ title, url: href, image, date, location });
            }
          });
          if (items.length > 0) break;
        }

        return items;
      });

      await page.close();

      const scrapedEvents: ScrapedEvent[] = [];
      const seen = new Set<string>();

      for (const ev of events) {
        const slug = ev.title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        if (seen.has(slug)) continue;
        seen.add(slug);

        const startDate = this.parseDate(ev.date);
        if (!startDate) continue;

        scrapedEvents.push({
          source_id: `praterwien-${slug}`,
          source_name: this.name,
          source_url: ev.url || this.URL,
          title: ev.title,
          start_date: startDate,
          location_name: ev.location || 'Wiener Prater',
          address: 'Prater, 1020 Wien',
          postal_code: '1020',
          bundesland: 'wien',
          district: '2. Leopoldstadt',
          latitude: this.LAT,
          longitude: this.LNG,
          category: categorizeEvent(ev.title) || 'Familie',
          image_url: ev.image || undefined,
        });
      }

      this.log(`${scrapedEvents.length} Events gescrapt`);
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

    return null;
  }
}
