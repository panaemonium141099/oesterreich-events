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
  /** Ort aus der Liste (Nebra, Königswinter). */
  locationName?: string;
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

export function geocmsListUrl(pageUrl: string, from: string, to: string): string {
  const u = new URL(pageUrl);
  const de = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  u.searchParams.set('min_date', de(from));
  u.searchParams.set('max_date', de(to));
  return u.href;
}


/**
 * Zeilen der Liste. Drei Vorlagen (07.11.2026): Köthen `article.gcevent-list-row`
 * mit Termin-Kennung im `title` des Links und `gcevent-list-day`; Nebra
 * `article.gcevent-list-row` ohne Kennung, Datum „07.11.2026 ab 11:00 Uhr" in
 * `gcevent-list-datetime`; Königswinter `li.media` mit `h4 a` und „17.10.2026 -
 * 12.12.2026 von 09:30 Uhr bis 11:00 Uhr". Gemeinsam: der Detail-Link
 * `/event/<ID>,<Mandant>/<slug>-TT-MM-JJJJ.html` trägt den Tag.
 */
export function parseGeocmsList(html: string, pageUrl: string): GeocmsRow[] {
  const $ = cheerio.load(html);
  const out = new Map<string, GeocmsRow>();
  $('a[href*="/event/"]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href');
    const m = href ? /\/event\/(\d+),(\d+)\/[^/?#]*?-(\d{2})-(\d{2})-(\d{4})\.html/.exec(href) : null;
    const title = text(a.text());
    if (!href || !m || !title) return;
    const slugDate = `${m[5]}-${m[4]}-${m[3]}`;
    const keyFromTitle = /\((event-\d+-\d+-[a-z]{2}-\d+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2})\)/.exec(a.attr('title') ?? '')?.[1];
    // Zeile: Artikel (Köthen, Nebra), Listenpunkt (Königswinter) oder Karte `div.card` (Oebisfelde).
    const row = a.closest('article, li, .card, .gcevent-list-row');
    const container = row.length ? row : a.parent();
    const dtEl = container.find('.gcevent-list-datetime, .card-text.date').first();
    const dt = text(dtEl.length ? dtEl.text() : container.find('.icon-calendar-day').first().parent().text());
    const dates = [...dt.matchAll(/(\d{2})\.(\d{2})\.(\d{4})/g)].map(x => `${x[3]}-${x[2]}-${x[1]}`);
    const times = [...dt.matchAll(/(\d{1,2})[:.](\d{2})\s*Uhr/g)].map(x => `${x[1].padStart(2, '0')}:${x[2]}`);
    const localDate = keyFromTitle ? keyFromTitle.slice(-16, -6) : slugDate;
    const keyTime = keyFromTitle?.slice(-5).replace('-', ':');
    const time = times[0] ?? (keyTime && keyTime !== '00:00' ? keyTime : undefined);
    const key = keyFromTitle ?? `event-${m[1]}-${m[2]}-${localDate}`;
    if (out.has(key)) return;
    const year = text(container.find('.gcevent-list-day-year').first().text()) || localDate.slice(0, 4);
    const range = /bis\s+(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)/.exec(text(container.find('.gcevent-list-day-month').first().text()));
    const lastFromDay = range && MONTHS[range[2].toLowerCase()] ? `${year}-${MONTHS[range[2].toLowerCase()]}-${range[1].padStart(2, '0')}` : undefined;
    const lastDate = lastFromDay ?? (dates.length > 1 ? dates[dates.length - 1] : undefined);
    const img = container.find('img').first().attr('src');
    const cat = text(container.find('.gcevent-list-categories, .text-muted').first().text()).split('|')[0].trim();
    // Die Liste hängt ihre Suchparameter an jeden Link (Halberstadt `?min_date=…&btp_event[…]=10`).
    const url = new URL(href.replace(/&amp;/g, '&'), pageUrl);
    url.search = '';
    out.set(key, {
      key,
      url: url.href,
      title,
      localDate,
      time,
      endTime: times[1],
      lastDate: lastDate && lastDate > localDate ? lastDate : undefined,
      category: cat || undefined,
      locationName: text(container.find('.gcevent-list-location-span').first().text()) || undefined,
      ...(img ? { image: new URL(img.trim(), pageUrl).href } : {}),
    });
  });
  return [...out.values()];
}

/** Weitere Seiten der Liste aus dem Pager (`a[data-offset]`, Parameter je Website verschieden). */
export function geocmsPagerUrls(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $('a[data-offset][href]').each((_, el) => {
    const off = Number($(el).attr('data-offset'));
    if (!Number.isFinite(off) || off <= 0) return;
    try {
      out.add(new URL($(el).attr('href')!.replace(/&amp;/g, '&'), pageUrl).href);
    } catch {
      // kein Link
    }
  });
  return [...out];
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
    locationName: detail?.locationName ?? row.locationName,
    street: detail?.street,
    postalCode: detail?.postalCode,
    locality: detail?.locality,
    image: detail?.image ?? row.image,
  };
}
