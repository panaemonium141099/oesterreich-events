/**
 * DE-Adapter Feratel Deskline (fn-29, Rest-Adapter): liest je Registry-
 * Seite der Integration `deskline` das eingebettete DW5-Widget, holt den
 * Linkkey aus dessen Tag-Kontext und die Termine aus der Deskline-WebAPI
 * (Weg und Felder wie `FeratelScraper.ts` für Österreich, ohne
 * Detail-Abfrage: Serien stehen mit ihrem nächsten Termin in der Liste).
 * Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`): die Gemeinde
 * eines Kalenders, den genau eine Gemeinde führt; sonst nur die Gemeinde,
 * die der Termin selbst nennt (`town`).
 *
 * Mehrere Gemeinden teilen einen Linkkey (Zeller Land: 13 Gemeinden, ein
 * Widget): die WebAPI wird je Linkkey einmal gelesen, die weiteren Seiten
 * zählen als derselbe Kalender (`sameCalendar`).
 */
import { randomUUID } from 'node:crypto';
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { singleGemeinde, type FeedGroup } from '@/lib/registry-de/load';
import { gemeindeDeByAgs } from '@/lib/gemeinden/de';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { throughHostGate } from './host-gate';
import { aktuellerKalender } from './kalender-stand';
import { imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, otherGemeindeNamed, terminContext } from './kontext';
import { seitenGruppen } from './seiten-gruppen';
import { desklineEmbeds, desklineEventsUrl, linkKeyFromTagcontext, parseDesklinePage, tagcontextUrl, type DesklineEmbed, type DesklineTermin } from './deskline';

/** Höchstens so viele Seiten à 400 je Linkkey (2.000 Termine; moselneu: 1.942 am 07.11.2026). */
const MAX_PAGES = 5;
const FETCH_TIMEOUT_MS = 30_000;

export class DesklineDeScraper extends DeFeedScraper {
  readonly name = 'de-deskline';
  readonly integrations = ['deskline'];
  private readonly sessionId = randomUUID();
  private linkKeys = new Map<string, string | null>();
  private termine = new Map<string, DesklineTermin[] | null>();

  /** Linkkey eines Widgets, je Widget einmal gelesen. */
  private async linkKey(e: DesklineEmbed): Promise<string | null> {
    const key = `${e.owner}/${e.guid}`;
    if (this.linkKeys.has(key)) {
      this.noteCached(this.linkKeys.get(key) != null);
      return this.linkKeys.get(key)!;
    }
    const js = await this.fetchFeed(tagcontextUrl(e));
    const lk = js ? linkKeyFromTagcontext(js) : null;
    if (js && !lk) this.log(`kein linkKey im Tag-Kontext: ${tagcontextUrl(e)}`);
    this.linkKeys.set(key, lk);
    return lk;
  }

  /** WebAPI-Abruf mit den Pflicht-Headern der Deskline-WebAPI, durch die Sperre je Website. */
  private async api(url: string): Promise<string | null> {
    if (!(await this.gate(url))) return null;
    const k = aktuellerKalender();
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const body = await throughHostGate(url, this.delayMs, async () => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          try {
            const res = await fetch(url, {
              headers: { Accept: 'application/json', 'DW-Source': 'desklineweb', 'DW-SessionId': this.sessionId, 'User-Agent': this.userAgent },
              signal: controller.signal,
            });
            if (res.status === 429) {
              const wait = Math.min(120, parseInt(res.headers.get('Retry-After') || '30', 10) || 30);
              return { retryAfter: wait };
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
            return { body: await res.text() };
          } finally {
            clearTimeout(timer);
          }
        });
        if ('retryAfter' in body) {
          this.log(`WebAPI 429, warte ${body.retryAfter}s`);
          await this.sleep((body.retryAfter ?? 30) * 1000);
          continue;
        }
        if (k) k.abrufe++;
        return body.body;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        k?.fehler(msg);
        this.log(`nicht lesbar: ${url}: ${msg}`);
        return null;
      }
    }
    return null;
  }

  /** Alle Termine eines Linkkeys, je Linkkey einmal gelesen. */
  private async events(linkKey: string): Promise<DesklineTermin[] | null> {
    if (this.termine.has(linkKey)) {
      this.noteCached(this.termine.get(linkKey) != null);
      return this.termine.get(linkKey)!;
    }
    const out: DesklineTermin[] = [];
    let ok = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await this.api(desklineEventsUrl(linkKey, page));
      if (body == null) break;
      let p;
      try {
        p = parseDesklinePage(body);
      } catch {
        this.log(`kein JSON: ${linkKey} Seite ${page}`);
        break;
      }
      ok = true;
      out.push(...p.events);
      if (page + 1 >= p.pageCount) break;
      if (page + 1 === MAX_PAGES) this.log(`abgeschnitten nach ${MAX_PAGES * 400} von ${p.total} Terminen: ${linkKey}`);
    }
    this.termine.set(linkKey, ok ? out : null);
    return ok ? out : null;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(seitenGruppen('deskline'));
    const all: ScrapedEvent[] = [];
    const firstGroupOfKey = new Map<string, FeedGroup>();
    let withWidget = 0;
    let abroad = 0;
    for (const g of groups) await this.inCalendar(g, async () => {
      const html = await this.fetchHtmlPage(g.pageUrl);
      if (html == null) return;
      const embeds = desklineEmbeds(html);
      if (!embeds.length) {
        this.log(`kein Deskline-Widget auf der Seite: ${g.pageUrl}`);
        return;
      }
      withWidget++;
      const seen = new Set<string>();
      const termine: DesklineTermin[] = [];
      for (const e of embeds) {
        const lk = await this.linkKey(e);
        if (!lk || seen.has(lk)) continue;
        seen.add(lk);
        const first = firstGroupOfKey.get(lk);
        if (first) {
          // Derselbe Linkkey auf einer weiteren Seite: dieselben Termine, nicht noch einmal.
          this.sameCalendar(g, first);
          continue;
        }
        const ev = await this.events(lk);
        if (!ev) continue;
        firstGroupOfKey.set(lk, g);
        termine.push(...ev);
      }
      if (!termine.length) return;
      this.noteTermine(termine);
      const inland = termine.filter(t => t.country === 'DE');
      abroad += termine.length - inland.length;
      const unique = collapseSourceDuplicates(inland);
      all.push(...withoutPlaceholderImages(unique).map(t => this.toScraped(t, g)));
    });
    this.log(`${groups.length} Seiten, ${withWidget} mit Widget, ${firstGroupOfKey.size} Linkkeys, ${all.length} Termine${abroad ? ` (${abroad} außerhalb Deutschlands ausgelassen)` : ''}`);
    return all;
  }

  toScraped(ev: DesklineTermin, g: FeedGroup): ScrapedEvent {
    const image = imageUrl(ev.image);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `deskline-${ev.uid}`,
      // Die WebAPI ist keine Seite; die Kalenderseite der Gemeinde zeigt den Termin im Widget.
      source_url: g.pageUrl,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      city: ev.locality,
      category: ev.category,
      ...(ev.categoryLocked ? { category_locked: true, category_lock_reason: 'feratel criteria map' } : {}),
      ...(ev.tags.length ? { tags: ev.tags } : {}),
      ...(image ? { image_url: image, image_credit: ev.imageCredit ?? new URL(g.pageUrl).host.replace(/^www\./, '') } : {}),
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: ev.locationName ? ('venue' as const) : ('municipality' as const) } : {}),
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!ev.locality }, ownTown(g, ev));
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}

/**
 * Ein Linkkey liefert die Region, nicht nur die Gemeinde der Seite (rptzell
 * auf stadt-zell-mosel.de: Zell, aber auch Wittlich und Trier). Nennt der
 * Termin als `town` einen anderen Ort als die Gemeinde der Seite oder einen
 * ihrer Ortsteile, gilt der Seitenkontext nicht: keine Gemeinde-PLZ, kein
 * Mittelpunkt, der Resolver arbeitet mit dem genannten Ort.
 */
export function ownTown(g: FeedGroup, ev: { title: string; locality?: string }): boolean {
  const single = singleGemeinde(g);
  if (!single || !ev.locality) return true;
  const gem = gemeindeDeByAgs(single.ags);
  if (!gem) return true;
  return otherGemeindeNamed(gem, { title: ev.title, locationName: ev.locality }) === undefined;
}
