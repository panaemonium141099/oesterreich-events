/**
 * Open2C (Bayern), Veranstaltungskalender des CMS, fn-29.15.
 *
 * Jeder Termin ist ein Block `.event_teaser_block` (davor
 * `.event_teaser_datebox`) mit Titel-Link `.teaser_title a`
 * (`<Kalender>.o<ID>.html?…&detailevent=<Termin-ID>`) und einer Tabelle aus
 * Zeilen „Termin:", „Kategorie:", „Ort:", „Beschreibung:". Die Terminzeile
 * trägt hCalendar-Zeiten mit Offset: `time.dtstart`/`time.dtend`
 * (`2026-11-10T19:30:00+01:00`); ganztägig steht nur das Datum im Text
 * („30.10.2026", „01.11.2026 – 30.11.2026"), die Zeit ist dann `T00:00`.
 * Folgeseiten: `.pag__item a` (`?page=N`). Der iCal-Export
 * (`export_ical.php`) ist teils per robots.txt gesperrt und wird nicht
 * genutzt. REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { visibleText } from '../event-title';

export interface Open2cTermin {
  /** Detailansicht `<Kalender>?detailevent=<ID>` (absolut, ohne Seitenzahl). */
  url: string;
  id: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  title: string;
  description?: string;
  locationName?: string;
  category?: string;
  image?: string;
}

export interface Open2cListPage {
  /** Kalendermodul gefunden (Suchformular oder Termine). */
  isList: boolean;
  termine: Open2cTermin[];
  /** Folgeseiten (absolut), in Reihenfolge. */
  pages: string[];
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/\s+/g, ' ').trim();
  return t || undefined;
};

/** `2026-11-10T19:30:00+01:00` → UTC-Instant; Datum allein bei ganztägig. */
function instant(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/.test(v)) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * Beginn und Ende aus der Terminzeile. Ganztägig, wenn der Text keine
 * Uhrzeit nennt; ein Ende ohne Uhrzeit („17:00 Uhr – 26.12.2026") ist der
 * Tag; ein Ende vor oder gleich dem Beginn bleibt offen.
 */
export function open2cWhen(text: string, dtstart?: string, dtend?: string): Pick<Open2cTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  const localDate = dtstart?.slice(0, 10);
  if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const [left, right] = text.split(/\s[–-]\s/, 2);
  const endDate = dtend?.slice(0, 10);
  const d2 = endDate && endDate > localDate ? endDate : undefined;
  const hasTime = (s: string | undefined) => /\d{1,2}:\d{2}\s*(?:bis\s+\d{1,2}:\d{2}\s*)?Uhr/.test(s ?? '');
  if (!hasTime(left)) return { localDate, start: localDate, ...(d2 ? { end: d2 } : {}), allDay: true };
  const start = instant(dtstart);
  if (!start) return null;
  // „von 19:00 bis 21:00 Uhr" steht links, „… – 06.11.2026 08:30 Uhr" rechts.
  const endHasTime = right != null ? hasTime(right) : /bis\s+\d{1,2}:\d{2}/.test(left);
  let end: string | undefined = endHasTime ? instant(dtend) ?? undefined : d2;
  if (end && end.length > 10 && end <= start) end = undefined;
  return { localDate, start, ...(end ? { end } : {}), allDay: false };
}

/** Eine Seite; `base` ist die abgerufene URL. */
export function parseOpen2cList(html: string, base: string): Open2cListPage {
  const $ = cheerio.load(html);
  const termine: Open2cTermin[] = [];
  $('.event_teaser_block').each((_, el) => {
    const block = $(el);
    const a = block.find('.teaser_title a[href]').first();
    const title = clean(visibleText(block.find('.teaser_title').first()));
    let link: URL;
    try {
      link = new URL((a.attr('href') ?? '').replace(/&amp;/g, '&'), base);
    } catch {
      return;
    }
    const id = link.searchParams.get('detailevent');
    if (!title || !id || !/^\d+$/.test(id)) return;
    const row = (label: string) => block.find('tr').filter((_, tr) => new RegExp(`^\\s*${label}:`).test($(tr).find('td').first().text())).first().find('td').last();
    const termin = row('Termin');
    const when = open2cWhen(clean(termin.text()) ?? '', termin.find('time.dtstart').attr('datetime'), termin.find('time.dtend').attr('datetime'));
    if (!when) return;
    const img = block.find('img').first().attr('src')?.trim();
    const description = clean(visibleText(row('Beschreibung')));
    const category = clean(row('Kategorie').text());
    const locationName = clean(visibleText(row('Ort')));
    termine.push({
      url: `${link.origin}${link.pathname}?detailevent=${id}`,
      id,
      ...when,
      title,
      ...(description ? { description } : {}),
      ...(locationName ? { locationName } : {}),
      ...(category ? { category } : {}),
      ...(img ? { image: new URL(img, base).href } : {}),
    });
  });
  const pages: string[] = [];
  $('.pag__item a[href]').each((_, a) => {
    const u = new URL($(a).attr('href')!.replace(/&amp;/g, '&'), base);
    u.hash = '';
    const page = u.searchParams.get('page');
    if (!page || page === '1') return;
    // Gleiche Seitenzahl nur einmal („2" und „weiter").
    const key = `${u.origin}${u.pathname}?page=${page}`;
    if (!pages.some(p => new URL(p).searchParams.get('page') === page)) pages.push(key);
  });
  const isList = termine.length > 0 || $('input[name="s_startdate"], .event_teaser_datebox').length > 0;
  return { isList, termine, pages };
}
