/**
 * TYPO3-Kalender-Extensions calendarize, events2 und sf_event_mgt, fn-29.14.
 * REIN, kein I/O.
 *
 * Keine der Extensions hat einen Feed ohne Konfiguration (`00-bundesweit.md`
 * D2; der calendarize-ICS-Link der Jümme ist leer, der tx_news-iCal
 * `type=9819` in Ohmbach antwortet 500, beide 2026-10-30). Die Vorlagen sind
 * je Website angepasst; fest sind die Links zur Detailseite, die jede
 * Extension mit ihren Parametern bzw. Routen baut. Je Detail-Link ist die
 * Karte der größte Block, der nur diesen Termin trägt; darin der Name
 * (Überschrift, sonst Linktext) und die Terminzeile („01.11.2026 13:00 Uhr“,
 * „13.11.2026 17:30 - Open End“, „11.09.2026 - 30.10.2026 All day“,
 * „Sa. 07. Nov. 2026“).
 *
 * calendarize liest die Terminzeile mit `parseCalendarizeTerm` aus
 * `calendarize-card.ts` (dieselbe Grammatik wie die AT-Kalenderkarten), die
 * AT-Vorlage selbst (`h4.card-title` + `.calendar_wrap`) mit
 * `readCalendarizeCard`. Trägt die Karte kein Datum (events2 Donnersdorf
 * zeigt nur den Tag, Poing den Tag ohne Jahr), liest der Adapter die
 * Detailseite (`parseTypo3Detail`).
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { parseCalendarizeTerm, readCalendarizeCard } from '../calendarize-card';
import { firstText, isNamelessTitle, visibleText } from '../event-title';
import { detectNextPage } from '../pagination';
import { ldEventsFromHtml, type LdEvent } from './jsonld';
import { absolute, contaoWhen, fieldDate, parsePlace, spacedText, usableHref } from './contao';
import type { CmsTermin } from './cms-termin';

export type Typo3Ext = 'calendarize' | 'events2' | 'sfeventmgt';

/** Detail-Link je Extension: Parameter (`…[index]=`, `…[event]=`) oder Route. */
const DETAIL: Record<Typo3Ext, RegExp> = {
  calendarize: /tx_calendarize_calendar(?:%5B|\[)index(?:%5D|\])=(\d+)|\/termin\/([^/?#]+)/,
  events2: /tx_events2_(?:events|show)(?:%5B|\[)event(?:%5D|\])=(\d+)|\/(\d{4}-\d{2}-\d{2}_\d{4})\/([^/?#]+)/,
  sfeventmgt: /tx_sfeventmgt_pievent[a-z]*(?:%5B|\[)event(?:%5D|\])=(\d+)/,
};

const MARK: Record<Typo3Ext, RegExp> = {
  calendarize: /calendarize/,
  events2: /tx[-_]events2/,
  sfeventmgt: /tx[-_]sf[-_]?event[-_]?mgt|tx_sfeventmgt/,
};

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

/** Kennung des Termins aus dem Detail-Link (Extension, ID, bei events2 auch der Tag). */
export function detailId(ext: Typo3Ext, href: string): string | null {
  const decoded = href.replace(/&amp;/g, '&');
  const m = DETAIL[ext].exec(decoded);
  if (!m) return null;
  // events2 führt je Tag einen Termin desselben Ereignisses (`…[timestamp]=`).
  const day = ext === 'events2' ? /tx_events2_(?:events|show)(?:%5B|\[)timestamp(?:%5D|\])=(\d+)/.exec(decoded)?.[1] : undefined;
  return [...m.slice(1).filter(Boolean), ...(day ? [day] : [])].join('-');
}

/** Welche Extension die Seite trägt (Termin-Links zählen, nicht nur Klassen). */
export function detectExt(html: string): Typo3Ext | null {
  let best: Typo3Ext | null = null;
  let most = 0;
  for (const ext of Object.keys(DETAIL) as Typo3Ext[]) {
    if (!MARK[ext].test(html)) continue;
    const ids = new Set<string>();
    for (const m of html.matchAll(/href="([^"]+)"/g)) {
      if (!/format(?:%5D|\])=ics/.test(m[1])) {
        const id = detailId(ext, m[1]);
        if (id) ids.add(id);
      }
    }
    if (ids.size > most) { most = ids.size; best = ext; }
  }
  return best;
}

const WEEKDAY = /^(?:mo|di|mi|do|fr|sa|so|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\.?,?\s+/i;
/** Beginnt mit einem Datum („01.11.2026“, „Sa. 07. Nov. 2026“), nicht mit Fließtext. */
const TERM_START = /^\d{1,2}\.\s?(?:\d{1,2}\.\s?\d{4}|(?:jan|feb|mär|mrz|apr|mai|jun|jul|aug|sep|okt|nov|dez)[a-zä]*\.?\s+\d{4})/i;

/** Terminzeile der Karte: das erste kurze Element, dessen Text mit einem Datum beginnt. */
function termLine($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): string | undefined {
  let found: string | undefined;
  card.find('*').each((_, el) => {
    if (found) return false;
    const t = clean($(el).text())?.replace(WEEKDAY, '');
    if (t && t.length <= 90 && TERM_START.test(t)) found = t;
    return undefined;
  });
  return found;
}

/**
 * Terminzeile von calendarize: „//“ (Gönnheim) und „Uhr“ fallen weg, „All
 * day“/„Ganztags“ heißt ohne Uhrzeit. Ein Endtag ohne Uhrzeit ist das Ende
 * eines ganztägigen Termins („01.10.2026 - 10.11.2026 Ganztags“).
 */
export function calendarizeWhen(line: string): Pick<CmsTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const text = line.replace(WEEKDAY, '').replace(/\/\//g, ' ').replace(/\s*uhr\b/gi, '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  const term = parseCalendarizeTerm(text);
  if (!term) return null;
  if (!term.time) {
    const m = /-\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(text);
    const end = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined;
    return { localDate: term.date, start: term.date, ...(end && end > term.date ? { end } : {}), allDay: true };
  }
  // 00:00 ohne Ende bzw. bis 00:00 oder 23:59 ist ein Termin ohne Uhrzeit (Prem „Allerheiligen“,
  // Dülmen „02.10.2026 00:00 - 30.10.2026 00:00“), wie in `jsonld.ts`.
  if (term.time === '00:00' && (!term.end || /T(00:00|23:59)$/.test(term.end))) {
    const endDate = term.end?.slice(0, 10);
    return { localDate: term.date, start: term.date, ...(endDate && endDate > term.date ? { end: endDate } : {}), allDay: true };
  }
  const start = toUtcInstant(`${term.date}T${term.time}:00`) as string;
  const end = term.end ? (toUtcInstant(`${term.end}:00`) as string) : undefined;
  return { localDate: term.date, start, ...(end ? { end } : {}), allDay: false };
}

/**
 * Uhrzeit in einem eigenen kurzen Feld der Karte („<p>18:00 Uhr</p>“, Burgsponheim;
 * Tabellenzeile „Uhrzeit | 19:00 Uhr - 20:30 Uhr“, Grevenbroich).
 */
function timeField($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): string {
  let t = '';
  card.find('p, span, div, time, td, dd').each((_, el) => {
    const s = clean($(el).text()) ?? '';
    if (!t && s.length <= 30 && /^(?:ab\s+)?\d{1,2}:\d{2}/.test(s)) t = s;
  });
  return t;
}

export function cardWhen(ext: Typo3Ext, $: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): Pick<CmsTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const line = termLine($, card);
  if (line) {
    // Zeile nur mit Datum, Uhrzeit in eigenem Feld daneben (Grevenbroich „Datum | Mi 04.11.2026“).
    const time = /\d:\d{2}/.test(line) ? '' : timeField($, card);
    if (time) return contaoWhen(undefined, `${line} ${time}`);
    return ext === 'calendarize' ? calendarizeWhen(line) : contaoWhen(undefined, line);
  }
  // Tag, Monat und Jahr in eigenen Feldern (`.date` > `.day`/`.month`/`.year`).
  const d = fieldDate(spacedText($, card.find('[class*="date"]').first()));
  return d ? contaoWhen(undefined, `${d.split('-').reverse().join('.')} ${timeField($, card)}`) : null;
}

/** Größter Block um den Link, der keinen anderen Termin und höchstens einen Namen trägt. */
function cardOf($: cheerio.CheerioAPI, link: cheerio.Cheerio<any>, ext: Typo3Ext, id: string): cheerio.Cheerio<any> {
  const only = (node: cheerio.Cheerio<any>) => {
    const ids = new Set<string>();
    node.find('a[href]').each((_, a) => {
      const x = detailId(ext, a.attribs.href ?? '');
      if (x) ids.add(x);
    });
    if (ids.size > 1 || (ids.size === 1 && !ids.has(id))) return false;
    let names = 0;
    // Überschriften mit der Terminzeile („<h4>13.11.2026 17:30 - Open End</h4>“, Oberzissen) sind kein Name.
    node.find('h1, h2, h3, h4, h5, h6').each((_, h) => {
      const t = clean($(h).text()) ?? '';
      if (!isNamelessTitle(t) && !TERM_START.test(t.replace(WEEKDAY, ''))) names++;
    });
    return names <= 1;
  };
  let node = link;
  for (;;) {
    const parent = node.parent();
    if (!parent.length || parent.is('body, main, ul, ol, table, tbody') || !only(parent)) return node;
    node = parent;
  }
}

/** „Einzelansicht: Schlachtschüssel …“, „Den Artikel lesen: …“: Beschriftung vor dem Namen im Linktitel. */
const titleOfLink = (t: string | undefined) => clean(t?.replace(/^[^:]{3,30}:\s*/, ''));

function cardTitle($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>, links: cheerio.Cheerio<any>): string | undefined {
  const heading = firstText(card.find('h1, h2, h3, h4, h5, h6, [itemprop="headline"], [itemprop="name"]'), t => !!clean(t) && !isNamelessTitle(t) && !TERM_START.test(clean(t)!.replace(WEEKDAY, '')), visibleText);
  if (heading) return clean(heading);
  const text = firstText(links, t => !!clean(t) && !isNamelessTitle(t), visibleText);
  return clean(text) ?? titleOfLink(links.first().attr('title'));
}

function cardPlace(card: cheerio.Cheerio<any>): Pick<CmsTermin, 'locationName' | 'street' | 'postalCode' | 'locality'> {
  const loc = card.find('[class*="location"], [itemprop="location"]').first();
  return loc.length ? parsePlace(visibleText(loc)) : {};
}

export interface Typo3Page {
  ext: Typo3Ext | null;
  termine: CmsTermin[];
  /** Karten ohne lesbares Datum: Detailseite lesen. */
  needDetail: { key: string; url: string; title: string; image?: string }[];
  nextPage: string | null;
}

function fromLd(e: LdEvent, base: string): CmsTermin {
  const url = e.url ? absolute(e.url, base) : undefined;
  return {
    // Mit Sprungmarke: Britz-Chorin-Oderberg verlinkt jeden Termin als `/events#event-16543`.
    key: url ? `${new URL(url).host}${new URL(url).pathname}${new URL(url).search}${new URL(url).hash}` : `${new URL(base).host}${new URL(base).pathname}#${e.name}`,
    ...(url ? { url } : {}),
    localDate: e.localDate,
    start: e.start,
    ...(e.end ? { end: e.end } : {}),
    allDay: e.allDay,
    title: e.name,
    ...(e.description ? { description: e.description } : {}),
    ...(e.locationName ? { locationName: e.locationName } : {}),
    ...(e.street ? { street: e.street } : {}),
    ...(e.postalCode ? { postalCode: e.postalCode } : {}),
    ...(e.locality ? { locality: e.locality } : {}),
    ...(e.organizer ? { organizer: e.organizer } : {}),
    ...(e.image ? { image: absolute(e.image, base) } : {}),
    ...(e.imageWidth ? { imageWidth: e.imageWidth, imageHeight: e.imageHeight } : {}),
    ...(e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng } : {}),
  };
}

export function parseTypo3Page(html: string, pageUrl: string): Typo3Page {
  const $ = cheerio.load(html);
  $('br').replaceWith(' ');
  $('script:not([type="application/ld+json"]), style, noscript').remove();
  const base = absolute($('base[href]').first().attr('href'), pageUrl) ?? pageUrl;

  // Schema.org-Events auf der Liste (Nördlingen, Britz-Chorin-Oderberg).
  const ld = ldEventsFromHtml(html);
  const ext = detectExt(html);
  if (ld.length && !ext) return { ext: null, termine: ld.map(e => fromLd(e, base)), needDetail: [], nextPage: null };
  if (!ext) return { ext: null, termine: [], needDetail: [], nextPage: null };

  const placeSuffix = false;
  const termine: CmsTermin[] = [];
  const needDetail: Typo3Page['needDetail'] = [];
  const seen = new Set<string>();
  $('a[href]').each((_, a) => {
    const href = a.attribs.href ?? '';
    if (/format(?:%5D|\])=ics/.test(href) || !usableHref(href)) return;
    const id = detailId(ext, href);
    const url = id ? absolute(href, base) : undefined;
    if (!id || !url || seen.has(id)) return;
    seen.add(id);
    const card = cardOf($, $(a), ext, id);
    const links = card.find('a[href]').filter((_, x) => detailId(ext, x.attribs.href ?? '') === id);
    const title = cardTitle($, card, links);
    if (!title) return;
    const img = card.find('img[src]').first().attr('src');
    const image = img && !img.startsWith('data:') ? absolute(img, base) : undefined;
    const key = `${ext}-${new URL(url).host}-${id}`;
    // AT-Vorlage der Kalenderkarte.
    const at = ext === 'calendarize' ? readCalendarizeCard(card, placeSuffix) : null;
    // events2: die Liste zeigt den Tag, Beginn und Ende stehen im JSON-LD der Detailseite (Wedel „Beginn: 16:00 Uhr“ ohne Datum).
    const when = ext === 'events2'
      ? null
      : at
      ? calendarizeWhen(`${at.start.date.split('-').reverse().join('.')}${at.start.time ? ` ${at.start.time}` : ''}${at.end ? ` - ${at.end.slice(0, 10).split('-').reverse().join('.')} ${at.end.slice(11)}` : ''}`)
      : cardWhen(ext, $, card);
    if (!when) {
      needDetail.push({ key, url, title, ...(image ? { image } : {}) });
      return;
    }
    termine.push({ key, url, ...when, title, ...cardPlace(card), ...(image ? { image } : {}) });
  });

  const pager = $('.pagination, .f3-widget-paginator, .page-navigation, nav[aria-label*="eite"]').length;
  return { ext, termine, needDetail, nextPage: pager ? detectNextPage($.html(), base).nextUrl : null };
}

/**
 * Detailseite eines Termins: JSON-LD (events2 setzt `@type: Event` mit
 * `startDate` in Ortszeit, Wedel 2026-10-30), sonst die Terminzeile im
 * Inhaltsbereich (calendarize Niebüll ohne JSON-LD).
 */
export function parseTypo3Detail(ext: Typo3Ext, html: string, url: string, title: string): Omit<CmsTermin, 'key'> | null {
  const ld = ldEventsFromHtml(html);
  const e = ld.find(x => x.name === title) ?? (ld.length === 1 ? ld[0] : undefined);
  if (e) {
    const { key: _k, ...t } = fromLd({ ...e, url: e.url ?? url }, url);
    return { ...t, url, title };
  }
  const $ = cheerio.load(html);
  $('br').replaceWith(' ');
  $('script, style, noscript, header, footer, nav').remove();
  // Nur der Bereich der Extension, sonst träfe die Terminzeile ein Datum der Seite.
  const scope = $('.calendarize, .tx-calendarize, .tx-sf-event-mgt, .tx-events2').first();
  const main = scope.length ? scope : $('main').length ? $('main') : $('body');
  const when = cardWhen(ext, $, main);
  return when ? { url, ...when, title } : null;
}
