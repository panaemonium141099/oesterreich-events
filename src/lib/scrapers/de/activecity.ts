/**
 * active-City (Advantic), Veranstaltungsliste des CMS, fn-29.15.
 *
 * Jeder Termin ist `.event_wrapper` mit `data-sortdate="2026-10-30"` und
 * `data-sorttime="20:00"` (Beginn in Ortszeit; `00:00` heißt ganztägig),
 * Datumszeile `.event_date_time_wrapper` („Fr 30. - Sa 31. Oktober 2026",
 * „Mi 04. November - Fr 04. Dezember 2026": das letzte Datum ist das Ende),
 * Titel-Link `.event_teaser_title_link`
 * (`…/Veranstaltungen.htm/Veranstaltungen/<Name>.html`), Ort strukturiert
 * (`.event_place_bezeichnung`, `.event_place_strasse`, `.event_place_ort`
 * = „49393 Lohne"), Text `.event_subtitle`/`.event_teaser`, Bild als
 * `background-image` von `.event_teaser_image_div` bzw. `img.event_teaser_image`.
 * Reihen zeigen nur „Nächster Termin: TT.MM.JJJJ“ ohne `data-sortdate` und
 * ohne Uhrzeit (Barntrup); sie werden nicht gelesen. Folgeseiten
 * `…?…&page=N`. robots.txt sperrt `/city_info/display/event/`; gelesen wird
 * nur die Liste. REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';

export interface ActiveCityTermin {
  /** Detailseite ohne Query (absolut). */
  url: string;
  /** Name der Detailseite (`HotlipsProject`). */
  slug: string;
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
  image?: string;
}

export interface ActiveCityListPage {
  isList: boolean;
  /** Einträge ohne `data-sortdate` („Nächster Termin: …“), nicht gelesen. */
  withoutSortdate: number;
  termine: ActiveCityTermin[];
  pages: string[];
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').replace(/\s*,\s*$/, '').trim();
  return t || undefined;
};

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mär: '03', mae: '03', apr: '04', mai: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dez: '12',
};

/** Letztes Datum mit Jahr der Datumszeile („… - Sa 31. Oktober 2026", „… 04.12.2026"). */
function lastDate(text: string): string | undefined {
  const all = [
    ...[...text.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g)].map(m => ({ at: m.index!, iso: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` })),
    ...[...text.matchAll(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]{3,})\s+(\d{4})/g)].flatMap(m => {
      const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
      return mo ? [{ at: m.index!, iso: `${m[3]}-${mo}-${m[1].padStart(2, '0')}` }] : [];
    }),
  ].sort((a, b) => a.at - b.at);
  return all[all.length - 1]?.iso;
}

/** Beginn aus `data-sortdate`/`data-sorttime`, Ende als Tag aus der Datumszeile. */
export function activeCityWhen(sortdate: string | undefined, sorttime: string | undefined, dateText: string): Pick<ActiveCityTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  if (!sortdate || !/^\d{4}-\d{2}-\d{2}$/.test(sortdate)) return null;
  const last = lastDate(dateText);
  const end = last && last > sortdate ? last : undefined;
  const t = /^(\d{2}):(\d{2})$/.exec(sorttime ?? '');
  if (!t || (t[1] === '00' && t[2] === '00') || +t[1] > 23) return { localDate: sortdate, start: sortdate, ...(end ? { end } : {}), allDay: true };
  return { localDate: sortdate, start: toUtcInstant(`${sortdate}T${t[1]}:${t[2]}:00`) as string, ...(end ? { end } : {}), allDay: false };
}

/** Eine Listenseite; `base` ist die abgerufene URL. */
export function parseActiveCityList(html: string, base: string): ActiveCityListPage {
  const $ = cheerio.load(html);
  const termine: ActiveCityTermin[] = [];
  const wrappers = $('.event_wrapper[data-sortdate]');
  wrappers.each((_, el) => {
    const w = $(el);
    // Der Bild-Link davor trägt dieselbe Klasse `event_teaser_link` (Stadthagen, Vellmar).
    const titleLink = w.find('a.event_teaser_title_link[href]').first();
    const a = titleLink.length ? titleLink : w.find('a.event_teaser_link[href]').filter((_, x) => !!clean($(x).text())).first();
    const title = clean(visibleText(a));
    let link: URL;
    try {
      link = new URL((a.attr('href') ?? '').replace(/&amp;/g, '&'), base);
    } catch {
      return;
    }
    const slug = /\/([^/]+)\.html$/.exec(link.pathname)?.[1];
    if (!title || !slug) return;
    const when = activeCityWhen(w.attr('data-sortdate'), w.attr('data-sorttime'), clean(w.find('.event_date_time_wrapper, .event_date').first().text()) ?? '');
    if (!when) return;
    const place = w.find('.event_place').first();
    const ort = clean(place.find('.event_place_ort').first().text());
    const plz = ort ? /^(\d{5})\s+(.+)$/.exec(ort) : null;
    const description = [...w.find('.event_subtitle, .event_teaser').toArray()].map(n => clean(visibleText($(n)))).filter(Boolean).join('\n') || undefined;
    const bg = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(w.find('.event_teaser_image_div').first().attr('style') ?? '')?.[1]
      ?? w.find('img.event_teaser_image').first().attr('src');
    termine.push({
      url: `${link.origin}${link.pathname}`,
      slug,
      ...when,
      title,
      ...(description ? { description } : {}),
      locationName: clean(place.find('.event_place_bezeichnung').first().text()) ?? (plz ? undefined : ort),
      ...(clean(place.find('.event_place_strasse').first().text()) ? { street: clean(place.find('.event_place_strasse').first().text()) } : {}),
      ...(plz ? { postalCode: plz[1], locality: plz[2] } : {}),
      ...(bg ? { image: new URL(bg, base).href } : {}),
    });
  });
  const pages: string[] = [];
  $('a[href*="page="]').each((_, x) => {
    const u = new URL($(x).attr('href')!.replace(/&amp;/g, '&'), base);
    u.hash = '';
    const page = u.searchParams.get('page');
    // Nur der Pager der Veranstaltungsliste (andere Listen der Seite blättern auch mit `page`).
    if (!page || page === '1' || u.host !== new URL(base).host || !/Veranstaltung|Termin/i.test(u.pathname)) return;
    if (!pages.some(p => new URL(p).searchParams.get('page') === page)) pages.push(u.href);
  });
  const all = $('.event_wrapper');
  return { isList: all.length > 0, withoutSortdate: all.length - wrappers.length, termine, pages };
}

/** Kalender einer Detailseite: `…/Veranstaltungen.htm/Veranstaltungen/X.html` → `…/Veranstaltungen.htm`. */
export function activeCityCalendarOf(url: string): string | null {
  const u = new URL(url);
  const i = u.pathname.indexOf('.htm/');
  return i > 0 ? `${u.origin}${u.pathname.slice(0, i + 4)}` : null;
}
