/**
 * verwaltungsportal.de (Förderverein für regionale Entwicklung,
 * „Azubi-Projekte“, „Thüringen/Sachsen-Anhalt vernetzt“), fn-29.11.
 *
 * Kein Feed. Die Liste `/veranstaltungen/index.php` zeigt die Termine der
 * nächsten zwölf Monate, je Website in einem von mindestens drei Layouts
 * (`events-box`, `event-entry-new-2`, `events-entry-3`; Uhrzeit nicht in
 * jedem). Gelesen wird aus ihr nur der Link je Termin
 * `/veranstaltungen/<ID>/<JJJJ>/<MM>/<TT>/<slug>`; eine Serie hat eine ID
 * und je Termin einen Link mit dessen Tag. Alles Weitere kommt aus der
 * Druckansicht der Detailseite (`?modus=drucken`, 8 statt 80 KB, gleiches
 * JSON-LD): JSON-LD `Event` (Name, Beschreibung, Beginn, Ort, Veranstalter,
 * Bild) und die Zeile unter der Überschrift („13.11.2026 um 19:00 Uhr“,
 * „11.11.2026 von 16:30 – 19:30 Uhr“, „11.06.2027 bis 13.06.2027 von 18:00 –
 * 00:00 Uhr“), die als einzige das Ende einer Uhrzeit nennt. Keine
 * Koordinaten in der Druckansicht. REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { htmlToText } from '@/lib/eventfrog/parse';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { parseEmLocation } from './em';

export interface VpLink {
  /** Termin-ID der Website (eine Serie teilt sie). */
  id: string;
  /** Termintag aus dem Link. */
  date: string;
  /** Pfad ohne Query, `/veranstaltungen/<ID>/<JJJJ>/<MM>/<TT>/<slug>`. */
  path: string;
  /**
   * Uhrzeiten, die die Liste an diesem Termin zeigt („14:00-16:00“, „“ ohne
   * Uhrzeit); fehlt, wenn das Layout der Liste keine Uhrzeit führt.
   */
  listClock?: string;
}

export interface VpEvent {
  id: string;
  /** Detailseite (kanonische URL der Website). */
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
  /** Gemeinde aus `addressLocality` („Remptendorf OT Ruppersdorf“ → Remptendorf). */
  locality?: string;
  organizer?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Uhrzeiten der Detailseite wie `VpLink.listClock`. */
  clock: string;
}

const DETAIL = /^\/veranstaltungen\/(\d+)\/(\d{4})\/(\d{2})\/(\d{2})\/[^?#]*$/;

/** Pfade der Module von verwaltungsportal.de (Kalender, Seite, Nachricht). */
const VP_PATH = /^\/(veranstaltungen|seite|news|veranstaltungstipps)(\/|$)/;

const bare = (h: string) => h.toLowerCase().replace(/^www\./, '');

/**
 * Website, deren Kalender ein Registry-Eintrag liest. Die Kalender-URL der
 * Vollerhebung zeigt teils auf die Website des Amts (Ausacker →
 * amt-huerup.de/veranstaltungen/index.php) oder eine neue Domain
 * (luehe-online.de → luehe.de/seite/…): ihr Host gilt, wenn die URL ein
 * Modul von verwaltungsportal.de ist oder auf der eigenen Website liegt.
 * Sonst (Amtskalender in anderem CMS, Stylesheet-URL) die eigene Website.
 */
export function vpCalendarHost(url: string | null, host: string | null): string | null {
  if (url) {
    try {
      const u = new URL(url);
      const h = bare(u.hostname);
      if (!h.endsWith('verwaltungsportal.de') && (h === bare(host ?? '') || VP_PATH.test(u.pathname))) return h;
    } catch {
      /* keine URL */
    }
  }
  return host ? bare(host) : null;
}

/** Listen-URLs einer Website in der Reihenfolge der Versuche. */
export function vpListUrls(host: string, knownUrl?: string | null): string[] {
  const out: string[] = [];
  if (knownUrl) {
    try {
      const u = new URL(knownUrl);
      if (bare(u.hostname) === host) out.push(`${u.origin}/veranstaltungen/index.php`);
    } catch {
      /* keine URL */
    }
  }
  for (const o of [`https://www.${host}`, `https://${host}`, `http://www.${host}`]) out.push(`${o}/veranstaltungen/index.php`);
  return [...new Set(out)];
}

/** Ist die Seite eine Kalenderliste von verwaltungsportal.de? */
export function isVpPage(html: string): boolean {
  return /\/\/(layout|fotos|vorschau)\.verwaltungsportal\.de\//.test(html);
}

/** Uhrzeiten eines Textes als „hh:mm-hh:mm“. */
export function clockOf(text: string): string {
  return [...text.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map(m => m[1].padStart(5, '0')).join('-');
}

/**
 * Termin-Links der Liste auf derselben Website (ohne `www.`), je Pfad
 * einmal. Fremde Websites (regionale Kalender verlinken Nachbarn) und
 * Query-Varianten (`?modus=drucken`) zählen nicht. In den Layouts
 * `events-box` und `event-entry-new-2` steht die Uhrzeit am Eintrag
 * (`.event-time`, `.event-entry-new-2-daytime`), in `events-entry-3` nicht.
 */
export function parseVpListLinks(html: string, pageUrl: string): VpLink[] {
  const base = new URL(pageUrl);
  const host = base.hostname.replace(/^www\./, '');
  const $ = cheerio.load(html);
  const out = new Map<string, VpLink>();
  $('a[href]').each((_, a) => {
    let u: URL;
    try {
      u = new URL($(a).attr('href')!, base);
    } catch {
      return;
    }
    if (u.hostname.replace(/^www\./, '') !== host || u.search || u.hash) return;
    let path: string;
    try {
      path = decodeURI(u.pathname);
    } catch {
      path = u.pathname;
    }
    const d = DETAIL.exec(path);
    if (!d) return;
    const entry = $(a).closest('.event-box, .event-entry-new-2');
    const listClock = entry.length ? clockOf(entry.find('.event-time, .event-entry-new-2-daytime').text()) : undefined;
    const prev = out.get(path);
    if (prev && (prev.listClock !== undefined || listClock === undefined)) return;
    out.set(path, { id: d[1], date: `${d[2]}-${d[3]}-${d[4]}`, path, ...(listClock !== undefined ? { listClock } : {}) });
  });
  return [...out.values()];
}

/** Druckansicht eines Termins: gleiche Daten, ohne Navigation und Seitenleiste. */
export function vpPrintUrl(origin: string, path: string): string {
  const u = new URL(path, origin);
  u.searchParams.set('modus', 'drucken');
  return u.href;
}

interface LdPlace { name?: string; address?: { streetAddress?: string; postalCode?: string; addressLocality?: string } }
interface LdEvent {
  '@type'?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string[] | string;
  location?: LdPlace;
  organizer?: { name?: string };
}

/** Text aus JSON-LD: HTML-Entitäten (`&amp;`, `&nbsp;`) und Tags (`<br>`) weg. */
function ldText(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = cheerio.load(`<div>${htmlToText(s.replace(/&nbsp;/g, ' '))}</div>`)('div').text().replace(/[ \t]+/g, ' ').trim();
  return t || undefined;
}

const oneLine = (s: string | undefined) => s?.replace(/\s+/g, ' ').trim() || undefined;

/**
 * Gemeinde aus `addressLocality`: verwaltungsportal schreibt den Ortsteil
 * hinter die Gemeinde („Remptendorf OT Ruppersdorf“, „Brück GT Trebitz“,
 * „Haina (Kloster) OT Dodenhausen“). Die Gemeinde ist der Ort, den der
 * Resolver kennt.
 */
export function vpLocality(raw: string | undefined): string | undefined {
  const t = oneLine(raw);
  if (!t) return undefined;
  return t.split(/\s+(?:OT|GT|Ortsteil|Gemeindeteil)\s+/)[0].trim() || undefined;
}

interface DayTime { date: string; time?: string }

const DATE_RE = /(\d{2})\.(\d{2})\.(\d{4})/;
const isoDay = (m: RegExpExecArray) => `${m[3]}-${m[2]}-${m[1]}`;

/**
 * Datum und Uhrzeit, wie die Detailseite sie zeigt (Proben 2026-10-29 auf
 * 40 Websites, vier Layouts): „13.11.2026 um 19:00 Uhr“, „11.11.2026 von
 * 16:30 – 19:30 Uhr“, „29.10.2026 bis 01.11.2026“, „11.06.2027 bis
 * 13.06.2027 von 18:00 – 00:00 Uhr“, „Fr, 28.05.2027 um 17:30 Uhr“, „Do.
 * 11.03.2027 10:00 – 11:30 Uhr“. Ein oder zwei Tage, null bis zwei
 * Uhrzeiten, dazwischen nur „bis“, „von“, „um“, „ab“, „Uhr“ und der
 * Strich. Alles andere ergibt null: der Termin wird nicht übernommen,
 * statt eine Zeit zu raten.
 */
export function parseVpDateLine(line: string): { start: DayTime; end?: DayTime } | null {
  const t = line
    .replace(/\u200b/g, '')
    .replace(/\b(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Mo|Di|Mi|Do|Fr|Sa|So)\b[.,]?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const dates = [...t.matchAll(new RegExp(DATE_RE.source, 'g'))].map(m => isoDay(m as RegExpExecArray));
  const hhmm = [...t.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map(m => pad(m[1]));
  const rest = t
    .replace(new RegExp(DATE_RE.source, 'g'), ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b(bis|von|um|ab|Uhr)\b/g, ' ')
    .replace(/[–—-]/g, ' ')
    .trim();
  if (rest || dates.length < 1 || dates.length > 2 || hhmm.length > 2) return null;
  if (dates.length === 2 && dates[1] < dates[0]) return null;
  const start: DayTime = { date: dates[0], ...(hhmm[0] ? { time: hhmm[0] } : {}) };
  const lastDay = dates[1] ?? dates[0];
  if (hhmm[1]) return { start, end: { date: lastDay, time: hhmm[1] } };
  return dates[1] ? { start, end: { date: lastDay } } : { start };
}

/**
 * Text mit Datum und Uhrzeit der Detailseite: im klassischen Layout das
 * Element direkt unter der Überschrift (`h5` bzw. `h2.legacy_h5`), in den
 * Layouts `single-view-1/2/4` das Element `…-release-date` und, wo die
 * Uhrzeit eigens steht, `article.single-view-4-time`.
 */
export function vpDateText($: cheerio.CheerioAPI): string {
  const rd = $('[id$="-release-date"], [class*="-release-date"]').first();
  if (rd.length) return `${rd.text()} ${$('article[class*="-time"] > span').first().text()}`;
  return $('h1').first().next().text();
}

const pad = (t: string) => t.padStart(5, '0');

/** Wandzeit Europe/Berlin als Instant. */
const berlin = (date: string, time: string) => toUtcInstant(`${date}T${pad(time)}:00`) as string;

/**
 * Beginn und Ende aus der Zeile. Ohne Uhrzeit ganztägig (Ende: letzter Tag
 * einschließlich). Mit Uhrzeit endet der Termin am letzten Tag zur
 * Endzeit; „00:00“ ist das Ende dieses Tages, und eintägig endet eine
 * Endzeit vor der Beginnzeit am Folgetag („20:00 – 02:00“). Gleiche Zeiten
 * oder mehrtägig ohne Endzeit: Ende unbekannt, wie bei den übrigen
 * DE-Adaptern (kein Datum an einer Uhrzeit).
 */
function times(p: { start: DayTime; end?: DayTime }): { start: string; end?: string; allDay: boolean } {
  const { start: s, end: e } = p;
  if (!s.time) return { start: s.date, end: e && e.date > s.date ? e.date : undefined, allDay: true };
  const start = berlin(s.date, s.time);
  if (!e?.time || (e.date === s.date && e.time === s.time)) return { start, allDay: false };
  const nextDay = e.time === '00:00' || (e.date === s.date && e.time < s.time);
  const end = berlin(nextDay ? addDays(e.date, 1) : e.date, e.time);
  return { start, end: end > start ? end : undefined, allDay: false };
}

/** Wandzeit aus JSON-LD `startDate` („2026-11-13T19:00:00+0100“ → 19:00). */
function ldWall(s: string | undefined): DayTime | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(s?.trim() ?? '');
  return m ? { date: m[1], time: m[2] } : null;
}

export type VpDetailResult = { event: VpEvent } | { skip: string };

/**
 * Druckansicht einer Detailseite lesen. `link` ist der Listen-Link, der
 * sie gefunden hat. Datum der Zeile, des JSON-LD und des Links müssen
 * übereinstimmen, ebenso die Uhrzeit von Zeile und JSON-LD; sonst bleibt der
 * Termin weg (mit Grund), statt einen der Werte zu raten.
 */
export function parseVpDetail(html: string, link: VpLink, origin: string): VpDetailResult {
  const $ = cheerio.load(html);
  let ld: LdEvent | null = null;
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const j = JSON.parse($(s).text()) as LdEvent;
      if (j['@type'] === 'Event' && !ld) ld = j;
    } catch {
      /* fremdes JSON-LD */
    }
  });
  const ev = ld as LdEvent | null;
  if (!ev) return { skip: 'kein JSON-LD' };
  const title = oneLine(ldText(ev.name));
  if (!title) return { skip: 'ohne Titel' };

  const lineText = vpDateText($);
  const line = parseVpDateLine(lineText);
  if (!line) return { skip: `Datumszeile unbekannt: ${oneLine(lineText) ?? '(leer)'}` };
  const wall = ldWall(ev.startDate);
  if (!wall) return { skip: `startDate unlesbar: ${ev.startDate}` };
  if (wall.date !== line.start.date || line.start.date !== link.date) {
    return { skip: `Datum widerspricht sich: Link ${link.date}, JSON-LD ${wall.date}, Zeile ${line.start.date}` };
  }
  if ((wall.time ?? null) !== (line.start.time ?? null)) {
    return { skip: `Uhrzeit widerspricht sich: JSON-LD ${wall.time ?? '-'}, Zeile ${line.start.time ?? '-'}` };
  }
  const t = times(line);

  const loc = ev.location;
  const addr = loc?.address;
  let place: Pick<VpEvent, 'locationName' | 'street' | 'postalCode' | 'locality'> = {
    locationName: oneLine(ldText(loc?.name)),
    street: oneLine(addr?.streetAddress),
    postalCode: /^\d{5}$/.test(addr?.postalCode?.trim() ?? '') ? addr!.postalCode!.trim() : undefined,
    locality: vpLocality(addr?.addressLocality),
  };
  // Ohne Adresse steht sie manchmal im Namen („Sitzungssaal,
  // Verwaltungsgebäude, Lindenallee 3, 15370 Fredersdorf-Vogelsdorf“).
  if (!place.street && !place.postalCode && !place.locality && place.locationName && /\b\d{5}\b/.test(place.locationName)) {
    const p = parseEmLocation(place.locationName);
    if (p.postalCode) place = { ...p, locality: vpLocality(p.locality) };
  }

  const canonical = $('link[rel="canonical"]').attr('href');
  const url = canonical && new URL(canonical, origin).pathname === new URL(link.path, origin).pathname
    ? new URL(canonical, origin).href
    : new URL(link.path, origin).href;

  return {
    event: {
      id: link.id,
      url,
      localDate: link.date,
      ...t,
      clock: clockOf(lineText),
      title,
      description: ldText(ev.description),
      ...place,
      organizer: oneLine(ldText(ev.organizer?.name)),
      ...vpImage($, ev),
    },
  };
}

/**
 * Bild des Termins: das erste aus JSON-LD. `og:image` ist dessen große
 * Fassung (`…/gross/<Datei>`) mit Maßen, wenn es zu ihm gehört; ohne
 * Terminbild zeigt `og:image` das Wappen bzw. Logo der Gemeinde
 * (`mandate/logo/…`), das gilt nicht.
 */
function vpImage($: cheerio.CheerioAPI, ev: LdEvent): Pick<VpEvent, 'image' | 'imageWidth' | 'imageHeight'> {
  const first = (Array.isArray(ev.image) ? ev.image : ev.image ? [ev.image] : [])[0]?.trim();
  if (!first) return {};
  let img: URL;
  try {
    img = new URL(first);
  } catch {
    return {};
  }
  const og = $('meta[property="og:image"]').attr('content');
  const w = Number($('meta[property="og:image:width"]').attr('content'));
  const h = Number($('meta[property="og:image:height"]').attr('content'));
  if (og && w > 0 && h > 0) {
    try {
      const o = new URL(og);
      const big = img.pathname.replace(/\/([^/]+)$/, '/gross/$1');
      if (o.hostname === img.hostname && o.pathname === big) {
        // og:image nennt http://, das JSON-LD desselben Hosts https://.
        return { image: new URL(big, img.origin).href, imageWidth: w, imageHeight: h };
      }
    } catch {
      /* kein URL */
    }
  }
  return { image: img.href };
}

const BERLIN = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tag oder Instant um `n` Tage verschieben, in Berliner Wandzeit (Umstellung beachtet). */
function shift(v: string, n: number): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return addDays(v, n);
  const [date, time] = BERLIN.format(new Date(v)).split(' ');
  return berlin(addDays(date, n), time);
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Weiterer Termin einer Serie ohne eigenen Abruf: alle Angaben der
 * gelesenen Detailseite, Beginn und Ende um den Abstand der Termintage
 * verschoben. Nur zulässig, wenn die Liste am gelesenen Termin dieselben
 * Uhrzeiten zeigt wie seine Detailseite und am weiteren Termin dieselben wie
 * am gelesenen (`vpSameClock`); sonst wird der weitere Termin selbst gelesen.
 */
export function vpOccurrence(ev: VpEvent, link: VpLink, origin: string): VpEvent {
  const n = dayDiff(ev.localDate, link.date);
  return {
    ...ev,
    url: new URL(link.path, new URL(ev.url).origin || origin).href,
    localDate: link.date,
    start: shift(ev.start, n),
    ...(ev.end ? { end: shift(ev.end, n) } : {}),
  };
}

/** Darf `other` aus der Detailseite von `read` (gelesen über `readLink`) abgeleitet werden? */
export function vpSameClock(read: VpEvent, readLink: VpLink, other: VpLink): boolean {
  return readLink.listClock !== undefined && readLink.listClock === read.clock && other.listClock === readLink.listClock;
}
