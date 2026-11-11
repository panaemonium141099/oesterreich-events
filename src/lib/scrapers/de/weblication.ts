/**
 * Weblication (Scholl Communications), Listenobjekt „eventMulti", fn-29.15.
 *
 * Die Gemeinden bauen ihre Veranstaltungsseite selbst aus dem Listen-Element
 * des CMS; einheitlich ist der Eintrag `li.listEntry.listEntryObject-eventMulti`
 * mit Titel (`.listEntryTitle`, Link auf `…/termine/<Name>.php`), Datum
 * (`.listEntryDate`: „Mi., 04.11.2026, 15:00 Uhr - 16:30 Uhr",
 * „Fr., 06. November 2026, 19:00 Uhr", „27.03.2026", mehrtägig
 * „Sa, 26.09.2026, 19:00 Uhr - So, 03.01.2027, 23:00 Uhr"), Ort
 * (`.listEntryLocation`), Text (`.listEntryDescription`) und Vorschaubild.
 * Termine einer Serie verlinken mit `?splitId=<n>&from=<JJJJ-MM-TT hh:mm:ss>&to=…`;
 * diese Wandzeit geht vor dem Text. Folgeseiten: `.pageNaviList a.pageNaviLink`
 * (`?pageId<Liste>=N`). REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';

export interface WeblicationTermin {
  /** Detailseite ohne Serienparameter (absolut). */
  url: string;
  /** Detailseite wie verlinkt (mit `splitId`/`from`/`to`). */
  link: string;
  /** Pfad der Detailseite ohne `.php` (Teil der source_id). */
  path: string;
  splitId?: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  locationName?: string;
  image?: string;
}

export interface WeblicationListPage {
  /** eventMulti-Einträge oder eine leere eventMulti-Liste erkannt. */
  isList: boolean;
  termine: WeblicationTermin[];
  /** Folgeseiten aus dem Pager (absolut, ohne Anker), in Reihenfolge. */
  pages: string[];
  /** Links auf Detailseiten `…/termine/….php` (Kalender einer Unterseite). */
  terminLinks: string[];
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

const berlin = (date: string, hh: string, mm: string) => toUtcInstant(`${date}T${hh.padStart(2, '0')}:${mm}:00`) as string;

/** Monatsnamen, voll oder abgekürzt („31. Okt 2026"): die ersten drei Buchstaben. */
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mär: '03', mae: '03', apr: '04', mai: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dez: '12',
};
const DAY = /(\d{1,2})\.\s*(?:(\d{1,2})\.|([A-Za-zÄÖÜäöü]+)\s+)\s*(\d{4})/g;
const TIME = /(\d{1,2}):(\d{2})\s*Uhr/i;

interface Part { date?: string; hh?: string; mm?: string }

function readPart(text: string): Part {
  DAY.lastIndex = 0;
  const d = DAY.exec(text);
  const month = d ? d[2]?.padStart(2, '0') ?? MONTHS[d[3].toLowerCase().slice(0, 3)] : undefined;
  const t = TIME.exec(text);
  return {
    ...(d && month ? { date: `${d[4]}-${month}-${d[1].padStart(2, '0')}` } : {}),
    ...(t && +t[1] <= 23 && +t[2] <= 59 ? { hh: t[1], mm: t[2] } : {}),
  };
}

/**
 * Datum und Uhrzeit. „00:00" ohne Ende ist ganztägig (leere Uhrzeit des
 * Formulars, wie bei JSON-LD), „23:59" als Ende heißt Ende offen; ein Ende
 * vor dem Beginn bleibt offen.
 */
function when(from: Part, to: Part): Pick<WeblicationTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  if (!from.date) return null;
  const d1 = from.date;
  const d2 = to.date && to.date > d1 ? to.date : undefined;
  const midnight = (p: Part) => p.hh != null && +p.hh === 0 && p.mm === '00';
  const toTime = to.hh != null && !(to.hh === '23' && to.mm === '59') && !(midnight(to) && !to.date) ? to : undefined;
  if (from.hh == null || (midnight(from) && (!toTime || midnight(toTime)))) {
    // Ganztägig bis einschließlich des letzten Tags (Schlangen „Schlänger Markt": Liste
    // „Fr, 30.10.2026 - Sa, 31.10.2026", Link `to=2026-10-31 00:00:00`).
    return { localDate: d1, start: d1, ...(d2 ? { end: d2 } : {}), allDay: true };
  }
  const start = berlin(d1, from.hh, from.mm!);
  let end: string | undefined;
  if (toTime?.hh != null) end = berlin(d2 ?? d1, toTime.hh, toTime.mm!);
  else if (d2) end = d2;
  if (end && end.length > 10 && end <= start) end = undefined;
  return { localDate: d1, start, ...(end ? { end } : {}), allDay: false };
}

/** Datum und Uhrzeit aus der Datumszeile der Liste. */
export function weblicationWhen(dateText: string): Pick<WeblicationTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const [left, right] = dateText.split(/\s[-–]\s/, 2);
  return when(readPart(left), right ? readPart(right) : {});
}

/** Datum und Uhrzeit aus `from`/`to` des Termin-Links („2026-11-04 15:00:00"). */
export function weblicationWhenFromLink(link: string): Pick<WeblicationTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const u = new URL(link);
  const p = (v: string | null): Part => {
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(v ?? '');
    return m ? { date: m[1], hh: m[2], mm: m[3] } : {};
  };
  const from = p(u.searchParams.get('from'));
  return from.date ? when(from, p(u.searchParams.get('to'))) : null;
}

function parseEntry($: cheerio.CheerioAPI, el: any, base: string): WeblicationTermin | null {
  const li = $(el);
  // Zwei Aufbauten: Titelzeile `.listEntryTitle` mit Link, oder Kacheln aus
  // `.listEntryElement` mit `.listEntryObjectEventMultiTitle` und `data-url`
  // am Eintrag (Aglasterhausen, Neunkirchen).
  const titleNode = li.find('.listEntryTitle, .listEntryObjectEventMultiTitle').first();
  const href = titleNode.find('a[href]').first().attr('href') ?? li.attr('data-url') ?? li.find('[data-url]').first().attr('data-url');
  const title = clean(visibleText(titleNode));
  if (!href || !title) return null;
  let link: URL;
  try {
    link = new URL(href, base);
  } catch {
    return null;
  }
  // Ein Eintrag, der auf ein anderes System zeigt (Gütersloh „Sitzung des
  // Rates" → ratsinfo.guetersloh.de/tops/), hat keine eigene Terminseite:
  // Quelle ist die Liste.
  const offSite = link.host !== new URL(base).host;
  if (offSite) {
    link = new URL(base);
    link.search = '';
    link.hash = '';
  }
  const url = `${link.origin}${link.pathname}`;
  const dateNode = li.find('.listEntryDate').first();
  const dateText = clean((dateNode.length ? dateNode : li.find('.dayDate').first().parent().parent()).text()) ?? '';
  const w = (offSite ? null : weblicationWhenFromLink(link.href)) ?? weblicationWhen(dateText);
  if (!w) return null;
  // Lazy-Loading: `srcset` ist dann ein SVG-Platzhalter, das Bild steht in `data-src`.
  const firstUrl = (v: string | undefined) => v?.split(/[\s,]+/).find(x => x && !x.startsWith('data:'));
  const pic = li.find('.listEntryThumbnail, .listEntryImage').first();
  const img = firstUrl(pic.find('img').first().attr('data-src')) ?? firstUrl(pic.find('img').first().attr('src'))
    ?? firstUrl(pic.find('source').first().attr('data-src')) ?? firstUrl(pic.find('source').first().attr('srcset'));
  const description = clean(visibleText(li.find('.listEntryDescription').first()));
  return {
    url,
    link: link.href,
    path: link.pathname.replace(/\.php$/i, ''),
    ...(link.searchParams.get('splitId') ? { splitId: link.searchParams.get('splitId')! } : {}),
    ...w,
    title,
    ...(description ? { description } : {}),
    locationName: clean(visibleText(li.find('.listEntryLocation').first()))
      ?? clean(li.find('.subline').filter((_, x) => /^\s*Ort:/.test($(x).text())).first().text().replace(/^\s*Ort:/, '')),
    ...(img ? { image: new URL(img, base).href } : {}),
  };
}

/** Eine Seite; `base` ist die abgerufene URL. */
export function parseWeblicationList(html: string, base: string): WeblicationListPage {
  const $ = cheerio.load(html);
  const items = $('li.listEntry[class*="listEntryObject-eventMulti"]');
  const termine: WeblicationTermin[] = [];
  items.each((_, el) => {
    const t = parseEntry($, el, base);
    if (t) termine.push(t);
  });
  const pages: string[] = [];
  $('.pageNaviList a.pageNaviLink[href]').each((_, a) => {
    const u = new URL($(a).attr('href')!, base);
    u.hash = '';
    if (!pages.includes(u.href) && u.href !== base) pages.push(u.href);
  });
  const host = new URL(base).host;
  const terminLinks = [...new Set($('a[href*="/termine/"]').map((_, a) => {
    try {
      const u = new URL($(a).attr('href')!, base);
      return u.host === host && /\/termine\/[^/]+\.php$/i.test(u.pathname) ? `${u.origin}${u.pathname}` : null;
    } catch {
      return null;
    }
  }).get().filter(Boolean) as string[])];
  return { isList: items.length > 0, termine, pages, terminLinks };
}

/** Kalenderseite zu einer Detailseite: `…/veranstaltungen/termine/Die-Raeuber.php` → `…/veranstaltungen/`. */
export function weblicationCalendarOf(detailUrl: string): string | null {
  const u = new URL(detailUrl);
  const i = u.pathname.indexOf('/termine/');
  return i > 0 ? `${u.origin}${u.pathname.slice(0, i + 1)}` : null;
}
