/**
 * DE-Adapter cEasy (hitcom, Modul `cVeka`; fn-29.15): liest die Trefferliste
 * aller Registry-Einträge der Integration `ceasy` seitenweise. Jede Website
 * gehört genau einer Gemeinde; Kontext wie bei den übrigen DE-Adaptern
 * (`kontext.ts`): die Gemeinde des Kalenders, eine eigene Adresse des
 * Termins geht vor, ein Ortsname einer Nachbargemeinde ebenso.
 *
 * Die Registry nennt oft eine Unterseite („…/Veranstaltungen/Maerkte",
 * „Veranstaltungsraeme-mieten"). Trägt sie keine Liste, gilt der Kalender,
 * auf den ihre Termin-Links zeigen (`…/Veranstaltungskalender/Veranstaltung?…&id=N`
 * → `…/Veranstaltungskalender`).
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
import { ceasyCalendarOf, ceasyNextUrl, parseCeasyList, type CeasyListPage, type CeasyTermin } from './ceasy';

/** Höchstens so viele Folgeseiten je Kalender (à 50 Termine). */
const MAX_PAGES = 20;

/** Kalender der Integration, je Registry-Seite einer (eine Website, eine Gemeinde). */
export function ceasyGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  for (const e of entries) {
    if (e.integration !== 'ceasy' || !e.url) continue;
    const g = groups.get(e.url) ?? { feedUrl: e.url, pageUrl: e.url, own: [], viaVerband: [] };
    g.own.push(e);
    groups.set(e.url, g);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/** Häufigster Kalender der Termin-Links auf derselben Website. */
export function calendarFromLinks(links: string[], pageUrl: string): string | null {
  const host = new URL(pageUrl).host;
  const n = new Map<string, number>();
  for (const l of links) {
    if (new URL(l).host !== host) continue;
    const c = ceasyCalendarOf(l);
    if (c) n.set(c, (n.get(c) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

export class CeasyDeScraper extends DeFeedScraper {
  readonly name = 'de-ceasy';

  private async listPage(url: string): Promise<CeasyListPage | null> {
    const html = await this.fetchHtmlPage(url);
    return html == null ? null : parseCeasyList(html, url);
  }

  /** Erste Listenseite: Registry-Seite, sonst der Kalender ihrer Termin-Links bzw. ihr Link auf den Veranstaltungskalender. */
  async firstPage(pageUrl: string): Promise<{ url: string; page: CeasyListPage } | null> {
    const first = await this.listPage(pageUrl);
    if (!first) return null;
    if (first.isList) return { url: pageUrl, page: first };
    // Termin-Links zeigen auf ihren Kalender; ohne solche genau ein Link „…/Veranstaltungskalender" (Bückeburg).
    const cal = calendarFromLinks(first.detailLinks, pageUrl) ?? (first.calendarLinks.length === 1 ? first.calendarLinks[0] : null);
    const page = cal && cal !== pageUrl ? await this.listPage(cal) : null;
    if (cal && page?.isList) return { url: cal, page };
    this.log(`keine cVeka-Liste: ${pageUrl}`);
    return null;
  }

  async calendar(first: CeasyListPage): Promise<CeasyTermin[]> {
    const termine = [...first.termine];
    let next = first.next;
    for (let n = 0; next && n < MAX_PAGES; n++) {
      const p = await this.listPage(ceasyNextUrl(next));
      if (!p || !p.termine.length) break;
      termine.push(...p.termine);
      next = p.next;
    }
    if (next) this.log(`abgeschnitten nach ${MAX_PAGES} Folgeseiten: ${first.next}`);
    const seen = new Set<string>();
    return termine.filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = ceasyGroups().slice(0, this.limit ?? Infinity);
    const done = new Set<string>();
    const all: ScrapedEvent[] = [];
    for (const g of groups) {
      const first = await this.firstPage(g.pageUrl);
      if (!first || done.has(first.url)) continue;
      done.add(first.url);
      const termine = await this.calendar(first.page);
      const robots = termine.length ? await this.robotsTxt(new URL(first.url).origin) : null;
      const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
      const unique = collapseSourceDuplicates(allowed.map(t => ({ ...t, uid: t.id })));
      all.push(...withoutPlaceholderImages(unique).map(t => this.toScraped(t, g)));
    }
    this.log(`${groups.length} Registry-Seiten, ${all.length} Termine`);
    return all;
  }

  toScraped(ev: CeasyTermin, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(ev.image);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: `ceasy-${new URL(ev.url).host.replace(/^www\./, '')}-${ev.id}`,
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
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
