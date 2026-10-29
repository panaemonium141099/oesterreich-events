/**
 * Joomla-Kalender JEvents und iCagenda (fn-29.7). Beide haben keinen
 * brauchbaren iCal-Export (JEvents `icals.export` liefert auf 52 Websites
 * nichts) und kein JSON-LD; gelesen werden RSS und Detailseite. REIN.
 *
 * JEvents: RSS „Neueste Termine" (`modlatest.rss`), Titel „TT.MM.JJJJ[ HH:MM
 * Uhr] : Name", je Termin eine Detailseite (Wiederholungen eigene Seiten) mit
 * „Montag, 02. November 2026, 09:30 Uhr - 10:30 Uhr" und `.location`.
 * iCagenda: RSS der Terminliste (`?format=feed&type=rss`), Detailseite mit
 * `ic-single-next` (JJJJ-MM-TT), `ic-single-starttime`, „Veranstaltungsort"
 * und allen Daten (`li.alldates`, je mit `evttime`).
 */
import { decodeEntities } from '@/lib/utils/decode-entities';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';

export interface RssItem { title: string; link: string; pubDate?: string }

const clean = (s: string | undefined) => {
  const t = s ? decodeEntities(s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';
  return t || undefined;
};

export function rssItems(xml: string): RssItem[] {
  const out: RssItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const tag = (n: string) => clean(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`).exec(m[1])?.[1]);
    const title = tag('title'), link = tag('link');
    if (title && link) out.push({ title, link, pubDate: tag('pubDate') });
  }
  return out;
}

export interface JoomlaTermin {
  title: string;
  url: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  locationName?: string;
}

const MONTHS: Record<string, string> = {
  januar: '01', februar: '02', märz: '03', maerz: '03', april: '04', mai: '05', juni: '06',
  juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12',
};

const berlin = (date: string, time: string) => toUtcInstant(`${date}T${time.padStart(5, '0')}:00`) as string;

function termin(title: string, url: string, date: string, time?: string, endDate?: string, endTime?: string, locationName?: string): JoomlaTermin {
  if (!time) {
    return { title, url, localDate: date, start: date, end: endDate && endDate > date ? endDate : undefined, allDay: true, locationName };
  }
  const start = berlin(date, time);
  const end = endTime ? berlin(endDate ?? date, endTime) : undefined;
  return { title, url, localDate: date, start, end: end && end > start ? end : undefined, allDay: false, locationName };
}

/** JEvents-RSS-Titel „02.11.2026 09:30 Uhr : Bewegung im Alter". */
export function parseJEventsTitle(raw: string): { date: string; time?: string; title: string } | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}:\d{2})(?:\s*Uhr)?)?\s*:\s*(.+)$/.exec(raw.trim());
  if (!m) return null;
  return { date: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, time: m[4], title: m[5].trim() };
}

/**
 * JEvents-Detailseite: Daten und Zeiten aus `.jev_evdt_summary`
 * („Montag, 02. November 2026, 09:30 Uhr - 10:30 Uhr", mehrtägig mit zwei
 * Daten), Ort aus `.location`. Ohne Datum in der Zusammenfassung null.
 */
export function parseJEventsDetail(html: string): { dates: string[]; times: string[]; locationName?: string } | null {
  const summary = /class="jev_evdt_summary"[^>]*>([\s\S]*?)<div class='ev_(?:prev|next)repeat'|class="jev_evdt_summary"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  // Abgewandelte Vorlagen ohne Zusammenfassung (Rauschenberg `wbc_eventdetails_body`,
  // Nordendorf): der Anfang des Inhaltsbereichs.
  const body = summary ? undefined : /class="[^"]*eventdetails_body[^"]*"[^>]*>([\s\S]{0,1500})/.exec(html)?.[1];
  const text = clean(summary?.[1] ?? summary?.[2] ?? body);
  if (!text) return null;
  const dates = [...text.matchAll(/(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi)]
    .map(m => `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`);
  if (!dates.length) return null;
  // Uhrzeit mit oder ohne „Uhr" (Rauschenberg „Samstag, 31. Oktober 2026 17:30").
  const times = [...text.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map(m => m[1]);
  // Die Beschriftung „Ort" ist kein Ort (Sönnebüll, Starzach, Gangelt).
  const loc = clean(/class="jev_evdt_location"[^>]*>\s*<span class="location">([\s\S]*?)<\/span>/.exec(html)?.[1])?.replace(/^Ort\s*:?\s*/i, '');
  return { dates, times, locationName: loc || undefined };
}

export function jeventsTermin(item: RssItem, detail: ReturnType<typeof parseJEventsDetail>): JoomlaTermin | null {
  const t = parseJEventsTitle(item.title);
  if (!t) return null;
  // Die Detailseite hat Vorrang: sie trägt das Ende; der RSS-Titel nur den Beginn.
  const date = detail?.dates[0] ?? t.date;
  const time = detail?.times[0] ?? t.time;
  const endDate = detail && detail.dates.length > 1 ? detail.dates[detail.dates.length - 1] : undefined;
  const endTime = detail && detail.times.length > 1 ? detail.times[detail.times.length - 1] : undefined;
  return termin(t.title, item.link, date, time, endDate, endTime, detail?.locationName);
}

/** Datum in ISO („2026-11-03"), mit Punkten („04.12.2026") oder als Text („14. November 2026"). */
function anyDate(raw: string | undefined): string | undefined {
  const t = clean(raw);
  if (!t) return undefined;
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{1,2})\.\s*(Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i.exec(t);
  return m ? `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}` : undefined;
}

/**
 * iCagenda-Detailseite: Titel, alle Daten mit Uhrzeit, Veranstaltungsort.
 * Die Vorlagen der Websites unterscheiden sich (Immenstedt `title-header` und
 * ISO-Daten, Wester-Ohrstedt „14. November 2026", Kammerstein und Lucka
 * Tabellenzellen, Lucka Zeiträume `ic-period-startdate`, 2026-10-29).
 */
export function parseICagendaDetail(html: string, url: string): JoomlaTermin[] {
  const view = html.slice(Math.max(0, html.search(/id="icagenda"/)));
  // Titel: erste Überschrift im Kalenderbereich (`h1`; Oster-Ohrstedt `h3` in `event-menu-titel`).
  const title = clean(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/.exec(view)?.[2]);
  if (!title) return [];
  const loc = clean(/<strong>\s*Veranstaltungsort:?\s*<\/strong>([\s\S]*?)<\/p>/.exec(view)?.[1])
    ?? clean(/ic-label">\s*Veranstaltungsort\s*<\/div>\s*<div[^>]*ic-value[^>]*>([\s\S]*?)<\/div>/.exec(view)?.[1])
    // Rhens: Ortssymbol statt Beschriftung, „Kaisersaal Rhens, Bahnhofstr. 11 | Rhens".
    ?? clean(/iCicon-location"[^>]*><\/span>([\s\S]*?)<\/p>/.exec(view)?.[1])?.replace(/\s*\|\s*/g, ', ');
  // Ohne Uhrzeit je Datum gilt die Startzeit der Seite (Rhens „Wochenmarkt" 15:00).
  const pageTime = /class="ic-single-starttime">\s*(\d{1,2}:\d{2})/.exec(view)?.[1];
  const time = (s: string) => /evttime[^>]*>\s*(\d{1,2}:\d{2})/.exec(s)?.[1] ?? pageTime;
  const all: { date: string; time?: string }[] = [];
  for (const m of view.matchAll(/<li class="alldates">([\s\S]*?)<\/li>/g)) {
    const date = anyDate(m[1].replace(/<span[\s\S]*$/, ''));
    if (date) all.push({ date, time: time(m[1]) });
  }
  for (const m of view.matchAll(/<li>\s*<span class="ic-period-startdate">([\s\S]*?)<\/span>([\s\S]*?)<\/li>/g)) {
    const date = anyDate(m[1]);
    if (date) all.push({ date, time: time(m[2]) });
  }
  let endTime: string | undefined;
  if (!all.length) {
    // Einzeltermin: `ic-single-next` (nächster) oder `ic-single-startdate` mit
    // `ic-single-endtime` (Groß Kreutz „30. Oktober 2026 15:00 - 21:00").
    const date = anyDate(/class="ic-single-(?:next|startdate)">([\s\S]*?)<\/span>/.exec(view)?.[1]);
    const t = /class="ic-single-starttime">\s*(\d{1,2}:\d{2})/.exec(view)?.[1];
    const e = /class="ic-single-endtime">\s*(\d{1,2}:\d{2})/.exec(view)?.[1];
    // 23:59 ist das Tagesende, keine Uhrzeit (Rhens „Möhnensitzung" 19:11 - 23:59).
    endTime = e && !e.startsWith('23:59') ? e : undefined;
    if (date) all.push({ date, time: t });
  }
  const seen = new Set<string>();
  return all.filter(d => !seen.has(d.date) && seen.add(d.date))
    .map(d => termin(title, url, d.date, d.time, undefined, all.length === 1 ? endTime : undefined, loc));
}
