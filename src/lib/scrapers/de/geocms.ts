/**
 * GeoCMS (BKG Geoinformationssysteme Thüringen/Sachsen-Anhalt), Modul
 * „gcevent", fn-29.15.
 *
 * Die Veranstaltungsliste ist ein Modul `btp_event` (Bootstrap-Theme) oder
 * `gc_gcevent` (älteres Theme) mit Klasse `view-listview`; ohne Treffer
 * `view-listview_no_result`. Einheitlich über alle Themes ist der Link auf
 * die Detailseite `…/event/<Termin-ID>,<Mandant>/<slug>-TT-MM-JJJJ.html`: die
 * ID ist je Termin eindeutig, das Datum am Ende ist der Tag des Termins.
 * Datum und Uhrzeit stehen je Theme in `.date`/`.card-date`/`.card-time`
 * (Bootstrap, neben dem Kalender-Symbol `data-info="ticket"`) bzw.
 * `.gcevent-list-datetime` und `.gcevent-list-day` („30.10.2026 ab 18:30 Uhr",
 * „17.10.2026 - 12.12.2026 von 09:30 Uhr bis 11:00 Uhr", „10.05. - 15.11.2026",
 * „01. bis 31. Oktober 2026"); Ort `.gcevent-list-location-span`, Rubriken
 * `.gcevent-list-categories` bzw. `.category`. Die kompakte Kachel (Langen,
 * Laatzen: „Fr 30. Okt") zeigt keine Uhrzeit; die steht auf der
 * Detailseite. Folgeseiten: Links mit `btp_event[…]=<offset>` bzw.
 * `gcevent[pager]=<offset>`. REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';

export interface GeocmsTermin {
  /** Detailseite (absolut). */
  url: string;
  /** Termin-ID aus dem Link („81338"). */
  id: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  locationName?: string;
  categories: string[];
  image?: string;
  /** Liste ohne Uhrzeit und Jahr (kompakte Kachel): Uhrzeit nur auf der Detailseite. */
  timeOnDetail: boolean;
}

export interface GeocmsListPage {
  /** Listenmodul gefunden (auch ohne Treffer). */
  isList: boolean;
  /** Das Modul steht im Hauptbereich (nicht nur ein Kasten am Rand). */
  main: boolean;
  termine: GeocmsTermin[];
  /** Folgeseiten aus dem Pager (absolut), in Reihenfolge. */
  pages: string[];
  /** Kalenderseiten derselben Website (`…/veranstaltungskalender….html`, `…/veranstaltungen.html`). */
  calendarLinks: string[];
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

const DETAIL = /\/event\/(\d+),(\d+)\/[^/?#]*?(\d{2})-(\d{2})-(\d{4})\.html$/;

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mär: '03', mae: '03', apr: '04', mai: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dez: '12',
};

/** Alle Daten mit Jahr in Textreihenfolge: „15.11.2026", „31. Oktober 2026". */
function fullDates(text: string): string[] {
  const out: { at: number; iso: string }[] = [];
  for (const m of text.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g)) {
    out.push({ at: m.index!, iso: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` });
  }
  for (const m of text.matchAll(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]{3,})\s+(\d{4})/g)) {
    const month = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (month) out.push({ at: m.index!, iso: `${m[3]}-${month}-${m[1].padStart(2, '0')}` });
  }
  return out.sort((a, b) => a.at - b.at).map(x => x.iso);
}

const berlin = (date: string, hh: string, mm: string) => toUtcInstant(`${date}T${hh.padStart(2, '0')}:${mm}:00`) as string;

/**
 * Datum und Uhrzeit eines Termins. Der Tag kommt aus dem Link (`date`), das
 * Ende aus dem letzten Datum mit Jahr im Text, die Uhrzeit aus „ab hh:mm
 * Uhr" bzw. „von hh:mm Uhr bis hh:mm Uhr". „bis hh:mm Uhr" ohne Beginn
 * (Weida-Land „03.09.2026 - 01.11.2026 bis 23:59 Uhr") ist keine Uhrzeit:
 * ganztägig. Ein Ende gleich dem Beginn (Muldestausee „von 14:00 Uhr bis
 * 14:00 Uhr") oder davor bleibt offen.
 */
export function geocmsWhen(date: string, text: string): Pick<GeocmsTermin, 'localDate' | 'start' | 'end' | 'allDay'> {
  const dates = fullDates(text);
  const last = dates[dates.length - 1];
  const endDay = last && last > date ? last : undefined;
  const from = /(?:^|\s)(?:von|ab)\s+(\d{1,2}):(\d{2})\s*Uhr/i.exec(text) ?? (/\bbis\s+\d{1,2}:\d{2}/i.test(text) ? null : /(?:^|\s)(\d{1,2}):(\d{2})\s*Uhr/.exec(text));
  if (!from || +from[1] > 23 || +from[2] > 59) {
    return { localDate: date, start: date, ...(endDay ? { end: endDay } : {}), allDay: true };
  }
  const start = berlin(date, from[1], from[2]);
  const to = /\bbis\s+(\d{1,2}):(\d{2})\s*Uhr/i.exec(text.slice(from.index + from[0].length));
  let end: string | undefined;
  if (to && +to[1] <= 23 && +to[2] <= 59 && !(to[1] === '23' && to[2] === '59')) end = berlin(endDay ?? date, to[1], to[2]);
  else if (endDay) end = endDay;
  if (end && end.length > 10 && end <= start) end = endDay;
  return { localDate: date, start, ...(end ? { end } : {}), allDay: false };
}

const DATE_SEL = '.gcevent-list-datetime, .gcevent-list-day, .date, .card-date, .card-time';

/** Text der Datums-Elemente eines Eintrags (verschachtelte nur einmal). */
function dateText($: cheerio.CheerioAPI, item: cheerio.Cheerio<any>): string {
  const nodes = item.find(DATE_SEL).add(item.find('[data-info="ticket"]').parent()).toArray();
  const top = nodes.filter(n => !nodes.some(o => o !== n && $(o).find(n as any).length > 0));
  return top.map(n => clean($(n).text()) ?? '').join(' ');
}

function eventHref(href: string | undefined, base: string): URL | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return DETAIL.test(u.pathname) ? u : null;
  } catch {
    return null;
  }
}

function parseItem($: cheerio.CheerioAPI, item: cheerio.Cheerio<any>, link: URL, base: string): GeocmsTermin | null {
  const m = DETAIL.exec(link.pathname)!;
  const date = `${m[5]}-${m[4]}-${m[3]}`;
  const titleNode = item.find('.card-title, .gcevent-list-title').first();
  const title = clean(visibleText(titleNode.length ? titleNode : item.find('a[href]').filter((_, a) => eventHref($(a).attr('href'), base)?.pathname === link.pathname).first()));
  if (!title) return null;
  const text = dateText($, item);
  const withYear = fullDates(text).length > 0;
  const when = geocmsWhen(date, text);
  const description = [...item.find('.card-subtitle, .gcevent-list-subtitle, .teaser, .gcevent-list-description').toArray()]
    .map(n => clean(visibleText($(n)))).filter(Boolean).join('\n') || undefined;
  const categories = (clean(item.find('.gcevent-list-categories, .category').first().text()) ?? '')
    .split('|').map(s => s.trim()).filter(Boolean);
  const img = item.find('img').filter((_, i) => !$(i).closest('[data-info], .gcevent_tooltip').length).first();
  const src = img.attr('data-src') ?? img.attr('src');
  return {
    url: `${link.origin}${link.pathname}`,
    id: m[1],
    ...when,
    title,
    ...(description ? { description } : {}),
    locationName: clean(visibleText(item.find('.gcevent-list-location-span').first())),
    categories,
    ...(src ? { image: new URL(src, base).href } : {}),
    timeOnDetail: !withYear && when.allDay,
  };
}

/** Eine Listenseite; `base` ist die abgerufene URL. */
export function parseGeocmsList(html: string, base: string): GeocmsListPage {
  const $ = cheerio.load(html);
  const modules = $('[class*="view-listview"]').filter((_, x) => /\b(btp_event|gc_gcevent)\b/.test($(x).attr('class') ?? ''));
  const mainModules = modules.filter((_, x) => /\bmodularea-main\b/.test($(x).attr('class') ?? ''));
  const use = mainModules.length ? mainModules : modules;
  const termine: GeocmsTermin[] = [];
  const pages: string[] = [];
  use.each((_, mod) => {
    const module = $(mod);
    const hrefs: string[] = [];
    module.find('a[href]').each((_, a) => {
      const u = eventHref($(a).attr('href'), base);
      if (u && !hrefs.includes(u.pathname)) hrefs.push(u.pathname);
    });
    const isOther = (a: any, own: string) => {
      const u = eventHref($(a).attr('href'), base);
      return !!u && u.pathname !== own;
    };
    for (const path of hrefs) {
      const anchor = module.find('a[href]').filter((_, a) => eventHref($(a).attr('href'), base)?.pathname === path).first();
      // Eintrag = größter Vorfahr im Modul, der keinen anderen Termin enthält.
      let item = anchor;
      while (item.parent().length && item.parent()[0] !== mod && !item.parent().find('a[href]').toArray().some(a => isOther(a, path))) item = item.parent();
      const t = parseItem($, item, new URL(path, base), base);
      if (t) termine.push(t);
    }
    module.find('a[href]').each((_, a) => {
      const href = $(a).attr('href')!;
      if (!/(btp_event|gcevent)(%5B|\[)/i.test(href)) return;
      const u = new URL(href, base);
      u.hash = '';
      // Detail-Links auf Folgeseiten tragen den Pager-Parameter mit (Braunsbedra
      // `…/event/53275,1243/….html?btp_event[p_3_24_1243]=15`): keine Folgeseite.
      if (DETAIL.test(u.pathname)) return;
      const offset = [...u.searchParams.entries()].find(([k]) => /^(btp_event|gcevent)\[/.test(k))?.[1];
      if (!offset || offset === '0' || pages.includes(u.href) || u.href === base) return;
      pages.push(u.href);
    });
  });
  const host = new URL(base).host;
  const calendarLinks = [...new Set($('a[href]').map((_, a) => {
    try {
      const u = new URL($(a).attr('href')!, base);
      const file = u.pathname.split('/').pop() ?? '';
      return u.host === host && /^(veranstaltungs?kalender[^/]*|veranstaltungen)\.html$/i.test(file) ? `${u.origin}${u.pathname}` : null;
    } catch {
      return null;
    }
  }).get().filter((u: string | null) => u && u !== base.split('?')[0]) as string[])]
    .sort((a, b) => Number(/veranstaltungen\.html$/i.test(a)) - Number(/veranstaltungen\.html$/i.test(b)));
  return { isList: use.length > 0, main: mainModules.length > 0, termine, pages, calendarLinks };
}

/** Uhrzeit von der Detailseite (kompakte Kachel ohne Uhrzeit): Datumszeile der Einzelansicht. */
export function geocmsDetailWhen(html: string, date: string): Pick<GeocmsTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const $ = cheerio.load(html);
  const view = $('[class*="view-singleview"]').filter((_, x) => /\b(btp_event|gc_gcevent)\b/.test($(x).attr('class') ?? '')).first();
  if (!view.length) return null;
  // Älteres Theme: `.gcevent-singleview-datetime`; Bootstrap: Datum und
  // Uhrzeit als Geschwister (`.event-date` + `.event-time` in Laatzen,
  // zwei `span.text-muted` in Sibbesse).
  const gc = view.find('.gcevent-singleview-datetime').first();
  const node = gc.length ? gc : view.find('.event-date, span.text-muted').filter((_, s) => /^\s*\d{1,2}\.\d{1,2}\.\d{4}/.test($(s).text())).first().parent();
  const text = clean(node.text());
  if (!text) return null;
  // Nur wenn die Detailseite denselben Tag nennt (sonst gilt die Liste).
  if (fullDates(text)[0] !== date) return null;
  return geocmsWhen(date, text);
}
