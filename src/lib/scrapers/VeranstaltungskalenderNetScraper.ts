import * as cheerio from 'cheerio';
import { BaseScraper } from './BaseScraper';
import { categorizeEvent } from '../categorize';
import type { ScrapedEvent } from '@/types/events';

/**
 * Letzte Listenseite laut Pager auf Seite 1 (`a.icon-last`, Ziel
 * `?seite=319`). Ohne diesen Link (nur eine Seite oder geändertes Markup)
 * null: dann endet die Liste an zwei leeren Seiten in Folge.
 */
export function lastListPage(html: string): number | null {
  const href = cheerio.load(html)('a.icon-last').first().attr('href') ?? '';
  const m = href.match(/[?&]seite=(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * veranstaltungskalender.net Scraper
 * Alle Bundesländer außer Burgenland, SSR-Listen mit ?seite=N.
 *
 * Seitenfolge: Eine Listenseite zeigt nur 1 bis 4 Einträge, chronologisch.
 * Am 2026-10-14 hatte die Quelle 1.593 Listenseiten (OÖ 447, Wien 330,
 * NÖ 237, Stmk 208, Sbg 124, Tirol 103, Ktn 82, Vbg 62). Bis dahin brach
 * der Scraper je Bundesland bei 200 Seiten ab: Wiener Termine ab Dezember
 * und OÖ ab Ende November kamen nie an, und die Wiener Gutscheine mit
 * Datum 31.12.2037 (Seite ~290 bis 325) wurden seit Juli nicht mehr
 * geliefert. Dadurch blieben sie veröffentlicht, obwohl die Quarantäne
 * `start_too_far_ahead` sie beim nächsten Upsert zurückhält.
 *
 * Jetzt endet jede Liste an der letzten Seite, die ihr Pager auf Seite 1
 * nennt. Die Bundesländer werden im Wechsel gelesen (Seite n aller Listen
 * vor Seite n+1), und ein Zeitbudget unter dem harten Timeout
 * (SCRAPER_TIMEOUT_OVERRIDES_MIN in index.ts) liefert ein Teilergebnis,
 * statt alles zu verlieren. Reicht das Budget einmal nicht, fehlen so nur
 * die fernsten Termine jeder Liste, nicht ein ganzes Bundesland.
 *
 * HTML structure (confirmed March 2026):
 *   div.global_listeneintrag
 *     a[href="...detail.html"]
 *       div.image_block > img
 *       div.text_block
 *         h2.eintrag_titel[itemprop="name"]
 *         div.ver_zeit  (date/time)
 *         div[itemprop="location"]
 *           span[itemprop="name"] > b  (venue name)
 *           div[itemprop="address"]
 *             span[itemprop="postalCode"]
 *             span[itemprop="addressLocality"]
 *             span[itemprop="streetAddress"]
 *         div.beschreibung[itemprop="description"]
 */
export class VeranstaltungskalenderNetScraper extends BaseScraper {
  readonly name = 'veranstaltungskalender.net';
  private readonly BASE = 'https://www.veranstaltungskalender.net';
  /** Nur Schutz gegen einen kaputten Pager, keine Abdeckungsgrenze. */
  static readonly PAGE_CAP = 2000;
  /** Pause zwischen zwei Abrufen; ein Abruf dauert inkl. Pause ~1 s. */
  static readonly PAGE_DELAY_MS = 800;
  /**
   * Zeitbudget für das Lesen der Listen. Ein voller Durchlauf brauchte
   * am 2026-10-14 etwa 26 min (1.593 Seiten zu ~0,98 s, gemessen an
   * source_runs: 1.150 s für 1.171 Seiten). Muss mit Sync-Phase unter dem
   * harten Timeout bleiben (veranstaltungskalender-net-pages.test.ts).
   */
  static readonly BUDGET_MIN = 38;

  private readonly REGIONS = [
    { path: '/oberoesterreich/', bundesland: 'oberoesterreich' },
    { path: '/steiermark/', bundesland: 'steiermark' },
    { path: '/niederoesterreich/', bundesland: 'niederoesterreich' },
    { path: '/salzburg/', bundesland: 'salzburg' },
    { path: '/kaernten/', bundesland: 'kaernten' },
    { path: '/tirol/', bundesland: 'tirol' },
    { path: '/vorarlberg/', bundesland: 'vorarlberg' },
    { path: '/wien/', bundesland: 'wien' },
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.log('Starte veranstaltungskalender.net Scraping (alle Bundesländer)...');
    const allEvents = new Map<string, ScrapedEvent>();
    const deadline = Date.now() + VeranstaltungskalenderNetScraper.BUDGET_MIN * 60_000;
    const lists = this.REGIONS.map(region => ({
      ...region,
      lastPage: VeranstaltungskalenderNetScraper.PAGE_CAP,
      read: 0,
      misses: 0,
      done: false,
    }));

    let outOfBudget = false;
    for (let page = 1; page <= VeranstaltungskalenderNetScraper.PAGE_CAP && !outOfBudget; page++) {
      for (const list of lists) {
        if (list.done) continue;
        if (page > list.lastPage) {
          list.done = true;
          continue;
        }
        if (Date.now() >= deadline) {
          outOfBudget = true;
          break;
        }
        const url = page === 1
          ? `${this.BASE}${list.path}`
          : `${this.BASE}${list.path}?seite=${page}`;

        try {
          const html = await this.fetchPage(url);
          if (page === 1) {
            list.lastPage = Math.min(
              lastListPage(html) ?? VeranstaltungskalenderNetScraper.PAGE_CAP,
              VeranstaltungskalenderNetScraper.PAGE_CAP,
            );
          }
          list.read = page;
          const { listed, events } = this.parsePage(html, list.bundesland);
          for (const ev of events) allEvents.set(ev.source_id, ev);

          // Zwei Seiten ohne Eintrag oder Fehler in Folge beenden die Liste
          // vor der Pager-Grenze (Liste inzwischen kürzer oder Seite kaputt).
          // Gezählt wird, was die Seite listet, nicht was der Parser nimmt:
          // Wien Seite 228 bis 231 zeigte nur einen Titel über 200 Zeichen.
          if (listed === 0) {
            if (++list.misses >= 2) list.done = true;
          } else {
            list.misses = 0;
          }

          if (page % 50 === 0) {
            this.log(`${list.bundesland} Seite ${page}/${list.lastPage} (gesamt: ${allEvents.size})`);
          }
        } catch (err) {
          this.log(`${list.bundesland} Seite ${page} fehler: ${err instanceof Error ? err.message : err}`);
          if (++list.misses >= 2) list.done = true;
        }
        await this.sleep(VeranstaltungskalenderNetScraper.PAGE_DELAY_MS);
      }
    }

    for (const list of lists) {
      this.log(`${list.bundesland}: Seite ${list.read} von ${list.lastPage}`);
    }
    if (outOfBudget) {
      this.log(`Zeitbudget ${VeranstaltungskalenderNetScraper.BUDGET_MIN} min erreicht, Teilergebnis`);
    }
    const events = Array.from(allEvents.values());
    this.log(`${events.length} Events gescrapt`);
    return events;
  }

  /** `listed`: Einträge der Seite ohne Werbung, auch die verworfenen. */
  private parsePage(html: string, bundesland: string): { listed: number; events: ScrapedEvent[] } {
    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];
    let listed = 0;

    // Each event is inside div.global_listeneintrag
    $('div.global_listeneintrag').each((_, el) => {
      try {
        const $container = $(el);

        // Skip ad containers (they have a child div.werbung_*)
        if ($container.find('[class*="werbung"]').length > 0) return;

        // The event link wraps everything inside the container
        const $link = $container.find('a[href$=".html"]').first();
        if (!$link.length) return;

        const href = $link.attr('href') || '';
        listed++;

        // Title from h2.eintrag_titel
        const title = $container.find('h2.eintrag_titel').first().text().trim();
        if (!title || title.length < 3 || title.length > 200) return;

        // Date from div.ver_zeit
        const dateText = $container.find('.ver_zeit').first().text().trim();
        if (!dateText) return;

        // Parse date — formats:
        //   "So 29.03.2026, von 10:00 bis 13:00 Uhr"
        //   "Sa 28.03.2026 10:00 Uhr, bis So 29.03.2026 17:00"
        //   "Mi 01.04.2026, 19:30 Uhr"
        const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (!dateMatch) return;

        let year = dateMatch[3];
        if (year.length === 2) year = `20${year}`;
        const startDate = `${year}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;

        // Skip past events
        const eventDate = new Date(startDate);
        if (eventDate < new Date('2025-01-01')) return;

        // End date (for multi-day events: "bis So 29.03.2026")
        let endDate: string | undefined;
        const endDateMatch = dateText.match(/bis\s+\w+\s+(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
        if (endDateMatch) {
          let endYear = endDateMatch[3];
          if (endYear.length === 2) endYear = `20${endYear}`;
          endDate = `${endYear}-${endDateMatch[2].padStart(2, '0')}-${endDateMatch[1].padStart(2, '0')}`;
        }

        // Time extraction — "von HH:MM" or standalone "HH:MM Uhr"
        const timeMatch = dateText.match(/(?:von\s+)?(\d{1,2}):(\d{2})(?:\s*(?:bis|Uhr))/);

        // End time
        const endTimeMatch = dateText.match(/bis\s+(\d{1,2}):(\d{2})\s*Uhr/);

        // Postal code from schema.org itemprop
        const postalCode = $container.find('[itemprop="postalCode"]').first().text().trim() || undefined;

        // Locality
        const locality = $container.find('[itemprop="addressLocality"]').first().text().trim() || undefined;

        // Street address
        const street = $container.find('[itemprop="streetAddress"]').first().text().trim() || undefined;

        // Build full address
        let address: string | undefined;
        if (postalCode || locality || street) {
          const parts: string[] = [];
          if (postalCode) parts.push(postalCode);
          if (locality) parts.push(locality);
          if (street) parts.push(street);
          address = parts.join(' ');
        }

        // Venue / location name
        const locationName = $container.find('[itemprop="location"] [itemprop="name"]').first().text().trim() || undefined;

        // Description
        const description = $container.find('.beschreibung').first().text().trim() || undefined;

        // Image
        const $img = $container.find('.image_block img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        const imageUrl = this.cleanImageUrl(
          imgSrc.startsWith('http') ? imgSrc : (imgSrc ? `${this.BASE}${imgSrc}` : undefined)
        );

        // Build source URL
        const sourceUrl = href.startsWith('http') ? href : `${this.BASE}${href}`;

        // Extract unique event ID from URL (e.g., "osterbrunch-796089.html" -> "796089")
        const idMatch = href.match(/(\d+)\.html$/);
        const eventId = idMatch ? idMatch[1] : title.toLowerCase().replace(/\W+/g, '-').slice(0, 60);
        const sourceId = `vknet-${eventId}`;

        // Format start datetime
        let startDateTime = startDate;
        if (timeMatch) {
          startDateTime = `${startDate}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00`;
        }

        // Format end datetime
        let endDateTime: string | undefined;
        if (endDate && endTimeMatch) {
          endDateTime = `${endDate}T${endTimeMatch[1].padStart(2, '0')}:${endTimeMatch[2]}:00`;
        } else if (!endDate && endTimeMatch) {
          endDateTime = `${startDate}T${endTimeMatch[1].padStart(2, '0')}:${endTimeMatch[2]}:00`;
        } else if (endDate) {
          endDateTime = endDate;
        }

        events.push({
          source_id: sourceId,
          source_name: this.name,
          source_url: sourceUrl,
          title,
          description,
          start_date: startDateTime,
          end_date: endDateTime,
          location_name: locationName,
          address,
          postal_code: postalCode,
          bundesland,
          category: categorizeEvent(title + (description ? ` ${description}` : '')),
          image_url: imageUrl,
        });
      } catch { /* skip malformed entry */ }
    });

    return { listed, events };
  }
}
