/**
 * DE-Adapter Advantic iKISS (fn-29.13): liest die Veranstaltungsliste
 * (`ModID=11`) aller Registry-Einträge der Integration `ikiss` seitenweise
 * und je Termin die Detailseite (Uhrzeit und Ort stehen nicht in jeder
 * Listenvorlage). Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`):
 * die Gemeinde eines Kalenders, den genau eine Gemeinde führt; im
 * Amtskalender nur die Gemeinde, die der Termin selbst nennt.
 *
 * Nachtlauf mit Fortsetzungs-Cursor je Website (fn-29.18, `nachtlauf.ts`).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { loadRegistryDe, singleGemeinde, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import { robotsAllows, robotsCrawlDelay } from '@/lib/registry-de/robots';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { hostKey } from './host-gate';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { imageAllowed } from './HwDeScraper';
import { calendarPaths, ikissPageUrl, parseIkissDetail, parseIkissList, parseIkissRss, type IkissTermin } from './ikiss';

/** Höchstens so viele Termine (Detailseiten) je Kalender, die nächsten ab heute. */
const MAX_TERMINE = 300;
const UA_TOKEN = 'lasstreffen';

/**
 * Kalender der Integration: Registry-Seite, sonst die Startseite der
 * Website (die Registry kennt für 75 iKISS-Gemeinden keine Kalenderseite),
 * dazu Ausweichwege über Amt/VG.
 */
export function ikissGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (raw: string) => {
    // Schierling: `…/Veranstaltungen/?&amp;kat=4283.13` (HTML-Entität aus dem Link übernommen).
    const url = raw.replace(/&amp;/g, '&');
    let g = groups.get(url);
    if (!g) { g = { feedUrl: url, pageUrl: url, own: [], viaVerband: [] }; groups.set(url, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'ikiss') group(e.url ?? `https://www.${e.host}/`).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'ikiss') {
      group(e.fallback.url ?? `https://www.${e.fallback.host}/`).viaVerband.push(e);
    }
  }
  // Kalender genau einer Gemeinde zuerst: zeigt ein Amtskalender denselben
  // Termin, gilt die Gemeinde-Seite (Amt Hohe Elbgeest filtert je Gemeinde).
  return [...groups.values()].sort((a, b) => Number(!singleGemeinde(a)) - Number(!singleGemeinde(b)) || a.feedUrl.localeCompare(b.feedUrl));
}

/**
 * Link aus dem RSS auf der Website des RSS: Magdeburg verlinkt einen internen
 * Projekt-Host (projekt13.kid-magdeburg.de, HTTP 401); derselbe Pfad auf
 * www.magdeburg.de ist die Seite (geprüft 2026-11-02).
 */
export function onSite(link: string, rssUrl: string): string {
  const x = new URL(link, rssUrl);
  const site = new URL(rssUrl);
  x.protocol = site.protocol;
  x.host = site.host;
  return x.href;
}

export class IkissDeScraper extends DeFeedScraper {
  readonly name = 'de-ikiss';
  readonly integrations = ['ikiss'];
  readonly resumesSourceList = true;
  private pages = new Map<string, string | null>();
  private termine = new Map<string, IkissTermin | null>();

  /** Seite lesen (robots.txt, Pause, Zeichensatz der Website), je URL einmal. */
  private async page(url: string): Promise<string | null> {
    if (this.pages.has(url)) {
      const cached = this.pages.get(url)!;
      this.noteCached(cached != null);
      return cached;
    }
    const robots = await this.robotsTxt(new URL(url).origin);
    let html: string | null = null;
    if (!robotsAllows(robots, url, UA_TOKEN)) {
      this.log(`robots.txt sperrt ${url}`);
      this.noteRobots();
    } else {
      await this.sleep(Math.max(this.delayMs, (robotsCrawlDelay(robots, UA_TOKEN) ?? 0) * 1000));
      const res = await this.fetchHtml(url, { retries: 2, charset: true });
      html = res.html;
      // iKISS-RSS kommt als XML; fetchHtml nimmt nur HTML an.
      if (html == null && /\/media\/rss\/[^/]+\.xml$/i.test(new URL(url).pathname)) {
        try {
          html = await this.fetchPage(url);
        } catch {
          html = null;
        }
      }
      if (html == null) this.log(`nicht lesbar: ${url}: ${res.error}`);
    }
    this.pages.set(url, html);
    return html;
  }

  /**
   * Detailseiten eines Kalenders: die Registry-Seite selbst, ihr RSS-Kanal
   * oder der Kalenderpfad, auf den sie verlinkt; dann alle Listenseiten bis
   * `MAX_TERMINE`.
   */
  async calendar(url: string): Promise<{ fid: string; url: string }[]> {
    const body = await this.page(url);
    if (body == null) return [];
    let listUrl = url;
    let html: string | null = body;
    let rssDetails: { fid: string; url: string }[] = [];
    const rss = parseIkissRss(body);
    if (rss) {
      rssDetails = rss.details.map(d => ({ ...d, url: onSite(d.url, url) }));
      if (!rss.calendarUrl) return rssDetails;
      listUrl = onSite(rss.calendarUrl, url);
      html = await this.page(listUrl);
      if (html == null) return rssDetails;
    }
    let list = parseIkissList(html, listUrl);
    if (!list.isList) {
      // Teaser oder Rubrikseite: die Liste liegt im Kalenderpfad der verlinkten Termine.
      const path = calendarPaths(html, listUrl).find(p => p !== listUrl);
      const up = path ? await this.page(path) : null;
      const upList = up && path ? parseIkissList(up, path) : null;
      if (upList?.isList) {
        list = upList;
        listUrl = path!;
      } else if (!list.details.length) {
        if (rssDetails.length) return rssDetails;
        this.log(`keine Veranstaltungsliste: ${url}`);
        return [];
      }
    }
    const details = new Map(list.details.map(d => [d.fid, d.url]));
    const last = Math.min((list.total ?? list.maxOffset + (list.pageSize ?? 0)) - 1, MAX_TERMINE - 1);
    if ((list.total ?? 0) > MAX_TERMINE) this.log(`abgeschnitten nach ${MAX_TERMINE} von ${list.total} Terminen: ${listUrl}`);
    for (let ofs = list.pageSize ?? Infinity; list.pagerTemplate && ofs <= last; ofs += list.pageSize!) {
      const p = await this.page(ikissPageUrl(list.pagerTemplate, ofs));
      if (p == null) break;
      const next = parseIkissList(p, listUrl).details.filter(d => !details.has(d.fid));
      if (!next.length) break;
      for (const d of next) details.set(d.fid, d.url);
    }
    return [...details].slice(0, MAX_TERMINE).map(([fid, u]) => ({ fid, url: u }));
  }

  private async termin(d: { fid: string; url: string }): Promise<IkissTermin | null> {
    const key = `${new URL(d.url).host}|${d.fid}`;
    if (this.termine.has(key)) return this.termine.get(key)!;
    const html = await this.page(d.url);
    const t = html ? parseIkissDetail(html, d.url) : null;
    if (html && !t) this.log(`kein Termin auf der Detailseite: ${d.url}`);
    this.termine.set(key, t);
    return t;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(ikissGroups());
    // Nachtlauf (fn-29.18): alle Detailseiten dauern gut zwei Stunden. Der
    // Lauf setzt je Website fort, nie mitten in einer: Amts- und
    // Gemeindekalender derselben Website teilen Termine (`taken`), die
    // Gemeinde-Seite gilt nur, wenn beide im selben Lauf gelesen werden.
    const byHost = new Map<string, FeedGroup[]>();
    for (const g of groups) {
      const h = hostKey(g.pageUrl);
      byHost.set(h, [...(byHost.get(h) ?? []), g]);
    }
    const all: ScrapedEvent[] = [];
    const taken = new Set<string>();
    let read = 0;
    for (const [host, hostGroups] of this.resumeGroups([...byHost], ([h]) => h)) {
      if (this.budgetSpent()) break;
      for (const g of hostGroups) await this.inCalendar(g, async () => {
        read++;
        const termine: IkissTermin[] = [];
        for (const d of await this.calendar(g.pageUrl)) {
          const key = `${new URL(d.url).host}|${d.fid}`;
          // Schon gelesene Termine kommen aus dem Speicher: kein zusätzlicher Abruf.
          const t = await this.termin(d);
          if (!t) continue;
          this.noteTermine([t]);
          if (taken.has(key)) continue;
          taken.add(key);
          termine.push(t);
        }
        const robots = termine.length ? await this.robotsTxt(new URL(g.pageUrl).origin) : null;
        const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
        const unique = collapseSourceDuplicates(allowed.map(t => ({ ...t, uid: t.fid })));
        all.push(...withoutPlaceholderImages(unique).map(t => this.toScraped(t, g)));
      });
      if (!this.budgetSpent()) this.groupDone(host);
    }
    this.log(`${read} von ${groups.length} Kalendern auf ${byHost.size} Websites, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: IkissTermin, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `ikiss-${new URL(ev.url).host}-${ev.fid}`,
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
    // „Ortschaft"/„Region" nennen die Gemeinde des Termins im Amtskalender
    // (Hamwarde im Kalender Amt Hohe Elbgeest), sind aber kein Ortsname.
    const named = [ev.locationName, ev.ortschaft, ev.region].filter(Boolean).join(', ') || undefined;
    const ctx = terminContext(g, { title: ev.title, locationName: named, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
