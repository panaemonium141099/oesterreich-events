/**
 * DE-Adapter GeoCMS (fn-29 Rest-Adapter): liest je Registry-Seite der
 * Integration `geocms` die Terminliste ein Jahr ab heute seitenweise und je
 * Termin die Detailseite (Veranstaltungsort mit PLZ, Text, Ticket-Link).
 * Mehrere Gemeinden teilen eine Seite (VG Wethautal: sechs): die Liste wird
 * je Seite einmal gelesen, derselbe Termin einmal.
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import type { FeedGroup } from '@/lib/registry-de/load';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { isEt4Page, seitenGruppen } from './seiten-gruppen';
import { ownTown } from './DesklineDeScraper';
import { geocmsListUrl, geocmsPagerUrls, isGeocmsPage, parseGeocmsDetail, parseGeocmsList, toGeocmsTermin, type GeocmsDetail, type GeocmsRow, type GeocmsTermin } from './geocms';

/**
 * Höchstens so viele Listenseiten à 20 je Kalender und so viele Detailseiten;
 * nach drei Detailseiten in Folge ohne Antwort gilt die Website als
 * gedrosselt (Köthen: 46 Seiten in 78 min, Prüfstand 07.11.2026), die
 * übrigen Termine kommen ohne Adresse aus der Liste.
 */
const MAX_PAGES = 15;
const MAX_DETAILS = 80;
const MAX_FAILS_IN_ROW = 3;

export class GeocmsDeScraper extends DeFeedScraper {
  readonly name = 'de-geocms';
  readonly integrations = ['geocms'];
  private details = new Map<string, GeocmsDetail | null>();

  /** destination.one-Seiten unter GeoCMS (Saale-Unstrut) liest `de-destinationone`. */
  readsPage(url: string | null | undefined): boolean {
    return !isEt4Page(url);
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(seitenGruppen('geocms').filter(g => this.readsPage(g.pageUrl)));
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
    const all: ScrapedEvent[] = [];
    let withList = 0;
    for (const g of groups) await this.inCalendar(g, async () => {
      const rows = new Map<string, GeocmsRow>();
      const seen = new Set<string>();
      const queue = [geocmsListUrl(g.pageUrl, from, to)];
      let first = true;
      while (queue.length && seen.size < MAX_PAGES) {
        const url = queue.shift()!;
        if (seen.has(url)) continue;
        seen.add(url);
        const html = await this.fetchHtmlPage(url);
        if (html == null) break;
        const list = parseGeocmsList(html, url);
        if (first && !list.length) {
          this.log(`${isGeocmsPage(html) ? 'keine Termine' : 'keine GeoCMS-Terminliste'} auf der Seite: ${g.pageUrl}`);
          break;
        }
        first = false;
        for (const r of list) if (!rows.has(r.key)) rows.set(r.key, r);
        // Pager-Links der Seite (je Website ein anderer Parameter), mit dem Datumsfenster.
        for (const next of geocmsPagerUrls(html, url)) {
          const u = new URL(next);
          for (const [k, v] of new URL(url).searchParams) if (/_date$/.test(k)) u.searchParams.set(k, v);
          if (!seen.has(u.href)) queue.push(u.href);
        }
        if (seen.size === MAX_PAGES && queue.length) this.log(`abgeschnitten nach ${MAX_PAGES} Seiten: ${g.pageUrl}`);
      }
      if (!rows.size) return;
      withList++;
      const termine: GeocmsTermin[] = [];
      let fails = 0;
      let read = 0;
      for (const row of rows.values()) {
        let detail = this.details.get(row.url);
        if (detail === undefined && read < MAX_DETAILS && fails < MAX_FAILS_IN_ROW) {
          read++;
          const page = await this.fetchHtmlPage(row.url);
          detail = page ? parseGeocmsDetail(page, row.url) : null;
          fails = page ? 0 : fails + 1;
          if (fails === MAX_FAILS_IN_ROW) this.log(`Detailseiten antworten nicht mehr, Rest ohne Adresse: ${g.pageUrl}`);
          this.details.set(row.url, detail);
        } else if (detail !== undefined) this.noteCached(detail != null);
        termine.push(toGeocmsTermin(row, detail ?? null));
      }
      this.noteTermine(termine);
      const unique = collapseSourceDuplicates(termine.map(t => ({ ...t, uid: t.key })));
      all.push(...withoutPlaceholderImages(unique).map(t => this.toScraped(t, g)));
    });
    this.log(`${groups.length} Seiten, ${withList} mit Terminliste, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: GeocmsTermin, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image, ev.url);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `geocms-${new URL(ev.url).host}-${ev.key}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      category: ev.category,
      ...(ev.ticketUrl ? { ticket_url: ev.ticketUrl } : {}),
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) }, ownTown(g, ev));
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
