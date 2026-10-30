/**
 * Hirsch & Wölfl `hwveranstaltung` (TYPO3-Extension, Medienwerk Vellberg),
 * fn-29.12.
 *
 * Kalenderliste `<Kalenderpfad>/seite-N/suche-none`, zehn Termine je Seite
 * ab heute. Je Termin ein `div.hwveranstaltung__record#…__record__<id>` mit
 * Titel (`h3.hw_record__title`), Kategorien (`hw_tag`), Datum
 * („07.11.2026" oder „07.11.2026 bis 08.11.2026"), Uhrzeit („16:00 Uhr bis
 * 20:00 Uhr", fehlt bei Terminen ohne Uhrzeit), Veranstalter, Ortsname
 * (`hw_record__simpleLocation`), Karte (OpenStreetMap `mlat`/`mlon`, Apple
 * Maps `q=<Titel>,<Straße+Nr>,<PLZ><Ort>`) und dem Link zur Detailseite
 * (`…/<id>/<slug>`, bei Serien `…/termin-<n>` je Termin). `?type=` sperrt
 * robots.txt, einen Feed gibt es nicht. REIN, kein I/O.
 *
 * Die älteren Modulversionen (`record record_list kalenderKatIdN`,
 * Volkertshausen; `einzeleintrag kalenderKatIdN`, Osterburken) haben keine
 * Detailseite je Termin; sie werden erkannt, aber nicht gelesen.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';

export interface HwTermin {
  /** Datensatz-ID der Veranstaltung auf der Website. */
  recordId: string;
  /** Termin-ID (`termin-<n>`), bei Veranstaltungen mit mehreren Terminen. */
  terminId?: string;
  /** Detailseite des Termins (absolut). */
  url: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  category?: string;
  organizer?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  image?: string;
  lat?: number;
  lng?: number;
}

export interface HwListPage {
  /** Neue Modulversion mit `hwveranstaltung__record` bzw. Listen-Plugin erkannt. */
  isList: boolean;
  /** Alte Modulversion ohne Detailseiten (nicht gelesen). */
  oldModule: boolean;
  termine: HwTermin[];
  /** Höchste Seitenzahl im Pager (1 ohne Pager). */
  lastPage: number;
  /** Pfad einer Folgeseite als Vorlage (`…/seite-2/suche-none`), sonst null. */
  pagerTemplate: string | null;
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

const DATE = /(\d{2})\.(\d{2})\.(\d{4})/g;
const TIME = /(\d{1,2})[:.](\d{2})\s*Uhr/gi;

/** Instant aus Wandzeit in deutscher Ortszeit (Europe/Berlin = Europe/Vienna bei Offset und Umstellung). */
const berlin = (date: string, hh: string, mm: string) => toUtcInstant(`${date}T${hh.padStart(2, '0')}:${mm}:00`) as string;

/**
 * Datum und Uhrzeit des Termins. Ohne Uhrzeit ganztägig (kein erfundenes
 * 00:00). „bis" verbindet Beginn und Ende; ein Ende vor dem Beginn ohne
 * eigenes Enddatum bleibt offen (keine erfundene Nacht).
 */
export function hwWhen(dateText: string, timeText: string | undefined): Pick<HwTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const dates = [...dateText.matchAll(DATE)].map(m => `${m[3]}-${m[2]}-${m[1]}`);
  if (!dates.length) return null;
  const [d1] = dates;
  const d2 = dates.length > 1 && dates[1] > d1 ? dates[1] : undefined;
  const times = [...(timeText ?? '').matchAll(TIME)].filter(m => +m[1] <= 23 && +m[2] <= 59);
  if (!times.length) return { localDate: d1, start: d1, ...(d2 ? { end: d2 } : {}), allDay: true };
  const start = berlin(d1, times[0][1], times[0][2]);
  let end: string | undefined;
  if (times.length > 1) end = berlin(d2 ?? d1, times[1][1], times[1][2]);
  else if (d2) end = d2;
  if (end && end.length > 10 && end <= start) end = undefined;
  return { localDate: d1, start, ...(end ? { end } : {}), allDay: false };
}

/** „Im Käppele29" → „Im Käppele 29" (Apple-Link ohne Leerzeichen vor der Hausnummer). */
function splitHouseNumber(street: string): string {
  return street.replace(/(\p{L}|\.)(\d+\s?[a-z]?(?:\s?[-/]\s?\d+\s?[a-z]?)?)$/u, '$1 $2');
}

/**
 * Adresse aus dem Apple-Maps-Link `q=<Titel>,<Straße><Nr>,<PLZ><Ort>`; der
 * Titel kann Kommas tragen, deshalb von rechts. Ohne Adresse steht dort
 * `<Titel>,,` (Kupferzell).
 */
export function appleAddress(q: string): { street?: string; postalCode?: string; locality?: string } {
  const parts = q.split(',');
  if (parts.length < 3) return {};
  const last = parts[parts.length - 1].trim();
  const street = clean(parts[parts.length - 2]);
  const m = /^(\d{5})\s*(.*)$/.exec(last);
  return {
    ...(street ? { street: splitHouseNumber(street) } : {}),
    ...(m ? { postalCode: m[1], ...(clean(m[2]) ? { locality: clean(m[2]) } : {}) } : {}),
  };
}

function valueText($: cheerio.CheerioAPI, rec: cheerio.Cheerio<any>, field: string): string | undefined {
  const node = rec.find(`.hw_record__${field} .hw_record__value__text`).first();
  return node.length ? clean(visibleText(node)) : undefined;
}

function parseRecord($: cheerio.CheerioAPI, el: any, base: string): HwTermin | null {
  const rec = $(el);
  // `…__record__647` oder je Termin `…__record__647-2855` (Bempflingen).
  const recordId = /__record__(\d+)(?:-\d+)?$/.exec(rec.attr('id') ?? '')?.[1];
  const title = clean(visibleText(rec.find('.hw_record__title').first()));
  const href = rec.find('a.hw_record__more__show').first().attr('href');
  const dateText = valueText($, rec, 'date');
  if (!recordId || !title || !href || !dateText) return null;
  const when = hwWhen(dateText, valueText($, rec, 'time'));
  if (!when) return null;
  const url = new URL(href, base).href;
  const terminId = /\/termin-(\d+)(?:[/?#]|$)/.exec(new URL(url).pathname + '/')?.[1];

  // Ortsname ist die erste Zeile; neuere Seiten hängen Straße und
  // „<PLZ><Ort>" mit <br> an (Auenwald), die liefert der Apple-Link sauber.
  const locNode = rec.find('.hw_record__simpleLocation .hw_record__value__text').first();
  const locationName = locNode.length
    ? clean((locNode.html() ?? '').split(/<br\s*\/?>/i).map(s => cheerio.load(s).text())[0])
    : undefined;

  const map = rec.find('a.hw_record__map_link');
  let lat: number | undefined, lng: number | undefined;
  const osm = map.filter((_, a) => /openstreetmap\.org/.test($(a).attr('href') ?? '')).first().attr('href');
  if (osm) {
    const u = new URL(osm);
    const la = Number(u.searchParams.get('mlat')), lo = Number(u.searchParams.get('mlon'));
    if (u.searchParams.get('mlat') && Number.isFinite(la) && Number.isFinite(lo) && !(la === 0 && lo === 0)) { lat = la; lng = lo; }
  }
  const apple = map.filter((_, a) => /maps\.apple\.com/.test($(a).attr('href') ?? '')).first().attr('href');
  const addr = apple ? appleAddress(decodeURIComponentSafe(apple.replace(/^[^?]*\?q=/, ''))) : {};

  const img = rec.find('.hw_record__image img, .hw_record__outside_image img').first().attr('src');
  return {
    recordId,
    ...(terminId ? { terminId } : {}),
    url,
    ...when,
    title,
    category: clean(visibleText(rec.find('.hw_tag').first())),
    organizer: valueText($, rec, 'organizer'),
    locationName,
    ...addr,
    ...(img ? { image: new URL(img, base).href } : {}),
    ...(lat != null ? { lat, lng } : {}),
  };
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Eine Seite der Kalenderliste; `base` ist die abgerufene URL (für relative Links). */
export function parseHwList(html: string, base: string): HwListPage {
  const $ = cheerio.load(html);
  const records = $('div.hwveranstaltung__record[id^="hwveranstaltung__record__"]');
  // Auch eine leere Liste ist die Liste („Es sind derzeit keine Einträge
  // vorhanden", Gundelfingen `hwveranstaltung__list_wrapper`).
  const isList = records.length > 0 || $('.frame-hwveranstaltung_list, .hwveranstaltung__list_wrapper').length > 0;
  // Ältere Versionen: `record record_list kalenderKatIdN` (Volkertshausen),
  // `einzeleintrag kalenderKatIdN` (Osterburken), leer `hwveranstaltung_list`
  // (Ötisheim); keine davon hat eine Detailseite je Termin.
  const oldModule = !isList && $('[class*="kalenderKatId"], .hwveranstaltung_list, .hwveranstaltung .list_module').length > 0;
  const termine: HwTermin[] = [];
  records.each((_, el) => {
    const t = parseRecord($, el, base);
    if (t) termine.push(t);
  });
  let lastPage = 1;
  let pagerTemplate: string | null = null;
  // Nur der Pager zählt (`nav.hw__frontend_pagination`, „Letzte Seite" ist
  // die höchste Zahl); Seiten ohne Pager haben eine Seite.
  $('.hw__frontend_pagination a[href], .hw_pagination a[href]').each((_, a) => {
    const href = $(a).attr('href')!;
    const m = /\/seite-(\d+)\/suche-[^/?#"]+/.exec(href);
    if (!m) return;
    const n = Number(m[1]);
    if (n > lastPage) lastPage = n;
    if (!pagerTemplate && n >= 2) pagerTemplate = new URL(href, base).href;
  });
  return { isList, oldModule, termine, lastPage, pagerTemplate };
}

/** URL der Seite `n` nach der Vorlage aus dem Pager. */
export function hwPageUrl(template: string, n: number): string {
  return template.replace(/\/seite-\d+\//, `/seite-${n}/`);
}
