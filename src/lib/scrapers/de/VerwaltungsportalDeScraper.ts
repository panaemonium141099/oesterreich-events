/**
 * DE-Adapter verwaltungsportal.de (fn-29.11): liest die Kalenderliste jeder
 * verwaltungsportal-Website der DE-Gemeinde-Registry und je Termin die
 * Druckansicht seiner Detailseite (`verwaltungsportal.ts`). Kontext wie bei
 * den übrigen DE-Adaptern (`kontext.ts`): die Gemeinde einer Website, die
 * genau eine Gemeinde führt; im Kalender eines Amts bzw. einer VG nur die
 * Gemeinde, die der Termin selbst nennt.
 *
 * Alle Websites liegen auf einem Server (144.76.55.199): abgerufen wird
 * plattformweit nacheinander, mit 2 s Pause und robots.txt
 * (`DeFeedScraper.gate`). Mit acht Websites parallel (rund acht
 * Abrufe je Sekunde) nahm der Server am 2026-10-29 keine Verbindungen mehr
 * an. Eine Serie (eine ID, viele Termintage) kostet einen Abruf, wenn die
 * Liste die Uhrzeiten belegt (`vpSameClock`). Was in einer Nacht nicht
 * fertig wird, setzt die nächste nach der zuletzt gelesenen Website fort
 * (`resumeAfterCursor`).
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import {
  isVpPage, parseVpDetail, parseVpListLinks, vpCalendarHost, vpListUrls, vpOccurrence, vpPrintUrl, vpSameClock, type VpEvent, type VpLink,
} from './verwaltungsportal';

export interface VpGroup extends FeedGroup {
  /** Website des Kalenders ohne `www.`. */
  host: string;
  /** Kalender-URL der Registry auf dieser Website, falls bekannt. */
  knownUrl: string | null;
}

/**
 * Websites der Integration mit den Gemeinden, die sie lesen: eigene
 * (Stufe B) und Ausweichwege über Amt/VG. Mehrere Gemeinden auf einer
 * Website heißt Amtskalender.
 */
export function vpGroups(entries: RegistryEntryDe[] = loadRegistryDe()): VpGroup[] {
  const groups = new Map<string, VpGroup>();
  const group = (host: string, url: string | null) => {
    let g = groups.get(host);
    if (!g) {
      const list = `https://www.${host}/veranstaltungen/index.php`;
      g = { host, knownUrl: null, feedUrl: list, pageUrl: list, own: [], viaVerband: [] };
      groups.set(host, g);
    }
    if (!g.knownUrl && url && vpCalendarHost(url, null) === host) g.knownUrl = url;
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'verwaltungsportal') {
      const h = vpCalendarHost(e.url, e.host);
      if (h) group(h, e.url).own.push(e);
    }
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'verwaltungsportal') {
      const h = vpCalendarHost(e.fallback.url, e.fallback.host);
      if (h) group(h, e.fallback.url).viaVerband.push(e);
    }
  }
  return [...groups.values()].sort((a, b) => a.host.localeCompare(b.host));
}

type VpTermin = VpEvent & { uid: string };

/**
 * Gleichmäßig verteilte Stichprobe von `n` Websites (Prüfstand), statt der
 * ersten `n` im Alphabet.
 */
export function spreadSample<T>(list: T[], n: number | undefined): T[] {
  if (n == null || n >= list.length) return list;
  const step = list.length / n;
  return Array.from({ length: n }, (_, i) => list[Math.floor(i * step)]);
}

export class VerwaltungsportalDeScraper extends DeFeedScraper {
  readonly name = 'de-verwaltungsportal';
  override readonly resumesSourceList = true;
  protected delayMs = 2000;

  /**
   * `limit` (Tests) bzw. `DE_VP_WEBSITES` (Prüfstand): so viele Websites,
   * gleichmäßig über die Registry verteilt; dann ohne Cursor.
   */
  async scrape(): Promise<ScrapedEvent[]> {
    const n = this.limit ?? (Number(process.env.DE_VP_WEBSITES) || undefined);
    const groups = n ? spreadSample(vpGroups(), n) : this.resumeAfterCursor(vpGroups(), g => g.host);
    const deadline = this.softDeadline();
    const all: ScrapedEvent[] = [];
    let done = 0;
    for (const g of groups) {
      if (Date.now() > deadline) {
        this.log(`Zeitbudget erreicht nach ${done} von ${groups.length} Websites${this.reachedCursor ? `; der nächste Lauf setzt nach „${this.reachedCursor}" fort` : ''}`);
        break;
      }
      all.push(...await this.scrapeGroup(g));
      done++;
      if (!n) this.markReached(g.host);
    }
    this.log(`${done} Websites, ${all.length} Termine, ${this.fetches} Abrufe`);
    return all;
  }

  private fetches = 0;

  /** HTML holen (robots.txt, Pause, nur text/html über `fetchHtml`). */
  private async fetchDoc(url: string): Promise<string | null> {
    if (!(await this.gate(url))) return null;
    this.fetches++;
    const r = await this.fetchHtml(url, { retries: 2 });
    if (r.html == null) this.log(`nicht lesbar (${r.error}): ${url}`);
    return r.html;
  }

  private async readDetail(origin: string, link: VpLink): Promise<VpEvent | null> {
    const html = await this.fetchDoc(vpPrintUrl(origin, link.path));
    if (html == null) return null;
    const r = parseVpDetail(html, link, origin);
    if ('skip' in r) {
      this.log(`übersprungen (${r.skip}): ${origin}${link.path}`);
      return null;
    }
    return r.event;
  }

  private async scrapeGroup(g: VpGroup): Promise<ScrapedEvent[]> {
    let list: string | null = null;
    let listUrl = '';
    for (const u of vpListUrls(g.host, g.knownUrl)) {
      list = await this.fetchDoc(u);
      listUrl = u;
      if (list != null) break;
    }
    if (list == null) return [];
    if (!isVpPage(list)) {
      this.log(`keine Kalenderliste von verwaltungsportal.de: ${listUrl}`);
      return [];
    }
    const origin = new URL(listUrl).origin;
    const series = new Map<string, VpLink[]>();
    for (const l of parseVpListLinks(list, listUrl)) series.set(l.id, [...(series.get(l.id) ?? []), l]);
    const events: VpTermin[] = [];
    const push = (e: VpEvent) => events.push({ ...e, uid: `${e.id}-${e.localDate}` });
    for (const links of series.values()) {
      links.sort((a, b) => a.date.localeCompare(b.date));
      const [first, ...rest] = links;
      const read = await this.readDetail(origin, first);
      if (read) push(read);
      for (const l of rest) {
        if (read && vpSameClock(read, first, l)) push(vpOccurrence(read, l, origin));
        else {
          const own = await this.readDetail(origin, l);
          if (own) push(own);
        }
      }
    }
    return withoutPlaceholderImages(collapseSourceDuplicates(events)).map(ev => this.toScraped(ev, g));
  }

  toScraped(ev: VpEvent, g: VpGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `vp-${g.host}-${ev.id}-${ev.localDate}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      address,
      postal_code: ev.postalCode,
      city: ev.locality,
      organizer: ev.organizer,
      ...(image ? {
        image_url: image,
        image_credit: imageCredit(ev.url),
        ...(ev.imageWidth ? { image_width: ev.imageWidth, image_height: ev.imageHeight } : {}),
      } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
