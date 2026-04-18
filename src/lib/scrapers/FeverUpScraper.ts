import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import { getSharedBrowser } from './puppeteerBrowser';
import type { ScrapedEvent } from '@/types/events';

/**
 * Fever (feverup.com) Scraper
 * React SPA — uses Puppeteer to intercept API calls for event data.
 * Covers Wien experiences: Candlelight concerts, immersive events, etc.
 */
export class FeverUpScraper extends BaseScraper {
  readonly name = 'feverup';
  private readonly URL = 'https://feverup.com/de/wien';

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte Fever Wien Scraping via Puppeteer...');

    try {
      const browser = await getSharedBrowser();
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

      // Collect API responses
      const apiResponses: unknown[] = [];
      page.on('response', async (res) => {
        const url = res.url();
        if ((url.includes('/api/') || url.includes('graphql') || url.includes('plans')) && res.status() === 200) {
          try {
            const contentType = res.headers()['content-type'] || '';
            if (contentType.includes('json')) {
              const data = await res.json();
              apiResponses.push(data);
            }
          } catch {}
        }
      });

      await page.goto(this.URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.sleep(5000);

      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        window.scrollBy(0, 2000);
      });
      await this.sleep(3000);

      // Fallback: scrape from rendered DOM if no API data
      const events = await page.evaluate(() => {
        const items: Array<{
          title: string;
          url: string;
          image: string;
          date: string;
          price: string;
          venue: string;
        }> = [];

        // Try to find event cards in the DOM
        const cards = document.querySelectorAll('a[href*="/plan/"], a[href*="/experience/"], [data-testid*="event"], .event-card, article');
        cards.forEach(card => {
          const link = card instanceof HTMLAnchorElement ? card : card.querySelector('a');
          if (!link) return;

          const href = link.href || link.getAttribute('href') || '';
          if (!href.includes('feverup.com') && !href.startsWith('/')) return;

          const titleEl = card.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');
          const title = titleEl?.textContent?.trim() || '';
          if (!title || title.length < 3) return;

          const imgEl = card.querySelector('img');
          const image = imgEl?.src || imgEl?.getAttribute('data-src') || '';

          const dateEl = card.querySelector('[class*="date"], time, [class*="when"]');
          const date = dateEl?.textContent?.trim() || '';

          const priceEl = card.querySelector('[class*="price"], [class*="cost"]');
          const price = priceEl?.textContent?.trim() || '';

          const venueEl = card.querySelector('[class*="venue"], [class*="location"]');
          const venue = venueEl?.textContent?.trim() || '';

          items.push({ title, url: href, image, date, price, venue });
        });

        return items;
      });

      await page.close();

      const scrapedEvents: ScrapedEvent[] = [];
      const seen = new Set<string>();

      for (const ev of events) {
        const slug = ev.url.replace(/.*\//, '').replace(/[?#].*/, '') || ev.title.toLowerCase().replace(/\W+/g, '-');
        if (seen.has(slug)) continue;
        seen.add(slug);

        const startDate = this.parseFeverDate(ev.date);
        if (!startDate) continue;

        const sourceUrl = ev.url.startsWith('http') ? ev.url : `https://feverup.com${ev.url}`;

        scrapedEvents.push({
          source_id: `feverup-${slug}`,
          source_name: this.name,
          source_url: sourceUrl,
          title: ev.title,
          start_date: startDate,
          location_name: ev.venue || 'Wien',
          latitude: 48.2082,
          longitude: 16.3738,
          bundesland: 'wien',
          category: categorizeEvent(ev.title),
          image_url: ev.image || undefined,
          price_text: ev.price || undefined,
        });
      }

      this.log(`${scrapedEvents.length} Events gescrapt`);
      return scrapedEvents;
    } catch (err) {
      this.log(`Puppeteer fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private parseFeverDate(text: string): string | null {
    if (!text) return null;

    // Various formats: "Mar 27", "27 Mar 2026", "27.03.2026"
    const MONTHS: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mar': '03', 'mär': '03', 'apr': '04',
      'may': '05', 'mai': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'okt': '10', 'nov': '11', 'dec': '12', 'dez': '12',
    };

    // "Mar 27" or "Mar 27, 2026"
    const m1 = text.match(/([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (m1) {
      const [, month, day, year] = m1;
      const mo = MONTHS[month.toLowerCase().slice(0, 3)];
      if (mo) {
        const y = year || new Date().getFullYear().toString();
        return `${y}-${mo}-${day.padStart(2, '0')}`;
      }
    }

    // "27 Mar 2026"
    const m2 = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (m2) {
      const [, day, month, year] = m2;
      const mo = MONTHS[month.toLowerCase().slice(0, 3)];
      if (mo) return `${year}-${mo}-${day.padStart(2, '0')}`;
    }

    // "27.03.2026"
    const m3 = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m3) {
      const [, day, mo, year] = m3;
      return `${year}-${mo.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }
}
