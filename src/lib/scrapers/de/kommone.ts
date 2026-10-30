/**
 * Komm.ONE Online-Suite, Veranstaltungsmodul der „dvv-Zusatzmodule"
 * (fn-29.10).
 *
 * Die Terminliste `<Kalenderseite>` bzw. `/site/<Mandant>/node/<nodeID>/pageN/pageN`
 * trägt je Termin ein hCalendar-`article.vevent` mit Datum
 * (`span.dtstart title="JJJJ-MM-TT"`, `span.dtend`), Uhrzeit
 * (`span.dtTimeInfo`, leer bei ganztägigen Terminen), Titel
 * (`h3.titelzmtitel`), Veranstaltungsort (`section.zmOrt` mit vCard:
 * `organization`, `street-address`, `postal-code`, `locality`),
 * Veranstalter (`section.zmVeranstalter`), Kategorie (`a.zmkatLink`), Bild
 * (`figure.bild a[href]`) und Detailseite (`…/zmdetail_<ID>/…`). Das RSS
 * `/site/<Mandant>/zmrss/<nodeID>/rss.xml` trägt dasselbe Markup, ist aber
 * auf 5 bis 50 Einträge gekürzt (Waldenbuch 15, Liste 20 je Seite); sein
 * Kanal-Link ist die Terminliste. REIN, kein I/O.
 */
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { visibleText } from '../event-title';

export interface KommOneTermin {
  /** `zmdetail_<ID>` der Detailseite. */
  id: string;
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
}

export interface KommOnePage {
  termine: KommOneTermin[];
  /** „Weiter" im Pager (ohne Sitzungs-ID), sonst null. */
  next: string | null;
  /** RSS-Link der Seite (`zmrss`), sonst null. */
  rss: string | null;
}

const clean = (s: string | undefined) => {
  const t = s?.replace(/[\s ]+/g, ' ').trim();
  return t || undefined;
};

const ISO_DAY = /^(\d{4}-\d{2}-\d{2})$/;
const TIME = /(\d{1,2})[:.](\d{2})/g;

const berlin = (date: string, hh: string, mm: string) => toUtcInstant(`${date}T${hh.padStart(2, '0')}:${mm}:00`) as string;

/**
 * Uhrzeiten als [Stunde, Minute]: „19:00", „19.00 Uhr", „19:00 - 22:00";
 * ohne Minuten nur mit „Uhr" („20-22 Uhr", Aichwald; „ab 19 Uhr").
 */
function timesOf(text: string): [string, string, string][] {
  const hm = [...text.matchAll(TIME)].filter(m => +m[1] <= 23 && +m[2] <= 59).map(m => [m[0], m[1], m[2]] as [string, string, string]);
  if (hm.length) return hm;
  const h = /(?<![\d.])(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*Uhr/i.exec(text);
  if (!h || +h[1] > 23 || (h[2] && +h[2] > 24)) return [];
  return [[h[1], h[1], '00'], ...(h[2] && +h[2] <= 23 ? [[h[2], h[2], '00'] as [string, string, string]] : [])];
}

/**
 * Beginn und Ende: Tage aus `title` von `dtstart`/`dtend`, Uhrzeit aus
 * `dtTimeInfo` („19:00", „19:00 - 22:00"). Ohne Uhrzeit ganztägig; ein Ende
 * vor dem Beginn ohne eigenes Enddatum bleibt offen.
 */
export function kommOneWhen(startDay: string, endDay: string | undefined, timeText: string | undefined): Pick<KommOneTermin, 'localDate' | 'start' | 'end' | 'allDay'> | null {
  if (!ISO_DAY.test(startDay)) return null;
  const d2 = endDay && ISO_DAY.test(endDay) && endDay > startDay ? endDay : undefined;
  const times = timesOf(timeText ?? '');
  if (!times.length) return { localDate: startDay, start: startDay, ...(d2 ? { end: d2 } : {}), allDay: true };
  const start = berlin(startDay, times[0][1], times[0][2]);
  let end: string | undefined = times[1] ? berlin(d2 ?? startDay, times[1][1], times[1][2]) : d2;
  if (end && end.length > 10 && end <= start) end = undefined;
  return { localDate: startDay, start, ...(end ? { end } : {}), allDay: false };
}

/** Text ohne Beschriftung (`<label>Veranstaltungsort</label> Musikhalle`, Ludwigsburg). */
function textWithoutLabel(node: cheerio.Cheerio<any>): string | undefined {
  const c = node.clone();
  c.find('label, .label').remove();
  return clean(visibleText(c));
}

function vcard($: cheerio.CheerioAPI, section: cheerio.Cheerio<any>) {
  const card = section.find('.vCard').not('a').first();
  const scope = card.length ? card : section;
  const text = (sel: string) => clean(visibleText(scope.find(sel).first()));
  const plz = text('.postal-code');
  return {
    name: text('.organization'),
    street: text('.street-address'),
    // Datenfehler der Quelle: „7111" statt 71111 (Waldenbuch) ist keine PLZ.
    postalCode: plz && /^\d{5}$/.test(plz) ? plz : undefined,
    locality: text('.locality'),
  };
}

function parseItem($: cheerio.CheerioAPI, el: any, base: string): KommOneTermin | null {
  const art = $(el);
  const detail = art.find('a[href*="zmdetail_"]').first().attr('href') ?? art.closest('item').find('link').first().text();
  const id = /zmdetail_(\d+)/.exec(detail ?? '')?.[1];
  if (!id) return null;
  const when = itemWhen(art);
  if (!when) return null;
  // Liste: `h3.titelzmtitel` bzw. `.titel` (neuere Vorlage); RSS: Text in
  // `header.summary` nach Datum und Uhrzeit.
  let title = clean(visibleText(art.find('.titelzmtitel').first())) ?? clean(visibleText(art.find('.zmitem__header .titel, a.titel, span.titel').first()));
  if (!title) {
    const h = art.find('header.summary').first().clone();
    h.find('.dtstart, .dtend, .uhr').remove();
    title = clean(visibleText(h))?.replace(/^[|\s-]+/, '');
  }
  if (!title) return null;
  // Ort: vCard in `.zmOrt` (Waldenbuch), Freitext in `.zmOrt .data`
  // (Bötzingen „Gasthaus "Zur Krone", Gottenheimer Straße 1") oder `.location`
  // (Besigheim „Steinhauskeller").
  const ort = art.find('.zmOrt').first();
  const place = ort.find('.vCard .organization, .vCard .locality').length
    ? vcard($, ort)
    : { name: textWithoutLabel(ort.find('.data').first()) ?? textWithoutLabel(art.find('.location').first()), street: undefined, postalCode: undefined, locality: undefined };
  const ver = art.find('.zmVeranstalter .data').first();
  const verOrg = ver.find('.organization').first().clone();
  verOrg.find('.fachbreich').remove();
  const organizer = (ver.find('.organization').length ? clean(visibleText(verOrg)) : clean(visibleText(ver.clone().children().remove().end())))
    ?? clean(visibleText(art.find('.person').first()));
  const cats = art.find('a.zmkatLink, .zmitem__kategorie, .zmitem__kat li').map((_, a) => clean($(a).text())).get().filter(Boolean);
  const img = art.find('figure.bild a[href]').first().attr('href') ?? art.find('.zmitem__image img[src], .zmitem__bild img[src]').first().attr('src');
  return {
    id,
    url: new URL(detail!.trim(), base).href,
    ...when,
    title,
    ...(cats.length ? { category: [...new Set(cats)].join(', ') } : {}),
    ...(organizer ? { organizer } : {}),
    ...(place.name ? { locationName: place.name } : {}),
    ...(place.street ? { street: place.street } : {}),
    ...(place.postalCode ? { postalCode: place.postalCode } : {}),
    ...(place.locality ? { locality: place.locality } : {}),
    ...(img ? { image: new URL(img, base).href } : {}),
  };
}

const DATE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/g;

/**
 * Datum: `span.dtstart`/`span.dtend` mit `title="JJJJ-MM-TT"`; die neuere
 * Vorlage schreibt nur Text („Freitag, 30.10.2026 bis Sonntag, 01.11.2026",
 * `.zmitem__time`). Uhrzeit aus `.dtTimeInfo` („10:00 Uhr", „19.00 Uhr").
 */
function itemWhen(art: cheerio.Cheerio<any>): ReturnType<typeof kommOneWhen> {
  const timeText = clean(art.find('.dtTimeInfo, .uhr').first().text());
  const startDay = art.find('.dtstart').first().attr('title');
  if (startDay) return kommOneWhen(startDay, art.find('.dtend').first().attr('title'), timeText);
  const t = art.find('.zmitem__time').first().clone();
  t.find('.dtTimeInfo').remove();
  const days = [...(clean(t.text()) ?? '').matchAll(DATE)].map(m => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  return days.length ? kommOneWhen(days[0], days[1], timeText) : null;
}

/** Pager-Link ohne Sitzungs-ID (`?zm.sid=…` wechselt je Abruf). */
function withoutSid(href: string, base: string): string {
  const u = new URL(href, base);
  u.searchParams.delete('zm.sid');
  u.hash = '';
  return u.href;
}

/** Eine Seite der Terminliste; `base` ist die abgerufene URL. */
export function parseKommOneList(html: string, base: string): KommOnePage {
  const $ = cheerio.load(html);
  const termine: KommOneTermin[] = [];
  // Ältere Vorlage `article.vevent`, neuere `div.zmitem`; verschachtelt zählt der äußere.
  $('article.vevent, .zmitem').filter((_, el) => $(el).parents('article.vevent, .zmitem').length === 0).each((_, el) => {
    const t = parseItem($, el, base);
    if (t) termine.push(t);
  });
  const fwd = $('.zmNavigClassForward a[href]').first().attr('href');
  const rss = $('link[type="application/rss+xml"][href*="/zmrss/"], a[href*="/zmrss/"]').first().attr('href');
  return {
    termine,
    next: fwd ? withoutSid(fwd, base) : null,
    rss: rss ? new URL(rss, base).href : null,
  };
}

/** RSS der dvv-Zusatzmodule: Kanal-Link (Terminliste) und die Termine aus `content:encoded`. */
export function parseKommOneRss(xml: string, base: string): { listUrl: string | null; termine: KommOneTermin[] } | null {
  if (!/<generator>\s*dvv-Zusatzmodule/i.test(xml)) return null;
  const $x = cheerio.load(xml, { xmlMode: true });
  const termine: KommOneTermin[] = [];
  $x('item').each((_, item) => {
    const link = $x(item).find('link').first().text().trim();
    const body = $x(item).find('content\\:encoded').first().text() || $x(item).find('description').first().text();
    const $ = cheerio.load(`<div>${body}</div>`);
    const art = $('article.vevent').first();
    if (!art.length) return;
    if (link && !art.find('a[href*="zmdetail_"]').length) art.append(`<a href="${link.replace(/"/g, '&quot;')}"></a>`);
    const t = parseItem($, art[0], base);
    if (t) termine.push(t);
  });
  return { listUrl: clean($x('channel > link').first().text()) ?? null, termine };
}
