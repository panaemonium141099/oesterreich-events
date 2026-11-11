/**
 * communice web (inixmedia GmbH; TYPO3-Extension `communice_calendar`),
 * fn-29.8.
 *
 * Gelesen wird die Kalenderliste `<Kalenderseite>[/seite-N]`, zwölf Termine
 * je Seite ab heute, je Termin ein `article.event` mit Titel und Link zur
 * Detailseite (`…/veranstaltung/<slug>`, bei Serien `…/<slug>/<JJJJ-MM-TT>`),
 * Datum und Uhrzeit, Ort, Etiketten (im Amtskalender die Gemeinde oder der
 * Ortsteil, dazu Rubriken), Text und Bild. Zwei Versionen der Vorlage:
 *
 * - neu (Mitteldithmarschen, Teisendorf): `.calendar-detail--meta--datetime`
 *   mit Klasse `calendar-datetime--…-full-day` bei Terminen ohne Uhrzeit,
 *   `.calendar-detail--meta--location`, `.calendar-detail--meta--labels`;
 * - alt (Babenhausen, Wacken): `ul.list-meta-date` mit Kalender-, Uhr- und
 *   Ortssymbol, Etiketten in `ul.list-meta-labels`.
 *
 * Der Atom-Feed `…/rss` hilft nicht: er nennt bei Terminen ohne Uhrzeit die
 * Uhrzeit der Anlage („Churchnight" 12:10, Liste und Detailseite ganztägig;
 * Mitteldithmarschen 2026-10-30). Die Liste lässt bei mehrtägigen Terminen
 * das Jahr des Beginns weg („14.11. – 31.12.2026" begann am 14.11.2025);
 * das Jahr liefert dann das iCal des Termins (`communiceIcalHref`).
 * REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';
import { parseIcalDate, readVEvents } from './ical';

export interface CommuniceWhen {
  localDate: string;
  /** Instant (ISO, UTC) oder reines Datum bei ganztägigen Terminen. */
  start: string;
  end?: string;
  allDay: boolean;
}

export interface CommuniceTermin {
  /** Detailseite (absolut). */
  url: string;
  /** Pfad nach `/veranstaltung/` ohne Datum. */
  slug: string;
  /** Datum aus der Detail-URL bei Serien (`…/<slug>/2026-11-07`). */
  urlDate?: string;
  title: string;
  /** Datum und Uhrzeit, wie die Liste sie zeigt (Leerraum zusammengefasst). */
  dateText: string;
  locationName?: string;
  labels: string[];
  description?: string;
  image?: string;
}

export interface CommuniceListPage {
  /** communice-Kalenderliste erkannt (auch leer: „Keine Veranstaltung gefunden"). */
  isList: boolean;
  termine: CommuniceTermin[];
  /** Höchste Seitenzahl im Pager (1 ohne Pager). */
  lastPage: number;
  /** Folgeseite als Vorlage (`…/seite-2`), sonst null. */
  pagerTemplate: string | null;
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

/** Instant aus Wandzeit in deutscher Ortszeit (Europe/Berlin = Europe/Vienna bei Offset und Umstellung). */
const berlin = (date: string, hh: string, mm: string) => toUtcInstant(`${date}T${hh.padStart(2, '0')}:${mm}:00`) as string;

const DAY = /(\d{1,2})\.(\d{1,2})\.(\d{4})?/;
const TIME = /(\d{1,2}):(\d{2})\s*Uhr/i;

interface Part { day: string; month: string; year?: string; hh?: string; mm?: string }

function readPart(text: string, needDate: boolean): Part | null {
  const d = DAY.exec(text);
  if (needDate && !d) return null;
  const t = TIME.exec(text);
  const time = t && +t[1] <= 23 && +t[2] <= 59 ? { hh: t[1], mm: t[2] } : {};
  return { day: d?.[1].padStart(2, '0') ?? '', month: d?.[2].padStart(2, '0') ?? '', ...(d?.[3] ? { year: d[3] } : {}), ...time };
}

/** Beginn und Ende als Teile; „–" trennt sie. */
function splitWhen(dateText: string): { from: Part; to: Part | null } | null {
  const [left, right] = dateText.split(/\s[–—-]\s?|\s?[–—]\s/, 2);
  const from = readPart(left, true);
  if (!from) return null;
  return { from, to: right ? readPart(right, false) : null };
}

/**
 * Tag und Monat des Beginns, wenn die Liste das Jahr weglässt (mehrtägige
 * Termine), sonst null.
 */
export function communiceStartWithoutYear(dateText: string): { day: string; month: string } | null {
  const w = splitWhen(dateText);
  return w && !w.from.year ? { day: w.from.day, month: w.from.month } : null;
}

/**
 * Datum und Uhrzeit aus der Zeile der Liste. Ohne Uhrzeit ganztägig (kein
 * erfundenes 00:00). `startYear` ergänzt das Jahr des Beginns, das die Liste
 * bei mehrtägigen Terminen weglässt; fehlt es, gibt es keinen Termin. Ein
 * Ende vor dem Beginn (Babenhausen „05.12. – 07.12.2025" mit Beginn
 * 5.12.2026 im iCal: Serie, deren Ende stehen blieb) bleibt offen.
 */
export function communiceWhen(dateText: string, startYear?: string): CommuniceWhen | null {
  const w = splitWhen(dateText);
  if (!w) return null;
  const { from, to } = w;
  const year = from.year ?? startYear;
  if (!year) return null;
  const d1 = `${year}-${from.month}-${from.day}`;
  const d2raw = to?.day && to.year ? `${to.year}-${to.month}-${to.day}` : undefined;
  const d2 = d2raw && d2raw > d1 ? d2raw : undefined;
  // „00:00 Uhr" ohne Ende ist die leere Uhrzeit des Formulars (Reichertsheim
  // „Nikolausdienst Landvolk Ramsau", 06.12.2026), wie bei JSON-LD (`jsonld.ts`).
  if (from.hh == null || (+from.hh === 0 && from.mm === '00' && to?.hh == null)) {
    return { localDate: d1, start: d1, ...(d2 ? { end: d2 } : {}), allDay: true };
  }
  const start = berlin(d1, from.hh, from.mm!);
  let end: string | undefined;
  if (to?.hh != null && (d2 || !to.day)) end = berlin(d2 ?? d1, to.hh, to.mm!);
  else if (d2) end = d2;
  if (end && end.length > 10 && end <= start) end = undefined;
  return { localDate: d1, start, ...(end ? { end } : {}), allDay: false };
}

/** Pfad nach `/veranstaltung/` und ein Datum am Ende (Serien). */
export function communiceSlug(url: string): { slug: string; urlDate?: string } | null {
  const m = /\/veranstaltung\/([^?#]+?)\/?$/.exec(new URL(url).pathname);
  if (!m) return null;
  const d = /^(.*)\/(\d{4}-\d{2}-\d{2})$/.exec(m[1]);
  return d ? { slug: d[1], urlDate: d[2] } : { slug: m[1] };
}

/** Text der Liste; ein mit „…" abgeschnittener Anrisstext ist keine Beschreibung. */
function teaser(node: cheerio.Cheerio<any>): string | undefined {
  const t = clean(visibleText(node));
  return t && !/(…|\.\.\.)$/.test(t) ? t : undefined;
}

function parseArticle($: cheerio.CheerioAPI, el: any, base: string): CommuniceTermin | null {
  const art = $(el);
  const link = art.find('header h1 a[href], .event--title a[href]').first();
  const href = link.attr('href');
  const title = clean(visibleText(link));
  if (!href || !title) return null;
  const url = new URL(href, base).href;
  const slug = communiceSlug(url);
  if (!slug) return null;

  // Neue Vorlage: eigener Block; alte: Listenpunkt mit Kalendersymbol.
  let dateNode = art.find('.calendar-detail--meta--datetime').first();
  if (!dateNode.length) dateNode = art.find('ul.list-meta-date li').filter((_, li) => $(li).find('.fa-calendar').length > 0).first();
  const dateText = clean(dateNode.text());
  if (!dateText) return null;

  let locNode = art.find('.calendar-detail--meta--location').first();
  if (!locNode.length) locNode = art.find('ul.list-meta-date li').filter((_, li) => $(li).find('.fa-map-marker, .fa-map-marker-alt').length > 0).first();
  const labels = art.find('.calendar-detail--meta--labels .label, ul.list-meta-labels .label')
    .map((_, l) => clean(visibleText($(l))))
    .get()
    .filter((l): l is string => !!l);
  const img = art.find('.event-image-wrap img, img.event-item-image').first().attr('src');
  const text = art.find('.event--text, .event-text-col').first();
  return {
    url,
    ...slug,
    title,
    dateText,
    locationName: locNode.length ? clean(visibleText(locNode)) : undefined,
    labels,
    description: text.length ? teaser(text) : undefined,
    ...(img ? { image: new URL(img, base).href } : {}),
  };
}

/** Eine Seite der Kalenderliste; `base` ist die abgerufene URL (für relative Links). */
export function parseCommuniceList(html: string, base: string): CommuniceListPage {
  const $ = cheerio.load(html);
  const list = $('section.calendar-list, [class*="ce-communicecalendar_calendarlist"]');
  const isList = list.length > 0 && /communice/i.test(html);
  const termine: CommuniceTermin[] = [];
  if (isList) {
    list.find('article.event').each((_, el) => {
      const t = parseArticle($, el, base);
      if (t) termine.push(t);
    });
  }
  let lastPage = 1;
  let pagerTemplate: string | null = null;
  // Nur der Pager zählt; Seiten ohne Pager haben eine Seite.
  $('ul.pagination a[href]').each((_, a) => {
    const href = $(a).attr('href')!;
    const m = /\/seite-(\d+)\/?(?:[?#]|$)/.exec(href);
    if (!m) return;
    const n = Number(m[1]);
    if (n > lastPage) lastPage = n;
    if (!pagerTemplate && n >= 2) pagerTemplate = new URL(href, base).href;
  });
  return { isList, termine: dedupeByUrl(termine), lastPage, pagerTemplate };
}

function dedupeByUrl(t: CommuniceTermin[]): CommuniceTermin[] {
  const seen = new Set<string>();
  return t.filter(x => (seen.has(x.url + x.dateText) ? false : (seen.add(x.url + x.dateText), true)));
}

/** URL der Seite `n` nach der Vorlage aus dem Pager. */
export function communicePageUrl(template: string, n: number): string {
  return template.replace(/\/seite-\d+(\/?)(?=[?#]|$)/, `/seite-${n}$1`);
}

/**
 * Kalenderseite zu einer Registry-URL: eine Detailseite
 * (`…/veranstaltungen/veranstaltung/laubannahme/2026-11-07?cHash=…`, Wacken)
 * zeigt auf ihren Kalender.
 */
export function communiceCalendarUrl(url: string): string {
  const u = new URL(url);
  const i = u.pathname.indexOf('/veranstaltung/');
  if (i > 0) u.pathname = u.pathname.slice(0, i);
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  return u.href;
}

/**
 * iCal-Link der Detailseite (genau ein Termin, `…[eventlist]=<ID>`); der
 * Link trägt einen cHash und lässt sich nicht selbst bauen.
 */
export function communiceIcalHref(html: string, base: string): string | null {
  const $ = cheerio.load(html);
  const hrefs = $('a[href]')
    .map((_, a) => $(a).attr('href')!)
    .get()
    .filter(h => /action(?:%5D|\])=ical/i.test(h) && /eventlist(?:%5D|\])=\d+(?:&|$)/i.test(h));
  const uniq = [...new Set(hrefs)];
  return uniq.length === 1 ? new URL(uniq[0], base).href : null;
}

/**
 * Jahr des Beginns aus dem iCal des Termins, nur wenn Tag und Monat zur
 * Liste passen (`DTSTART;VALUE = DATE:20261205`, Leerzeichen um das `=`
 * im Original).
 */
export function communiceStartYear(ics: string, want: { day: string; month: string }): string | null {
  const ev = readVEvents(ics);
  if (ev.length !== 1) return null;
  const p = ev[0].get('DTSTART');
  const s = p ? parseIcalDate({ params: {}, value: p.value }) : null;
  if (!s) return null;
  const [y, m, d] = s.date.split('-');
  return m === want.month && d === want.day ? y : null;
}
