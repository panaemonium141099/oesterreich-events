/**
 * DE-Adapter Open2C (fn-29.15): liest den Veranstaltungskalender des CMS
 * (`.event_teaser_block`, `open2c.ts`) aller Registry-Einträge der
 * Integration `open2c` mit allen Folgeseiten. Registry-Seiten ohne
 * Kalendermodul (RCE-Kalender in Sulzemoos, Nachrichtenartikel, Hallen-
 * Seiten) bleiben ohne Termine.
 *
 * Ort: „Ort:" ist oft eine volle Adresse („Bürgerhaus Rathausplatz 2 85298
 * Scheyern"); die PLZ mit Ort geht wie bei cEasy an den Resolver. Sonst
 * gilt der Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`).
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
import { parseOpen2cList, type Open2cListPage, type Open2cTermin } from './open2c';

/** Höchstens so viele Listenseiten à 20 je Kalender. */
const MAX_PAGES = 40;

/** Kalender der Integration: eigene Seiten und Ausweichwege über die Verwaltungsgemeinschaft. */
export function open2cGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    let g = groups.get(url);
    if (!g) { g = { feedUrl: url, pageUrl: url, own: [], viaVerband: [] }; groups.set(url, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'open2c' && e.url) group(e.url).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'open2c' && e.fallback.url) group(e.fallback.url).viaVerband.push(e);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/**
 * PLZ und Ort am Ende der Ortsangabe: „Bürgerhaus Rathausplatz 2 85298
 * Scheyern", „Haus der Bürger Reisbach, Neumühlstraße 4, 94419 Reisbach".
 * Ohne PLZ nur der Name.
 */
export function open2cPlace(raw: string | undefined): { locationName?: string; postalCode?: string; locality?: string } {
  if (!raw || raw === '-') return {};
  const m = /^(.*?)[,\s]+(\d{5})\s+([A-ZÄÖÜ][^,\d]*?)\s*$/.exec(raw);
  if (!m) return { locationName: raw };
  return { locationName: m[1].replace(/[,\s]+$/, '') || raw, postalCode: m[2], locality: m[3] };
}

export class Open2cDeScraper extends DeFeedScraper {
  readonly name = 'de-open2c';
  readonly integrations = ['open2c'];

  private async listPage(url: string): Promise<Open2cListPage | null> {
    const html = await this.fetchHtmlPage(url);
    return html == null ? null : parseOpen2cList(html, url);
  }

  async calendar(first: Open2cListPage, url: string): Promise<Open2cTermin[]> {
    const termine = [...first.termine];
    const seen = new Set([url]);
    const queue = [...first.pages];
    while (queue.length && seen.size < MAX_PAGES) {
      const next = queue.shift()!;
      if (seen.has(next)) continue;
      seen.add(next);
      const p = await this.listPage(next);
      if (!p || !p.termine.length) continue;
      termine.push(...p.termine);
      for (const q of p.pages) if (!seen.has(q) && !queue.includes(q)) queue.push(q);
    }
    if (queue.length) this.log(`abgeschnitten nach ${MAX_PAGES} Seiten: ${url}`);
    return termine;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(open2cGroups());
    const all: ScrapedEvent[] = [];
    let calendars = 0;
    for (const g of groups) {
      const first = await this.listPage(g.pageUrl);
      if (!first?.isList) {
        this.log(`kein Open2C-Veranstaltungskalender: ${g.pageUrl}`);
        continue;
      }
      calendars++;
      const termine = await this.calendar(first, g.pageUrl);
      // Bilder nur, wo robots.txt sie freigibt (Regel wie bei Hirsch & Wölfl).
      const robots = termine.length ? await this.robotsTxt(new URL(g.pageUrl).origin) : null;
      const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
      all.push(...this.toScrapedAll(allowed, g));
    }
    this.log(`${groups.length} Registry-Seiten, ${calendars} Kalender, ${all.length} Termine`);
    return all;
  }

  /** Termine eines Kalenders: Dubletten und Platzhalterbilder weg, je Termin-ID eine Zeile. */
  toScrapedAll(termine: Open2cTermin[], g: FeedGroup): ScrapedEvent[] {
    const seen = new Set<string>();
    const once = termine.filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)));
    const unique = collapseSourceDuplicates(once.map(t => ({ ...t, uid: t.id.padStart(12, '0') })));
    return withoutPlaceholderImages(unique).map(t => this.toScraped(t, g));
  }

  toScraped(ev: Open2cTermin, g: FeedGroup): ScrapedEvent {
    const place = open2cPlace(ev.locationName);
    const image = imageUrl(ev.image);
    const base: ScrapedEvent = {
      source_name: this.name,
      // Termin-ID der Detailansicht (`detailevent`), je Website eindeutig.
      source_id: `open2c-${new URL(ev.url).host.replace(/^www\./, '')}-${ev.id}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: place.locationName,
      ...(place.postalCode ? { address: `${place.postalCode} ${place.locality}`, postal_code: place.postalCode, city: place.locality } : {}),
      category: ev.category,
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: place.locationName, hasOwnPlace: !!place.postalCode });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
