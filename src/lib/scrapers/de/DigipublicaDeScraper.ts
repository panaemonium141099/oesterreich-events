/**
 * DE-Adapter DigiPublica (fn-29.15): liest das Veranstaltungsmodul „gdc"
 * aller Registry-Einträge der Integration `digipublica` (fast nur Bayern),
 * aus dem Kalenderblatt (`data-calendar`, alle Termine) oder, wo es fehlt,
 * aus der sichtbaren Liste (`digipublica.ts`). Abgesagte Termine fallen weg.
 *
 * Ort: Weder Kalenderblatt noch Liste nennen einen Veranstaltungsort. Es
 * gilt der Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`): die
 * Gemeinde eines Kalenders, den genau eine Gemeinde führt; im Kalender
 * einer Verwaltungsgemeinschaft nur die Gemeinde, die der Titel nennt.
 *
 * Websites eines Verbunds teilen eine Datenbank (VG Altfraunhofen und
 * Baierbach dasselbe Kalenderblatt; die Gemeinden der VGem Boos zeigen
 * „Trauerkaffee" und „Blutspenden Boos" auf jeder Website): derselbe
 * Termin bleibt einmal, und keine der Websites ist dann sein Ort (wie
 * `acrossCalendars` bei communice).
 *
 * Im Nachtlauf seit fn-29.18 (`nachtlauf.ts`).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageAllowed } from './HwDeScraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { parseDigipublicaPage, type DigipublicaTermin } from './digipublica';

/** Kalender der Integration: eigene Seiten und Ausweichwege über die Verwaltungsgemeinschaft. */
export function digipublicaGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    const key = url.replace(/&amp;/g, '&');
    let g = groups.get(key);
    if (!g) { g = { feedUrl: key, pageUrl: key, own: [], viaVerband: [] }; groups.set(key, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'digipublica' && e.url) group(e.url).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'digipublica' && e.fallback.url) group(e.fallback.url).viaVerband.push(e);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

export interface CalendarTermine { group: FeedGroup; termine: DigipublicaTermin[] }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Termine aller Kalender, je Termin einmal: derselbe Schlüssel der
 * Detailseite, Beginn und Titel auf mehreren Websites ist ein Termin des
 * Verbunds; er bekommt die Gemeinden aller dieser Kalender (Gemeinde dann nur
 * aus dem Titel). Vertreter ist der Kalender mit der kleinsten URL.
 * Innerhalb eines Kalenders: Dubletten und Platzhalterbilder weg; dieselbe
 * ID an mehreren Tagen bekommt den Tag in die source_id (`withDay`).
 */
export function acrossCalendars(cals: CalendarTermine[]): { termin: DigipublicaTermin; group: FeedGroup; withDay: boolean }[] {
  const items: { termin: DigipublicaTermin; group: FeedGroup; withDay: boolean; key: string }[] = [];
  for (const c of [...cals].sort((a, b) => a.group.pageUrl.localeCompare(b.group.pageUrl))) {
    const unique = withoutPlaceholderImages(collapseSourceDuplicates(c.termine.map(t => ({ ...t, uid: `${t.key}|${t.start}` }))));
    const days = new Map<string, Set<string>>();
    for (const t of unique) days.set(t.id, (days.get(t.id) ?? new Set()).add(t.localDate));
    for (const t of unique) {
      items.push({ termin: t, group: c.group, withDay: (days.get(t.id)?.size ?? 1) > 1, key: JSON.stringify([t.key, t.start, norm(t.title)]) });
    }
  }
  const byKey = new Map<string, typeof items>();
  for (const it of items) byKey.set(it.key, [...(byKey.get(it.key) ?? []), it]);
  const out: { termin: DigipublicaTermin; group: FeedGroup; withDay: boolean }[] = [];
  for (const list of byKey.values()) {
    const first = list[0];
    if (new Set(list.map(x => x.group.pageUrl)).size === 1) {
      for (const x of list) out.push({ termin: x.termin, group: x.group, withDay: x.withDay });
      continue;
    }
    const own = new Map<string, RegistryEntryDe>();
    for (const x of list) for (const e of [...x.group.own, ...x.group.viaVerband]) own.set(e.ags, e);
    out.push({ termin: first.termin, group: { ...first.group, own: [...own.values()], viaVerband: [] }, withDay: list.some(x => x.withDay) });
  }
  return out;
}

export class DigipublicaDeScraper extends DeFeedScraper {
  readonly name = 'de-digipublica';
  readonly integrations = ['digipublica'];

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = digipublicaGroups().slice(0, this.limit ?? Infinity);
    const cals: CalendarTermine[] = [];
    let cancelled = 0;
    for (const g of groups) {
      const html = await this.fetchHtmlPage(g.pageUrl);
      const page = html == null ? null : parseDigipublicaPage(html, g.pageUrl);
      if (!page?.isCalendar) {
        this.log(`kein DigiPublica-Veranstaltungsmodul: ${g.pageUrl}`);
        continue;
      }
      if (page.withoutYear) this.log(`${page.withoutYear} Listeneinträge ohne Jahr nicht gelesen: ${g.pageUrl}`);
      cancelled += page.termine.filter(t => t.cancelled).length;
      const termine = page.termine.filter(t => !t.cancelled);
      // Bilder nur, wo robots.txt sie freigibt (Regel wie bei Hirsch & Wölfl).
      const robots = termine.length ? await this.robotsTxt(new URL(g.pageUrl).origin) : null;
      cals.push({ group: g, termine: termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t)) });
    }
    const all = acrossCalendars(cals).map(x => this.toScraped(x.termin, x.group, x.withDay));
    this.log(`${groups.length} Registry-Seiten, ${cals.length} Kalender, ${all.length} Termine, ${cancelled} abgesagt`);
    return all;
  }

  /** Termine eines Kalenders (Tests): wie `scrape`, ohne Abruf. */
  toScrapedAll(termine: DigipublicaTermin[], g: FeedGroup): ScrapedEvent[] {
    return acrossCalendars([{ group: g, termine: termine.filter(t => !t.cancelled) }]).map(x => this.toScraped(x.termin, x.group, x.withDay));
  }

  toScraped(ev: DigipublicaTermin, g: FeedGroup, withDay = false): ScrapedEvent {
    const image = imageUrl(ev.image);
    const host = new URL(ev.url).host.replace(/^www\./, '');
    const base: ScrapedEvent = {
      source_name: this.name,
      // Veranstaltungs-ID der Detailseite, bei Reihen mit dem Tag.
      source_id: `digipublica-${host}-${ev.id}${withDay ? `-${ev.localDate}` : ''}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, hasOwnPlace: false });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
