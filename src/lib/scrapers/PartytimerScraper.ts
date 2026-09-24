import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * PartyTimer.at Scraper
 * Laravel Livewire framework but SSR — initial data is in HTML.
 * Pagination via ?page=N. Primarily Wien nightlife/party events.
 */
export class PartytimerScraper extends BaseScraper {
  readonly name = 'partytimer';
  private readonly BASE = 'https://www.partytimer.at';
  private readonly MAX_PAGES = 20;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte PartyTimer Wien Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();
    let emptyCount = 0;

    for (let pg = 1; pg <= this.MAX_PAGES; pg++) {
      const url = pg === 1 ? `${this.BASE}/events` : `${this.BASE}/events?page=${pg}`;
      try {
        const html = await this.fetchPage(url);
        const events = this.parsePage(html);

        if (events.length === 0) {
          emptyCount++;
          if (emptyCount >= 2) {
            this.log(`${emptyCount} leere Seiten, stoppe.`);
            break;
          }
        } else {
          emptyCount = 0;
          for (const ev of events) {
            allEvents.set(ev.source_id, ev);
          }
        }

        this.log(`Seite ${pg}: ${events.length} Events (gesamt: ${allEvents.size})`);
        await this.rateLimit();
      } catch (err) {
        this.log(`Seite ${pg} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
        emptyCount++;
        if (emptyCount >= 2) break;
      }
    }

    // Koordinaten liefert nicht der Scraper: Adressen geocodiert die Pipeline
    // strukturiert (geocode-addresses.ts), Namenssuche gibt es bewusst nicht.
    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  /**
   * Jede Karte ist selbst ein `<a href=".../events/{id}">`. Titel steht im
   * `font-display`-Block, darüber die Badges ("Event", Genre, "Empfohlen"),
   * darunter Datum ("Do 24.9."), Uhrzeit ("17:00 Uhr") und "Venue, PLZ Ort".
   * Nie aus dem Linktext oder einem umgebenden Container lesen: der Linktext
   * beginnt mit den Badges ("Event Pop / Rock …") und der Container ist die
   * ganze Liste.
   */
  parsePage(html: string, now: Date = new Date()): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('a[href*="/events/"]').each((_, el) => {
      const $card = $(el);
      const href = $card.attr('href') || '';

      // Must be event detail: /events/{numeric-id}
      const idMatch = href.match(/\/events\/(\d+)(?:[/?#]|$)/);
      if (!idMatch) return;
      const eventId = idMatch[1];

      // Ohne echten Namen kein Event (sonst landet "Event Pop / Rock" als Titel).
      const title = this.clean($card.find('.font-display').first().text());
      if (!title || title.length < 3) return;

      const cardText = this.clean($card.text());
      if (/\babgesagt\b/i.test(cardText)) return;

      const $date = $card.find('p.font-bold').first();
      const dateText = this.clean($date.text());
      const timeText = this.clean($date.parent().text());
      const startDate = this.parseDate(dateText, timeText, now);
      if (!startDate) return;

      const badges = $card.find('[class*="badge"]').map((_, b) => this.clean($(b).text())).get();
      const genre = badges.find(b => b !== 'Event' && b !== 'Empfohlen');

      const subtitle = this.clean($card.find('.font-display').first().nextAll('p').first().text()) || undefined;

      // Ortszeile: letzter Block der Karte, "Venue, 1120 Wien"
      let venue: string | undefined;
      let postalCode: string | undefined;
      let city: string | undefined;
      const locText = this.clean($card.find('div.flex-row').last().children('div').last().text());
      const locMatch = locText.match(/^(.*?),\s*(\d{4})\s+(.+)$/);
      if (locMatch) {
        venue = locMatch[1].trim() || undefined;
        postalCode = locMatch[2];
        city = locMatch[3].trim();
      } else if (locText) {
        venue = locText;
      }

      let imageUrl: string | undefined;
      const imgSrc = ($card.find('img').first().attr('src') || '').trim();
      if (imgSrc && !imgSrc.startsWith('data:')) {
        const resolved = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;
        imageUrl = this.cleanImageUrl(resolved);
      }

      const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

      events.push({
        source_id: `partytimer-${eventId}`,
        source_name: this.name,
        source_url: sourceUrl,
        title,
        description: subtitle,
        start_date: startDate,
        location_name: venue || city || 'Wien',
        city,
        postal_code: postalCode,
        bundesland: 'wien',
        category: categorizeEvent(title, subtitle, genre ? [genre] : undefined),
        image_url: imageUrl,
      });
    });

    return events;
  }

  private clean(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * "Do 24.9." (+ "17:00 Uhr") → Wiener Wandzeit "2026-09-24T17:00:00".
   * Ohne Jahr: laufendes Jahr, ab mehr als 60 Tagen Vergangenheit das nächste
   * (Dezember-Liste zeigt Jänner-Termine).
   */
  private parseDate(dateText: string, timeText: string, now: Date): string | null {
    const m = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;

    let year = m[3] ? Number(m[3]) : now.getFullYear();
    if (!m[3]) {
      const candidate = Date.UTC(year, month - 1, day);
      if (candidate < now.getTime() - 60 * 86_400_000) year++;
    }
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const t = timeText.match(/(\d{1,2}):(\d{2})\s*Uhr/);
    return t ? `${date}T${t[1].padStart(2, '0')}:${t[2]}:00` : date;
  }
}
