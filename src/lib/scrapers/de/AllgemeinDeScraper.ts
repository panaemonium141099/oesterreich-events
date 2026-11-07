/**
 * DE-Adapter allgemeiner Parser (fn-29.16): liest die Kalenderseiten der
 * Stufen D (JSON-LD/Mikrodaten) und E (Liste mit Datum, JS oder Feed) der
 * DE-Gemeinde-Registry, dazu Gemeinden, die einen solchen Kalender ihres
 * Amts bzw. ihrer VG nutzen. Parser: `allgemein.ts`. Kontext wie bei den
 * übrigen DE-Adaptern (`kontext.ts`): die Gemeinde einer Seite, die genau
 * eine Gemeinde führt; im Amtskalender nur die Gemeinde, die der Termin
 * selbst nennt.
 *
 * Websites laufen nebeneinander, Seiten einer Website nacheinander mit
 * ihrem Crawl-delay (robots.txt, `feed-scraper.ts`).
 *
 * Im Nachtlauf seit fn-29.18 (`nachtlauf.ts`).
 */
import { applyGemeindeContext } from '../gemeinde-context';
import { detectNextPage } from '../pagination';
import { ortsdatenFor } from '@/lib/location/ortsdaten';
import { gemeindeDeByAgs } from '@/lib/gemeinden/de';
import { loadRegistryDe, singleGemeinde, type FeedGroup } from '@/lib/registry-de/load';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import type { ScrapedEvent } from '@/types/events';
import { DeFeedScraper } from './feed-scraper';
import { imageCredit, imageUrl, withoutPlaceholderImages } from './bild';
import { collapseSourceDuplicates, otherGemeindeNamed, sameTerminKey, terminContext, type FeedTermin } from './kontext';
import { allgemeinSourceId, parseAllgemeinPage, type AllgemeinTermin } from './allgemein';
import { calendarLinks } from '@/lib/registry-de/feed-url';

/** Integrationen der Vollerhebung ohne Hersteller-Schema (Stufen D und E). */
export const ALLGEMEIN_INTEGRATIONS = new Set(['jsonld', 'html_generic', 'js_oder_feed']);

/** Hersteller-Adapter, die nur einen bestätigten Feed lesen. */
const BRAUCHT_FEED = new Set(['ionas', 'tribe', 'eventsmanager', 'jevents', 'icagenda']);
/** Hersteller-Adapter, die eine Kalenderseite der Registry lesen. */
const BRAUCHT_SEITE = new Set(['txnews', 'contao_events', 'calendarize', 'events2', 'sfeventmgt', 'activecity', 'digipublica', 'hwext', 'ceasy', 'weblication', 'open2c', 'communice', 'komm1', 'mec']);

/**
 * Kalender, den dieser Adapter liest: eigene Integrationen, und alles, was der
 * Hersteller-Adapter nicht lesen kann (Nachtlauf 06.11.2026: 731 Gemeinden
 * „kein Kalender des Adapters“). Die CMS-Kennung sagt nichts über den Kalender:
 * ionas-Seiten ohne Kalendermodul führen Tabellen (vg-goellheim.de) oder
 * verlinken die Seite. Lizenzquellen bleiben draußen, DPCalendar auch: seine
 * Mikrodaten tragen die Zeit in UTC, die Regel „Wandzeit“ läge eine Stunde daneben
 * (Feldafing „Spieleabend“: 17:00+00:00, Seite 18:00).
 */
export function allgemeinSeite(integration: string, url: string | null | undefined, feed: string | undefined, host: string | null | undefined): string | null {
  const home = host ? `https://www.${host.replace(/^www\./, '')}/` : null;
  if (ALLGEMEIN_INTEGRATIONS.has(integration)) return url ?? home;
  if (BRAUCHT_FEED.has(integration)) return feed ? null : url ?? home;
  if (BRAUCHT_SEITE.has(integration)) return url ? null : home;
  return null;
}

/**
 * Startseiten liest der Adapter nicht als Kalender: dort stehen Termine neben
 * Meldungen („Halbseitige Sperrung der Fahrbahn" mit Datumsspanne auf
 * havelberg.de, „Öffentliche Bekanntmachung … Wahl" auf hausen-am-tann.de, Probe
 * 2026-10-29), und die Kachel unterscheidet beides nicht. Er folgt nur ihren
 * Kalenderlinks.
 */
export function isStartseite(url: string): boolean {
  return /^\/(?:index\.(?:php|html?)|home|startseite)?\/?$/i.test(new URL(url).pathname);
}

/**
 * Kalenderseiten der Registry je URL, mit den Gemeinden, die sie führen.
 * Teilen sich mehrere Gemeinden die Website (Amt, VG: Wikidata nennt für
 * Hintersee die Seite des Amts am Stettiner Haff, dessen Kalender Termine in
 * Eggesin und Mönkebude führt, Probe 2026-10-29), ist jede ihrer Seiten ein
 * Amtskalender: Ort nur, wenn der Termin seine Gemeinde nennt.
 */
export function allgemeinGroups(entries: RegistryEntryDe[] = loadRegistryDe()): FeedGroup[] {
  // Website einer Gemeinde: ihr Host und der Host ihrer Kalenderseite
  // (Hintersee: hintersee-online.de, Kalender auf amt-am-stettiner-haff.de).
  const bare = (h: string) => h.replace(/^www\./, '').toLowerCase();
  const hostsOf = (e: RegistryEntryDe) => new Set([e.host, e.url ? new URL(e.url).host : null].filter((h): h is string => !!h).map(bare));
  const byHost = new Map<string, Set<RegistryEntryDe>>();
  for (const e of entries) for (const h of hostsOf(e)) byHost.set(h, (byHost.get(h) ?? new Set()).add(e));
  // Eine Seite unter zwei Schreibweisen (amt-ssl.de und www.amt-ssl.de,
  // http und https) ist ein Kalender, sonst stünde jeder Termin doppelt.
  const groups = new Map<string, FeedGroup>();
  const group = (url: string) => {
    const u = new URL(url);
    const k = `${bare(u.host)}${u.pathname.replace(/\/+$/, '')}${u.search}`;
    let g = groups.get(k);
    if (!g) { g = { feedUrl: url, pageUrl: url, own: [], viaVerband: [] }; groups.set(k, g); }
    return g;
  };
  // Aufgefangene Einträge nur auf Websites, die kein Hersteller-Adapter liest:
  // Die Shard-Aufteilung hält so jede Website in einem Shard (`nachtlauf.ts`).
  const herstellerLiest = new Set<string>();
  const liest = (integration: string, url: string | null | undefined, feed: string | undefined) => {
    if (ALLGEMEIN_INTEGRATIONS.has(integration)) return;
    const page = BRAUCHT_FEED.has(integration) ? feed : BRAUCHT_SEITE.has(integration) ? url : undefined;
    if (page) herstellerLiest.add(bare(new URL(page).host));
  };
  for (const e of entries) {
    liest(e.integration, e.url, e.feed_url);
    if (e.fallback?.kind === 'verband') liest(e.fallback.integration, e.fallback.url, e.fallback.feed_url);
  }
  const seite = (integration: string, url: string | null | undefined, feed: string | undefined, host: string | null | undefined) => {
    const page = allgemeinSeite(integration, url, feed, host);
    return page && !ALLGEMEIN_INTEGRATIONS.has(integration) && herstellerLiest.has(bare(new URL(page).host)) ? null : page;
  };
  for (const e of entries) {
    const own = seite(e.integration, e.url, e.feed_url, e.host);
    if (own) group(own).own.push(e);
    const f = e.fallback;
    const viaAmt = f?.kind === 'verband' ? seite(f.integration, f.url, f.feed_url, f.host) : null;
    if (viaAmt) group(viaAmt).viaVerband.push(e);
  }
  for (const g of groups.values()) {
    for (const e of byHost.get(bare(new URL(g.feedUrl).host)) ?? []) {
      if (!g.own.includes(e) && !g.viaVerband.includes(e)) g.viaVerband.push(e);
    }
  }
  return [...groups.values()].sort((a, b) => a.feedUrl.localeCompare(b.feedUrl));
}

/** Folgeseiten je Kalender (pagination.ts, Pager zuerst). */
const MAX_FOLLOW_PAGES = 5;
/**
 * Websites gleichzeitig. Mehrere Websites können auf einem Server liegen
 * (verwaltungsportal.de sperrte bei 8 parallelen Websites die IP, fn-29.11,
 * 2026-10-29); vier halten jeden geteilten Server unter vier Abrufen je
 * Sekunde.
 */
const PARALLEL_HOSTS = 4;

/**
 * Derselbe Termin auf den Kalenderseiten mehrerer Gemeinden („gemeinsamer
 * Kalender" von Güglingen und Pfaffenhofen, Amt am Stettiner Haff und
 * meiersberg-online.de, Prüfstand 2026-10-29): eine Zeile, und keine der
 * Gemeinden ist sicher sein Ort. Er bekommt den Kontext aller dieser
 * Seiten, also einen Ort nur, wenn er selbst eine Gemeinde nennt.
 */
export function sharedCalendars<T extends FeedTermin>(read: { g: FeedGroup; termine: T[] }[]): { t: T; g: FeedGroup }[] {
  const sorted = [...read].sort((a, b) => a.g.feedUrl.localeCompare(b.g.feedUrl));
  const seen = new Map<string, { t: T; g: FeedGroup }>();
  const out: { t: T; g: FeedGroup }[] = [];
  for (const { g, termine } of sorted) {
    for (const t of termine) {
      const k = sameTerminKey(t);
      const first = seen.get(k);
      if (!first) {
        const item = { t, g };
        seen.set(k, item);
        out.push(item);
        continue;
      }
      if (first.g === g) continue;
      const merge = (a: FeedGroup['own'], b: FeedGroup['own']) => [...new Set([...a, ...b])];
      first.g = { ...first.g, own: merge(first.g.own, g.own), viaVerband: merge(first.g.viaVerband, g.viaVerband) };
    }
  }
  return out;
}

/**
 * Trägt eine verlinkte Seite einen Kalender? Eine Liste hat mehrere Termine, ein
 * einzelner Treffer steht in einem Artikel (horstmar.de „…um 19:00 Uhr im Borchorster
 * Hof“ wurde zum Titel), nur ausgezeichnete Termine gelten für sich.
 */
export function istKalender(termine: readonly { strategie?: string }[]): boolean {
  return termine.length >= 2 || termine.some(t => t.strategie !== 'liste');
}

const berlinToday = () => new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);

export class AllgemeinDeScraper extends DeFeedScraper {
  readonly name = 'de-allgemein';
  readonly integrations = [...ALLGEMEIN_INTEGRATIONS];
  protected fetchTimeoutMs = 20_000;

  /** Gemeindeseiten in ISO-8859-1 richtig lesen (fetch-html.ts). */
  protected fetchHtml(url: string, opts: Parameters<DeFeedScraper['fetchHtml']>[1] = {}) {
    return super.fetchHtml(url, { ...opts, charset: true });
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const groups = this.pickGroups(allgemeinGroups());
    const byHost = new Map<string, FeedGroup[]>();
    for (const g of groups) {
      const h = new URL(g.feedUrl).host;
      byHost.set(h, [...(byHost.get(h) ?? []), g]);
    }
    const queue = [...byHost.values()];
    const deadline = this.softDeadline();
    const today = berlinToday();
    const read: { g: FeedGroup; termine: (AllgemeinTermin & { uid: string })[] }[] = [];
    let pagesWithEvents = 0;
    const worker = async () => {
      for (let hostGroups = queue.shift(); hostGroups; hostGroups = queue.shift()) {
        for (const g of hostGroups) {
          if (Date.now() > deadline) return;
          const termine = await this.inCalendar(g, () => this.readCalendar(g.feedUrl, today));
          if (termine.length) pagesWithEvents++;
          read.push({ g, termine: withoutPlaceholderImages(collapseSourceDuplicates(termine.map(t => ({ ...t, uid: t.key })))) });
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL_HOSTS }, worker));
    const all = sharedCalendars(read).map(({ t, g }) => this.toScraped(t, g));
    this.log(`${groups.length} Kalenderseiten, ${pagesWithEvents} mit Terminen, ${all.length} Termine`);
    return all;
  }

  /**
   * Termine einer Registry-Seite. Bleibt sie ohne kommenden Termin (oder ist sie
   * die Startseite), folgt der Adapter ihren Kalenderlinks und nimmt die erste
   * Seite mit kommenden Terminen: die Erhebung hat teils die Startseite, eine
   * Meldung oder eine Unterseite erwischt (Seitenprobe 06.11.2026, pruem.de,
   * weeze.de, mitwitz.de).
   */
  private async readCalendar(url: string, today: string): Promise<AllgemeinTermin[]> {
    let base = url;
    let first = await this.fetchHtmlPage(base);
    // Registry-Seite tot (amt-huettener-berge.de, 16 Gemeinden: alter Pfad 404,
    // Kalender heute unter /das-amt/termine): von der Startseite aus suchen.
    if (first == null && !isStartseite(url)) {
      base = new URL('/', url).href;
      first = await this.fetchHtmlPage(base);
    }
    if (first == null) return [];
    const direct = isStartseite(base) ? [] : await this.readPages(base, first, today);
    if (direct.length) return direct;
    for (const link of calendarLinks(first, base)) {
      const termine = await this.readPages(link, null, today);
      if (istKalender(termine)) return termine;
    }
    return [];
  }

  /** Kalenderseite samt Folgeseiten, solange sie neue Termine bringen. */
  private async readPages(url: string, firstHtml: string | null, today: string): Promise<AllgemeinTermin[]> {
    const out: AllgemeinTermin[] = [];
    const seen = new Set<string>();
    const visited = new Set<string>();
    let next: string | null = url;
    for (let page = 0; next && page <= MAX_FOLLOW_PAGES; page++) {
      visited.add(next);
      const html: string | null = page === 0 && firstHtml != null ? firstHtml : await this.fetchHtmlPage(next);
      if (html == null) break;
      // Weiter, solange die Seite neue Termine trägt, auch vergangene: eine
      // Liste, die mit gestrigen Terminen beginnt, hat die künftigen auf den
      // Folgeseiten (Saarbrücken, Greetsiel, Mannheim, Prüfstand 2026-10-30).
      const all = parseAllgemeinPage(html, next, '', url).filter(t => !seen.has(t.key));
      if (all.length === 0) break;
      this.noteTermine(all);
      for (const t of all) seen.add(t.key);
      const termine = all.filter(t => t.localDate >= today);
      out.push(...termine);
      const n: string | null = detectNextPage(html, next).nextUrl;
      next = n && !visited.has(n) ? n : null;
    }
    return out;
  }

  toScraped(t: AllgemeinTermin, g: FeedGroup): ScrapedEvent {
    const address = [t.street, [t.postalCode, t.locality].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined;
    const image = imageUrl(t.image, t.url);
    const base: ScrapedEvent = {
      source_name: this.name,
      source_id: allgemeinSourceId(t),
      source_url: t.url,
      title: t.title,
      start_date: t.start,
      ...(t.end ? { end_date: t.end } : {}),
      location_name: t.locationName,
      address,
      postal_code: t.postalCode,
      city: t.locality,
      ...(image ? { image_url: image, image_credit: imageCredit(t.url) } : {}),
      country: 'DE',
      ...(t.lat != null && t.lng != null ? { latitude: t.lat, longitude: t.lng, coords_precision: 'venue' as const } : {}),
    };
    const hasOwnPlace = !!(t.locality || t.postalCode);
    // Nennt die Kachel eine andere Gemeinde („Ort: Witt's Gasthof, Krummbek"
    // im Kalender von Tröndel), ist der Kalender nicht ihr Ort: dann zählt
    // nur, was der Termin selbst nennt (kontext.ts), sonst Quarantäne.
    const single = singleGemeinde(g);
    const gem = single && !hasOwnPlace && t.placeText ? gemeindeDeByAgs(single.ags) : null;
    const ownCalendar = !gem || otherGemeindeNamed(gem, { title: t.title, locationName: t.placeText }) === undefined;
    const ctx = terminContext(g, { title: t.title, locationName: t.locationName, hasOwnPlace }, ownCalendar);
    const out = applyGemeindeContext(base, ctx, ortsdatenFor('DE')!);
    if (!out.bundesland) delete out.bundesland;
    return out;
  }
}
