/**
 * GeoCMS (Sachsen-Anhalt, Hessen, Rheinland-Pfalz; Vollerhebung 66
 * Gemeinden), fn-29 Rest-Adapter. Die Kalenderseite `…/veranstaltungen.html`
 * listet 20 Termine je Seite als `article.gcevent-list-row`: `time
 * .gcevent-list-day` (Wochentag, „19. November" oder „01. bis 30.
 * November", Jahr), Titel-Link mit `title="… (event-<ID>-<Mandant>-de-<n>-
 * YYYY-MM-DD-HH-MM)"`, Uhrzeit „von 10:00 Uhr bis 18:00 Uhr", Kategorien.
 * Fenster `min_date`/`max_date` (TT.MM.JJJJ), Seiten über
 * `gcevent[pager]=<Offset>`. Die Detailseite `gcevent-singleview` trägt
 * Datum, Uhrzeit, Text, Ticket-Link und den Veranstaltungsort mit „PLZ Ort"
 * und Straße (Köthen, 07.11.2026). REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';

export interface GeocmsRow {
  /** Termin-Schlüssel `event-<ID>-<Mandant>-de-<n>-YYYY-MM-DD-HH-MM`. */
  key: string;
  url: string;
  title: string;
  localDate: string;
  /** „HH:MM" oder undefined (00-00 in der Kennung heißt ohne Uhrzeit). */
  time?: string;
  endTime?: string;
  /** Letzter Tag bei „01. bis 30. November". */
  lastDate?: string;
  category?: string;
  image?: string;
}

export interface GeocmsDetail {
  description?: string;
  ticketUrl?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  image?: string;
}

export interface GeocmsTermin {
  key: string;
  url: string;
  title: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  category?: string;
  description?: string;
  ticketUrl?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  image?: string;
}

const text = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const MONTHS: Record<string, string> = { januar: '01', februar: '02', märz: '03', maerz: '03', april: '04', mai: '05', juni: '06', juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12' };

export function isGeocmsPage(html: string): boolean {
  return /gc_gcevent|gcevent-list|GeoCMS/i.test(html);
}

export function geocmsListUrl(pageUrl: string, from: string, to: string, offset: number): string {
  const u = new URL(pageUrl);
  const de = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  u.searchParams.set('min_date', de(from));
  u.searchParams.set('max_date', de(to));
  if (offset > 0) u.searchParams.set('gcevent[pager]', String(offset));
  return u.href;
}

export const GEOCMS_PAGE_SIZE = 20;

export function parseGeocmsList(html: string, pageUrl: string): GeocmsRow[] {
  const $ = cheerio.load(html);
  const out: GeocmsRow[] = [];
  $('article.gcevent-list-row').each((_, el) => {
    const row = $(el);
    const a = row.find('.gcevent-list-title a').first();
    const href = a.attr('href');
    const key = /\((event-\d+-\d+-[a-z]{2}-\d+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2})\)/.exec(a.attr('title') ?? '')?.[1];
    const title = text(a.text());
    if (!href || !key || !title) return;
    const m = /-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/.exec(key)!;
    const localDate = `${m[1]}-${m[2]}-${m[3]}`;
    const timeFromKey = `${m[4]}:${m[5]}`;
    const dt = text(row.find('.gcevent-list-datetime').first().text());
    const times = [...dt.matchAll(/(\d{1,2})[:.](\d{2})\s*Uhr/g)].map(x => `${x[1].padStart(2, '0')}:${x[2]}`);
    const time = times[0] ?? (timeFromKey !== '00:00' ? timeFromKey : undefined);
    const year = text(row.find('.gcevent-list-day-year').first().text()) || m[1];
    const range = /bis\s+(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)/.exec(text(row.find('.gcevent-list-day-month').first().text()));
    const lastDate = range && MONTHS[range[2].toLowerCase()] ? `${year}-${MONTHS[range[2].toLowerCase()]}-${range[1].padStart(2, '0')}` : undefined;
    const img = row.find('.gcevent-listview-image img').first().attr('src');
    out.push({
      key,
      url: new URL(href, pageUrl).href,
      title,
      localDate,
      time,
      endTime: times[1],
      lastDate: lastDate && lastDate > localDate ? lastDate : undefined,
      category: text(row.find('.gcevent-list-categories').first().text()).split('|')[0].trim() || undefined,
      ...(img ? { image: new URL(img, pageUrl).href } : {}),
    });
  });
  return out;
}

export function parseGeocmsDetail(html: string, pageUrl: string): GeocmsDetail | null {
  const $ = cheerio.load(html);
  const box = $('.gcevent-singleview');
  if (!box.length) return null;
  const addr = box.find('.gcevent-singleview-address-row').first();
  let locationName: string | undefined, street: string | undefined, postalCode: string | undefined, locality: string | undefined;
  if (addr.length) {
    locationName = text(addr.find('.gcevent-singleview-address-rowtitle').first().text()) || undefined;
    const lines = addr
      .clone()
      .children('strong, ul')
      .remove()
      .end()
      .html()!
      .split(/<br\s*\/?>/i)
      .map(s => text(cheerio.load(s).text()))
      .filter(Boolean);
    for (const l of lines) {
      const plz = /^(\d{5})\s+(.+)$/.exec(l);
      if (plz) { postalCode = plz[1]; locality = plz[2]; } else if (!street) street = l;
    }
  }
  const ticket = box.find('.gcevent-singleview-ticket-link a[href]').first().attr('href');
  const img = box.find('.gcevent-singleview-headpicture img').first().attr('src');
  return {
    description: text(box.find('.gcevent-singleview-content').first().text()) || undefined,
    ticketUrl: ticket && /^https?:\/\//.test(ticket) ? ticket : undefined,
    locationName,
    street,
    postalCode,
    locality,
    ...(img ? { image: new URL(img, pageUrl).href } : {}),
  };
}

export function toGeocmsTermin(row: GeocmsRow, detail: GeocmsDetail | null): GeocmsTermin {
  const allDay = !row.time;
  const start = allDay ? row.localDate : (toUtcInstant(`${row.localDate}T${row.time}:00`) as string);
  let end: string | undefined;
  if (allDay) end = row.lastDate;
  else if (row.endTime) end = toUtcInstant(`${row.lastDate && row.lastDate > row.localDate ? row.lastDate : row.localDate}T${row.endTime}:00`) as string;
  return {
    key: row.key,
    url: row.url,
    title: row.title,
    localDate: row.localDate,
    start,
    end: end && end > start ? end : undefined,
    allDay,
    category: row.category,
    description: detail?.description,
    ticketUrl: detail?.ticketUrl,
    locationName: detail?.locationName,
    street: detail?.street,
    postalCode: detail?.postalCode,
    locality: detail?.locality,
    image: detail?.image ?? row.image,
  };
}
