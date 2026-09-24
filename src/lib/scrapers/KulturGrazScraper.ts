import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';
import { cleanKulturGrazVenue } from './kultur-graz-venue';

/**
 * kultur.graz.at Scraper (Graz / Steiermark)
 * Kulturserver der Stadt Graz — SSR calendar with daily views.
 * 200-400 events/month, 10 categories, 70+ venues.
 * Uses /kalender/tag/YYYYMMDD for daily views.
 */
export class KulturGrazScraper extends BaseScraper {
  readonly name = 'kultur-graz';
  private readonly BASE = 'https://kultur.graz.at';
  private readonly DAYS_AHEAD = 60;

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte kultur.graz.at Scraping...');
    const allEvents = new Map<string, ScrapedEvent>();

    const today = new Date();

    // Scrape daily pages for the next N days
    for (let i = 0; i < this.DAYS_AHEAD; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const dateStr = this.formatDateForUrl(date);
      const url = `${this.BASE}/kalender/tag/${dateStr}`;
      const isoDate = this.formatIsoDate(date);

      try {
        const html = await this.fetchPage(url);
        const events = this.parseDayPage(html, isoDate);

        for (const ev of events) allEvents.set(ev.source_id, ev);

        if (i % 7 === 0) {
          this.log(`Tag ${dateStr}: ${events.length} Events (gesamt: ${allEvents.size})`);
        }

        await this.rateLimit();
      } catch (err) {
        this.log(`Tag ${dateStr} fehlgeschlagen: ${err instanceof Error ? err.message : err}`);
      }
    }

    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);

    if (events.length > 0) {
      const summary = await this.enrichFromDetail(events);
      this.log(`detail-enrich: ${JSON.stringify(summary)}`);
    }
    return events;
  }

  /**
   * Tagesseite parsen. Jeder Termin steht in der Eventliste als eigene Zeile:
   *
   *   <div class="kategorie show" data-ort="p.p.c" data-kategorie="Musik">
   *     <div class="truncatesmall">
   *       <span class="beginnzeit">19:00 Uhr </span>
   *       <b><a href="/kalender/event/1788769785">Black Sea Dahu</a></b>
   *       <span class="tag-ort"> - p.p.c</span> <span class="tag-kategorie"> - Musik</span>
   *     </div>
   *     <div class="showtexthover">…<img …-thumbnail.jpg>…</div>
   *   </div>
   *
   * Die Highlight-Karten oben auf der Seite wiederholen Termine der Liste
   * mit Label, Titel und Zeit in EINEM Link und werden übersprungen. Vorher
   * nahm der Parser den ersten Link je Event (oft die Karte) und riet den
   * Ort aus dem Zeilentext: heraus kamen „Eröffnung", „Beginnzeit nicht
   * bekannt" oder gar nichts, was die Pipeline dann mit „Graz" füllte.
   */
  parseDayPage(html: string, fallbackDate: string): ScrapedEvent[] {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    const seen = new Set<string>();

    $('.eventliste div.kategorie').each((_, el) => {
      try {
        const $row = $(el);
        const $link = $row.find('.truncatesmall a[href*="/kalender/event/"]').first();
        const href = $link.attr('href') || '';
        const idMatch = href.match(/\/kalender\/event\/(\d+)/);
        if (!idMatch) return;

        const eventId = idMatch[1];
        if (seen.has(eventId)) return;
        seen.add(eventId);

        const title = $link.text().replace(/\s+/g, ' ').trim();
        if (!title || title.length < 3) return;

        // „19:00 Uhr", „Beginnzeit nicht bekannt" oder „Ganztägig"
        const timeMatch = $row.find('.beginnzeit').first().text().match(/(\d{1,2}):(\d{2})\s*Uhr/);
        const startDate = timeMatch
          ? `${fallbackDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
          : fallbackDate;

        const locationName =
          cleanKulturGrazVenue($row.find('.tag-ort').first().text()) ??
          cleanKulturGrazVenue($row.attr('data-ort'));

        const categoryTag = $row.attr('data-kategorie')?.trim() || undefined;

        const imgSrc = $row.find('img').first().attr('src') || '';
        let imageUrl: string | undefined;
        if (imgSrc) {
          const fullImg = imgSrc.startsWith('http') ? imgSrc : `${this.BASE}${imgSrc}`;
          // Prefer large version
          imageUrl = this.cleanImageUrl(fullImg.replace('-thumbnail', '-large'));
        }

        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        events.push({
          source_id: `kultur-graz-${eventId}`,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          start_date: startDate,
          // fn-25 B3: Graz ist der Ortskontext, kein Ersatz-Venue.
          location_name: locationName,
          city: 'Graz',
          bundesland: 'steiermark',
          category: categorizeEvent(title, undefined, categoryTag ? [categoryTag] : undefined),
          image_url: imageUrl,
        });
      } catch { /* skip invalid entries */ }
    });

    return events;
  }

  private formatDateForUrl(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private formatIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
