/**
 * recon CMS (regiogate GmbH), fn-29 Rest-Adapter. Die Kalenderseite listet
 * Termine als Karten `div.card--event` (Chamerau, Bad Kissingen: 22 bzw. 24
 * am 07.11.2026) mit `datebox` (Wochentag, Tag und Monat ohne Jahr,
 * Uhrzeit), Überschrift und Teaser; der Link `?ev[id]=<ID>` führt zur
 * Detailseite `catalog-details` mit derselben `datebox` und der Adresse
 * (`events-address-title`, `-str`, `-ort` mit PLZ). Rheine zeigt die Karten
 * mit vollem Datum (`event_time`: „08.11.2026, 11:00 Uhr bis 12:00 Uhr") und
 * Ort (`event_location`). Das Jahr fehlt in der Datebox: die Liste zeigt nur
 * kommende Termine, ein Tag vor heute liegt im nächsten Jahr. REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';

export interface RegiogateCard {
  id: string;
  url: string;
  title: string;
  /** Tag und Monat der Datebox („07.11.") oder volles Datum („08.11.2026"). */
  dateText: string;
  timeText: string;
  teaser?: string;
  locationText?: string;
  image?: string;
}

export interface RegiogateTermin {
  id: string;
  url: string;
  title: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  description?: string;
  image?: string;
}

const text = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function isRegiogatePage(html: string): boolean {
  return /cdn\.regiogate\.net|recon CMS|data-recon-lyb/.test(html);
}

/** Karten der Listenseite. */
export function parseRegiogateList(html: string, pageUrl: string): RegiogateCard[] {
  const $ = cheerio.load(html);
  const out = new Map<string, RegiogateCard>();
  $('.card--event').each((_, el) => {
    const card = $(el);
    const href = card.is('a') ? card.attr('href') : card.find('a[href*="ev%5Bid%5D="], a[href*="ev[id]="]').first().attr('href');
    if (!href) return;
    let url: URL;
    try {
      url = new URL(href.replace(/&amp;/g, '&'), pageUrl);
    } catch {
      return;
    }
    const id = url.searchParams.get('ev[id]');
    if (!id || out.has(id)) return;
    const title = text(card.find('h1, h2, h3, h4').first().clone().children('i').remove().end().text());
    if (!title) return;
    const dateText = text(card.find('.datebox__date').first().text()) || text(card.find('.event_time').first().text());
    const timeText = text(card.find('.datebox__time').first().text());
    const img = card.find('img').first().attr('src');
    out.set(id, {
      id,
      url: url.href,
      title,
      dateText,
      timeText,
      teaser: text(card.find('.card__teaser').first().text()) || undefined,
      locationText: text(card.find('.event_location').first().text()) || undefined,
      ...(img ? { image: new URL(img, pageUrl).href } : {}),
    });
  });
  return [...out.values()];
}

export interface RegiogateDetail {
  title?: string;
  dateText: string;
  timeText: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  description?: string;
  image?: string;
}

/** Detailseite `catalog-details`. */
export function parseRegiogateDetail(html: string, pageUrl: string): RegiogateDetail | null {
  const $ = cheerio.load(html);
  const box = $('.catalog-details');
  if (!box.length) return null;
  const ort = text(box.find('.events-address-ort').first().text());
  const plz = /^(\d{5})\s+(.*)$/.exec(ort);
  const img = box.find('img').first().attr('src');
  return {
    title: text(box.find('.catalog-details__title').first().text()) || undefined,
    dateText: text(box.find('.datebox__date').first().text()),
    timeText: text(box.find('.datebox__time').first().text()),
    locationName: text(box.find('.events-address-title').first().text()) || undefined,
    street: text(box.find('.events-address-str').first().text()) || undefined,
    postalCode: plz?.[1],
    locality: plz ? text(plz[2]) : ort || undefined,
    description: text(box.find('.catalog-details__text, .catalog-details__description, .catalog-details__content').first().text()) || undefined,
    ...(img ? { image: new URL(img, pageUrl).href } : {}),
  };
}

/**
 * Tag aus „07.11." (Jahr aus `today`: liegt der Tag vor heute, nächstes
 * Jahr) oder „08.11.2026, 11:00 Uhr bis 12:00 Uhr".
 */
export function regiogateDay(dateText: string, today: string): string | null {
  const full = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(dateText);
  if (full) return `${full[3]}-${full[2].padStart(2, '0')}-${full[1].padStart(2, '0')}`;
  const short = /(\d{1,2})\.(\d{1,2})\.?/.exec(dateText);
  if (!short) return null;
  const y = Number(today.slice(0, 4));
  const md = `${short[2].padStart(2, '0')}-${short[1].padStart(2, '0')}`;
  const day = `${y}-${md}`;
  return day >= today ? day : `${y + 1}-${md}`;
}

/**
 * Uhrzeiten aus „11:00 Uhr bis 12:00 Uhr", „19:30", „11.00 Uhr". Ein Tag
 * „13.11." ist keine Uhrzeit (Sinntal „St. Martinsumzug" stand mit 13:11,
 * Prüfstand 07.11.2026): Punkt nur mit „Uhr" dahinter.
 */
export function regiogateTimes(s: string): { start?: string; end?: string } {
  const m = [...s.matchAll(/(\d{1,2}):(\d{2})|(\d{1,2})\.(\d{2})\s*Uhr/g)].map(x => `${(x[1] ?? x[3]).padStart(2, '0')}:${x[2] ?? x[4]}`);
  return { start: m[0], end: m[1] };
}

export function toRegiogateTermin(card: RegiogateCard, detail: RegiogateDetail | null, today: string): RegiogateTermin | null {
  const dateText = detail?.dateText || card.dateText;
  const localDate = regiogateDay(dateText, today);
  if (!localDate) return null;
  const times = regiogateTimes([detail?.timeText, card.timeText, card.dateText].filter(Boolean).join(' '));
  const allDay = !times.start;
  const start = allDay ? localDate : (toUtcInstant(`${localDate}T${times.start}:00`) as string);
  const end = !allDay && times.end ? (toUtcInstant(`${localDate}T${times.end}:00`) as string) : undefined;
  // Rheine: „Veranstaltungsort: Stadthalle Rheine Humboldtplatz 10 48429 Rheine" auf der Karte.
  const loc = card.locationText?.replace(/^Veranstaltungsort:\s*/i, '');
  const plz = loc ? /(\d{5})\s+([^\d]+)$/.exec(loc) : null;
  return {
    id: card.id,
    url: card.url,
    title: detail?.title || card.title,
    localDate,
    start,
    end: end && end > start ? end : undefined,
    allDay,
    locationName: detail?.locationName ?? (loc ? text(loc.replace(/\d{5}\s+[^\d]+$/, '').split(/\s{2,}/)[0]) || undefined : card.teaser),
    street: detail?.street,
    postalCode: detail?.postalCode ?? plz?.[1],
    locality: detail?.locality ?? (plz ? text(plz[2]) : undefined),
    description: detail?.description,
    image: detail?.image ?? card.image,
  };
}
