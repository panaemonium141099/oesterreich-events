/**
 * Kalenderkarten der TYPO3-Vorlage mit `.calendarize-item` (Gemeinde-
 * Websites mit den Erweiterungen calendarize bzw. sf_event_mgt): Überschrift
 * in `h4.card-title`, Terminzeile in `.calendar_wrap`
 * („31.10.2026 16:00 - 23:00", „03.09.2026 10:00 - 23.12.2026 13:00",
 * „13.10.2026 19:00 -", „10.10.2026 20:00 - Offenes Ende").
 *
 * Die Listen-Parser von gemeinden-generic und gemeinde-registry finden die
 * Karte und nehmen die Überschrift als Titel. Zwei Angaben der Karte gingen
 * dabei verloren (Prod-Befund 2026-10-11, oberpullendorf.gv.at):
 *  - das Ende aus der Terminzeile (end_date war bei allen Zeilen leer),
 *  - der Ort: Karten ohne eigenes Ortsfeld tragen ihn hinter einem Trenner
 *    in der Überschrift („Halloween im Garten | Hauptplatz 10").
 *
 * Der Trenner bedeutet anderswo anderes: Untertitel („Alfred Dorfer |
 * "GLEICH"", frantschach.gv.at), zweite Sprache (oslip.at), Datum vor dem
 * Titel (kapfenstein.at). Als Ort gilt er deshalb nur bei dieser Vorlage,
 * auf Karten ohne eigenes Ortsfeld und nur, wenn die Seite ihn durchgehend
 * setzt (`usesPlaceSuffix`): ein Untertitel steht bei einzelnen Events, ein
 * Ort bei fast allen.
 */
import type * as cheerio from 'cheerio';
import { isNamelessTitle } from './event-title';

const CARD = '.calendarize-item';
const HEADING = 'h4.card-title';
const TERM = '.calendar_wrap';
/** Eigenes Ortsfeld der Karte („Veranstaltungsort: KUGA", grosswarasdorf.at). */
const OWN_DETAILS = '.calendar_details';
const SEPARATOR = /\s+\|\s+/;
/** Anteil der Karten mit Trenner, ab dem er zur Vorlage der Seite gehört. */
const PLACE_SUFFIX_SHARE = 0.75;
const MIN_CARDS = 3;

export interface CalendarizeTerm {
  /** Beginn, YYYY-MM-DD */
  date: string;
  /** Beginn, HH:MM */
  time?: string;
  /** Ende, YYYY-MM-DDTHH:MM (nur mit Endzeit) */
  end?: string;
}

export interface CalendarizeCard {
  /** Überschrift wie auf der Seite (Grundlage der bisherigen source_id) */
  heading: string;
  /** Name des Events */
  title: string;
  /** Ort hinter dem Trenner */
  location?: string;
  /** Weitere Teile der Überschrift (Untertitel, Öffnungszeiten) */
  details?: string;
  start: { date: string; time?: string };
  end?: string;
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
const pad = (n: string) => n.padStart(2, '0');

/**
 * Terminzeile: Beginn als Datum mit optionaler Uhrzeit, nach „-" optional
 * Enddatum und Endzeit. Ein Ende gibt es nur mit Endzeit: ein Endtag ohne
 * Uhrzeit („28.11.2026 Offenes Ende") ergäbe ein erfundenes 00:00. Ohne
 * Enddatum liegt eine Endzeit vor dem Beginn nach Mitternacht; ein
 * ausdrückliches Ende vor dem Beginn ist ein Eingabefehler und entfällt.
 */
export function parseCalendarizeTerm(text: string): CalendarizeTerm | null {
  const m = clean(text).match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?(?:\s*-\s*(?:(\d{1,2})\.(\d{1,2})\.(\d{4}))?\s*(?:(\d{1,2}):(\d{2}))?)?/,
  );
  if (!m) return null;
  const date = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  const time = m[4] ? `${pad(m[4])}:${m[5]}` : undefined;
  const term: CalendarizeTerm = time ? { date, time } : { date };
  if (!time || !m[9]) return term;

  const endTime = `${pad(m[9])}:${m[10]}`;
  let endDate = m[8] ? `${m[8]}-${pad(m[7])}-${pad(m[6])}` : date;
  if (!m[8] && endTime < time) {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    endDate = next.toISOString().slice(0, 10);
  }
  const end = `${endDate}T${endTime}`;
  if (end > `${date}T${time}`) term.end = end;
  return term;
}

/** Kalenderkarten der Seite mit Überschrift und Terminzeile. */
function cards($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  return $(CARD).filter((_, el) => $(el).find(HEADING).length === 1 && $(el).find(TERM).length === 1);
}

/**
 * Die Seite setzt den Ort hinter den Trenner: mindestens drei Karten ohne
 * eigenes Ortsfeld, davon mindestens drei Viertel mit Trenner. Ein
 * einzelnes Event ohne Ortsangabe schaltet die Regel nicht ab.
 */
export function usesPlaceSuffix($: cheerio.CheerioAPI): boolean {
  const list = cards($);
  if (list.length < MIN_CARDS || list.find(OWN_DETAILS).length > 0) return false;
  let piped = 0;
  list.each((_, el) => {
    if (SEPARATOR.test(clean($(el).find(HEADING).text()))) piped++;
  });
  return piped / list.length >= PLACE_SUFFIX_SHARE;
}

/**
 * Teilt „Titel | Ort" bzw. „Titel | … | Ort": der erste Teil ist der Name,
 * der Ort ist der letzte Teil, der nicht nur Tage und Uhrzeiten nennt
 * („14er Haus | Do+Sa 10-13h"), die übrigen Teile sind Beschreibung. Ist
 * der erste Teil nur ein Datum, bleibt die Überschrift ganz.
 */
function splitPlace(heading: string): Pick<CalendarizeCard, 'title' | 'location' | 'details'> {
  const parts = heading.split(SEPARATOR);
  if (parts.length < 2 || isNamelessTitle(parts[0])) return { title: heading };
  const rest = parts.slice(1);
  let at = -1;
  for (let i = rest.length - 1; i >= 0 && at < 0; i--) if (!isNamelessTitle(rest[i])) at = i;
  if (at < 0) return { title: heading };
  const details = rest.filter((_, i) => i !== at).join(' | ');
  return { title: parts[0], location: rest[at], ...(details ? { details } : {}) };
}

/**
 * Die Kalenderkarte im Block, den ein Listen-Parser als Event gewählt hat
 * (der Block ist die Karte oder liegt in ihr). `placeSuffix` aus
 * `usesPlaceSuffix` für die ganze Seite.
 */
export function readCalendarizeCard($block: cheerio.Cheerio<any>, placeSuffix: boolean): CalendarizeCard | null {
  let $card = $block.is(CARD) ? $block : $block.find(CARD);
  if ($card.length === 0) $card = $block.closest(CARD);
  if ($card.length !== 1) return null;
  const $heading = $card.find(HEADING);
  const $term = $card.find(TERM);
  if ($heading.length !== 1 || $term.length !== 1) return null;

  const term = parseCalendarizeTerm($term.text());
  const heading = clean($heading.text());
  if (!term || !heading) return null;

  const own = $card.find(OWN_DETAILS).length > 0;
  const name = placeSuffix && !own ? splitPlace(heading) : { title: heading };
  return {
    heading,
    ...name,
    start: term.time ? { date: term.date, time: term.time } : { date: term.date },
    ...(term.end ? { end: term.end } : {}),
  };
}
