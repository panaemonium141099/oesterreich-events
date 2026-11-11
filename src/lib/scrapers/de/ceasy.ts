/**
 * cEasy (hitcom), Veranstaltungsmodul `cVeka`, fn-29.15.
 *
 * Gelesen wird die Trefferliste des Moduls (`?item=eventDate&view=find`,
 * Folgeseiten über `cCore_pagination_nextButton`, Parameter `offset`). Zwei
 * Darstellungen derselben Daten:
 *
 * - Kasten (`cVeka_box_eventDate…`): Datum (`cVeka_box_date`, „Sa., 31.10.26")
 *   und Uhrzeit (`cVeka_box_time`, „15:00 - 18:00 Uhr") getrennt;
 * - Streifen (`cVeka_stripes_eventDate…`, `useXsl=STRIPES`): beides in
 *   `cVeka_stripes_date` („Fr., 30.10.26, 12:00 - 13:30 Uhr").
 *
 * Je Termin Titel mit Link auf die Detailseite (`…?view=publish&item=eventDate&id=<ID>`,
 * die ID gilt je Termin), Ort (`cVeka_box_location`, teils mit Straße und
 * „PLZ Ort" in eigenen Zeilen), Veranstalter, Anrisstext, Vorschaubild.
 * Mehrtägig steht als „So., 04.10.26 - So., 08.11.26" mit beiden Jahren.
 *
 * Das Uhrzeit-Feld ist Freitext („mittwochs von 09.00-11.00 Uhr und
 * donnerstags …", „Gruppe A: 09:00 Uhr | Gruppe B: 10:00 Uhr", „Uhrzeit wird
 * noch bekannt gegeben!"). Eine Uhrzeit gilt nur, wenn die Zeile mit ihr
 * beginnt (auch „ab", „von", „um", „ca."); sonst bleibt der Termin
 * ganztägig. REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';

export interface CeasyTermin {
  /** Termin-ID (`item=eventDate&id=<ID>`). */
  id: string;
  /** Detailseite (absolut). */
  url: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  organizer?: string;
  image?: string;
}

export interface CeasyListPage {
  /** cVeka-Trefferliste erkannt (auch leer). */
  isList: boolean;
  termine: CeasyTermin[];
  /** „nächste Seite", sonst null. */
  next: string | null;
  /** Detailseiten auf der Seite (auch außerhalb einer Liste, z. B. Teaser). */
  detailLinks: string[];
  /** Links auf eine Seite „…/Veranstaltungskalender" derselben Website. */
  calendarLinks: string[];
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

/** Instant aus Wandzeit in deutscher Ortszeit (Europe/Berlin = Europe/Vienna bei Offset und Umstellung). */
const berlin = (date: string, hh: string, mm: string) => toUtcInstant(`${date}T${hh.padStart(2, '0')}:${mm}:00`) as string;

const DATE = /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/g;
/** Uhrzeit am Anfang der Zeile: „15:00 - 18:00 Uhr", „ab 15:00 Uhr", „13:00 Uhr- 17:00 Uhr". */
const LEAD_TIME = /^(?:(?:ab|von|um|ca\.)\s*)?(\d{1,2}):(\d{2})(?:\s*Uhr)?(?:\s*(?:-|–|bis)\s*(\d{1,2}):(\d{2}))?\s*Uhr/i;

function isoDate(m: RegExpMatchArray): string {
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function leadTime(text: string | undefined): { h1: string; m1: string; h2?: string; m2?: string } | null {
  const m = LEAD_TIME.exec((text ?? '').replace(/^[\s,|]+/, ''));
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const end = m[3] != null && +m[3] <= 23 && +m[4] <= 59 ? { h2: m[3], m2: m[4] } : {};
  return { h1: m[1], m1: m[2], ...end };
}

/**
 * Datum und Uhrzeit aus der Datumszeile (`dateLine`, nur die erste Zeile
 * vor einem Umbruch) und der Uhrzeitzeile (`timeLine`, Kasten-Darstellung).
 * Ohne Uhrzeit am Zeilenanfang ganztägig; ein Ende vor dem Beginn bleibt offen.
 */
export function ceasyWhen(dateLine: string, timeLine?: string): Pick<CeasyTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const dates = [...dateLine.matchAll(DATE)];
  if (!dates.length) return null;
  const d1 = isoDate(dates[0]);
  const d2raw = dates[1] ? isoDate(dates[1]) : undefined;
  const d2 = d2raw && d2raw > d1 ? d2raw : undefined;
  // Uhrzeit hinter dem letzten Datum der Zeile, sonst in der Uhrzeitzeile.
  const last = dates[dates.length - 1];
  const after = dateLine.slice(last.index! + last[0].length);
  const t = leadTime(after) ?? leadTime(timeLine);
  if (!t) return { localDate: d1, start: d1, ...(d2 ? { end: d2 } : {}), allDay: true };
  const start = berlin(d1, t.h1, t.m1);
  let end: string | undefined;
  if (t.h2 != null) end = berlin(d2 ?? d1, t.h2, t.m2!);
  else if (d2) end = d2;
  if (end && end.length > 10 && end <= start) end = undefined;
  return { localDate: d1, start, ...(end ? { end } : {}), allDay: false };
}

/** Zeilen eines Blocks (Umbrüche `<br>` bzw. Absätze), ohne Beschriftung. */
function lines($: cheerio.CheerioAPI, node: cheerio.Cheerio<any>, label: RegExp): string[] {
  const html = node.html() ?? '';
  return html
    .split(/<br\s*\/?>/i)
    .map(part => clean(visibleText(cheerio.load(`<div>${part}</div>`)('div').first())))
    .filter((l): l is string => !!l)
    .map((l, i) => (i === 0 ? l.replace(label, '').trim() : l))
    .filter(Boolean);
}

/**
 * Ort aus `cVeka_box_location`: erste Zeile der Name, „PLZ Ort" in einer
 * eigenen Zeile oder hinter Komma („Weingut Knauß, Nolten 2, 71384
 * Weinstadt"), die Straße davor. Weitere Zeilen („(Alter Teckbote)") zählen nicht.
 */
export function ceasyLocation(ls: string[]): Pick<CeasyTermin, 'locationName' | 'street' | 'postalCode' | 'locality'> {
  if (!ls.length) return {};
  const out: Pick<CeasyTermin, 'locationName' | 'street' | 'postalCode' | 'locality'> = { locationName: ls[0].split(/,\s*/)[0] };
  for (let i = 0; i < ls.length; i++) {
    const parts = ls[i].split(/,\s*/);
    const k = parts.findIndex(p => /^\d{5}\s+\S/.test(p));
    if (k < 0) continue;
    const m = /^(\d{5})\s+(.+)$/.exec(parts[k])!;
    out.postalCode = m[1];
    out.locality = m[2].trim();
    const street = k > 0 ? parts[k - 1] : i > 0 ? ls[i - 1].split(/,\s*/).pop() : undefined;
    if (street && street !== out.locationName && /\d/.test(street)) out.street = street;
    break;
  }
  return out;
}

function parseItem($: cheerio.CheerioAPI, el: any, base: string): CeasyTermin | null {
  const it = $(el);
  const link = it.find('.cVeka_box_title a[href], .cVeka_stripes_title a[href]').first();
  const href = link.attr('href');
  const title = clean(visibleText(link));
  if (!href || !title) return null;
  const url = new URL(href, base).href;
  const id = /[?&]id=(\d+)/.exec(url)?.[1];
  if (!id || !/item=eventDate/.test(url)) return null;
  const dateNode = it.find('.cVeka_box_date, .cVeka_stripes_date').first();
  // Datumszeile bis zum ersten Umbruch; „Fr., 30.10.26<br/>-<br/>Mo., 02.11.26"
  // (Kasten, mehrtägig) gehört zusammen.
  const dateLines = lines($, dateNode, /^$/);
  const dateLine = dateLines[1] === '-' ? dateLines.slice(0, 3).join(' - ') : dateLines[0] ?? '';
  const timeLine = lines($, it.find('.cVeka_box_time').first(), /^$/)[0];
  const when = ceasyWhen(dateLine, timeLine);
  if (!when) return null;
  const loc = ceasyLocation(lines($, it.find('.cVeka_box_location').first(), /^Veranstaltungsort:\s*/i));
  // Eine Mailadresse („mediathek(at)denkingen.de") ist kein Veranstaltername.
  const org = lines($, it.find('.cVeka_box_organizer').first(), /^Veranstalter:\s*/i)[0];
  const organizer = org && !/@|\(at\)/i.test(org) ? org : undefined;
  const img = it.find('img.cVeka_strip_previewImage, .cVeka_box_previewImage img, .cVeka_stripes_previewImage img').first().attr('src');
  return {
    id,
    url,
    ...when,
    title,
    description: clean(visibleText(it.find('.cVeka_box_teaser, .cVeka_stripes_teaser').first())),
    ...loc,
    ...(organizer ? { organizer } : {}),
    ...(img ? { image: new URL(img, base).href } : {}),
  };
}

/** Eine Seite der Trefferliste; `base` ist die abgerufene URL. */
export function parseCeasyList(html: string, base: string): CeasyListPage {
  const $ = cheerio.load(html);
  const items = $('[class*="cVeka_box_eventDate"], [class*="cVeka_stripes_eventDate"]');
  const isList = $('.cCore_searchResultDiv').length > 0 && /cVeka_/.test(html);
  const termine: CeasyTermin[] = [];
  const seen = new Set<string>();
  items.each((_, el) => {
    const t = parseItem($, el, base);
    if (t && !seen.has(t.id)) { seen.add(t.id); termine.push(t); }
  });
  const nextHref = $('.cCore_pagination_nextButton a[href]').first().attr('href');
  const detailLinks = [...new Set($('a[href*="item=eventDate"]').map((_, a) => new URL($(a).attr('href')!, base).href).get())]
    .filter(h => /[?&]id=\d+/.test(h) && /view=publish/.test(h));
  const host = new URL(base).host;
  const calendarLinks = [...new Set($('a[href]').map((_, a) => {
    try {
      const u = new URL($(a).attr('href')!, base);
      return u.host === host && /\/veranstaltungskalender\/?$/i.test(u.pathname) && !u.search ? `${u.origin}${u.pathname.replace(/\/+$/, '')}` : null;
    } catch {
      return null;
    }
  }).get().filter(Boolean) as string[])];
  return { isList, termine, next: nextHref ? new URL(nextHref, base).href : null, detailLinks, calendarLinks };
}

/**
 * Kalenderseite zu einer Detailseite: `…/Veranstaltungskalender/Veranstaltung?view=publish&item=eventDate&id=2045`
 * → `…/Veranstaltungskalender`.
 */
export function ceasyCalendarOf(detailUrl: string): string | null {
  const u = new URL(detailUrl);
  const path = u.pathname.replace(/\/+$/, '');
  const i = path.lastIndexOf('/');
  if (i <= 0) return null;
  return `${u.origin}${path.slice(0, i)}`;
}

/**
 * Folgeseite mit 50 Treffern (weniger Abrufe als die 5 bis 15 der Website):
 * Der Server rechnet den nächsten `offset` aus `offset + limit`, so schließen
 * die Seiten lückenlos an; doppelte Termine fallen über die ID weg.
 */
export function ceasyNextUrl(next: string, n = 50): string {
  const u = new URL(next);
  if (u.searchParams.has('limit')) u.searchParams.set('limit', String(n));
  return u.href;
}
