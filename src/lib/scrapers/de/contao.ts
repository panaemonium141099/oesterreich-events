/**
 * Contao-Kalender (Core-Modul `calendar`), fn-29.14. REIN, kein I/O.
 *
 * Contao hat keinen Feed ohne Konfiguration (an keiner Gemeinde verlinkt,
 * `00-bundesweit.md` D3); gelesen wird das HTML der Kalenderseite:
 *
 * - Terminliste `mod_eventlist`: je Termin ein Block `.event` mit Klasse
 *   `cal_<Kalender>` und `upcoming|current|bygone`. Die Vorlagen sind je
 *   Website angepasst, maschinenlesbar sind drei Angaben des Cores:
 *   `<time datetime="2026-11-06T16:00:00+01:00">` (ohne Uhrzeit nur das
 *   Datum), der Linktitel „Name (Freitag, 06.11.2026, 16:00–17:30)“ und in
 *   der Monatsansicht `?day=…&times=<Beginn>,<Ende>` (Unix-Sekunden).
 * - Monatskalender `mod_calendar` (`table.calendar`): Termine je Tageszelle
 *   mit `times=`, Folgemonat über `th.head.next a` (`?month=JJJJMM`).
 *
 * Wiederkehrende Termine stehen je Vorkommen mit eigenem Datum in der Liste
 * und teilen die Detailseite. Ort: `.location` bzw. Schema.org `location`
 * mit `name` und `address` („St. Marcellusstraße 7, 27330 Asendorf“).
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { eventNameNodes, firstText, isNamelessTitle, visibleText } from '../event-title';
import { detectNextPage } from '../pagination';
import type { CmsTermin } from './cms-termin';

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

const BERLIN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Wandzeit in deutscher Ortszeit zu Unix-Sekunden: „2026-10-01“ und „10:00“. */
function berlinWall(sec: number): { date: string; time: string } {
  const p = Object.fromEntries(BERLIN.formatToParts(new Date(sec * 1000)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const instant = (date: string, time: string) => toUtcInstant(`${date}T${time}:00`) as string;

type When = Pick<CmsTermin, 'localDate' | 'start' | 'end' | 'allDay'>;

/**
 * `times=<Beginn>,<Ende>` der Monatsansicht. Ganztägig speichert Contao als
 * 00:00 bis 23:59:59 des letzten Tages; ein Ende gleich dem Beginn heißt
 * ohne Ende (Uetersen „Offenes Singen“ `1790859600,1790859600`).
 */
export function whenFromTimes(startSec: number, endSec: number): When | null {
  if (!Number.isFinite(startSec) || startSec <= 0) return null;
  const s = berlinWall(startSec);
  const e = Number.isFinite(endSec) && endSec > startSec ? berlinWall(endSec) : null;
  if (s.time === '00:00' && (!e || e.time === '23:59')) {
    return { localDate: s.date, start: s.date, ...(e && e.date > s.date ? { end: e.date } : {}), allDay: true };
  }
  return { localDate: s.date, start: instant(s.date, s.time), ...(e ? { end: instant(e.date, e.time) } : {}), allDay: false };
}

const MONTHS = ['jan', 'feb', 'mär', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];
/** „2026-11-06“, „06.11.2026“, „10. Oktober 2026“, „8. Nov 2026“. */
const DATE_RE = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\.(\d{1,2})\.\s?(\d{4})|(\d{1,2})\.?\s*(jan|feb|mär|mrz|apr|mai|jun|jul|aug|sep|okt|nov|dez)[a-zä]*\.?\s+(\d{4})/giu;
const TIME_RE = /(?<![\d.:])(\d{1,2}):(\d{2})(?![\d.])/g;
const pad = (n: string) => n.padStart(2, '0');

function tokenDate(m: RegExpMatchArray): string {
  if (m[1]) return `${m[1]}-${m[2]}-${m[3]}`;
  if (m[6]) return `${m[6]}-${pad(m[5])}-${pad(m[4])}`;
  const mon = m[8].toLowerCase() === 'mrz' ? 3 : MONTHS.indexOf(m[8].toLowerCase()) + 1;
  return `${m[9]}-${pad(String(mon))}-${pad(m[7])}`;
}

/** Daten und Uhrzeiten eines Datumstexts in Reihenfolge. */
function tokens(text: string): { dates: string[]; times: string[] } {
  const dates = [...text.matchAll(DATE_RE)].map(tokenDate);
  const times = [...text.matchAll(TIME_RE)].filter(m => +m[1] <= 23 && +m[2] <= 59).map(m => `${pad(m[1])}:${m[2]}`);
  return { dates, times };
}

/**
 * Datum aus einem Feld, das sich selbst als Datum auszeichnet (`.date`):
 * genau drei Zahlen Tag, Monat, Jahr mit beliebigem Trenner
 * (Gutweiler „09 //11 // 2026“, Schmidgaden `day`/`month`/`year` „01 11 2026“).
 */
export function fieldDate(text: string): string | undefined {
  // Monat als Wort („15 Nov. 2026“, Burgsponheim; „31 Okt. 2026“, Weinsheim).
  text = text.replace(/(?<!\p{L})(jan|feb|mär|mrz|apr|mai|jun|jul|aug|sep|okt|nov|dez)\p{L}*\.?/giu, m => {
    const k = m.slice(0, 3).toLowerCase();
    return String(k === 'mrz' ? 3 : MONTHS.indexOf(k) + 1);
  });
  const m = /^\D*?(\d{1,2})\D{1,8}(\d{1,2})\D{1,8}(\d{4})\D*$/.exec(text.trim());
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return undefined;
  return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
}

/**
 * Beginn und Ende eines Termins aus `datetime` (Beginn; der Versatz zählt
 * nicht, die Wandzeit ist maßgeblich wie in `jsonld.ts`) und dem Datumstext
 * der Seite („06.11.2026, 16:00–17:30“, „06.11.2026–08.11.2026“,
 * „06.11.2026 16:00–08.11.2026 12:00“). Ohne Uhrzeit ganztägig; ein Ende
 * vor oder gleich dem Beginn bleibt offen (Strohn „20:00 – 20:00“).
 */
export function contaoWhen(datetime: string | undefined, text: string): When | null {
  const dt = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/.exec(datetime?.trim() ?? '');
  const t = tokens(text);
  const date = dt?.[1] ?? t.dates[0];
  if (!date) return null;
  const time = dt ? (dt[2] ? `${dt[2]}:${dt[3]}` : undefined) : t.times[0];
  // Das Enddatum ist das erste Datum nach dem Beginn im Text.
  const endDate = t.dates.find(d => d > date);
  if (!time) return { localDate: date, start: date, ...(endDate ? { end: endDate } : {}), allDay: true };
  const start = instant(date, time);
  // Die Endzeit folgt der Beginnzeit im Text („16:00–17:30“).
  const i = t.times.indexOf(time);
  const endTime = i >= 0 ? t.times[i + 1] : undefined;
  let end = endTime ? instant(endDate ?? date, endTime) : undefined;
  if (end && end <= start) end = undefined;
  return { localDate: date, start, ...(end ? { end } : {}), allDay: false };
}

/** Datumsangabe am Ende des Linktitels: „Spielzeugbörse (Samstag, 21.11.2026 13:00–16:00)“. */
function titleDateText(title: string | undefined): string {
  const m = /\(([^()]*\d[^()]*)\)\s*$/.exec(title ?? '');
  return m && tokens(m[1]).dates.length ? m[1] : '';
}

/** Text mit Leerzeichen zwischen Elementen (`<div class="day">15</div><div class="month">Nov.</div>` ist „15 Nov.“). */
export function spacedText($: cheerio.CheerioAPI, node: cheerio.Cheerio<any>): string {
  return node.length ? cheerio.load(($.html(node) ?? '').replace(/></g, '> <')).root().text().replace(/\s+/g, ' ').trim() : '';
}

function timesParam(href: string | undefined): [number, number] | null {
  const m = /[?&](?:amp;)?times=(\d+),(\d+)/.exec(href ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

type Place = Pick<CmsTermin, 'locationName' | 'street' | 'postalCode' | 'locality'>;

/** Beschriftung vor dem Ort („Ort: Zuchtanlage“, „Wo: Pfarrkirche“, „Start: Grundschule Üxheim“). */
const stripLabel = (s: string) => s.replace(/^\p{L}+:\s*/u, '');

/**
 * Ortszeile mit Adresse: der Abschnitt vor der PLZ, der mit einer
 * Hausnummer endet, ist die Straße, davor steht der Name; nach der PLZ der
 * Ort bis zum nächsten Komma („Oberschule Stolpen, Pirnaer Landstraße 1,
 * 01833 Stolpen“, „Begegnungsstätte, Alleegässchen1 - 01558 Großenhain“,
 * „Sportheim VfB Eichenbühl: In den Rittern 3, 63928 Eichenbühl“). Folgt der
 * PLZ noch eine Straße („23746 Kellenhusen Kirchweg 20“), bleibt der Ort leer.
 */
export function parsePlace(text: string | undefined): Place {
  const t = clean(stripLabel(clean(text) ?? ''));
  if (!t) return {};
  const m = /(?<!\d)(\d{5})(?!\d)/.exec(t);
  if (!m) return { locationName: t };
  const before = t.slice(0, m.index).replace(/[\s,;:\-–]+$/, '');
  const after = t.slice(m.index + 5).split(',')[0].trim();
  const parts = before ? before.split(/\s*[,:;]\s*/).filter(Boolean) : [];
  const last = parts[parts.length - 1];
  const street = last && /\d+\s?[a-z]?$/i.test(last) ? last : undefined;
  const name = clean((street ? parts.slice(0, -1) : parts).join(', '));
  return {
    ...(name ? { locationName: name } : {}),
    ...(street ? { street } : {}),
    postalCode: m[1],
    ...(after && !/\d/.test(after) ? { locality: after } : {}),
  };
}

function location($: cheerio.CheerioAPI, block: cheerio.Cheerio<any>): Place {
  const loc = block.find('[itemprop="location"], .location').first();
  if (!loc.length) return {};
  const addrNode = loc.find('[itemprop="address"]').first();
  // Name in `name` oder in einem inneren `location` ohne eigenen Scope (Nienhagen).
  const named = loc.find('[itemprop="name"], [itemprop="location"]:not([itemscope])').first();
  if (!named.length && addrNode.length) {
    // „Ort: Hagensaal | Adresse: Dorfstraße 41, …“: ohne Adresse, Beschriftungen und Trenner.
    const copy = loc.clone();
    copy.find('[itemprop="address"]').remove();
    copy.find('*').filter((_, el) => /^\s*(\p{L}+\s*:|\|)\s*$/u.test($(el).text())).remove();
    const name = clean(stripLabel(clean(visibleText(copy))?.replace(/[\s|,;:]+$/, '') ?? ''));
    return { ...parsePlace(visibleText(addrNode)), ...(name ? { locationName: name } : {}) };
  }
  if (named.length) {
    const name = clean(stripLabel(clean(visibleText(named)) ?? ''));
    const addr = addrNode.length ? parsePlace(visibleText(addrNode)) : {};
    return { ...addr, ...(name ? { locationName: name } : {}) };
  }
  // `<p class="location">Gemeindehaus (Hauptstraße 1, 12345 Ort)</p>`
  const text = clean(visibleText(loc)) ?? '';
  const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(text);
  if (!m) return parsePlace(text);
  const name = clean(stripLabel(m[1]));
  return { ...parsePlace(m[2]), ...(name ? { locationName: name } : {}) };
}

/** Download statt Detailseite (Lichtenau `?file=…pdf`, Schwepnitz Plakat). */
const FILE_LINK = /[?&](?:amp;)?file=|\.(pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|webp)(?:[?#]|$)/i;
export const usableHref = (href: string | undefined) => !!href && !/^(mailto:|tel:|#|javascript:)/i.test(href) && !FILE_LINK.test(href);

const DETAIL = '[itemprop="url"][href], h1 a[href], h2 a[href], h3 a[href], h4 a[href], h5 a[href], h6 a[href]';

/**
 * Link zur Detailseite: ausgezeichnet (`itemprop="url"`, in der Überschrift),
 * sonst der erste Link auf derselben Website (ein Facebook-Link im Text ist
 * nicht die Detailseite, Georgenthal „Martinstag“).
 */
function detailLink(block: cheerio.Cheerio<any>, base: string): cheerio.Cheerio<any> {
  const named = block.find(DETAIL).filter((_, a) => usableHref(a.attribs.href)).first();
  if (named.length) return named;
  const host = new URL(base).host;
  return block.find('a[href]').filter((_, a) => usableHref(a.attribs.href) && absolute(a.attribs.href, base)?.startsWith(`${new URL(base).protocol}//${host}`) === true).first();
}

/** Datum, Uhrzeit und Datumsfelder gehören nicht zum Namen (Pommern „<small class="time">14.11.2026</small> St. Martins-Zug“). */
const DATE_PARTS = 'time, .time, .date, .datetime, .info, [itemprop="startDate"], [itemprop="endDate"]';

function nameText(node: cheerio.Cheerio<any>): string {
  if (!node.find(DATE_PARTS).length) return visibleText(node);
  const copy = node.clone();
  copy.find(DATE_PARTS).remove();
  return visibleText(copy);
}

/**
 * „Name| Ort: Gasthaus Maier Wurmsham“: Vorlage der Gemeinden Wurmsham,
 * Neufraunhofen und Markt Velden (`event-details-<gemeinde>/<id>.html`),
 * die den Ort mit „| Ort:“ an den Namen hängt.
 */
export function splitOrtSuffix(title: string): { title: string; place?: string } {
  const m = /^(.*?)\s*\|\s*Ort:\s*(.+)$/.exec(title);
  return m && clean(m[1]) ? { title: clean(m[1])!, place: clean(m[2]) } : { title };
}

export function absolute(href: string | undefined, base: string): string | undefined {
  if (!href || /^(mailto:|tel:|#|javascript:)/i.test(href)) return undefined;
  try {
    const u = new URL(href, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** Kennung der Detailseite ohne die Termin-Parameter der Monatsansicht. */
export function detailKey(url: string): string {
  const u = new URL(url);
  u.searchParams.delete('day');
  u.searchParams.delete('times');
  u.hash = '';
  return `${u.host}${u.pathname.replace(/\/+$/, '')}${u.search}`;
}

function parseEventBlock($: cheerio.CheerioAPI, el: any, base: string): CmsTermin | null {
  const block = $(el);
  const link = detailLink(block, base);
  const href = link.attr('href');
  const url = absolute(href, base);
  // Schema.org-Name, dann Überschrift, dann übrige Namensklassen: Sulzbachs `div.title`
  // trägt Überschrift und Beschreibung.
  const nameNodes = eventNameNodes(block);
  const named = clean(
    firstText(nameNodes.filter('[itemprop="name"]'), t => !isNamelessTitle(t), nameText) ||
      firstText(block.find('h1, h2, h3, h4, h5, h6'), t => !isNamelessTitle(t), nameText) ||
      firstText(nameNodes, t => !isNamelessTitle(t), nameText) ||
      // Erding: Bildlink mit Screenreader-Text vor dem Namenslink in `div.h4`.
      firstText(block.find(DETAIL).add(block.find('a[title]')), t => !isNamelessTitle(t), visibleText),
  );
  if (!named) return null;
  const { title, place } = splitOrtSuffix(named);

  const times = timesParam(href);
  const timeEl = block.find('time[datetime]').first();
  let when = times ? whenFromTimes(times[0], times[1]) : null;
  const paren = block.find('a[title]').map((_, a) => titleDateText(a.attribs.title)).get().find(Boolean) ?? '';
  if (!when && (timeEl.length || paren)) {
    when = contaoWhen(timeEl.attr('datetime'), paren || clean(timeEl.text()) || '');
    // Mehrtägig, je Tag gelistet (`event_upcoming`, Markt Velden „Gründungsfest der FF Eberspoint“:
    // `datetime` 17.06., Linktitel 18.06., 19.06., 20.06.): der gezeigte Tag ist ein Tag des
    // Termins, kein eigener Beginn. `mergeSameTermin` führt die Tage zu einem Termin bis zum letzten.
    const shown = tokens(paren || clean(timeEl.text()) || '').dates[0];
    if (when?.allDay && shown && shown > when.localDate && (!when.end || shown > when.end)) when = { ...when, end: shown };
  }
  if (!when) {
    // Angepasste Vorlagen ohne `datetime` und ohne Linktitel: Datums- und Zeitfelder.
    const text = clean(block.find('[class*="date"], [class*="time"], .info').map((_, el) => $(el).text()).get().join(' ')) ?? '';
    const loose = fieldDate(spacedText($, block.find('[class*="date"]').first()));
    if (tokens(text).dates.length) when = contaoWhen(undefined, text);
    else if (loose) when = contaoWhen(undefined, `${loose} ${text}`);
  }
  if (!when) return null;

  const img = block.find('img[itemprop="image"], .image_container img, img').first().attr('src');
  const image = absolute(img, base);
  return {
    key: url ? detailKey(url) : `${new URL(base).host}${new URL(base).pathname}#${title}`,
    ...(url ? { url } : {}),
    ...when,
    title,
    ...(place ? parsePlace(place) : location($, block)),
    ...(image && !image.startsWith('data:') ? { image } : {}),
  };
}

export interface ContaoPage {
  /** Contao-Kalender erkannt (Terminliste oder Monatskalender). */
  isCalendar: boolean;
  termine: CmsTermin[];
  /** Blöcke `.event` ohne Name oder lesbares Datum. */
  unreadable: number;
  /** Folgeseite der Terminliste (Pager). */
  nextPage: string | null;
  /** Folgemonat des Monatskalenders. */
  nextMonth: string | null;
  /**
   * Tage mit Terminen aus dem Minikalender (`?day=JJJJMMTT`), wenn die
   * Seite selbst nur die Termine eines Tages zeigt (Bienenbüttel, Modautal).
   */
  dayLinks: string[];
}

/**
 * Anker eines Termins in der Liste: Block-Klassen des Cores (`event`,
 * Status `upcoming|current|bygone`), Schema.org-Event, Beginn
 * (`datetime`, `startDate`) und Links der Monatsansicht (`times=`).
 */
const SEED = '.event, [itemtype*="schema.org/Event"], .upcoming, .current, .bygone, [itemprop="startDate"], time[datetime], a[href*="times="]';
const NAME = 'h1, h2, h3, h4, h5, h6, [itemprop="name"]';

/** Namen, Detailseiten und Tage in einem Teilbaum: ein Termin hat von jedem höchstens einen. */
function signature($: cheerio.CheerioAPI, node: cheerio.Cheerio<any>) {
  const names = new Set<string>();
  // Trägt der Teilbaum Schema.org-Namen, zählen nur sie: weitere Überschriften sind
  // Beschriftungen (Rerik `<h5 class="category">Sport, Natur, Outdoor-Aktivität</h5>`).
  const all = node.find(NAME).add(node.filter(NAME));
  const schema = all.filter('[itemprop="name"]');
  (schema.length ? schema : all).each((_, el) => {
    const n = $(el);
    if (n.closest('[itemprop="location"], .location').length) return;
    const t = clean(nameText(n));
    if (t && !isNamelessTitle(t)) names.add(splitOrtSuffix(t).title);
  });
  const hrefs = new Set<string>();
  // Je Angabe getrennt: ein Tag eines mehrtägigen Termins trägt `datetime` des ersten Tags und
  // im Linktitel den gezeigten Tag (Markt Velden), das sind nicht zwei Termine.
  const byTimes = new Set<string>();
  const byTitle = new Set<string>();
  const byDatetime = new Set<string>();
  node.find('a[href]').add(node.filter('a[href]')).each((_, a) => {
    const href = a.attribs.href;
    const detail = $(a).is('[itemprop="url"], h1 a, h2 a, h3 a, h4 a, h5 a, h6 a') || /times=|[?&]day=/.test(href ?? '') || !!titleDateText(a.attribs.title);
    if (detail && usableHref(href)) hrefs.add(href.replace(/[?&](?:amp;)?(day|times)=[^&]*/g, '').replace(/#.*$/, ''));
    const t = timesParam(href);
    if (t) byTimes.add(berlinWall(t[0]).date);
    const p = tokens(titleDateText(a.attribs.title)).dates[0];
    if (p) byTitle.add(p);
  });
  node.find('time[datetime], [itemprop="startDate"][content]').each((_, el) => {
    const d = /^\d{4}-\d{2}-\d{2}/.exec(el.attribs.datetime ?? el.attribs.content ?? '')?.[0];
    if (d) byDatetime.add(d);
  });
  return { names: names.size, hrefs: hrefs.size, dates: Math.max(byTimes.size, byTitle.size, byDatetime.size) };
}

const single = (s: ReturnType<typeof signature>) => s.names <= 1 && s.hrefs <= 1 && s.dates <= 1;

/**
 * Blöcke der Termine: von jedem Anker aufwärts bis zum größten Vorfahren,
 * der noch genau einen Termin trägt (Georgenthal: Datum und Name in
 * Nachbarspalten von `.item`; Wutha-Farnroda und Satow: `.card` ohne
 * Klasse `event`). Ein Anker mit mehreren Terminen ist ein Rahmen.
 */
function eventBlocks($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): any[] {
  const out = new Set<any>();
  root.find(SEED).each((_, seed) => {
    let node = $(seed);
    if (node.is('.header, .empty') || !single(signature($, node))) return;
    for (;;) {
      const parent = node.parent();
      if (!parent.length || parent.is('.mod_eventlist, .mod_calendar, td, tbody, table, body') || !single(signature($, parent))) break;
      node = parent;
    }
    out.add(node[0]);
  });
  // Ein Block in einem anderen zählt einmal.
  return [...out].filter(el => ![...out].some(o => o !== el && $.contains(o, el)));
}

export function parseContaoPage(html: string, pageUrl: string): ContaoPage {
  const $ = cheerio.load(html);
  // Zeilenumbrüche trennen im Ortsfeld Name, Straße und Ort („Erlebnisgolf Rerik<br>Parkweg 7<br>18230 Rerik“),
  // sonst Wörter.
  $('.location br, [itemprop="location"] br').replaceWith(', ');
  $('br').replaceWith(' ');
  // Contao setzt `<base href>`; relative Links gelten dazu, nicht zur Seite (Klinkrade).
  const base = absolute($('base[href]').first().attr('href'), pageUrl) ?? pageUrl;
  const lists = $('.mod_eventlist');
  const calendars = $('.mod_calendar');
  const blocks = [...eventBlocks($, lists), ...eventBlocks($, calendars.find('table.calendar'))];
  const termine: CmsTermin[] = [];
  let unreadable = 0;
  for (const el of blocks) {
    const t = parseEventBlock($, el, base);
    if (t) termine.push(t);
    else unreadable++;
  }

  let nextPage: string | null = null;
  if (lists.find('.pagination').length) nextPage = detectNextPage($.html(), base).nextUrl;

  const next = calendars.find('table.calendar th.next a[href], table.calendar th.head.next a[href]').first().attr('href');
  const nextMonth = next ? absolute(next, base) ?? null : null;

  // Minikalender: die Liste daneben zeigt nur einen Tag.
  const dayLinks: string[] = [];
  const dayOnly = !blocks.length || lists.toArray().every(l => /\?day=\d{8}/.test(pageUrl) || $(l).find('.event').length === 0);
  if (dayOnly) {
    calendars.find('table.minicalendar td a[href*="day="]').each((_, a) => {
      const u = absolute(a.attribs.href, base);
      if (u && /[?&]day=\d{8}/.test(u)) dayLinks.push(u);
    });
  }
  const miniNext = calendars.find('table.minicalendar th.next a[href]').first().attr('href');
  return {
    isCalendar: lists.length > 0 || calendars.length > 0,
    termine,
    unreadable,
    nextPage,
    nextMonth: nextMonth ?? (dayOnly && miniNext ? absolute(miniNext, base) ?? null : null),
    dayLinks: [...new Set(dayLinks)],
  };
}
