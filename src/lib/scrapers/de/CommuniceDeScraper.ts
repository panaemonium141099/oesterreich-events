/**
 * DE-Adapter communice (inixmedia, fn-29.8): liest die Kalenderliste aller
 * Registry-Einträge der Integration `communice` seitenweise
 * (`…/seite-N`, zwölf Termine je Seite), eigene Kalender und Amtskalender.
 * Bei mehrtägigen Terminen ohne Jahr des Beginns holt er Detailseite und
 * iCal des Termins (`communice.ts`).
 *
 * Ort: Im Amtskalender trägt der Termin die Gemeinde oder den Ortsteil als
 * Etikett („Busenwurth", „Tensbüttel-Röst"); ein Etikett, das genau eine
 * Gemeinde des Amts nennt, ist die Gemeinde des Termins. Nennt der
 * Veranstaltungsort eine andere Gemeinde in der Nähe („Churchnight",
 * Etikett Bargenstedt, Ort Heide), gilt der Ort (`otherGemeindeNamed`).
 * Ohne Etikett gilt `terminContext` wie bei den übrigen DE-Adaptern.
 *
 * Nicht im Nachtlauf, bevor der Prüfstand bestanden ist (Epic fn-29).
 */
import { applyGemeindeContext, type GemeindeContext } from '../gemeinde-context';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import type { GemeindeDe } from '@/lib/gemeinden/de';
import { normalizeGemeindeName } from '@/lib/location/gemeinde-name';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageAllowed } from './HwDeScraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, feedGemeinden, otherGemeindeNamed, terminContext } from './kontext';
import {
  communiceCalendarUrl, communiceIcalHref, communicePageUrl, communiceStartWithoutYear, communiceStartYear,
  communiceWhen, parseCommuniceList, type CommuniceListPage, type CommuniceTermin, type CommuniceWhen,
} from './communice';

/** Höchstens so viele Listenseiten à 12 je Kalender (480 Termine). */
const MAX_PAGES = 40;

export type CommuniceEvent = CommuniceTermin & CommuniceWhen;

/**
 * Kalender der Integration: eigene Kalenderseiten und Ausweichwege über das
 * Amt. Schlüssel ist die Kalenderseite (Detail-URLs der Registry zeigen auf
 * ihren Kalender); dieselbe Seite für mehrere Gemeinden ist ein Amtskalender.
 */
export function communiceGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    const key = communiceCalendarUrl(url);
    let g = groups.get(key);
    if (!g) { g = { feedUrl: key, pageUrl: key, own: [], viaVerband: [] }; groups.set(key, g); }
    return g;
  };
  for (const e of entries) {
    if (e.integration === 'communice' && e.url) group(e.url).own.push(e);
    if (e.fallback?.kind === 'verband' && e.fallback.integration === 'communice' && e.fallback.url) group(e.fallback.url).viaVerband.push(e);
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/** Eine Ebene höher: `/…/veranstaltungskalender/einreichen-1` → `/…/veranstaltungskalender`. */
function parentPath(url: string): string | null {
  const u = new URL(url);
  const path = u.pathname.replace(/\/+$/, '');
  const i = path.lastIndexOf('/');
  if (i <= 0) return null;
  u.pathname = path.slice(0, i);
  return u.href;
}

/** Gemeinde, die genau ein Etikett des Termins nennt (unter den Gemeinden des Kalenders). */
export function labelGemeinde(labels: string[], candidates: GemeindeDe[]): GemeindeDe | null {
  const want = new Set(labels.map(normalizeGemeindeName));
  const hits = candidates.filter(g => want.has(normalizeGemeindeName(g.name)) || want.has(normalizeGemeindeName(g.name.replace(/\s*\([^)]*\)\s*$/, ''))));
  return hits.length === 1 ? hits[0] : null;
}

function gemeindeContext(gem: GemeindeDe): GemeindeContext {
  return { name: gem.name, plz: gem.plz, lat: gem.lat, lng: gem.lng, bundesland: gem.land, bezirk: null };
}

export interface CalendarTermine { group: FeedGroup; termine: CommuniceEvent[] }

/** Pfad ohne Zählsuffix: `austraglertreffen-914` → `austraglertreffen`. */
const baseSlug = (slug: string) => slug.replace(/-\d+$/, '');
const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Termine aller Kalender, je Termin einmal. Die Gemeinde-Websites eines Amts
 * teilen oft eine communice-Datenbank und zeigen dieselben Termine („Laternenumzug
 * Schenefeld" auf wacken.de, vaale.de, poeschendorf.de …) oder Kopien mit
 * Zählsuffix (`austraglertreffen-914`, `-940`, `-953` im Holzland). Gleicher
 * Pfad ohne Suffix, gleicher Beginn, Titel und Ort heißt derselbe Termin; er
 * bleibt einmal, und weil er auf mehreren Websites steht, ist keine davon
 * sein Ort: Er bekommt die Gemeinden aller dieser Kalender als Amtskalender
 * (Gemeinde nur aus Etikett, Ortsangabe oder Titel). Vertreter ist der
 * Kalender mit der kleinsten URL (stabile source_id).
 *
 * Innerhalb eines Kalenders: Dubletten (`collapseSourceDuplicates`) und
 * Platzhalterbilder weg; dieselbe Detailseite an mehreren Tagen ohne Datum
 * in der URL bekommt den Tag in die source_id (`withDay`).
 */
export function acrossCalendars(cals: CalendarTermine[]): { termin: CommuniceEvent; group: FeedGroup; withDay: boolean }[] {
  const items: { termin: CommuniceEvent; group: FeedGroup; withDay: boolean; key: string }[] = [];
  for (const c of [...cals].sort((a, b) => a.group.pageUrl.localeCompare(b.group.pageUrl))) {
    const unique = withoutPlaceholderImages(collapseSourceDuplicates(c.termine.map(t => ({ ...t, uid: `${t.slug}|${t.urlDate ?? ''}|${t.localDate}` }))));
    const days = new Map<string, Set<string>>();
    for (const t of unique) {
      const k = `${t.slug}|${t.urlDate ?? ''}`;
      days.set(k, (days.get(k) ?? new Set()).add(t.localDate));
    }
    for (const t of unique) {
      items.push({
        termin: t,
        group: c.group,
        withDay: (days.get(`${t.slug}|${t.urlDate ?? ''}`)?.size ?? 1) > 1,
        key: JSON.stringify([baseSlug(t.slug), t.start, norm(t.title), norm(t.locationName)]),
      });
    }
  }
  const byKey = new Map<string, typeof items>();
  for (const it of items) byKey.set(it.key, [...(byKey.get(it.key) ?? []), it]);
  const out: { termin: CommuniceEvent; group: FeedGroup; withDay: boolean }[] = [];
  for (const list of byKey.values()) {
    const first = list[0];
    const pages = new Set(list.map(x => x.group.pageUrl));
    if (pages.size === 1) {
      for (const x of list) out.push({ termin: x.termin, group: x.group, withDay: x.withDay });
      continue;
    }
    const own = new Map<string, RegistryEntryDe>();
    for (const x of list) for (const e of [...x.group.own, ...x.group.viaVerband]) own.set(e.ags, e);
    out.push({ termin: first.termin, group: { ...first.group, own: [...own.values()], viaVerband: [] }, withDay: first.withDay });
  }
  return out;
}

export class CommuniceDeScraper extends DeFeedScraper {
  readonly name = 'de-communice';

  private async listPage(url: string): Promise<CommuniceListPage | null> {
    const html = await this.fetchHtmlPage(url);
    return html == null ? null : parseCommuniceList(html, url);
  }

  /**
   * Erste Seite des Kalenders: die Registry-Seite, sonst eine Ebene höher
   * („…/veranstaltungskalender/einreichen-1"), sonst `/veranstaltungen`
   * (Standardpfad laut 03-schleswig-holstein.md; Registry nennt teils die
   * Startseite).
   */
  async firstPage(pageUrl: string): Promise<{ url: string; page: CommuniceListPage } | null> {
    const tried = new Set<string>();
    for (const url of [pageUrl, parentPath(pageUrl), `${new URL(pageUrl).origin}/veranstaltungen`]) {
      if (!url || tried.has(url)) continue;
      tried.add(url);
      const page = await this.listPage(url);
      if (page?.isList) return { url, page };
    }
    this.log(`keine communice-Kalenderliste: ${pageUrl}`);
    return null;
  }

  async calendar(first: CommuniceListPage, url: string): Promise<CommuniceTermin[]> {
    const termine = [...first.termine];
    const last = Math.min(first.lastPage, MAX_PAGES);
    if (first.lastPage > MAX_PAGES) this.log(`abgeschnitten nach ${MAX_PAGES} Seiten: ${url}`);
    for (let n = 2; n <= last && first.pagerTemplate; n++) {
      const p = await this.listPage(communicePageUrl(first.pagerTemplate, n));
      if (!p || !p.termine.length) break;
      termine.push(...p.termine);
    }
    return termine;
  }

  /** Jahr des Beginns aus dem iCal des Termins (Detailseite → iCal-Link). */
  private async startYear(t: CommuniceTermin): Promise<string | undefined> {
    const want = communiceStartWithoutYear(t.dateText);
    if (!want) return undefined;
    const detail = await this.fetchHtmlPage(t.url);
    const ical = detail ? communiceIcalHref(detail, t.url) : null;
    const ics = ical ? await this.fetchFeed(ical) : null;
    const year = ics ? communiceStartYear(ics, want) : null;
    if (!year) this.log(`Jahr des Beginns unbekannt, verworfen: ${t.url}`);
    return year ?? undefined;
  }

  /** Datum der Termine; mehrtägige ohne Jahr nur, wenn sie noch nicht vorbei sind. */
  async withDates(termine: CommuniceTermin[], today: string): Promise<CommuniceEvent[]> {
    const out: CommuniceEvent[] = [];
    for (const t of termine) {
      let when = communiceWhen(t.dateText);
      if (!when && communiceStartWithoutYear(t.dateText)) {
        // Ende schon vorbei: kein Abruf, der Termin fiele ohnehin weg.
        const endYear = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(?:\d{1,2}:\d{2}\s*Uhr)?\s*$/.exec(t.dateText);
        const end = endYear ? `${endYear[3]}-${endYear[2].padStart(2, '0')}-${endYear[1].padStart(2, '0')}` : null;
        if (end && end < today) continue;
        const year = await this.startYear(t);
        when = year ? communiceWhen(t.dateText, year) : null;
      }
      if (when) out.push({ ...t, ...when });
    }
    return out;
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = communiceGroups().slice(0, this.limit ?? Infinity);
    const today = new Date().toISOString().slice(0, 10);
    // Mehrere Registry-Seiten können auf denselben Kalender führen
    // (Startseite → /veranstaltungen): je Kalender ein Lauf, Gemeinden vereint.
    const calendars = new Map<string, { group: FeedGroup; page: CommuniceListPage }>();
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
    const cals: CalendarTermine[] = [];
    for (const [url, { group, page }] of calendars) {
      const termine = await this.withDates(await this.calendar(page, url), today);
      // Bilder nur, wo robots.txt sie freigibt (Regel wie bei Hirsch & Wölfl).
      const robots = termine.length ? await this.robotsTxt(new URL(url).origin) : null;
      const allowed = termine.map(t => (t.image && !imageAllowed(robots, t.image) ? { ...t, image: undefined } : t));
      cals.push({ group, termine: allowed });
    }
    const all = acrossCalendars(cals).map(x => this.toScraped(x.termin, x.group, undefined, x.withDay));
    this.log(`${groups.length} Registry-Seiten, ${calendars.size} Kalender, ${all.length} Termine`);
    return all;
  }

  /** Termine eines Kalenders (Tests, Einzelkalender): wie `scrape`, ohne Abruf. */
  toScrapedAll(termine: CommuniceEvent[], g: FeedGroup): ScrapedEvent[] {
    return acrossCalendars([{ group: g, termine }]).map(x => this.toScraped(x.termin, x.group, undefined, x.withDay));
  }

  toScraped(ev: CommuniceEvent, g: FeedGroup, members = feedGemeinden([...g.own, ...g.viaVerband]), withDay = false): ScrapedEvent {
    const image = imageUrl(ev.image);
    const host = new URL(ev.url).host.replace(/^www\./, '');
    const day = ev.urlDate ?? (withDay ? ev.localDate : undefined);
    const fromLabel = labelGemeinde(ev.labels, members);
    const category = ev.labels.filter(l => !members.some(m => normalizeGemeindeName(m.name) === normalizeGemeindeName(l))).join(', ') || undefined;
    const base: ScrapedEvent = {
      source_name: this.name,
      // Pfad der Detailseite (TYPO3-Slug), bei Serien mit dem Tag.
      source_id: `communice-${host}-${ev.slug}${day ? `-${day}` : ''}`,
      source_url: ev.url,
      title: ev.title,
      description: ev.description,
      start_date: ev.start,
      ...(ev.end ? { end_date: ev.end } : {}),
      location_name: ev.locationName,
      category,
      ...(image ? { image_url: image, image_credit: imageCredit(ev.url) } : {}),
      country: 'DE',
    };
    let ctx: GemeindeContext;
    if (fromLabel) {
      const other = otherGemeindeNamed(fromLabel, { title: ev.title, locationName: ev.locationName });
      const gem = other === undefined ? fromLabel : other;
      // null: der Ort nennt eine fernere Gemeinde, dann nur das Gebiet des Kalenders.
      ctx = gem ? gemeindeContext(gem) : terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: true }, false);
    } else {
      ctx = terminContext(g, { title: ev.title, locationName: ev.locationName, hasOwnPlace: false });
    }
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
