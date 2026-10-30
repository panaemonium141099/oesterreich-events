/**
 * DE-Adapter TYPO3- und Contao-Kalender (fn-29.14): liest die Kalenderseiten
 * aller Registry-Einträge der Integrationen `contao_events`, `calendarize`,
 * `events2`, `sfeventmgt` und `txnews` (eigene Seiten und Ausweichwege über
 * Amt/VG). Welche Vorlage eine Seite trägt, entscheidet ihr HTML, nicht das
 * Registry-Merkmal: Contao (`contao.ts`), die TYPO3-Extensions über ihre
 * Detail-Links (`typo3.ts`), sonst Schema.org-Events der Seite. tx_news-
 * Listen sind Nachrichten (das Datum ist das der Meldung) und werden nicht
 * als Termine gelesen.
 *
 * Kontext wie bei den übrigen DE-Adaptern (`kontext.ts`). Nicht im
 * Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29, fn-29.18).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, terminContext } from './kontext';
import { imageAllowed } from './HwDeScraper';
import { parseContaoPage } from './contao';
import { parseTypo3Detail, parseTypo3Page } from './typo3';
import type { CmsTermin } from './cms-termin';

export const TYPO3_INTEGRATIONS = ['contao_events', 'calendarize', 'events2', 'sfeventmgt', 'txnews'];

/** Folgeseiten einer Liste, Folgemonate eines Monatskalenders, Tage eines Minikalenders, Detailseiten. */
const MAX_PAGES = 15;
const MAX_MONTHS = 6;
const MAX_DAYS = 60;
const MAX_DETAILS = 150;

/** Kalenderseiten der Integrationen; eine Seite, die mehrere Gemeinden führen, ist ein gemeinsamer Kalender. */
export function typo3Groups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    let g = groups.get(url);
    if (!g) { g = { feedUrl: url, pageUrl: url, own: [], viaVerband: [] }; groups.set(url, g); }
    return g;
  };
  for (const e of entries) {
    if (TYPO3_INTEGRATIONS.includes(e.integration) && e.url) group(e.url.replace(/&amp;/g, '&')).own.push(e);
    if (e.fallback?.kind === 'verband' && TYPO3_INTEGRATIONS.includes(e.fallback.integration ?? '') && e.fallback.url) {
      group(e.fallback.url.replace(/&amp;/g, '&')).viaVerband.push(e);
    }
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/**
 * Derselbe Termin aus Liste und Monatskalender einer Seite (Uetersen) oder
 * je Tag eines mehrtägigen Termins gelistet (Markt Velden): gleiche
 * Detailseite und gleicher Beginn sind ein Termin; fehlende Angaben kommen
 * aus dem weiteren Eintrag, das Ende ist das späteste.
 */
export function mergeSameTermin(termine: CmsTermin[]): CmsTermin[] {
  const out = new Map<string, CmsTermin>();
  for (const t of termine) {
    const k = `${t.key}|${t.start}`;
    const cur = out.get(k);
    if (!cur) out.set(k, t);
    else {
      const add = Object.fromEntries(Object.entries(t).filter(([f, v]) => v != null && (cur as unknown as Record<string, unknown>)[f] == null));
      const end = cur.end && t.end && t.end > cur.end ? { end: t.end } : {};
      out.set(k, { ...cur, ...add, ...end });
    }
  }
  // Ein Eintrag ohne Detailseite neben demselben Termin mit Detailseite (gleicher Name und Beginn;
  // Bleicherode „Kirmes Pustleben“ als Teaser ohne Link und in der Liste mit Link) ist derselbe Termin.
  const linked = new Map<string, string>();
  for (const [k, t] of out) if (t.url) linked.set(`${t.title.toLowerCase()}|${t.start}`, k);
  for (const [k, t] of [...out]) {
    if (t.url) continue;
    const target = linked.get(`${t.title.toLowerCase()}|${t.start}`);
    if (!target) continue;
    const cur = out.get(target)!;
    const add = Object.fromEntries(Object.entries(t).filter(([f, v]) => f !== 'key' && v != null && (cur as unknown as Record<string, unknown>)[f] == null));
    out.set(target, { ...cur, ...add, ...(t.end && (!cur.end || t.end > cur.end) ? { end: t.end } : {}) });
    out.delete(k);
  }
  return [...out.values()];
}

export type CalendarStatus = 'contao' | 'typo3' | 'jsonld' | 'kein_kalender' | 'nicht_lesbar';

export class Typo3DeScraper extends DeFeedScraper {
  readonly name = 'de-typo3';
  /** Ergebnis je Kalenderseite (für den Prüfstand-Bericht). */
  readonly status = new Map<string, { status: CalendarStatus; termine: number }>();

  /** Alle Termine einer Contao-Kalenderseite: Folgeseiten, Folgemonate, Tage des Minikalenders. */
  private async contao(first: ReturnType<typeof parseContaoPage>): Promise<CmsTermin[]> {
    const termine = [...first.termine];
    let next = first.nextPage;
    for (let n = 2; next && n <= MAX_PAGES; n++) {
      const html = await this.fetchHtmlPage(next);
      if (!html) break;
      const p = parseContaoPage(html, next);
      if (!p.termine.length) break;
      termine.push(...p.termine);
      next = p.nextPage && p.nextPage !== next ? p.nextPage : null;
    }
    // Monatskalender bzw. Minikalender: die folgenden Monate.
    let page = first;
    const days = new Set(first.dayLinks);
    for (let m = 1; page.nextMonth && m < MAX_MONTHS; m++) {
      const html = await this.fetchHtmlPage(page.nextMonth);
      if (!html) break;
      page = parseContaoPage(html, page.nextMonth);
      termine.push(...page.termine);
      for (const d of page.dayLinks) days.add(d);
    }
    // Tage des Minikalenders, wenn die Liste daneben nur einen Tag zeigt (Bienenbüttel, Modautal).
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const upcoming = [...days].filter(u => (/[?&]day=(\d{8})/.exec(u)?.[1] ?? '') >= today).slice(0, MAX_DAYS);
    for (const u of upcoming) {
      const html = await this.fetchHtmlPage(u);
      if (html) termine.push(...parseContaoPage(html, u).termine);
    }
    return termine;
  }

  /** Alle Termine einer Seite mit TYPO3-Extension: Folgeseiten, dann Detailseiten der Karten ohne Datum. */
  private async typo3(first: ReturnType<typeof parseTypo3Page>): Promise<CmsTermin[]> {
    const termine = [...first.termine];
    const need = [...first.needDetail];
    let next = first.nextPage;
    const seen = new Set<string>();
    for (let n = 2; next && n <= MAX_PAGES && !seen.has(next); n++) {
      seen.add(next);
      const html = await this.fetchHtmlPage(next);
      if (!html) break;
      const p = parseTypo3Page(html, next);
      if (!p.termine.length && !p.needDetail.length) break;
      termine.push(...p.termine);
      need.push(...p.needDetail);
      next = p.nextPage;
    }
    const ext = first.ext!;
    const unique = [...new Map(need.map(d => [d.key, d])).values()];
    if (unique.length > MAX_DETAILS) this.log(`Detailseiten abgeschnitten nach ${MAX_DETAILS}: ${unique.length}`);
    for (const d of unique.slice(0, MAX_DETAILS)) {
      const html = await this.fetchHtmlPage(d.url);
      const t = html ? parseTypo3Detail(ext, html, d.url, d.title) : null;
      if (t) termine.push({ key: d.key, ...t, ...(t.image ? {} : d.image ? { image: d.image } : {}) });
    }
    return termine;
  }

  /** Termine einer Kalenderseite und welche Vorlage sie trägt. */
  async calendar(pageUrl: string): Promise<{ status: CalendarStatus; termine: CmsTermin[] }> {
    const html = await this.fetchHtmlPage(pageUrl);
    if (html == null) return { status: 'nicht_lesbar', termine: [] };
    if (/mod_eventlist|mod_calendar/.test(html)) {
      const p = parseContaoPage(html, pageUrl);
      if (p.isCalendar) return { status: 'contao', termine: mergeSameTermin(await this.contao(p)) };
    }
    const t = parseTypo3Page(html, pageUrl);
    if (t.ext) return { status: 'typo3', termine: mergeSameTermin(await this.typo3(t)) };
    if (t.termine.length) return { status: 'jsonld', termine: mergeSameTermin(t.termine) };
    return { status: 'kein_kalender', termine: [] };
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = typo3Groups().slice(0, this.limit ?? Infinity);
    const all: ScrapedEvent[] = [];
    const ids = new Set<string>();
    for (const g of groups) {
      const { status, termine } = await this.calendar(g.pageUrl);
      this.status.set(g.pageUrl, { status, termine: termine.length });
      // Bilder nur, wo robots.txt sie freigibt (beide Schreibweisen, wie bei Hirsch & Wölfl).
      const robots = termine.length ? await this.robotsTxt(new URL(g.pageUrl).origin) : null;
      const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
      const unique = collapseSourceDuplicates(allowed.map(t => ({ ...t, uid: `${t.key}|${t.localDate}` })));
      for (const t of withoutPlaceholderImages(unique)) {
        const s = this.toScraped(t, g);
        // Mehrere Registry-Seiten derselben Website zeigen teils denselben Kalender.
        if (ids.has(s.source_id)) continue;
        ids.add(s.source_id);
        all.push(s);
      }
    }
    const by = new Map<CalendarStatus, number>();
    for (const { status } of this.status.values()) by.set(status, (by.get(status) ?? 0) + 1);
    this.log(`${groups.length} Kalenderseiten (${[...by].map(([k, v]) => `${k} ${v}`).join(', ')}), ${all.length} Termine`);
    return all;
  }

  toScraped(ev: CmsTermin, g: FeedGroup): ScrapedEvent {
    const address = [ev.street, [ev.postalCode, ev.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const sourceUrl = ev.url ?? g.pageUrl;
    const image = imageUrl(ev.image, sourceUrl);
    const base: ScrapedEvent = {
      source_name: this.name,
      // Detailseite (bzw. Extension und Datensatz) und Tag: Serien teilen die Detailseite.
      source_id: `t3-${ev.key}-${ev.localDate}`,
      source_url: sourceUrl,
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
        image_credit: imageCredit(sourceUrl),
        ...(ev.imageWidth ? { image_width: ev.imageWidth, image_height: ev.imageHeight } : {}),
      } : {}),
      country: 'DE',
      ...(ev.lat != null && ev.lng != null ? { latitude: ev.lat, longitude: ev.lng, coords_precision: 'venue' as const } : {}),
    };
    const ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: !!(ev.locality || ev.postalCode) });
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
