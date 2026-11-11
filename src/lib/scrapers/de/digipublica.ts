/**
 * DigiPublica (Neos-Plattform bayerischer Gemeinden), Veranstaltungsmodul
 * „gdc", fn-29.15.
 *
 * Zwei Wege auf derselben Seite:
 * - Kalenderblatt `[data-calendar]`: JSON aller kommenden Termine
 *   (`title`, `start`/`end` als Ortszeit ohne Offset, `url` der Detailseite
 *   mit `selectedDate=<Wochentag>, TT.MM.JJJJ, hh:mm Uhr`). Ohne Ende steht
 *   `1970-01-01T`. Ganztägige Termine tragen Platzhalterzeiten: Beginn
 *   00:00, 00:01 oder 00:05, Ende 23:55 oder 23:59 bzw. 00:05.
 * - Liste `.gdc-list .gdc-object`: Datum aus `.date-day`/`.date-month`/
 *   `.date-year` (ohne Jahr bei `dateFormat=shortDate`), Uhrzeit aus
 *   `.gdc-time` („19:30 Uhr ‐ 21:45 Uhr", „19 Uhr ‐ 23:59 Uhr"), Titel
 *   `.gdc-title a`, Text `.gdc-description`, Bild als `background-image` von
 *   `.gdc-image-container` (`.gdc-image-placeholder` ist das Gemeindelogo),
 *   Absage `.gdc-event-cancelled`. Die Liste zeigt oft nur die ersten
 *   15 Termine („Mehr laden" lädt per Skript nach).
 * Gibt es das Kalenderblatt, ist es die Quelle; die Liste ergänzt Text, Bild
 * und Absage für die Termine, die sie zeigt. Ort steht in keinem der beiden.
 * Detailseite `…/detail?<slug>-<ID>`: die ID gilt für alle Tage einer Reihe.
 * REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';

export interface DigipublicaTermin {
  /** Detailseite des Termins (mit `selectedDate`, sonst ohne). */
  url: string;
  /** Erster Query-Schlüssel der Detailseite (`preisschafkopfen--509535`). */
  key: string;
  /** Veranstaltungs-ID am Ende des Schlüssels. */
  id: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  image?: string;
  cancelled: boolean;
}

export interface DigipublicaPage {
  /** Veranstaltungsmodul gefunden (Liste oder Kalenderblatt, auch leer). */
  isCalendar: boolean;
  /** Termine kommen aus dem Kalenderblatt. */
  fromJson: boolean;
  termine: DigipublicaTermin[];
  /** Listeneinträge ohne Jahr (und ohne Datum im Link): nicht lesbar. */
  withoutYear: number;
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mär: '03', mae: '03', apr: '04', mai: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dez: '12',
};

const pad = (s: string | number) => String(s).padStart(2, '0');
const berlin = (date: string, hh: string, mm: string) => toUtcInstant(`${date}T${pad(hh)}:${mm}:00`) as string;

interface Clock { hh: string; mm: string }

/** Platzhalter für „ganztägig": Beginn 00:00 bis 00:05. */
const startPlaceholder = (c: Clock) => +c.hh === 0 && +c.mm <= 5;
/** Platzhalter für „bis Tagesende": 23:55 bis 23:59, oder 00:00 bis 00:05 als Ende. */
const endPlaceholder = (c: Clock) => (+c.hh === 23 && +c.mm >= 55) || (+c.hh === 0 && +c.mm <= 5);

/**
 * Beginn und Ende eines Termins aus Tag und Uhrzeit (Ortszeit Europe/Berlin).
 * Platzhalterzeiten heißen ganztägig bzw. Ende offen; ein Ende vor oder
 * gleich dem Beginn bleibt offen.
 */
export function digipublicaWhen(date: string, from?: Clock, endDate?: string, to?: Clock): Pick<DigipublicaTermin, 'localDate' | 'start' | 'end' | 'allDay'> {
  const d2 = endDate && endDate > date ? endDate : undefined;
  if (!from || startPlaceholder(from)) return { localDate: date, start: date, ...(d2 ? { end: d2 } : {}), allDay: true };
  const start = berlin(date, from.hh, from.mm);
  let end: string | undefined;
  if (to && !endPlaceholder(to)) end = berlin(d2 ?? date, to.hh, to.mm);
  else if (d2) end = d2;
  // Ende genau fünf Minuten nach dem Beginn ist das Formular, kein Ende
  // (Hirschau „Halloween" 18:00 bis 18:05, Eisenheim „Rathaussturm" 18:11 bis 18:16).
  if (end && end.length > 10 && (end <= start || Date.parse(end) - Date.parse(start) === 5 * 60_000)) end = d2;
  return { localDate: date, start, ...(end ? { end } : {}), allDay: false };
}

/** „2026-10-30T20:00:00" → Tag und Uhrzeit; „1970-01-01T" → nichts. */
function isoParts(v: unknown): { date: string; clock?: Clock } | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/.exec(typeof v === 'string' ? v : '');
  if (!m || m[1].startsWith('1970')) return null;
  return { date: m[1], ...(m[2] ? { clock: { hh: m[2], mm: m[3] } } : {}) };
}

/** Schlüssel und ID der Detailseite: `detail?<slug>-<ID>&…`. */
function detailKey(u: URL): { key: string; id: string } | null {
  if (!/\/detail$/.test(u.pathname)) return null;
  const key = decodeURIComponent(u.search.slice(1).split('&')[0] ?? '');
  const id = /-(\d+)$/.exec(key)?.[1];
  return id ? { key, id } : null;
}

function absolute(href: string | undefined, base: string): URL | null {
  if (!href) return null;
  try {
    return new URL(href.replace(/&amp;/g, '&'), base);
  } catch {
    return null;
  }
}

/** „Samstag, 31.10.2026, 19 Uhr" bzw. „…, 19:30 Uhr" aus `selectedDate`. */
function selectedDate(u: URL): { date: string; clock?: Clock } | null {
  const v = u.searchParams.get('selectedDate') ?? '';
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,\s*(\d{1,2})(?::(\d{2}))?\s*Uhr)?/.exec(v);
  if (!m) return null;
  return { date: `${m[3]}-${pad(m[2])}-${pad(m[1])}`, ...(m[4] ? { clock: { hh: m[4], mm: m[5] ?? '00' } } : {}) };
}

/** Uhrzeiten der Zeile `.gdc-time`: „19:30 Uhr ‐ 21:45 Uhr", „19 Uhr ‐ 23:59 Uhr". */
function clocks(text: string): { from?: Clock; to?: Clock } {
  const all = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*Uhr/g)]
    .filter(m => +m[1] <= 23 && +(m[2] ?? 0) <= 59)
    .map(m => ({ hh: m[1], mm: m[2] ?? '00' }));
  return { from: all[0], to: all[1] };
}

/** Tage der Zeile `.gdc-date` (Beginn, und nach „‐" das Ende); ohne Jahr null. */
function listDates($: cheerio.CheerioAPI, item: cheerio.Cheerio<any>): { start: string; end?: string } | null | 'no-year' {
  const days = item.find('.gdc-date .date-day').toArray();
  if (!days.length) return null;
  const read = (dayEl: any): string | 'no-year' | null => {
    const box = $(dayEl).parent();
    const day = /(\d{1,2})/.exec($(dayEl).text())?.[1];
    const monthText = box.find('.date-month').first().text().trim();
    const month = /^\d{1,2}/.test(monthText) ? pad(/^(\d{1,2})/.exec(monthText)![1]) : MONTHS[monthText.toLowerCase().slice(0, 3)];
    const year = /(\d{4})/.exec(box.find('.date-year').first().text())?.[1];
    if (!day || !month) return null;
    if (!year) return 'no-year';
    return `${year}-${month}-${pad(day)}`;
  };
  const start = read(days[0]);
  if (start == null || start === 'no-year') return start;
  const end = days[1] ? read(days[1]) : null;
  return { start, ...(typeof end === 'string' && end !== 'no-year' ? { end } : {}) };
}

function backgroundImage(item: cheerio.Cheerio<any>, base: string): string | undefined {
  const box = item.find('.gdc-image-container').first();
  const m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(box.attr('style') ?? '');
  const src = m?.[1] ?? item.find('.gdc-image img').first().attr('src');
  return src ? absolute(src, base)?.href : undefined;
}

interface ListItem {
  key: string;
  id: string;
  url: string;
  title: string;
  description?: string;
  image?: string;
  cancelled: boolean;
  when: Pick<DigipublicaTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null;
  noYear: boolean;
}

function listItems($: cheerio.CheerioAPI, base: string): ListItem[] {
  const out: ListItem[] = [];
  $('.gdc-list .gdc-object').each((_, el) => {
    const item = $(el);
    const titleA = item.find('.gdc-title a[href]').first();
    const title = clean(visibleText(item.find('.gdc-title').first()));
    const links = item.find('a[href]').toArray().map(a => absolute($(a).attr('href'), base)).filter((u): u is URL => !!u && !!detailKey(u));
    const main = absolute(titleA.attr('href'), base) ?? links[0];
    const k = main ? detailKey(main) : null;
    if (!title || !main || !k) return;
    const sel = links.map(selectedDate).find(Boolean) ?? null;
    const withSel = links.find(u => selectedDate(u));
    const dates = listDates($, item);
    const { from, to } = clocks(item.find('.gdc-time').first().clone().children('.gdc-event-cancelled').remove().end().text());
    let when: ListItem['when'] = null;
    if (sel) when = digipublicaWhen(sel.date, sel.clock ?? from, dates && dates !== 'no-year' ? dates.end : undefined, to);
    else if (dates && dates !== 'no-year') when = digipublicaWhen(dates.start, from, dates.end, to);
    const description = clean(visibleText(item.find('.gdc-description').first()));
    const image = item.find('.gdc-image-placeholder').length ? undefined : backgroundImage(item, base);
    out.push({
      ...k,
      url: (withSel ?? main).href,
      title,
      ...(description ? { description } : {}),
      ...(image ? { image } : {}),
      cancelled: item.find('.gdc-event-cancelled').length > 0,
      when,
      noYear: !when && dates === 'no-year',
    });
  });
  return out;
}

interface JsonEvent { title?: unknown; start?: unknown; end?: unknown; url?: unknown }

/** Eine Kalenderseite; `base` ist die abgerufene URL. */
export function parseDigipublicaPage(html: string, base: string): DigipublicaPage {
  const $ = cheerio.load(html);
  const raw: JsonEvent[] = [];
  $('[data-calendar]').each((_, x) => {
    try {
      const a = JSON.parse($(x).attr('data-calendar') ?? '[]');
      if (Array.isArray(a)) raw.push(...a);
    } catch {
      /* kein JSON: Liste gilt */
    }
  });
  const items = listItems($, base);
  const isCalendar = $('.gdc-list').length > 0 || $('[data-calendar]').length > 0;
  const byKeyDay = new Map(items.filter(i => i.when).map(i => [`${i.key}|${i.when!.localDate}`, i]));
  const termine: DigipublicaTermin[] = [];
  if (raw.length) {
    const seen = new Set<string>();
    for (const e of raw) {
      const u = absolute(typeof e.url === 'string' ? e.url : undefined, base);
      const k = u ? detailKey(u) : null;
      const s = isoParts(e.start);
      const title = clean(typeof e.title === 'string' ? cheerio.load(e.title).text() : undefined);
      if (!u || !k || !s || !title) continue;
      const end = isoParts(e.end);
      const when = digipublicaWhen(s.date, s.clock, end?.date, end?.clock);
      const id = `${k.key}|${when.start}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const li = byKeyDay.get(`${k.key}|${when.localDate}`);
      termine.push({
        url: u.href, ...k, ...when, title,
        ...(li?.description ? { description: li.description } : {}),
        ...(li?.image ? { image: li.image } : {}),
        cancelled: li?.cancelled ?? false,
      });
    }
    return { isCalendar, fromJson: true, termine, withoutYear: 0 };
  }
  for (const i of items) {
    if (!i.when) continue;
    termine.push({
      url: i.url, key: i.key, id: i.id, ...i.when, title: i.title,
      ...(i.description ? { description: i.description } : {}),
      ...(i.image ? { image: i.image } : {}),
      cancelled: i.cancelled,
    });
  }
  return { isCalendar, fromJson: false, termine, withoutYear: items.filter(i => i.noYear).length };
}
