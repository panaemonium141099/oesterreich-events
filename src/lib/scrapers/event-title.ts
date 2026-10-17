/**
 * Titelwahl der Listen-Parser: Datum und Uhrzeit sind kein Titel.
 *
 * Listen-Kacheln tragen Datum, Wochentag und Uhrzeit oft in eigenen
 * Überschriften, Links oder Zellen ("09.10.2026", "Fr Okt 09",
 * "Sa, ab 19:30", "November 2026"). Die Parser nahmen das erste solche
 * Element als Titel; der Müll-Filter verwirft diese Titel, das Event
 * dahinter ging verloren (Prod 2026-10-09: 511 aktuell gelieferte Zeilen
 * aus acht Quellen).
 */
import type * as cheerio from 'cheerio';

/**
 * Wörter reiner Datums- und Uhrzeitangaben ('' steht für ein Token aus
 * Ziffern), dieselben wie im Müll-Filter des Dedup-Umbaus, dazu
 * "Ganztägig" an der Stelle der Uhrzeit ("11.10.2026, Ganztägig").
 */
const DATE_WORDS = new Set([
  '',
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
  'mo', 'di', 'mi', 'do', 'fr', 'sa', 'so',
  'januar', 'jaenner', 'jänner', 'jän', 'februar', 'feber', 'maerz', 'märz', 'april', 'mai',
  'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  'jan', 'feb', 'mär', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'okt', 'nov', 'dez',
  'uhr', 'h', 'ab', 'bis', 'von', 'um', 'am', 'und',
  'ganztägig', 'ganztaegig', 'ganztags',
]);

/**
 * Nur Datum, Wochentag oder Uhrzeit, oder gar kein Buchstabe ("08 30" aus
 * zwei Uhrzeit-Feldern). Ziffern innerhalb eines Worts zählen nicht als
 * Datum ("Ufo361" bleibt ein Name). Andere Nicht-Titel ("Kontakt",
 * "Weiterlesen") gehören nicht hierher: wer sie überspringt, landet beim
 * nächsten Text eines Blocks, der gar kein Event ist ("Öffnungszeiten" →
 * "Amtszeiten").
 */
export function isNamelessTitle(text: string | null | undefined): boolean {
  return (text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .every(t => DATE_WORDS.has(t.replace(/\d/g, '')));
}

/**
 * Für `firstText`: überspringt Elemente, die nur Datum oder Uhrzeit
 * tragen. Ein leeres Element bleibt ein Treffer wie bei `.first()` (die
 * Stufe liefert dann nichts), sonst griffe eine andere Parser-Strategie
 * als bisher.
 */
export const isTitleCandidate = (text: string): boolean => text === '' || !isNamelessTitle(text);

/**
 * Getrimmter Text des ersten Elements (Dokumentreihenfolge), den `accept`
 * annimmt. Mit `() => true` ist das `.first().text().trim()`, also die
 * Titelwahl vor 2026-10 (für previous_source_id). `read` liest den Text
 * eines Elements, z. B. `visibleText`.
 */
export function firstText(
  nodes: cheerio.Cheerio<any>,
  accept: (text: string) => boolean,
  read: (node: cheerio.Cheerio<any>) => string = node => node.text(),
): string {
  for (let i = 0; i < nodes.length; i++) {
    const text = read(nodes.eq(i)).trim();
    if (accept(text)) return text;
  }
  return '';
}

/**
 * Text nur für Screenreader: unsichtbar und nie Teil des Namens.
 * stadthalle.com setzt „Detailinfos zu " vor jeden Namen (Prod 2026-10-14:
 * alle 170 künftigen Zeilen), GEM2GO-Karten legen „mehr zu <Name>" in den
 * Bild-Link, der vor der Überschrift steht.
 */
const SCREEN_READER_ONLY = '.sr-only, .visually-hidden, .screen-reader-text';

/** Text einer Überschrift oder eines Links ohne Screenreader-Text. */
export function visibleText(node: cheerio.Cheerio<any>): string {
  if (!node.is(SCREEN_READER_ONLY) && node.find(SCREEN_READER_ONLY).length === 0) return node.text();
  const copy = node.not(SCREEN_READER_ONLY).clone();
  copy.find(SCREEN_READER_ONLY).remove();
  return copy.text();
}

/**
 * Elemente, mit denen eine Kachel ihren Namen ausdrücklich auszeichnet:
 * Schema.org-Name, EventON-Titel (neuberg-bgld.at), Titel-Klasse
 * (krumpendorf.gv.at: `div.title.h4`), GEM2GO-Kopf (`.bemHeader`),
 * GEM2GO-Tabellenspalte (`.va_list_bez`) und GEM2GO-Terminbox
 * (`.veranstaltungsBox_…_Titel`, niederleis.gv.at). Sie gehen Überschriften und
 * Links vor: in solchen Kacheln sind die Überschriften Beschriftungen
 * ("Veranstaltungsdetails", "Termin" auf neuberg-bgld.at) und die Links
 * Knöpfe ("mehr lesen", "Weitere Termine vorhanden").
 */
const EVENT_NAME = '[itemprop="name"], .evcal_event_title, .title, .bemHeader, .va_list_bez, .veranstaltungsBox_listView_Item_Titel, .veranstaltungsBox_Content_Titel';

/**
 * Namens-Elemente einer Kachel. Ein Schema.org-Name zählt nur für das
 * Event selbst, nicht für Ort oder Veranstalter darin (`itemprop="name"`
 * unter `itemtype="…/Place"`). `.title` vor einem `.value` ist die
 * Beschriftung eines Felds (schaerding.at: „Uhrzeit:", „Ort:").
 */
export function eventNameNodes($el: cheerio.Cheerio<any>): cheerio.Cheerio<any> {
  const nodes = $el.find(EVENT_NAME);
  return nodes.filter(i => {
    const node = nodes.eq(i);
    if (node.is('.title') && node.next('.value').length > 0) return false;
    if (!node.is('[itemprop="name"]') || node.is('.evcal_event_title')) return true;
    const scope = node.parent().closest('[itemscope]');
    return scope.length === 0 || /Event/i.test(scope.attr('itemtype') ?? '');
  });
}

/**
 * Name der Event-Kachel um einen Link, der nur Datum oder Uhrzeit trägt
 * (treibhaus.at: "SA 10.10. 19:30 UHR", kapu.or.at: "Di. 13.10.2026 - 21:00"):
 * der Schema.org-Name oder die erste Überschrift der Kachel.
 */
export function cardEventName($link: cheerio.Cheerio<any>): string {
  const $card = $link.closest('[itemtype*="Event"], article, .event, .event-item');
  return firstText($card.find('[itemprop="name"], h1, h2, h3, h4'), t => !isNamelessTitle(t))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mehrere benannte Überschriften: der Block ist eine Liste, keine Kachel.
 * Dort nimmt der Parser keine spätere Überschrift als Titel, sonst trüge
 * die Liste den Namen des ersten Events und Datum oder Uhrzeit eines
 * anderen.
 */
export function isEventList($el: cheerio.Cheerio<any>): boolean {
  const headings = $el.find('h1, h2, h3, h4, h5, h6');
  let named = 0;
  for (let i = 0; i < headings.length && named < 2; i++) {
    if (!isNamelessTitle(headings.eq(i).text())) named++;
  }
  return named >= 2;
}
