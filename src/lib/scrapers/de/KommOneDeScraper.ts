/**
 * DE-Adapter Komm.ONE Online-Suite (fn-29.10): liest die Terminliste aller
 * Registry-Einträge der Integration `komm1` seitenweise (das RSS ist
 * gekürzt und dient nur dazu, die Liste zu finden oder zu ersetzen, wenn es
 * keine gibt). Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`).
 *
 * Abrufe: robots.txt der Kunden setzt `Crawl-delay: 30` je Website. Die
 * Websites laufen in wenigen Komm.ONE-Netzen (194.59.37.x, 194.0.95.240);
 * der Adapter ruft nacheinander ab, immer nur ein Abruf zur Zeit und
 * mindestens `GLOBAL_GAP_MS` dazwischen, und wechselt dabei die Website,
 * damit jede ihre 30 s Pause bekommt, ohne dass der Lauf Stunden dauert.
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
import { parseKommOneList, parseKommOneRss, type KommOneTermin } from './kommone';

/** Höchstens so viele Listenseiten (à 20 in der Probe) je Kalender. */
const MAX_PAGES = 10;
/** Mindestabstand zwischen zwei Abrufen über alle Websites. */
const GLOBAL_GAP_MS = 2000;
/** Gleichzeitig bearbeitete Kalender (die Abrufe selbst laufen nacheinander). */
const WORKERS = 20;
const UA_TOKEN = 'lasstreffen';

/** Kalender der Integration: Registry-Seite, sonst das RSS; Ausweichwege über die VG. */
export function kommOneGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const add = (url: string | null | undefined, feed: string | null | undefined, e: RegistryEntryDe, via: boolean) => {
    const key = url ?? feed;
    if (!key) return false;
    let g = groups.get(key);
    if (!g) { g = { feedUrl: feed ?? key, pageUrl: key, own: [], viaVerband: [] }; groups.set(key, g); }
    (via ? g.viaVerband : g.own).push(e);
    return true;
  };
  for (const e of entries) {
    if (e.integration === 'komm1') add(e.url, e.feed_url, e, false);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'komm1') add(e.fallback.url, e.fallback.feed_url, e, true);
  }
  return [...groups.values()].sort((a, b) => a.pageUrl.localeCompare(b.pageUrl));
}

export class KommOneDeScraper extends DeFeedScraper {
  readonly name = 'de-kommone';
  private nextAt = new Map<string, number>();
  private lastEnd = 0;
  private lock: Promise<void> = Promise.resolve();
  private robotsSeen = new Map<string, string | null>();

  /** Ein Abruf zur Zeit: wartet auf die Pause der Website, dann auf den globalen Abstand. */
  private async serial<T>(origin: string, run: () => Promise<T>, delayS: number): Promise<T> {
    const wait = (this.nextAt.get(origin) ?? 0) - Date.now();
    if (wait > 0) await this.sleep(wait);
    const prev = this.lock;
    let release!: () => void;
    this.lock = new Promise(r => { release = r; });
    await prev;
    try {
      const gap = this.lastEnd + GLOBAL_GAP_MS - Date.now();
      if (gap > 0) await this.sleep(gap);
      return await run();
    } finally {
      this.lastEnd = Date.now();
      this.nextAt.set(origin, Date.now() + Math.max(this.delayMs, delayS * 1000));
      release();
    }
  }

  private async robotsOf(origin: string): Promise<string | null> {
    if (this.robotsSeen.has(origin)) return this.robotsSeen.get(origin)!;
    const txt = await this.serial(origin, () => this.robotsTxt(origin), 0);
    this.robotsSeen.set(origin, txt);
    // Crawl-delay gilt auch zwischen robots.txt und der ersten Seite.
    this.nextAt.set(origin, Date.now() + Math.max(this.delayMs, (robotsCrawlDelay(txt, UA_TOKEN) ?? 0) * 1000));
    return txt;
  }

  /** Seite lesen (robots.txt, Crawl-delay, Zeichensatz); RSS als Text. */
  private async page(url: string, xml = false): Promise<string | null> {
    const origin = new URL(url).origin;
    const robots = await this.robotsOf(origin);
    if (!robotsAllows(robots, url, UA_TOKEN)) {
      this.log(`robots.txt sperrt ${url}`);
      return null;
    }
    const delay = robotsCrawlDelay(robots, UA_TOKEN) ?? 0;
    return this.serial(origin, async () => {
      if (xml) {
        try {
          return await this.fetchPage(url);
        } catch (e) {
          this.log(`nicht lesbar: ${url}: ${e instanceof Error ? e.message : e}`);
          return null;
        }
      }
      const res = await this.fetchHtml(url, { retries: 1, charset: true });
      if (res.html == null) this.log(`nicht lesbar: ${url}: ${res.error}`);
      return res.html;
    }, delay);
  }

  /**
   * Termine eines Kalenders: die Registry-Seite, wenn sie die Liste trägt;
   * sonst die Liste hinter dem RSS (Kanal-Link); sonst die Einträge des RSS.
   */
  async calendar(g: FeedGroup): Promise<KommOneTermin[]> {
    const first = g.pageUrl !== g.feedUrl || !/\/zmrss\//.test(g.pageUrl) ? await this.page(g.pageUrl) : null;
    let page = first ? parseKommOneList(first, g.pageUrl) : null;
    let listUrl = g.pageUrl;
    if (!page?.termine.length) {
      const feed = /\/zmrss\//.test(g.feedUrl) ? g.feedUrl : page?.rss;
      const xml = feed ? await this.page(feed, true) : null;
      const rss = xml ? parseKommOneRss(xml, feed!) : null;
      if (!rss) {
        this.log(`keine Terminliste: ${g.pageUrl}`);
        return [];
      }
      const list = rss.listUrl && rss.listUrl !== g.pageUrl && new URL(rss.listUrl).host === new URL(feed!).host ? rss.listUrl : null;
      const html = list ? await this.page(list) : null;
      page = html ? parseKommOneList(html, list!) : null;
      if (!page?.termine.length) return rss.termine;
      listUrl = list!;
    }
    const termine = [...page.termine];
    const seen = new Set([listUrl]);
    for (let n = 2; page.next && n <= MAX_PAGES && !seen.has(page.next); n++) {
      seen.add(page.next);
      const html = await this.page(page.next);
      if (!html) break;
      page = parseKommOneList(html, page.next);
      if (!page.termine.length) break;
      termine.push(...page.termine);
    }
    if (page.next && seen.size >= MAX_PAGES) this.log(`abgeschnitten nach ${MAX_PAGES} Seiten: ${listUrl}`);
    return termine;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = kommOneGroups().slice(0, this.limit ?? Infinity);
    const results: ScrapedEvent[][] = new Array(groups.length);
    let next = 0;
    const worker = async () => {
      for (let i = next++; i < groups.length; i = next++) {
        const g = groups[i];
        const termine = await this.calendar(g);
        const unique = collapseSourceDuplicates([...new Map(termine.map(t => [t.id, { ...t, uid: t.id }])).values()]);
        results[i] = withoutPlaceholderImages(unique).map(t => this.toScraped(t, g));
      }
    };
    await Promise.all(Array.from({ length: Math.min(WORKERS, groups.length) }, worker));
    const all = results.flat();
    this.log(`${groups.length} Kalender, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: KommOneTermin, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `komm1-${new URL(ev.url).host}-${ev.id}`,
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
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
