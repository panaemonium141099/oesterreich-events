/**
 * DE-Adapter Hirsch & Wölfl `hwveranstaltung` (fn-29.12): liest die
 * Kalenderliste aller Registry-Einträge der Integration `hwext` seitenweise
 * (`…/seite-N/suche-none`, zehn Termine je Seite). Kontext wie bei den
 * übrigen DE-Adaptern (`kontext.ts`): die Gemeinde eines Kalenders, den
 * genau eine Gemeinde führt; im Kalender einer Verwaltungsgemeinschaft nur
 * die Gemeinde, die der Termin selbst nennt.
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import { robotsAllows, robotsCrawlDelay } from '@/lib/registry-de/robots';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { hwPageUrl, parseHwList, type HwListPage, type HwTermin } from './hw';

/** Höchstens so viele Listenseiten à 10 je Kalender (400 Termine). */
const MAX_PAGES = 40;
const UA_TOKEN = 'lasstreffen';

/**
 * Kalender der Integration: eigene Kalenderseiten und Ausweichwege über die
 * Verwaltungsgemeinschaft. Eine Seite, die mehrere Gemeinden führen, ist ein
 * gemeinsamer Kalender (`feedUrl` = Kalenderseite, es gibt keinen Feed).
 */
export function hwGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    let g = groups.get(url);
    if (!g) { g = { feedUrl: url, pageUrl: url, own: [], viaVerband: [] }; groups.set(url, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'hwext' && e.url) group(e.url).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'hwext' && e.fallback.url) group(e.fallback.url).viaVerband.push(e);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/**
 * Darf das Bild übernommen werden? robots.txt vergleicht Pfade genau nach
 * Groß- und Kleinschreibung, die Kunden sperren aber Bildendungen
 * kleingeschrieben (`Disallow: /*.jpg$`) und meinen damit jede Bilddatei
 * (Ammerbuch, Dinkelsbühl, Sindelfingen: `…/Kalenderbilder/…JPG`,
 * 2026-10-29). Beide Schreibweisen müssen frei sein.
 */
export function imageAllowed(robots: string | null, url: string): boolean {
  const u = new URL(url);
  const lower = new URL(u.href);
  lower.pathname = u.pathname.toLowerCase();
  return robotsAllows(robots, u.href, UA_TOKEN) && robotsAllows(robots, lower.href, UA_TOKEN);
}

/** Eine Ebene höher: `/freizeit/veranstaltungen/dorffest` → `/freizeit/veranstaltungen`. */
export function parentPath(url: string): string | null {
  const u = new URL(url);
  const path = u.pathname.replace(/\/+$/, '');
  const i = path.lastIndexOf('/');
  if (i <= 0) return null;
  u.pathname = path.slice(0, i);
  u.search = '';
  u.hash = '';
  return u.href;
}

export class HwDeScraper extends DeFeedScraper {
  readonly name = 'de-hwveranstaltung';

  /** Kalenderseite lesen, wenn robots.txt sie erlaubt (Pause wie fetchFeed). */
  private async listPage(url: string): Promise<HwListPage | null> {
    const robots = await this.robotsTxt(new URL(url).origin);
    if (!robotsAllows(robots, url, UA_TOKEN)) {
      this.log(`robots.txt sperrt ${url}`);
      return null;
    }
    await this.sleep(Math.max(this.delayMs, (robotsCrawlDelay(robots, UA_TOKEN) ?? 0) * 1000));
    const { html, error } = await this.fetchHtml(url, { retries: 2 });
    if (html == null) {
      this.log(`nicht lesbar: ${url}: ${error}`);
      return null;
    }
    return parseHwList(html, url);
  }

  /**
   * Alle Termine eines Kalenders. Die Registry nennt teils eine Seite unter
   * dem Kalender („…/veranstaltungen/veranstaltung-melden",
   * „…/veranstaltungen/dorffest"); trägt sie keine Liste, gilt die Seite
   * eine Ebene höher, wenn dort die Liste steht.
   */
  async calendar(pageUrl: string): Promise<HwTermin[]> {
    let first = await this.listPage(pageUrl);
    if (first && !first.isList && !first.oldModule) {
      const parent = parentPath(pageUrl);
      const up = parent ? await this.listPage(parent) : null;
      if (up?.isList || up?.oldModule) first = up;
    }
    if (!first) return [];
    if (first.oldModule) {
      this.log(`alte Modulversion ohne Detailseiten, nicht gelesen: ${pageUrl}`);
      return [];
    }
    if (!first.isList) {
      this.log(`keine Kalenderliste: ${pageUrl}`);
      return [];
    }
    const termine = [...first.termine];
    const last = Math.min(first.lastPage, MAX_PAGES);
    if (first.lastPage > MAX_PAGES) this.log(`abgeschnitten nach ${MAX_PAGES} Seiten: ${pageUrl}`);
    for (let n = 2; n <= last && first.pagerTemplate; n++) {
      const p = await this.listPage(hwPageUrl(first.pagerTemplate, n));
      if (!p || !p.termine.length) break;
      termine.push(...p.termine);
    }
    return termine;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = hwGroups().slice(0, this.limit ?? Infinity);
    const all: ScrapedEvent[] = [];
    for (const g of groups) {
      const termine = await this.calendar(g.pageUrl);
      // Bilder nur, wo robots.txt sie freigibt (Hirsch-&-Wölfl-Kunden sperren
      // in der Regel `/fileadmin/` und Bildendungen).
      const robots = termine.length ? await this.robotsTxt(new URL(g.pageUrl).origin) : null;
      const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
      const unique = collapseSourceDuplicates(allowed.map(t => ({ ...t, uid: `${t.recordId}-${t.terminId ?? t.localDate}` })));
      all.push(...withoutPlaceholderImages(unique).map(t => this.toScraped(t, g)));
    }
    this.log(`${groups.length} Kalender, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: HwTermin, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image);
    const base: ScrapedEvent = {
      source_name: this.name,
      // Termin-ID, wo die Website Termine führt; sonst Datensatz und Tag.
      source_id: `hw-${new URL(ev.url).host}-${ev.recordId}-${ev.terminId ? `t${ev.terminId}` : ev.localDate}`,
      source_url: ev.url,
      title: ev.title,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      organizer: ev.organizer,
      category: ev.category,
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
