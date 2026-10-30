/**
 * Allgemeiner Parser der Stufen D und E (fn-29.16): Kalenderseiten ohne
 * erkannten Hersteller. Reihenfolge wie `GemeindeRegistryScraper` in
 * Österreich: Schema.org-Events (JSON-LD, dann Mikrodaten), sonst die Liste
 * mit Datum. Titel nach `event-title.ts` (Datum oder Uhrzeit ist nie ein
 * Titel, ausgezeichnete Namen vor Überschriften, kein Screenreader-Text),
 * keine Wortlisten. REIN, kein I/O.
 *
 * Liste: Ein Termin ist eine Kachel, Zeile oder ein Listeneintrag, der sich
 * neben Geschwistern gleicher Art wiederholt, die ebenfalls ein Datum tragen
 * (wie gleichartige Kacheln der AT-Parser). Die Kachel nennt genau ein Datum
 * oder eine Spanne; trägt sie mehrere, ist sie die Liste, kein Termin. Ohne
 * benanntes Element (Name, Überschrift, Titel, Link, Fettdruck, Zelle) gibt
 * es keinen Termin: Fließtext ist kein Titel.
 */
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { toUtcInstant } from '@/lib/pipeline/normalize-date';
import { isGarbageTitle } from '@/lib/pipeline/garbage-filter';
import { isUsableDetailHref } from '../gemeinde-event-discovery';
import { GENERIC_LINK_TEXT } from '../GenericGemeindeScraper';
import { eventNameNodes, isEventList, isNamelessTitle, visibleText } from '../event-title';
import { extractTimeOfDay } from '../time-of-day';
import { dateKey, findDateExprs, withoutDates, yearlessDates, type DateExpr } from './datum';
import { toLdEvent, type LdEvent } from './jsonld';

export type Strategie = 'jsonld' | 'mikrodaten' | 'liste';

export interface AllgemeinTermin {
  /** Grundlage der source_id (Detailseite oder Liste + Titel), mit Termintag. */
  key: string;
  title: string;
  /** Detailseite des Termins, sonst die Kalenderseite. */
  url: string;
  localDate: string;
  start: string;
  end?: string;
  allDay: boolean;
  image?: string;
  locationName?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  lat?: number;
  lng?: number;
  /** Sichtbarer Text der Kachel (Liste): nennt er eine andere Gemeinde,
   *  ist der Kalender nicht der Ort des Termins (AllgemeinDeScraper). */
  placeText?: string;
  strategie: Strategie;
}

const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'ol', 'p', 'section', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul']);

/** Nie Inhalt einer Terminliste: Menü, Kopf, Fuß, Formulare, Skripte. */
const NOISE = 'script, style, noscript, template, svg, iframe, select, option, nav, form, [role="navigation"], [hidden], .sr-only, .visually-hidden, .screen-reader-text';

/**
 * Kopf und Fuß der Seite, nicht der eines Beitrags: WordPress-Themes legen
 * den Namen eines Termins in `article > header` (Schlöben 2026-10-29).
 */
const PAGE_CHROME = 'header, footer';

/**
 * Veröffentlichungsdatum eines Beitrags (Schema.org `datePublished`,
 * WordPress `time.entry-date`, `.posted-on`) ist kein Termin: auf
 * Beitragslisten („category/veranstaltungen") stünde sonst der Tag des
 * Beitrags statt des Fests.
 */
const PUBLISHED = '[itemprop="datePublished"], [itemprop="dateModified"], time.entry-date, .posted-on, .entry-date';

const FILE_LINK = /\.(pdf|docx?|xlsx?|pptx?|odt|zip|jpe?g|png|gif|webp|ics|vcs|mp3|mp4)(?:[?#]|$)/i;

/* ── Text mit Grenzen ─────────────────────────────────────────────── */

type Node = { type: string; data?: string; tagName?: string; children?: Node[]; parent?: Node | null; attribs?: Record<string, string> };

/** Text eines Elements, Blockgrenzen als Leerzeichen („12.11.2026" in einer
 *  Zelle, „Kegeln" in der nächsten bleiben getrennt). */
function textMap(root: Node): Map<Node, string> {
  const map = new Map<Node, string>();
  const walk = (n: Node): string => {
    if (n.type === 'text') return n.data ?? '';
    if (n.type !== 'tag' && n.type !== 'root') return '';
    let s = '';
    for (const c of n.children ?? []) {
      const t = walk(c);
      s += c.type === 'tag' && BLOCK.has(c.tagName!) ? ` ${t} ` : t;
    }
    if (n.type === 'tag' && n.tagName === 'br') s = ' ';
    map.set(n, s);
    return s;
  };
  walk(root);
  return map;
}

// Weiches Trennzeichen und Nullbreite gehören nicht in den Namen („Stadt­füh­rung").
const squash = (s: string) => s.replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Text eines Namens-Elements ohne eingebettete Felder: „Stammdösch Vertäll
 * <span>Kategorie: Brauchtum</span>" im Link (Tönisvorst 2026-10-29).
 * Bleibt danach nichts, war das Feld der Name („<span>Lesung: <em>Krimi</em></span>").
 */
/** Steht vor `part` im Element schon ein Name? */
function nameBefore(node: cheerio.Cheerio<any>, part: string): boolean {
  const all = squash(node.text());
  const i = all.indexOf(part);
  return i > 0 && !isNamelessTitle(all.slice(0, i));
}

function nameText(node: cheerio.Cheerio<any>): string {
  const copy = node.clone();
  const whole = squash(copy.text());
  const all = copy.find('*');
  for (let i = 0; i < all.length; i++) {
    const el = all.eq(i);
    // Ein Element mit dem ganzen Text (der Link um Name und Feld) ist kein Feld.
    if (squash(el.text()) === whole) continue;
    // Rubrik im Namens-Element („<strong>Adams Äpfel …</strong>
    // <span class=a5-event-box-category>Schauspiel</span>", Nettetal).
    if (el.is('[class*="categor" i], [class*="kategorie" i], [class*="rubrik" i]')) {
      el.remove();
      continue;
    }
    // Feld hinter dem Namen im selben Element („<span>Herbstmarkt</span>
    // <p>Veranstaltungsort: …</p>", Sulzbach): fällt weg. Steht die
    // Beschriftung vorn („<span>Lesung:</span> Krimi"), gehört sie zum Namen.
    const own = squash(el.text());
    if (LABEL.test(own) && (el.children().length > 0 || nameBefore(copy, own))) {
      el.remove();
      continue;
    }
    // Datum oder Uhrzeit in eigenem Element grenzt an den Namen ohne
    // Leerzeichen („<strong>… 15:00 Uhr</strong>Weinfahrt", Ornbau).
    if (el.children().length === 0 && (findDateExprs(el.text()).length > 0 || /\d{1,2}[:.]\d{2}|Uhr/.test(el.text()))) {
      el.before(' ');
      el.after(' ');
    }
  }
  const rest = visibleText(copy);
  return squash(rest) ? rest : visibleText(node);
}

/* ── Titel ────────────────────────────────────────────────────────── */

/** „Ort:", „Uhrzeit: 19:00" — Beschriftung eines Felds, kein Name. */
const LABEL = /^[\p{L} ]{2,30}:(\s|$)/u;

/**
 * Datum, Wochentag und Uhrzeit am Anfang oder Ende eines Titels gehören
 * nicht zum Namen („07. November 2026 - 15:00 Uhr Weinfahrt" in einer
 * Überschrift, Ornbau 2026-10-29).
 */
const EDGE_TOKEN = new RegExp(
  String.raw`^(?:\s|[,;|/·•:–—-]|\(|\)|(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\.?(?![\p{L}])|ab(?![\p{L}])|ca\.?(?![\p{L}])|um(?![\p{L}])|bis(?![\p{L}])|am(?![\p{L}])|vom(?![\p{L}])|Uhr(?![\p{L}])|\d{1,2}[:.]\d{2}|\d{1,2}(?=\s*Uhr))+`,
  'iu',
);

/** Nur Beschriftung vor dem Datum („Meldung vom:", „Datum"). */
const LABEL_PREFIX = /^[\p{L} ]{0,30}:\s*$/u;

function stripEdges(title: string): string {
  let t = title;
  for (let i = 0; i < 4; i++) {
    const before = t;
    const first = findDateExprs(t)[0];
    if (first) {
      const prefix = t.slice(0, first.index).replace(EDGE_TOKEN, '');
      if (prefix === '' || LABEL_PREFIX.test(prefix)) t = t.slice(first.index + first.length);
    }
    t = t.replace(EDGE_TOKEN, '');
    const last = findDateExprs(t).at(-1);
    if (last && t.slice(last.index + last.length).replace(EDGE_TOKEN, '').trim() === '') {
      // Wochentag nur als Teil der Datumsangabe („Freitag, 13. November",
      // „Sa. 14.11."), nicht als Wort des Namens („Martinimarkt mit
      // verkaufsoffenem Sonntag 08.11.2026", Wemding).
      t = t.slice(0, last.index).replace(/(?:\s|[,;|/·•:–—(-]|(?<![\p{L}])(?:am|vom|ab|bis)(?![\p{L}])|(?<![\p{L}])(?:Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)[.,](?=\s*$))+$/iu, '');
    }
    t = t.trim();
    if (t === before) break;
  }
  return squash(t);
}

/** Eine Adresse ist kein Name („www.adventskalender.hanau.de", Hanau 2026-10-29). */
const WEB_ADDRESS = /^(?:https?:\/\/\S+|(?:www\.)?[\w-]+(?:\.[\w-]+)+\/?\S*)$/i;

interface TitleRules {
  /** „Lesung: Krimi" ist ein Name (Überschrift), kein Feld. */
  labelsOk: boolean;
  /** Ein Datum im Text: das Element ist die ganze Kachel, nicht ihr Name. */
  datesOk: boolean;
}

function acceptTitle(raw: string, rules: TitleRules): string {
  const t = stripEdges(squash(raw));
  if (t.length < 3 || t.length > 200) return '';
  if (isNamelessTitle(t)) return '';
  // Bruchstück eines Datums („.2026, 18:00 bis ca. 22:00 Uhr", Sebnitz).
  if (/^[.,]\s*\d/.test(t)) return '';
  if (!rules.labelsOk && LABEL.test(t)) return '';
  if (/:$/.test(t)) return '';
  if (GENERIC_LINK_TEXT.test(t.replace(/^[»›>→\s]+|[»›>→…\s]+$/g, '')) || WEB_ADDRESS.test(t)) return '';
  // Adresse statt Name: Mail oder Cloudflares Platzhalter dafür (Dautphetal).
  if (/^\S+@\S+$|\[email(?:&#160;|\s)protected\]/i.test(t)) return '';
  // Derselbe Müll-Filter wie im Sync (garbage-filter.ts): „› weiterlesen",
  // „Einlass 18:00 Uhr Beginn 19:00 Uhr" sind dort Müll, hier dann kein Name.
  if (isGarbageTitle(t)) return '';
  if (!rules.datesOk && findDateExprs(t).length > 0) return '';
  // Zelle, Link oder Fettdruck mit mehreren Sätzen ist Beschreibung, kein
  // Name („Wir basteln … Herbstlaub. Bitte anmelden unter Tel. …",
  // Flechtingen, Prüfstand 2026-10-29).
  if (!rules.labelsOk && (t.length > 120 || /[.!?]\s+\p{Lu}/u.test(t))) return '';
  return t;
}

type $El = cheerio.Cheerio<any>;

function firstAccepted(nodes: $El, rules: TitleRules): { title: string; node: $El } | null {
  for (let i = 0; i < nodes.length; i++) {
    const t = acceptTitle(nameText(nodes.eq(i)), rules);
    if (t) return { title: t, node: nodes.eq(i) };
  }
  return null;
}

const NAMED: TitleRules = { labelsOk: true, datesOk: true };
const FIELD: TitleRules = { labelsOk: false, datesOk: false };

/**
 * Spaltenköpfe, die die Namensspalte einer Terminliste beschriften
 * („Datum | Verein | Veranstaltung | Ort", Contwig 2026-10-29). Positive
 * Feldbeschriftung, keine Liste verbotener Titel.
 */
const TITLE_COLUMN = /^(?:veranstaltung(?:en)?|veranstaltungstitel|titel|bezeichnung|was|anlass|event)\s*:?$/i;

/**
 * Name aus einer Tabellenzeile: die Spalte, die der Kopf als Veranstaltung
 * beschriftet, sonst die einzige Zelle mit Text neben Datum und Uhrzeit.
 * Mehrere Textzellen ohne Kopf: welche der Name ist (Verein, Ort,
 * Veranstaltung), sagt die Zeile nicht, also keiner.
 */
function rowTitle($: cheerio.CheerioAPI, $r: $El): { title: string; node: $El } | null {
  // Zelle mit Überschrift: deren Name; mehrere benannte Überschriften sind
  // mehrere Termine in einer Zelle (Beckingen, zerbrochene Tabelle mit
  // „Neujahrsempfang 2019" neben „Adventssingen", Prüfstand 2026-10-29).
  const cellTitle = (cell: $El): string => {
    if (isEventList(cell)) return '';
    const h = firstAccepted(cell.find('h1, h2, h3, h4, h5, h6'), NAMED);
    return h ? h.title : acceptTitle(nameText(cell), FIELD);
  };
  const cells = $r.children('td, th');
  const table = $r.closest('table');
  // Kopfzeile: thead, sonst die erste Zeile ohne Datum mit gleich vielen
  // Zellen (über ihr steht bei Contwig „Ortskartell Contwig 2026" quer).
  const sameWidth = (tr: any) => $(tr).children('td, th').length === cells.length;
  const headRow = table.find('thead tr').filter((_, tr) => sameWidth(tr)).first().length
    ? table.find('thead tr').filter((_, tr) => sameWidth(tr)).first()
    : table.find('tr').filter((_, tr) => sameWidth(tr) && findDateExprs($(tr).text()).length === 0).first();
  if (headRow.length && headRow[0] !== $r[0]) {
    const heads = headRow.children('td, th');
    if (heads.length === cells.length) {
      for (let i = 0; i < heads.length; i++) {
        if (!TITLE_COLUMN.test(squash(heads.eq(i).text()))) continue;
        const t = cellTitle(cells.eq(i));
        return t ? { title: t, node: cells.eq(i) } : null;
      }
    }
  }
  const named: { title: string; node: $El }[] = [];
  cells.each((i, c) => {
    if (findDateExprs($(c).text()).length > 0) return;
    const t = cellTitle(cells.eq(i));
    if (t) named.push({ title: t, node: cells.eq(i) });
  });
  return named.length === 1 ? named[0] : null;
}

/**
 * Name einer Kachel: ausgezeichneter Name, Überschrift, Titel-Element, in
 * Tabellenzeilen die Namensspalte, sonst Link-Text, zuletzt der erste
 * Fettdruck. Überschrift und Name dürfen „Lesung: Krimi" heißen und ein
 * Datum tragen („Weinfrühling 28.-30.05.2027"), Link, Zelle und Fettdruck
 * nicht (dort ist „Ort: Bürgerhaus" ein Feld und ein Datum die Kachel).
 */
/** Teile einer Kachel, die Ort oder Veranstalter beschreiben. */
const PLACE_PART = '[class*="location" i], [class*="venue" i], [class*="organi" i], [class*="veranstalter" i], [class*="address" i], [itemprop="location"], [itemprop="organizer"]';

function recordTitle($: cheerio.CheerioAPI, $r: $El, pageUrl: string, buttons: ReadonlySet<string> = new Set()): { title: string; node: $El } | null {
  // Ein Name im Ort oder Veranstalter ist nicht der des Termins (Baiern:
  // `.location .title` = „Netterndorf" neben „Osterschießen").
  // Mehrere benannte Überschriften: die Kachel ist eine Liste (event-title.ts).
  if (isEventList($r)) return null;
  const notPlace = (_: number, n: any) => !$(n).is(PLACE_PART) && $(n).parentsUntil($r).filter(PLACE_PART).length === 0;
  const own = eventNameNodes($r).filter(notPlace);
  const named = firstAccepted(own, NAMED) ?? firstAccepted($r.find('h1, h2, h3, h4, h5, h6'), NAMED);
  if (named) return named;
  const titleEls = $r.find('[class*="title" i], [class*="titel" i]').filter((_, n) => $(n).find('[class*="title" i], [class*="titel" i]').length === 0).filter(notPlace);
  const fromClass = firstAccepted(titleEls, { labelsOk: true, datesOk: false });
  if (fromClass) return fromClass;
  if ($r.is('tr')) return rowTitle($, $r);
  // Nur Links auf eine Seite derselben Website benennen den Termin; ein
  // Ticket-Link („Tickets kaufen", Woldegk) führt zum Shop.
  const links = $r.find('a[href]').filter((_, a) => resolveDetail($(a).attr('href'), pageUrl) != null && !buttons.has(squash(visibleText($(a)))));
  const fromLink = firstAccepted(links, FIELD);
  if (fromLink) return fromLink;
  const bold = $r.find('strong, b').filter((_, n) => findDateExprs($(n).text()).length === 0);
  return firstAccepted(bold.first(), FIELD);
}

/* ── Link und Bild ────────────────────────────────────────────────── */

function detailHref(href: string | undefined): string | null {
  if (!isUsableDetailHref(href) || FILE_LINK.test(href)) return null;
  return href;
}

function resolveDetail(href: string | undefined, pageUrl: string): string | null {
  const h = detailHref(href);
  if (!h) return null;
  try {
    const u = new URL(h, pageUrl);
    const page = new URL(pageUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    // Nur auf der eigenen Website; ein Link anderswohin ist Ticket oder Veranstalter.
    if (u.hostname.replace(/^www\./, '') !== page.hostname.replace(/^www\./, '')) return null;
    u.hash = '';
    const p = new URL(pageUrl);
    p.hash = '';
    return u.href === p.href ? null : u.href;
  } catch {
    return null;
  }
}

/**
 * Detailseite des Termins: der Link am Namen, die verlinkte Kachel, sonst
 * ein Knopf („mehr", „Details") oder ein Bild-Link in der Kachel. Andere
 * Links der Kachel führen zu Verein, Monatsansicht oder Karte
 * (Hainewalde `?zr=202611`, 2026-10-29), nicht zum Termin.
 */
function recordLink($: cheerio.CheerioAPI, $r: $El, title: { title: string; node: $El }, pageUrl: string): string | null {
  const titleNode = title.node;
  const own = titleNode.is('a') ? titleNode : titleNode.find('a[href]').first().length ? titleNode.find('a[href]').first() : titleNode.closest('a');
  const fromTitle = own.length ? resolveDetail(own.attr('href'), pageUrl) : null;
  if (fromTitle) return fromTitle;
  const wrapper = $r.is('a') ? $r : $r.parent().is('a') && $r.parent().children().length === 1 ? $r.parent() : null;
  if (wrapper) return resolveDetail(wrapper.attr('href'), pageUrl);
  const anchors = $r.find('a[href]');
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors.eq(i);
    const text = squash(visibleText(a));
    const button = GENERIC_LINK_TEXT.test(text.replace(/^[»›>→\s]+|[»›>→…\s]+$/g, '')) || text === title.title || (text === '' && a.find('img').length > 0);
    if (!button) continue;
    const u = resolveDetail(a.attr('href'), pageUrl);
    if (u) return u;
  }
  return null;
}

function recordImage($r: $El, pageUrl: string): string | undefined {
  const img = $r.find('img').first();
  const src = img.attr('data-src') ?? img.attr('data-lazy-src') ?? img.attr('src');
  if (!src || src.startsWith('data:')) return undefined;
  try {
    return new URL(src, pageUrl).href;
  } catch {
    return undefined;
  }
}

/* ── Uhrzeit ──────────────────────────────────────────────────────── */

const TIME_RANGE = /^\s*(?:Uhr)?\s*(?:-|–|—|bis)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:Uhr)?/i;

/**
 * Uhrzeit des Termins aus der Kachel: die erste Uhrzeit nach dem Datum
 * (höchstens 80 Zeichen dahinter), sonst die einzige der Kachel. Mehrere
 * Uhrzeiten ohne Bezug zum Datum: keine (keine erfundene Uhrzeit).
 * „19 Uhr" zählt wie „19:00".
 */
export function recordTime(text: string, date: DateExpr, standalone?: ReadonlySet<string>): { start: string; end?: string } | null {
  // Mehrtägig: ob eine Uhrzeit dem ersten oder letzten Tag gilt, sagt die
  // Kachel nicht („31.10.2026 bis 01.11.2026 - 01:00 Uhr", Kenzingen).
  if (date.end) return null;
  const plain = withoutDates(text);
  const found: { index: number; time: string; end?: string; endAt?: number }[] = [];
  // „19 Uhr", auch als Anfang einer Spanne („von 16 bis 17 Uhr", Flechtingen).
  const re = /(?<![\d:.,])(\d{1,2})(?::(\d{2})(?!\d)|\.(\d{2})(?=\s*Uhr|\s*(?:-|–|—|bis)\s*\d{1,2}[.:]\d{2}\s*Uhr|\s*[•·|](?!\s*\d))|(?=\s*Uhr(?![\p{L}]))|(?=\s*(?:-|–|—|bis)\s*\d{1,2}(?:[:.]\d{2})?\s*Uhr(?![\p{L}])))/giu;
  for (const m of plain.matchAll(re)) {
    const h = Number(m[1]);
    const min = Number(m[2] ?? m[3] ?? 0);
    if (h > 23 || min > 59) continue;
    const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const after = plain.slice(m.index! + m[0].length);
    const r = TIME_RANGE.exec(after);
    const end = r && Number(r[1]) <= 23 && Number(r[2] ?? 0) <= 59 ? `${r[1].padStart(2, '0')}:${(r[2] ?? '00')}` : undefined;
    found.push({ index: m.index!, time, end, endAt: r ? m.index! + m[0].length + r[0].length : undefined });
  }
  if (found.length === 0) return null;
  // extractTimeOfDay (AT) liest dieselben Formen; „19 Uhr" kommt hier dazu.
  // Nach jeder Nennung desselben Datums: Augsburg nennt es im Kopf der
  // Kachel und noch einmal direkt vor der Uhrzeit („Montag, 23.11.2026
  // Bildnachweis: … 23.11.2026 18:00 Uhr", Prüfstand 2026-10-29).
  const ends = findDateExprs(text).filter(d => dateKey(d) === dateKey(date)).map(d => d.index + d.length);
  const near = found.find(f => ends.some(e => f.index >= e && f.index - e <= 80));
  // Sonst die einzige Anfangszeit der Kachel; das Ende einer Spanne zählt
  // nicht mit (Willich: Beschreibung, dann „Zeit 15:00 Uhr - 16:30 Uhr").
  const starts = found.filter(f => !found.some(o => o.endAt != null && f.index > o.index && f.index < o.endAt));
  // Ohne Nähe zum Datum nur eine Uhrzeit in eigenem, kurzem Element: eine im
  // Beschreibungstext ist oft etwas anderes („Geschäfte ab 12:30 Uhr
  // geöffnet" beim Martinimarkt, Wemding).
  const lone = new Set(starts.map(f => f.time)).size === 1 ? starts[0] : null;
  const pick = near ?? (lone && (!standalone || standalone.has(lone.time)) ? lone : null);
  if (!pick) return null;
  return { start: pick.time, ...(pick.end && pick.end > pick.time ? { end: pick.end } : {}) };
}

/* ── Termin bauen ─────────────────────────────────────────────────── */

const berlin = (date: string, time: string) => toUtcInstant(`${date}T${time}:00`) as string;

function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function fromLd(e: LdEvent, pageUrl: string, strategie: Strategie, image?: string): AllgemeinTermin | null {
  // Auch Schema.org-Namen tragen Datum und Uhrzeit („Martinsumzug … Freitag,
  // 13. November 2026, ab 18:00 Uhr", Birkenfeld 2026-10-29).
  const title = acceptTitle(e.name, NAMED);
  if (!title) return null;
  let url = pageUrl;
  if (e.url) {
    try {
      const u = new URL(e.url, pageUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') url = u.href;
    } catch { /* Seite */ }
  }
  const detail = url !== pageUrl;
  return {
    key: detail ? `${url}|${e.localDate}` : `${pageUrl}|${e.name}|${e.localDate}`,
    title,
    url,
    localDate: e.localDate,
    start: e.start,
    ...(e.end ? { end: e.end } : {}),
    allDay: e.allDay,
    ...(image ? { image } : {}),
    locationName: e.locationName,
    street: e.street,
    postalCode: e.postalCode,
    locality: e.locality,
    ...(e.lat != null && e.lng != null ? { lat: e.lat, lng: e.lng } : {}),
    strategie,
  };
}

function ldImage(o: Record<string, unknown>, pageUrl: string): string | undefined {
  const raw = Array.isArray(o.image) ? o.image[0] : o.image;
  const src = typeof raw === 'string' ? raw : raw && typeof raw === 'object' ? ((raw as Record<string, unknown>).url ?? (raw as Record<string, unknown>).contentUrl) : undefined;
  if (typeof src !== 'string') return undefined;
  try {
    return new URL(src, pageUrl).href;
  } catch {
    return undefined;
  }
}

/** JSON-LD-Events der Seite. */
export function parseJsonLd(html: string, pageUrl: string): AllgemeinTermin[] {
  const out: AllgemeinTermin[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const objs: Record<string, unknown>[] = [];
    const visit = (x: unknown): void => {
      if (Array.isArray(x)) { x.forEach(visit); return; }
      if (!x || typeof x !== 'object') return;
      const o = x as Record<string, unknown>;
      if (o['@graph']) visit(o['@graph']);
      const t = o['@type'];
      if ((Array.isArray(t) ? t : [t]).some(v => typeof v === 'string' && /Event$/.test(v))) objs.push(o);
    };
    visit(data);
    for (const o of objs) {
      const e = toLdEvent(o);
      const t = e && fromLd(e, pageUrl, 'jsonld', ldImage(o, pageUrl));
      if (t) out.push(t);
    }
  }
  return out;
}

/** Mikrodaten (`itemtype=…/Event`): Felder wie JSON-LD, gelesen über toLdEvent. */
export function parseMicrodata($: cheerio.CheerioAPI, pageUrl: string): AllgemeinTermin[] {
  const out: AllgemeinTermin[] = [];
  $('[itemscope][itemtype]').each((_, el) => {
    const $e = $(el);
    if (!/schema\.org\/\w*Event$/i.test(($e.attr('itemtype') ?? '').trim())) return;
    // Nur Eigenschaften dieses Events, nicht die eines eingebetteten Orts.
    const own = (prop: string) => $e.find(`[itemprop="${prop}"]`).filter((_, n) => $(n).parent().closest('[itemscope]')[0] === el).first();
    const val = ($n: $El) => ($n.attr('content') ?? $n.attr('datetime') ?? $n.attr('href') ?? $n.attr('src') ?? $n.text()).trim();
    const loc = own('location');
    const o: Record<string, unknown> = {
      name: val(own('name')),
      startDate: val(own('startDate')),
      endDate: val(own('endDate')) || undefined,
      url: val(own('url')) || undefined,
      location: loc.length ? { name: loc.find('[itemprop="name"]').first().text().trim() || undefined } : undefined,
    };
    const e = toLdEvent(o);
    if (!e) return;
    const img = own('image');
    let image: string | undefined;
    try {
      image = img.length && val(img) ? new URL(val(img), pageUrl).href : undefined;
    } catch { /* kein Bild */ }
    const t = fromLd(e, pageUrl, 'mikrodaten', image);
    if (t) out.push(t);
  });
  return out;
}

/**
 * Gleichartige Geschwister: gleiches Element, bei Containern (div, section,
 * span, p) dazu eine gemeinsame Klasse oder beide ohne Klasse. Der Kasten
 * „Aktuell notiert" neben dem Inhalt ist keine Kachel einer Terminliste
 * (Muldenhammer, Prüfstand 2026-10-29); Zeilen und Listeneinträge mit
 * wechselnder Klasse („odd", „even") schon.
 */
function sameKind(a: Node, b: Node): boolean {
  if (a.tagName !== b.tagName) return false;
  if (!['div', 'section', 'span', 'p'].includes(a.tagName!)) return true;
  const ca = (a.attribs?.class ?? '').split(/\s+/).filter(Boolean);
  const cb = new Set((b.attribs?.class ?? '').split(/\s+/).filter(Boolean));
  return (ca.length === 0 && cb.size === 0) || ca.some(c => cb.has(c));
}

/**
 * Liste mit Datum: Kacheln suchen, die sich mit Datum wiederholen, je
 * Kachel Name, Datum, Uhrzeit, Link und Bild lesen.
 */
export function parseListe($: cheerio.CheerioAPI, pageUrl: string): AllgemeinTermin[] {
  $(NOISE).remove();
  $(PAGE_CHROME).filter((_, n) => $(n).parents('article, li, tr, [itemscope]').length === 0).remove();
  $(PUBLISHED).remove();
  // Linktext an drei oder mehr verschiedenen Zielen ist ein Knopf („zum
  // Konzert", „Tickets kaufen" in Woldegk, Prüfstand 2026-10-29), kein Name.
  const targets = new Map<string, Set<string>>();
  $('a[href]').each((_, a) => {
    const t = squash(visibleText($(a)));
    if (t) targets.set(t, (targets.get(t) ?? new Set<string>()).add($(a).attr('href')!));
  });
  const buttons = new Set([...targets].filter(([, h]) => h.size >= 3).map(([t]) => t));
  const root = $.root()[0] as unknown as Node;
  const texts = textMap(root);
  const exprCache = new Map<Node, DateExpr[]>();
  const exprs = (n: Node): DateExpr[] => {
    let e = exprCache.get(n);
    if (!e) {
      e = findDateExprs(texts.get(n) ?? '');
      exprCache.set(n, e);
    }
    return e;
  };
  const keys = (n: Node) => new Set(exprs(n).map(dateKey));
  const sameKeys = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(k => b.has(k));
  const elementChildren = (n: Node) => (n.children ?? []).filter(c => c.type === 'tag');

  // Innerste Elemente mit Datum.
  const minimal: Node[] = [];
  for (const n of texts.keys()) {
    if (n.type !== 'tag' || exprs(n).length === 0) continue;
    if (elementChildren(n).some(c => exprs(c).length > 0)) continue;
    minimal.push(n);
  }

  const records = new Map<Node, DateExpr>();
  const tried = new Set<Node>();
  for (const m of minimal) {
    let own = keys(m);
    if (own.size !== 1) continue;
    let el: Node = m;
    // Aufsteigen, solange die Kachel nur dieses Datum nennt; die erste Stufe
    // mit gleichartigen Geschwistern samt Datum ist ein Kandidat, der erste
    // Kandidat mit Namen ist der Termin.
    while (el.parent && el.parent.type === 'tag') {
      const parent: Node = el.parent;
      const siblings = elementChildren(parent).filter(c => c !== el && sameKind(c, el) && exprs(c).length > 0);
      if (siblings.length > 0 && !tried.has(el)) {
        tried.add(el);
        if (recordTitle($, $(el as any), pageUrl, buttons)) {
          records.set(el, exprs(el)[0]);
          break;
        }
      }
      const up = keys(parent);
      if (!sameKeys(up, own)) {
        // Spanne über zwei Elemente („<time>16.10</time> - <time>05.11.2026</time>",
        // Kempen): das Element trug nur ihr Ende, die Kachel nennt die Spanne.
        const [k] = own;
        const [u] = up;
        if (up.size !== 1 || !u.includes('/') || !(u.endsWith(`/${k.split('/')[0]}`) || u.startsWith(k.split('/')[0]))) break;
        own = up;
      }
      el = parent;
    }
  }

  const out: AllgemeinTermin[] = [];
  // Titel je Link: ein Link an Kacheln verschiedener Termine ist der
  // Kalender; an Kacheln desselben Namens die Detailseite der Reihe
  // („Jugendtreffpunkt im FIZ (Di)", Schlöben).
  const linkTitles = new Map<string, Set<string>>();
  const drafts: { $r: $El; title: string; link: string | null; date: DateExpr; text: string }[] = [];
  for (const node of records.keys()) {
    // Ein Termin in einem anderen Termin: die äußere Kachel ist die Liste.
    let p = node.parent;
    let nested = false;
    while (p) {
      if (records.has(p)) { nested = true; break; }
      p = p.parent ?? null;
    }
    if (nested) continue;
    const $r = $(node as any);
    const t = recordTitle($, $r, pageUrl, buttons)!;
    // „bis 20.12.2026" ohne Beginn: das Ende eines laufenden Angebots, kein
    // Termin an diesem Tag (Kalkar „Ausstellung …", 2026-10-29).
    // Leerraum zusammengefasst: „Uhrzeit nach dem Datum" misst Zeichen, und
    // eingerückte Kacheln trennen Datum und Uhrzeit sonst durch hunderte
    // Leerzeichen (Viersen, Augsburg, Prüfstand 2026-10-29).
    const text = squash(texts.get(node) ?? '');
    const date = findDateExprs(text)[0];
    if (!date) continue;
    // Nennt die Kachel einen anderen Tag ohne Jahr (ihr Kopf), stammt das
    // Datum mit Jahr aus dem Beschreibungstext: welches gilt, ist offen.
    const [, sm, sd] = date.start.split('-').map(Number);
    if (yearlessDates(text).some(p => p.day !== sd || p.month !== sm)) continue;
    if (/(?:^|[\s(])bis\s*(?:zum\s+)?(?:\p{L}{2,10}\.?,?\s*)?$/iu.test(text.slice(Math.max(0, date.index - 20), date.index))) continue;
    const link = recordLink($, $r, t, pageUrl);
    if (link) linkTitles.set(link, (linkTitles.get(link) ?? new Set<string>()).add(t.title));
    drafts.push({ $r, title: t.title, link, date, text });
  }
  // Inner verschachtelte Termine zuerst gefunden? Dann fällt die Liste weg (oben).
  for (const d of drafts) {
    // Derselbe Link an mehreren Kacheln mit verschiedenen Terminen ist der
    // Kalender, keine Detailseite.
    const shared = d.link != null && (linkTitles.get(d.link)?.size ?? 0) > 1;
    const url = d.link && !shared ? d.link : pageUrl;
    // Uhrzeiten, die in einem eigenen kurzen Element der Kachel stehen.
    const standalone = new Set<string>();
    d.$r.find('*').each((_, n) => {
      const t = squash($(n).text());
      if (t.length > 40) return;
      const any = findDateExprs(t)[0] ?? { start: '', index: 0, length: 0 };
      const found = recordTime(t, any);
      if (found) standalone.add(found.start);
    });
    const time = recordTime(d.text, d.date, standalone);
    let start: string, end: string | undefined;
    if (time) {
      start = berlin(d.date.start, time.start);
      if (d.date.end) end = berlin(d.date.end, time.end ?? time.start);
      else if (time.end) end = berlin(d.date.start, time.end);
    } else {
      start = d.date.start;
      end = d.date.end;
    }
    const image = recordImage(d.$r, pageUrl);
    out.push({
      key: url !== pageUrl ? `${url}|${d.date.start}` : `${pageUrl}|${d.title}|${d.date.start}`,
      title: d.title,
      url,
      localDate: d.date.start,
      start,
      ...(end ? { end } : {}),
      allDay: !time,
      ...(image ? { image } : {}),
      placeText: squash(d.text).slice(0, 600),
      strategie: 'liste',
    });
  }
  return out;
}

/**
 * Alle Termine einer Kalenderseite, die ab `today` (YYYY-MM-DD, deutsche
 * Ortszeit) beginnen (eine laufende Ausstellung verwirft der
 * Freigabevertrag als `start_in_past` wie bei allen Adaptern): JSON-LD, Mikrodaten oder Liste, je nachdem was am meisten
 * künftige Termine trägt (bei Gleichstand die mit mehr Uhrzeiten, dann in dieser Reihenfolge). Nie zwei
 * Lesarten derselben Seite zusammen, sonst stünde jeder Termin doppelt.
 * `calendarUrl`: die Kalenderseite, zu der eine Folgeseite gehört. Termine
 * ohne Detailseite bekommen ihre Identität von ihr, nicht von der
 * Folgeseite (Woldegk `?from=40` wandert mit jedem vergangenen Termin).
 */
export function parseAllgemeinPage(html: string, pageUrl: string, today: string, calendarUrl = pageUrl): AllgemeinTermin[] {
  // Ohne `today` alle Termine der Seite (Folgeseiten-Entscheidung im Adapter).
  const future = (list: AllgemeinTermin[]) => (today ? list.filter(t => t.localDate >= today) : list);
  const ld = future(parseJsonLd(html, pageUrl));
  const micro = future(parseMicrodata(cheerio.load(html), pageUrl));
  const liste = future(parseListe(cheerio.load(html), pageUrl));
  // Gleich viele Termine: die Lesart mit Uhrzeiten (Gemmingen: Mikrodaten
  // nur mit Datum, die Liste daneben mit „18:00 Uhr", Prüfstand 2026-10-29).
  const timed = (l: AllgemeinTermin[]) => l.filter(t => !t.allDay).length;
  const best = [ld, micro, liste].reduce((a, b) => (b.length > a.length || (b.length === a.length && timed(b) > timed(a)) ? b : a));
  return best.map(t => (t.url === pageUrl ? { ...t, key: `${calendarUrl}|${t.title}|${t.localDate}` } : t));
}

/** source_id: Website und Hash der Termin-Identität, nie gekürzter Text. */
export function allgemeinSourceId(t: AllgemeinTermin): string {
  return `allg-${new URL(t.url).host.replace(/^www\./, '')}-${hash(t.key)}-${t.localDate}`;
}

