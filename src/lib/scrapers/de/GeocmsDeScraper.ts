/**
 * DE-Adapter GeoCMS (fn-29.15): liest die Veranstaltungsliste (Modul
 * „gcevent", Themes `btp_event` und `gc_gcevent`) aller Registry-Einträge
 * der Integration `geocms` mit allen Folgeseiten. Die Websites setzen in
 * robots.txt `Crawl-delay: 15`; `DeFeedScraper` hält die Pause vor jedem
 * Abruf ein. Detailseiten nur, wo die Liste keine Uhrzeit zeigt (kompakte
 * Kachel in Langen und Laatzen).
 *
 * Die Registry nennt teils eine Seite ohne Liste (Laatzen
 * „veranstaltungswerbung.html", Aken „veranstaltungsarchiv.html", Merseburg
 * „veranstaltungsreihen.html" mit einem Kasten am Rand); dann gilt der
 * Kalender, auf den die Seite verlinkt (`…/veranstaltungskalender.html`,
 * `…/veranstaltungen.html`).
 *
 * Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`): die Gemeinde eines
 * Kalenders, den genau eine Gemeinde führt; im Kalender einer
 * Verbandsgemeinde (VGem Droyßiger-Zeitzer Forst, Weida-Land) nur die
 * Gemeinde, die der Termin selbst nennt.
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageAllowed } from './HwDeScraper';
import { imageCredit, imageUrl, placeholderImages, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { geocmsDetailWhen, parseGeocmsList, type GeocmsListPage, type GeocmsTermin } from './geocms';

/** Höchstens so viele Listenseiten je Kalender. */
const MAX_PAGES = 40;
/** Höchstens so viele Kalender-Links einer Seite ohne Liste. */
const MAX_CALENDAR_LINKS = 2;

/** Kalender der Integration: eigene Seiten und Ausweichwege über die Verbandsgemeinde. */
export function geocmsGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    let g = groups.get(url);
    if (!g) { g = { feedUrl: url, pageUrl: url, own: [], viaVerband: [] }; groups.set(url, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'geocms' && e.url) group(e.url).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'geocms' && e.fallback.url) group(e.fallback.url).viaVerband.push(e);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/** Dateiname des Bildes: GeoCMS legt jedes hochgeladene Bild unter neuer ID ab (`…/id/143820,1081/7gebirge_untereinander_k.png`). */
const imageFile = (url: string) => decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '').toLowerCase();

/**
 * Platzhalterbilder eines Kalenders: dieselbe URL (`bild.ts`) oder derselbe
 * Dateiname an mindestens drei verschiedenen Terminen (Königswinter: das
 * VHS-Logo `7gebirge_untereinander_k.png` je Kurs unter eigener ID).
 */
export function withoutGeocmsPlaceholders<T extends { title: string; image?: string }>(termine: T[]): T[] {
  const byFile = placeholderImages(termine.map(t => ({ title: t.title, image: t.image && imageFile(t.image) })));
  return withoutPlaceholderImages(termine).map(t => (t.image && byFile.has(imageFile(t.image)) ? { ...t, image: undefined } : t));
}

export class GeocmsDeScraper extends DeFeedScraper {
  readonly name = 'de-geocms';

  private async listPage(url: string): Promise<GeocmsListPage | null> {
    const html = await this.fetchHtmlPage(url);
    return html == null ? null : parseGeocmsList(html, url);
  }

  /**
   * Erste Listenseite: die Registry-Seite, wenn ihr Hauptbereich die Liste
   * trägt; sonst der Kalender, auf den sie verlinkt; sonst ein Kasten am
   * Rand der Registry-Seite.
   */
  async firstPage(pageUrl: string): Promise<{ url: string; page: GeocmsListPage } | null> {
    const first = await this.listPage(pageUrl);
    if (first?.main) return { url: pageUrl, page: first };
    for (const cal of (first?.calendarLinks ?? []).filter(u => u !== pageUrl).slice(0, MAX_CALENDAR_LINKS)) {
      const page = await this.listPage(cal);
      if (page?.main) return { url: cal, page };
    }
    if (first?.isList) return { url: pageUrl, page: first };
    this.log(`keine GeoCMS-Veranstaltungsliste: ${pageUrl}`);
    return null;
  }

  async calendar(first: GeocmsListPage, url: string): Promise<GeocmsTermin[]> {
    const termine = [...first.termine];
    const seen = new Set([url]);
    const queue = [...first.pages];
    while (queue.length && seen.size < MAX_PAGES) {
      const next = queue.shift()!;
      if (seen.has(next)) continue;
      seen.add(next);
      const p = await this.listPage(next);
      if (!p) continue;
      termine.push(...p.termine);
      for (const q of p.pages) if (!seen.has(q) && !queue.includes(q)) queue.push(q);
    }
    if (queue.length) this.log(`abgeschnitten nach ${MAX_PAGES} Seiten: ${url}`);
    return termine;
  }

  /** Uhrzeit der kompakten Kachel von der Detailseite; ohne lesbare Detailseite bleibt der Tag ganztägig. */
  async withDetailTimes(termine: GeocmsTermin[]): Promise<GeocmsTermin[]> {
    const out: GeocmsTermin[] = [];
    for (const t of termine) {
      if (!t.timeOnDetail) { out.push(t); continue; }
      const html = await this.fetchHtmlPage(t.url);
      const when = html ? geocmsDetailWhen(html, t.localDate) : null;
      if (!when) this.log(`Uhrzeit der Detailseite nicht lesbar: ${t.url}`);
      out.push(when ? { ...t, ...when } : t);
    }
    return out;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = geocmsGroups().slice(0, this.limit ?? Infinity);
    // Mehrere Registry-Seiten können auf denselben Kalender führen: je Kalender ein Lauf, Gemeinden vereint.
    const calendars = new Map<string, { group: FeedGroup; page: GeocmsListPage }>();
    for (const g of groups) {
      const first = await this.firstPage(g.pageUrl);
      if (!first) continue;
      const cur = calendars.get(first.url);
      if (cur) {
        cur.group.own.push(...g.own);
        cur.group.viaVerband.push(...g.viaVerband);
      } else {
        calendars.set(first.url, { group: { ...g, feedUrl: first.url, pageUrl: first.url, own: [...g.own], viaVerband: [...g.viaVerband] }, page: first.page });
      }
    }
    const all: ScrapedEvent[] = [];
    for (const [url, { group, page }] of calendars) {
      const termine = await this.withDetailTimes(await this.calendar(page, url));
      // Bilder nur, wo robots.txt sie freigibt (Regel wie bei Hirsch & Wölfl).
      const robots = termine.length ? await this.robotsTxt(new URL(url).origin) : null;
      const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
      all.push(...this.toScrapedAll(allowed, group));
    }
    this.log(`${groups.length} Registry-Seiten, ${calendars.size} Kalender, ${all.length} Termine`);
    return all;
  }

  /** Termine eines Kalenders: Dubletten und Platzhalterbilder weg, IDs eindeutig. */
  toScrapedAll(termine: GeocmsTermin[], g: FeedGroup): ScrapedEvent[] {
    const unique = collapseSourceDuplicates(termine.map(t => ({ ...t, uid: `${t.id}|${t.localDate}` })));
    // Die Termin-ID ist je Tag eigen; trägt sie doch mehrere Tage, kommt der Tag dazu.
    const days = new Map<string, Set<string>>();
    for (const t of unique) days.set(t.id, (days.get(t.id) ?? new Set()).add(t.localDate));
    const seen = new Set<string>();
    return withoutGeocmsPlaceholders(unique)
      .filter(t => {
        const k = `${t.id}|${t.localDate}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map(t => this.toScraped(t, g, (days.get(t.id)?.size ?? 1) > 1));
  }

  toScraped(ev: GeocmsTermin, g: FeedGroup, withDay = false): ScrapedEvent {
    const image = imageUrl(ev.image);
    const host = new URL(ev.url).host.replace(/^www\./, '');
    const base: ScrapedEvent = {
      source_name: this.name,
      // Termin-ID aus dem Link der Detailseite.
      source_id: `geocms-${host}-${ev.id}${withDay ? `-${ev.localDate}` : ''}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      category: ev.categories.join(', ') || undefined,
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: false });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
