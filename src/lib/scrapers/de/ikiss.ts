/**
 * Advantic iKISS, Veranstaltungsmodul `ModID=11` (fn-29.13).
 *
 * Kalenderliste `<Kalenderpfad>/` mit „Es wurden N Veranstaltungen
 * gefunden", Folgeseiten über `ofs_<Liste>=<Versatz>` (`pn_step` im Pager),
 * je Termin ein Link `<Kalenderpfad>/<Slug>.php?…ModID=11&FID=<Mandant>.<ID>.<Sprache>`.
 * Drei Vorlagen in der Probe 2026-10-30: `result-list veranstaltungen` mit
 * Kategorie und Ort (Pfatter), `veranstaltungen` + `list-title` (Kasseburg),
 * `liste_titel` nur mit Datum (Amt Hohe Elbgeest). Die Liste trägt nicht
 * überall Uhrzeit und Ort; maßgeblich ist deshalb die Detailseite mit ihren
 * Feldern „Datum:", „Uhrzeit:", „Veranstaltungsort:"/„Ort:", „Ortschaft:",
 * „Region:". Der iCal-Export liegt unter `/output/`, das robots.txt sperrt.
 * Manche Websites bieten `/media/rss/<Name>.xml` (20 Einträge, ohne Adresse);
 * dessen Kanal-Link ist die Kalenderliste. REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';

export interface IkissListPage {
  /** Kalenderliste erkannt („Es wurden N Veranstaltungen gefunden" oder Pager). */
  isList: boolean;
  /** N aus „Es wurden N Veranstaltungen gefunden". */
  total: number | null;
  /** Detailseiten der Termine dieser Seite (absolut, je FID einmal). */
  details: { fid: string; url: string }[];
  /** Link auf eine Folgeseite als Vorlage (`…ofs_2=25…`), sonst null. */
  pagerTemplate: string | null;
  /** Termine je Seite (kleinster Versatz im Pager). */
  pageSize: number | null;
  /** Größter Versatz im Pager. */
  maxOffset: number;
}

export interface IkissTermin {
  /** `<Mandant>.<ID>.<Sprache>`, z. B. „4257.5597.1". */
  fid: string;
  url: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  category?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  /** „Ortschaft:" bzw. „Gemeinde:" (Gemeinde oder Ortsteil des Termins). */
  ortschaft?: string;
  /** „Region:" (Gemeinde, Ortsteil oder Amt, je nach Website). */
  region?: string;
  organizer?: string;
  image?: string;
  /** Koordinate der Quelle (Kartenlink), nur wo die Website sie führt. */
  lat?: number;
  lng?: number;
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/[\s ‌]+/g, ' ').trim();
  return t || undefined;
};

/** FID aus einem Link (`FID=4257.5597.1`), nur im Veranstaltungsmodul. */
export function fidOf(href: string): string | null {
  if (!/[?&]ModID=11(?:&|$)/i.test(href)) return null;
  return /[?&]FID=(\d+\.\d+\.\d+)(?:&|$)/i.exec(href)?.[1] ?? null;
}

function detailLinks($: cheerio.CheerioAPI, base: string): { fid: string; url: string }[] {
  const out = new Map<string, string>();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href')!.replace(/&amp;/g, '&');
    const fid = fidOf(href);
    if (!fid || out.has(fid)) return;
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if (u.host !== new URL(base).host || u.pathname.startsWith('/output/')) return;
    u.hash = '';
    out.set(fid, u.href);
  });
  return [...out].map(([fid, url]) => ({ fid, url }));
}

/** Eine Seite der Kalenderliste; `base` ist die abgerufene URL. */
export function parseIkissList(html: string, base: string): IkissListPage {
  const $ = cheerio.load(html);
  const total = /Es\s+wurden?\s+(\d+)\s+Veranstaltung/i.exec($('h2').text().replace(/\s+/g, ' '))?.[1];
  let pagerTemplate: string | null = null;
  let pageSize: number | null = null;
  let maxOffset = 0;
  $('a.pn_step[href], a.pn_page_r[href], .ikiss_pagenav a[href], .seitenzaehler a[href]').each((_, a) => {
    const href = $(a).attr('href')!;
    const m = /[?&](?:amp;)?ofs_\d+=(\d+)/.exec(href);
    if (!m || !/ModID=11/.test(href)) return;
    const ofs = Number(m[1]);
    if (ofs <= 0) return;
    if (pageSize == null || ofs < pageSize) {
      pageSize = ofs;
      pagerTemplate = new URL(href.replace(/&amp;/g, '&'), base).href.replace(/#.*$/, '');
    }
    if (ofs > maxOffset) maxOffset = ofs;
  });
  return {
    isList: total != null || pagerTemplate != null,
    total: total != null ? Number(total) : null,
    details: detailLinks($, base),
    pagerTemplate,
    pageSize,
    maxOffset,
  };
}

/** URL der Listenseite mit Versatz `offset` nach der Vorlage aus dem Pager. */
export function ikissPageUrl(template: string, offset: number): string {
  return template.replace(/([?&]ofs_\d+=)\d+/, `$1${offset}`);
}

/**
 * Kalenderpfade, auf die eine Seite ohne Liste verlinkt (Teaser,
 * „Weitere Termine"): Detailseiten liegen unter `<Kalenderpfad>/<Slug>.php`,
 * die Liste ist `<Kalenderpfad>/`. Häufigster Pfad zuerst.
 */
export function calendarPaths(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const count = new Map<string, number>();
  for (const d of detailLinks($, base)) {
    const u = new URL(d.url);
    const dir = u.pathname.replace(/[^/]*$/, '');
    if (dir === '/' || !/\.php$/i.test(u.pathname)) continue;
    const href = `${u.origin}${dir}`;
    count.set(href, (count.get(href) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([h]) => h);
}

/** iKISS-RSS (`<generator>IKISS</generator>`): Kanal-Link (Kalenderliste) und Detailseiten. */
export function parseIkissRss(xml: string): { calendarUrl: string | null; details: { fid: string; url: string }[] } | null {
  if (!/<generator>\s*IKISS\s*<\/generator>/i.test(xml)) return null;
  const $ = cheerio.load(xml, { xmlMode: true });
  const details: { fid: string; url: string }[] = [];
  $('item > link').each((_, l) => {
    const url = $(l).text().trim();
    const fid = fidOf(url);
    if (fid && !details.some(d => d.fid === fid)) details.push({ fid, url });
  });
  return { calendarUrl: clean($('channel > link').first().text()) ?? null, details };
}

const DATE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/g;
const TIME = /(\d{1,2})[:.](\d{2})/g;
const MONTHS = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
const MONTH_DATE = new RegExp(String.raw`(\d{1,2})\.\s*(${MONTHS.join('|')})\s+(\d{4})`, 'gi');

/** „14. November 2026" → „14.11.2026" (Bad Oldesloe, Hennigsdorf). */
export function numericDates(text: string): string {
  return text.replace(MONTH_DATE, (_, d: string, m: string, y: string) => `${d}.${MONTHS.indexOf(m.toLowerCase()) + 1}.${y}`);
}

const berlin = (date: string, hh: string, mm: string) => toUtcInstant(`${date}T${hh.padStart(2, '0')}:${mm}:00`) as string;

/**
 * Datum und Uhrzeit aus „Datum:" und „Uhrzeit:". Ohne Uhrzeit ganztägig.
 * „bis" verbindet Beginn und Ende; das Ende „23:59" ist kein Ende, sondern
 * die Vorgabe des Formulars: 147 der 7.910 Detailseiten der Probe
 * 2026-10-30 enden um 23:59, 138 davon aus Lennestadt und Oberviechtach
 * („14:45 bis 23:59", „04:00 bis 23:59"); es bleibt offen. Ein Ende vor dem
 * Beginn ohne eigenes Enddatum bleibt offen.
 */
export function ikissWhen(dateText: string, timeText: string | undefined): Pick<IkissTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const dates = [...numericDates(dateText).matchAll(DATE)].map(m => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  if (!dates.length) return null;
  const [d1] = dates;
  const d2 = dates.length > 1 && dates[1] > d1 ? dates[1] : undefined;
  const times = [...(timeText ?? '').matchAll(TIME)].filter(m => +m[1] <= 23 && +m[2] <= 59);
  if (!times.length) return { localDate: d1, start: d1, ...(d2 ? { end: d2 } : {}), allDay: true };
  const start = berlin(d1, times[0][1], times[0][2]);
  let end: string | undefined;
  const t2 = times[1];
  if (t2 && !(t2[1] === '23' && t2[2] === '59')) end = berlin(d2 ?? d1, t2[1], t2[2]);
  else if (d2) end = d2;
  if (end && end.length > 10 && end <= start) end = undefined;
  return { localDate: d1, start, ...(end ? { end } : {}), allDay: false };
}

/**
 * „Beginn: 14.11.2026, 18:11 Uhr" / „Ende: 15.11.2026, 02:00 Uhr" (Vorlage
 * mit `dl.object-data`). Ohne Uhrzeit am Beginn ganztägig, auch wenn das Ende
 * eine trägt.
 */
function beginEnd(rawBegin: string, rawEnd: string | undefined): ReturnType<typeof ikissWhen> {
  const begin = numericDates(rawBegin);
  const end = rawEnd && numericDates(rawEnd);
  const bt = [...begin.replace(DATE, ' ').matchAll(TIME)][0];
  const et = end ? [...end.replace(DATE, ' ').matchAll(TIME)][0] : undefined;
  return ikissWhen(`${begin} bis ${end ?? ''}`, bt ? `${bt[0]} bis ${et?.[0] ?? ''}` : undefined);
}

/** Zeilen eines Feldwerts (`<p>`, `<br>`), ohne Telefon-, Mail- und Web-Links. */
function valueLines($: cheerio.CheerioAPI, node: cheerio.Cheerio<any>): string[] {
  const c = node.clone();
  c.find('a[href^="tel:"], a[href^="mailto:"], a[href^="http"], script, .sr-only').remove();
  const html = (c.html() ?? '').replace(/<\/?(?:p|div|br)[^>]*>/gi, '\n');
  return html.split('\n').map(s => clean(cheerio.load(s).text())).filter((s): s is string => !!s);
}

/**
 * Felder der Detailseite: Beschriftung „Datum:" in einem Element, der Wert
 * im nächsten (`column-3`/`column-2x3`, `spalte_links`/`spalte_rechts`).
 */
function fields($: cheerio.CheerioAPI): Map<string, cheerio.Cheerio<any>> {
  const out = new Map<string, cheerio.Cheerio<any>>();
  $('div, dt, th, span, strong').each((_, el) => {
    const n = $(el);
    // Screenreader-Beschriftungen im Wert („<span class="sr-only">Datum: </span>01.01.2026",
    // Haldensleben, Gießen) sind kein Feld.
    if (n.is('.sr-only, .hide') || n.closest('.sr-only').length) return;
    // Ein Icon vor der Beschriftung zählt nicht (Wismar `<dt><span aria-hidden>…</span>Datum:</dt>`).
    const label = n.clone();
    label.find('[aria-hidden="true"], .hide').remove();
    if (label.children().length) return;
    const m = /^([A-Za-zÄÖÜäöüß ]{2,30}):$/.exec(clean(label.text()) ?? '');
    if (!m) return;
    const key = m[1].trim().toLowerCase();
    if (out.has(key)) return;
    const value = n.next();
    if (value.length) out.set(key, value);
  });
  return out;
}

/** „Haidauer Str. 29" / „93102 Pfatter" aus den Zeilen nach dem Ortsnamen. */
function placeOf(raw: string[]): Pick<IkissTermin, 'locationName' | 'street' | 'postalCode' | 'locality'> {
  // Adresse in einer Zeile („Gutshotel Groß Breesen · Groß Breesen 10 · 18276 Zehna",
  // Bützow): aufteilen, wenn ein Teil mit einer PLZ beginnt.
  // Mehr als Name und Straße vor der PLZ („Caritashaus, Kirchplatz1, 1. Etage,
  // Raum 1, 53340 Meckenheim") bleibt der Ortsname, nur PLZ und Ort werden Felder.
  let joined = false;
  const lines = raw.flatMap(l => {
    const parts = l.split(/\s*[·,]\s*/);
    let plz = parts.findIndex(x => /^\d{5}\s+\S/.test(x));
    if (parts.length < 2 || plz < 0) return [l];
    // Straße nach der PLZ („Café Jendraß, 38271 Baddeckenstedt, Lindenstraße 6").
    if (plz === parts.length - 2 && /\p{L}.*\d+\s?[a-z]?$/iu.test(parts[plz + 1])) {
      parts.splice(plz, 0, parts.pop()!);
      plz++;
    }
    if (plz <= 2) return parts;
    joined = true;
    return [parts.slice(0, plz).join(', '), ...parts.slice(plz)];
  });
  if (!lines.length) return {};
  const plzIdx = lines.findIndex(l => /^\d{5}\s+\S/.test(l));
  if (plzIdx === -1) return { locationName: lines[0] };
  const m = /^(\d{5})\s+(.+)$/.exec(lines[plzIdx])!;
  // PLZ und Ort zuerst, der Ort des Termins danach (Kleinmachnow „14532 Kleinmachnow /
  // Rathaus Kleinmachnow, Bürgersaal Adolf-Grimme-Ring 10 / Haltestelle: …").
  if (plzIdx === 0 && lines.length > 1) return { locationName: lines[1], postalCode: m[1], locality: clean(m[2]) };
  const before = lines.slice(0, plzIdx);
  // Eine Zeile vor der PLZ ist Straße, wenn sie auf eine Hausnummer endet, sonst der Ortsname.
  const streetLine = joined ? undefined : before.length >= 2 || (before.length === 1 && /\d+\s?[a-z]?$/i.test(before[0])) ? before[before.length - 1] : undefined;
  const name = before.length >= 2 || (before.length === 1 && !streetLine) ? before[0] : undefined;
  if (joined && plzIdx >= 1) return { locationName: before[0], postalCode: m[1], locality: clean(m[2]) };
  return {
    ...(name ? { locationName: name } : {}),
    ...(streetLine ? { street: streetLine } : {}),
    postalCode: m[1],
    locality: clean(m[2]),
  };
}

/** Detailseite eines Termins; null, wenn sie keinen Termin trägt. */
export function parseIkissDetail(html: string, url: string): IkissTermin | null {
  const fid = fidOf(url);
  if (!fid) return null;
  const $ = cheerio.load(html);
  const f = fields($);
  const text = (k: string) => (f.get(k) ? clean(f.get(k)!.text()) : undefined);
  const datum = text('datum');
  const info = $('.event-info').first();
  const infoTime = info.find('time').first();
  let when: ReturnType<typeof ikissWhen>;
  let anchor = f.get('datum') ?? f.get('beginn');
  if (datum) when = ikissWhen(datum, text('uhrzeit'));
  else if (text('beginn')) when = beginEnd(text('beginn')!, text('ende'));
  else if (infoTime.length) {
    // Hennigsdorf: `.event-info` mit `<time>` „01. November 2026 <br> 18:00 Uhr bis 20:00 Uhr".
    const t = numericDates(clean(infoTime.text()) ?? '');
    when = ikissWhen(t, t.replace(DATE, ' '));
    anchor = infoTime;
  } else when = null;
  if (!when || !anchor) return null;

  // Titel ist das letzte <h1> vor dem Datumsfeld: davor steht oft die
  // Seitenüberschrift „Veranstaltungen" im Suchformular (Algermissen).
  const order = new Map($('*').toArray().map((el, i) => [el, i]));
  const at = order.get(anchor[0]) ?? Infinity;
  const h1 = $(info.length && infoTime.length ? '.event-info-title' : 'h1')
    .filter((_, h) => $(h).closest('header, nav, footer').length === 0 && (order.get(h) ?? Infinity) < at)
    .last();
  // Kategorien „Vereine • Theater/Kabarett", getrennt durch ein Icon.
  const topic = h1.find('.page-topic').clone();
  topic.find('[class*="fa-"]').replaceWith(', ');
  const category = clean(visibleText(topic))?.replace(/\s*,\s*/g, ', ').replace(/^,\s*|,\s*$/g, '');
  const titleNode = h1.clone();
  titleNode.find('.page-topic').remove();
  const title = clean(visibleText(titleNode));
  if (!title) return null;

  // Hennigsdorf: Ort als Link auf Google Maps mit Koordinate (`q=52.637430,13.204573`).
  const mapLink = info.find('a[href*="maps"]').first();
  const q = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(mapLink.attr('href') ?? '');
  const coords = q && !(+q[1] === 0 && +q[2] === 0) ? { lat: +q[1], lng: +q[2] } : {};
  const placeNode = f.get('veranstaltungsort') ?? f.get('ort');
  const place = placeNode ? placeOf(valueLines($, placeNode)) : mapLink.length ? placeOf([clean(mapLink.text()) ?? ''].filter(Boolean)) : {};
  // „Veranstalter:" als Feld oder als Seitenkasten mit Adresse (Gemünden (Felda)).
  const org = f.get('veranstalter');
  const orgBox = $('.widget-title').filter((_, h) => clean($(h).text()) === 'Veranstalter').first().closest('.widget').find('.result-list_object-title').first();
  const organizer = org ? valueLines($, org)[0] : orgBox.length ? clean(visibleText(orgBox)) : undefined;
  const img = $('a[data-photoswipe-large-source], .image-gallery a[href*="/media/"]').filter((_, a) => $(a).closest('footer').length === 0).first();
  const imgHref = img.attr('data-photoswipe-large-source') ?? img.attr('href');
  return {
    fid,
    url,
    ...when,
    title,
    ...(category ? { category } : {}),
    ...place,
    ...(text('ortschaft') ?? text('gemeinde') ? { ortschaft: text('ortschaft') ?? text('gemeinde') } : {}),
    ...(f.get('region') ? { region: clean(f.get('region')!.text()) } : {}),
    ...(organizer ? { organizer } : {}),
    ...(imgHref ? { image: new URL(imgHref, url).href } : {}),
    ...coords,
  };
}
