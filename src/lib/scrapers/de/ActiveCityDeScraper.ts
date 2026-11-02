/**
 * DE-Adapter active-City (Advantic, fn-29.15): liest die Veranstaltungsliste
 * (`.event_wrapper[data-sortdate]`, `activecity.ts`) aller Registry-Einträge
 * der Integration `activecity` mit allen Folgeseiten.
 *
 * Die Registry nennt oft eine Detailseite
 * (`…/Veranstaltungen.htm/Veranstaltungen/Offener-Spieletreff.html`); dann
 * gilt der Kalender davor (`…/Veranstaltungen.htm`), sonst ein Link der
 * Seite auf `…Veranstaltung….htm`.
 *
 * Ort: Die Liste nennt Name, Straße und „PLZ Ort“; PLZ und Ort gehen wie bei
 * cEasy an den Resolver. Sonst Kontext wie bei den übrigen DE-Adaptern.
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
import { activeCityCalendarOf, parseActiveCityList, type ActiveCityListPage, type ActiveCityTermin } from './activecity';

/** Höchstens so viele Listenseiten je Kalender. */
const MAX_PAGES = 40;

/** Kalender der Integration: eigene Seiten und Ausweichwege über die Samtgemeinde bzw. das Amt. */
export function activeCityGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    let g = groups.get(url);
    if (!g) { g = { feedUrl: url, pageUrl: url, own: [], viaVerband: [] }; groups.set(url, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'activecity' && e.url) group(e.url).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'activecity' && e.fallback.url) group(e.fallback.url).viaVerband.push(e);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/** Kalender-Links einer Seite ohne Liste: `…/Veranstaltungen.htm`, `…/Veranstaltungskalender.htm` derselben Website. */
export function activeCityCalendarLinks(html: string, base: string): string[] {
  const host = new URL(base).host;
  const out: string[] = [];
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    try {
      const u = new URL(m[1].replace(/&amp;/g, '&'), base);
      if (u.host === host && /\/Veranstaltung[^/]*\.htm$/i.test(u.pathname) && !out.includes(`${u.origin}${u.pathname}`)) out.push(`${u.origin}${u.pathname}`);
    } catch {
      /* kein Link */
    }
  }
  return out;
}

export class ActiveCityDeScraper extends DeFeedScraper {
  readonly name = 'de-activecity';

  private async page(url: string): Promise<{ html: string; page: ActiveCityListPage } | null> {
    const html = await this.fetchHtmlPage(url);
    return html == null ? null : { html, page: parseActiveCityList(html, url) };
  }

  /** Erste Listenseite: Registry-Seite, sonst der Kalender davor bzw. ein Kalender-Link der Seite. */
  async firstPage(pageUrl: string): Promise<{ url: string; page: ActiveCityListPage } | null> {
    const first = await this.page(pageUrl);
    if (first?.page.termine.length) return { url: pageUrl, page: first.page };
    const tried = new Set([pageUrl]);
    const candidates = [activeCityCalendarOf(pageUrl), ...(first ? activeCityCalendarLinks(first.html, pageUrl) : [])].filter((u): u is string => !!u);
    for (const url of candidates.slice(0, 3)) {
      if (tried.has(url)) continue;
      tried.add(url);
      const p = await this.page(url);
      if (p?.page.termine.length) return { url, page: p.page };
    }
    if (first?.page.withoutSortdate) this.log(`${first.page.withoutSortdate} Einträge ohne Datum und Uhrzeit (nur „Nächster Termin“): ${pageUrl}`);
    this.log(`keine active-City-Veranstaltungsliste: ${pageUrl}`);
    return null;
  }

  async calendar(first: ActiveCityListPage, url: string): Promise<ActiveCityTermin[]> {
    const termine = [...first.termine];
    const seen = new Set([url]);
    const queue = [...first.pages];
    while (queue.length && seen.size < MAX_PAGES) {
      const next = queue.shift()!;
      if (seen.has(next)) continue;
      seen.add(next);
      const p = await this.page(next);
      if (!p || !p.page.termine.length) continue;
      termine.push(...p.page.termine);
      for (const q of p.page.pages) if (!seen.has(q) && !queue.includes(q)) queue.push(q);
    }
    if (queue.length) this.log(`abgeschnitten nach ${MAX_PAGES} Seiten: ${url}`);
    return termine;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(activeCityGroups());
    const calendars = new Map<string, { group: FeedGroup; page: ActiveCityListPage }>();
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
      const termine = await this.calendar(page, url);
      // Bilder nur, wo robots.txt sie freigibt (Regel wie bei Hirsch & Wölfl).
      const robots = termine.length ? await this.robotsTxt(new URL(url).origin) : null;
      const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
      all.push(...this.toScrapedAll(allowed, group));
    }
    this.log(`${groups.length} Registry-Seiten, ${calendars.size} Kalender, ${all.length} Termine`);
    return all;
  }

  /** Termine eines Kalenders: Dubletten und Platzhalterbilder weg, IDs eindeutig. */
  toScrapedAll(termine: ActiveCityTermin[], g: FeedGroup): ScrapedEvent[] {
    const unique = collapseSourceDuplicates(termine.map(t => ({ ...t, uid: `${t.slug}|${t.start}` })));
    const days = new Map<string, Set<string>>();
    for (const t of unique) days.set(t.slug, (days.get(t.slug) ?? new Set()).add(t.localDate));
    const seen = new Set<string>();
    return withoutPlaceholderImages(unique)
      .filter(t => (seen.has(`${t.slug}|${t.localDate}`) ? false : (seen.add(`${t.slug}|${t.localDate}`), true)))
      .map(t => this.toScraped(t, g, (days.get(t.slug)?.size ?? 1) > 1));
  }

  toScraped(ev: ActiveCityTermin, g: FeedGroup, withDay = false): ScrapedEvent {
    const image = imageUrl(ev.image);
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      // Name der Detailseite, bei Reihen mit dem Tag.
      source_id: `activecity-${new URL(ev.url).host.replace(/^www\./, '')}-${ev.slug}${withDay ? `-${ev.localDate}` : ''}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
