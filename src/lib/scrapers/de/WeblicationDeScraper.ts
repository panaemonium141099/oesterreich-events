/**
 * DE-Adapter Weblication (Scholl Communications; fn-29.15): liest die
 * Veranstaltungsliste (Listenobjekt „eventMulti") aller Registry-Einträge der
 * Integration `weblication` mit allen Folgeseiten. Kontext wie bei den
 * übrigen DE-Adaptern (`kontext.ts`): die Gemeinde eines Kalenders, den
 * genau eine Gemeinde führt; im Kalender einer Verbandsgemeinde nur die
 * Gemeinde, die der Termin selbst nennt.
 *
 * Die Registry nennt oft einen einzelnen Termin („…/veranstaltungen/termine/Die-Raeuber.php")
 * oder eine Unterseite; dann gilt die Seite über `/termine/` bzw. der
 * Kalender, auf den ihre Termin-Links zeigen.
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
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { parseWeblicationList, weblicationCalendarOf, type WeblicationListPage, type WeblicationTermin } from './weblication';

/** Höchstens so viele Listenseiten je Kalender. */
const MAX_PAGES = 40;

/** Kalender der Integration: eigene Seiten und Ausweichwege über die Verbandsgemeinde. */
export function weblicationGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    const key = weblicationCalendarOf(url) ?? url;
    let g = groups.get(key);
    if (!g) { g = { feedUrl: key, pageUrl: key, own: [], viaVerband: [] }; groups.set(key, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'weblication' && e.url) group(e.url).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'weblication' && e.fallback.url) group(e.fallback.url).viaVerband.push(e);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

export class WeblicationDeScraper extends DeFeedScraper {
  readonly name = 'de-weblication';

  private async listPage(url: string): Promise<WeblicationListPage | null> {
    const html = await this.fetchHtmlPage(url);
    return html == null ? null : parseWeblicationList(html, url);
  }

  /** Erste Listenseite: Registry-Seite, sonst der Kalender ihrer Termin-Links. */
  async firstPage(pageUrl: string): Promise<{ url: string; page: WeblicationListPage } | null> {
    const first = await this.listPage(pageUrl);
    if (first?.isList) return { url: pageUrl, page: first };
    const counts = new Map<string, number>();
    for (const l of first?.terminLinks ?? []) {
      const c = weblicationCalendarOf(l);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const cal = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    const page = cal && cal !== pageUrl ? await this.listPage(cal) : null;
    if (cal && page?.isList) return { url: cal, page };
    this.log(`keine eventMulti-Liste: ${pageUrl}`);
    return null;
  }

  async calendar(first: WeblicationListPage, url: string): Promise<WeblicationTermin[]> {
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

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = weblicationGroups().slice(0, this.limit ?? Infinity);
    const done = new Set<string>();
    const all: ScrapedEvent[] = [];
    for (const g of groups) {
      const first = await this.firstPage(g.pageUrl);
      if (!first || done.has(first.url)) continue;
      done.add(first.url);
      const termine = await this.calendar(first.page, first.url);
      const robots = termine.length ? await this.robotsTxt(new URL(first.url).origin) : null;
      const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
      all.push(...this.toScrapedAll(allowed, g));
    }
    this.log(`${groups.length} Kalender, ${all.length} Termine`);
    return all;
  }

  /** Termine eines Kalenders: Dubletten und Platzhalterbilder weg, IDs eindeutig. */
  toScrapedAll(termine: WeblicationTermin[], g: FeedGroup): ScrapedEvent[] {
    const unique = collapseSourceDuplicates(termine.map(t => ({ ...t, uid: `${t.path}|${t.splitId ?? ''}|${t.start}` })));
    // Dieselbe Detailseite an mehreren Tagen: Tag anhängen; mehrmals am selben
    // Tag (Neunkirchen „Buchausstellung" 10:00 und 13:30 Uhr): auch die Uhrzeit.
    const days = new Map<string, Set<string>>();
    const slots = new Map<string, number>();
    for (const t of unique) {
      days.set(t.path, (days.get(t.path) ?? new Set()).add(t.localDate));
      slots.set(`${t.path}|${t.localDate}`, (slots.get(`${t.path}|${t.localDate}`) ?? 0) + 1);
    }
    return withoutPlaceholderImages(unique).map(t =>
      this.toScraped(t, g, (days.get(t.path)?.size ?? 1) > 1, (slots.get(`${t.path}|${t.localDate}`) ?? 1) > 1),
    );
  }

  toScraped(ev: WeblicationTermin, g: FeedGroup, withDay = false, withTime = false): ScrapedEvent {
    const image = imageUrl(ev.image);
    const host = new URL(ev.url).host.replace(/^www\./, '');
    // Serientermine (`splitId`) mit dem Tag: die Nummer im Link ist eine
    // Zählung der Serie, der Tag bleibt, solange der Termin bleibt.
    const time = withTime && !ev.allDay ? `-${ev.start.slice(11, 16).replace(':', '')}` : '';
    const suffix = (ev.splitId || withDay || withTime ? `-${ev.localDate}` : '') + time;
    const base: ScrapedEvent = {
      source_name: this.name,
      // Pfad der Detailseite, bei Serien mit dem Tag.
      source_id: `weblication-${host}${ev.path.replace(/\//g, '-')}${suffix}`,
      source_url: ev.splitId ? ev.link : ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: false });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
