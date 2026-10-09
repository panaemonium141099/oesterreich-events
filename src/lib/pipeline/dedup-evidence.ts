// src/lib/pipeline/dedup-evidence.ts

/**
 * Belege für den Event-Dedup: Titel, Uhrzeit, Ort — je als Relation statt
 * als Punktzahl.
 *
 * WARUM (Prod-Befund 2026-10-07): Der frühere Scorer addierte gewichtete
 * Teilwerte. Quellenübergreifend fehlen fast immer gemeinsame URLs und
 * Venue-Ids, Ortsnamen sind verschieden geschrieben („Sargfabrik" vs.
 * „Sargfabrik - Verein für integrative Lebensgestaltung"). Gleicher Titel,
 * gleiche Uhrzeit, gleiche Koordinaten ergaben so 0,775 → „uncertain", und
 * niemand löste das auf. 2.097 solche Paare waren gleichzeitig sichtbar.
 *
 * Hier wird jede Dimension für sich beurteilt; fehlende Daten sind
 * „unbekannt" und kein Gegenbeweis. Alles ist quellen-unabhängig: es gibt
 * keine Regel für eine einzelne Quelle, nur Sprache (Stoppwörter,
 * Venue-Gattungswörter) und amtliche Ortsdaten.
 *
 * Rein und ohne I/O.
 */

import { decodeEntities } from '@/lib/utils/decode-entities';
import { hasKnownStartTime, parseEventDate, toViennaDate, toViennaIso } from '@/lib/utils/event-time';
import { haversineDistance } from '@/lib/pipeline/normalize-venue';
import { gemeindenByName, gemeindenByPlz, isKnownAustrianPlaceName } from '@/lib/location/gemeinde-index';
import type { EventRow } from './types';

export type TitleRelation = 'equal' | 'near' | 'contains' | 'related' | 'different';
export type TimeRelation = 'exact' | 'near' | 'far' | 'conflict' | 'unknown';
export type PlaceRelation = 'same' | 'town' | 'unknown' | 'conflict';

export interface PlaceEvidence {
  relation: PlaceRelation;
  /** Beleg bzw. Widerspruch, z. B. 'coords', 'venue_name', 'different_venue'. */
  reason: string;
}

/** Pins unter dieser Distanz (beide genau) sind derselbe Ort. */
export const SAME_PLACE_M = 250;
/** Genaue Pins weiter auseinander widersprechen sich (außer gleiche PLZ, s. u.). */
export const DIFFERENT_PLACE_M = 1000;
/** Größter beobachteter Pin-Fehler derselben Venue innerhalb einer PLZ. */
export const MAX_PIN_ERROR_M = 5000;

// ---------------------------------------------------------------------------
// Text-Normalisierung
// ---------------------------------------------------------------------------

/** Kleinschreibung, Entities, Umlaut-Schreibweise und Akzente vereinheitlicht. */
export function foldText(s: string): string {
  return decodeEntities(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'einem',
  'und', 'oder', 'mit', 'von', 'vom', 'zu', 'zum', 'zur', 'fuer', 'bei', 'aus', 'nach',
  'in', 'im', 'am', 'an', 'auf', 'ins',
  'the', 'a', 'an', 'of', 'and', 'to', 'for', 'at', 'on', 'by', 'with',
]);

const YEAR = /^(19|20)\d{2}$/;

/** Verbindungswörter zwischen Gegnern/Acts („Salzburg vs. Lustenau"). */
const CONNECTORS = new Set(['vs', 'gegen', 'x']);

/** Bedeutungstragende Wörter eines Titels, in Reihenfolge. Jahreszahlen und
 *  Länderkürzel in Klammern („(A)", „(uk)") tragen am selben Tag nichts bei. */
function titleTokens(folded: string): string[] {
  return folded
    .replace(/\(\s*[a-z]{1,3}\s*\)/g, ' ')
    // Akronyme mit Punkten als ein Wort: „K.O." → „ko", „K.U.L.T." → „kult"
    .replace(/(?<![\p{L}\p{N}])(?:\p{L}\.){2,}(?:\p{L}(?![\p{L}\p{N}]))?/gu, m => m.replace(/\./g, ''))
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t && !STOPWORDS.has(t) && !YEAR.test(t) && (t.length > 1 || /\d/.test(t)));
}

/** Teil vor dem ersten Trennzeichen („Sarah Bosetti - Worte …" → „sarah bosetti"). */
const LEAD_DELIMITER = /\s+[-–—]\s*|\s*[-–—]\s+|:\s|\s\|\s|\s\/\s|\s\+\s|\(|\sfeat\.?\s/;

// ---------------------------------------------------------------------------
// Merkmale je Event (einmal berechnet)
// ---------------------------------------------------------------------------

interface VenueFeatures {
  /** Ortsname statt Venue („Wien", „Österreich", „Linz"), leer oder fehlend. */
  townLabel: boolean;
  /** Straße und Hausnummer statt Venue („Karlingerstraße 6"). */
  isAddress: boolean;
  /** Wörter ohne Stoppwörter und ohne den eigenen Gemeindenamen. */
  tokens: string[];
  compact: string;
  /** tokens ohne Gattungswörter („Saal", „Pfarrkirche", „St.") */
  core: Set<string>;
  /** Gemeindenamen zur eigenen PLZ (auch „Wiener"), für den Vergleich mit Zeilen ohne PLZ. */
  townWords: Set<string>;
  /** Alle Wörter des Venue-Namens, auch Ortsnamen. */
  allTokens: string[];
  /** Ortsname statt Venue („Feldbach", „St. Pölten"), normalisiert; sonst ''. */
  townKey: string;
  /** Derselbe Ortsname, wie die Quelle ihn schreibt (für die Gemeinde-Auflösung). */
  townRaw: string;
  /** Gemeindenamen zur eigenen PLZ als Wortfolgen (ohne bloße Gattungswörter). */
  townNames: string[][];
}

interface Features {
  day: string | null;
  startMs: number | null;
  tokens: string[];
  tokenSet: Set<string>;
  compact: string;
  numbers: string;
  lead: string;
  venue: VenueFeatures;
  precise: boolean;
  plz: string | null;
  gemeinden: Set<string>;
  district: string;
  /** Jahreszahlen im Titel („Jahrgangstreffen 1956"). */
  years: Set<string>;
}

const cache = new WeakMap<EventRow, Features>();

/** Jahreszahlen eines Titels, Saisonangaben („2025/26", „2025/2026") mit beiden Jahren. */
function titleYears(folded: string): Set<string> {
  const out = new Set<string>();
  for (const m of folded.matchAll(/(?<!\d)((?:19|20)\d{2})(?:\s*[/–-]\s*(\d{4}|\d{2}))?(?!\d)/g)) {
    out.add(m[1]);
    if (m[2]) out.add(m[2].length === 2 ? m[1].slice(0, 2) + m[2] : m[2]);
  }
  return out;
}

/** `YYYY-MM-DD` mit vierstelligem Jahr (Intl liefert für Jahr 1 „1-01-01"). */
function viennaDay(d: Date): string {
  const [y, m, dd] = toViennaDate(d).split('-');
  return `${y.padStart(4, '0')}-${m}-${dd}`;
}

export function viennaDayOf(e: Pick<EventRow, 'start_date'>): string | null {
  const d = parseEventDate(e.start_date);
  return d ? viennaDay(d) : null;
}

/**
 * Plausibler Veranstaltungstag (2000 bis fünf Jahre voraus). Quellen liefern
 * gelegentlich Jahr 1 oder 2919; solche Zeilen sind Datenfehler, keine
 * Dubletten-Kandidaten, und dürfen den Lauf nicht abbrechen.
 */
export function isPlausibleEventDay(day: string, now: Date = new Date()): boolean {
  const year = Number(day.slice(0, 4));
  return Number.isFinite(year) && year >= 2000 && year <= now.getUTCFullYear() + 5;
}

/**
 * Erster Tag, den der Dedup plant: der Wiener Vortag. Ältere Tage sieht
 * niemand mehr; ihre Änderungen (wandernde Serienzeilen) hielten nur das
 * Sicherheitsventil zu (Abschlussprüfung 2026-10-08).
 */
export function planningStartDay(now: Date = new Date()): string {
  return viennaDay(new Date(now.getTime() - 86_400_000));
}

/** UTC-Mitternacht eines Tages; setUTCFullYear statt Date.UTC, das Jahre
 *  0–99 als 1900–1999 liest (Quellen liefern gelegentlich „0001-01-01"). */
function utcMidnight(y: number, m: number, d: number): Date {
  const t = new Date(Date.UTC(2000, 0, 1));
  t.setUTCFullYear(y, m - 1, d);
  return t;
}

/**
 * UTC-Grenzen [Beginn, Ende) eines Wiener Kalendertags `YYYY-MM-DD`.
 * Wien ist UTC+1 oder UTC+2 (historische Zeitzonen-Daten können für sehr
 * alte Jahre krumme Offsets liefern); gesucht wird der erste Instant, der
 * schon zum Tag gehört.
 */
export function viennaDayBoundsUtc(day: string): [string, string] {
  const midnight = (y: number, m: number, d: number): string => {
    const base = utcMidnight(y, m, d);
    // Ab 3 h vor UTC-Mitternacht minutenweise vorwärts bis zum Tageswechsel.
    const target = viennaDay(new Date(base.getTime() + 12 * 3_600_000));
    let t = base.getTime() - 3 * 3_600_000;
    while (viennaDay(new Date(t)) !== target) t += 60_000;
    return new Date(t).toISOString();
  };
  const [y, m, d] = day.split('-').map(Number);
  const next = utcMidnight(y, m, d + 1);
  return [midnight(y, m, d), midnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())];
}

function features(e: EventRow): Features {
  const hit = cache.get(e);
  if (hit) return hit;

  const folded = foldText(e.title ?? '');
  const tokens = titleTokens(folded);
  const leadPart = folded.split(LEAD_DELIMITER)[0] ?? '';
  const leadTokens = titleTokens(leadPart);
  const plz = /^\d{4}$/.test((e.postal_code ?? '').trim()) ? e.postal_code!.trim() : null;
  const gemeinden = new Set(plz ? gemeindenByPlz(plz).map(g => `${g.name}|${g.bundesland}`) : []);

  let startMs: number | null = null;
  if (e.start_date && hasKnownStartTime({ start_date: e.start_date, is_all_day: e.is_all_day ?? null })) {
    const d = parseEventDate(e.start_date);
    startMs = d && !isDateEchoTime(d) ? d.getTime() : null;
  }

  const f: Features = {
    day: viennaDayOf(e),
    startMs,
    tokens,
    tokenSet: new Set(tokens),
    compact: tokens.join(''),
    // Auch Ziffern in Wörtern zählen („Midi2", „Folgetermine5").
    numbers: tokens.flatMap(t => t.match(/\d+/g) ?? []).sort().join(','),
    lead: leadTokens.length > 0 && leadTokens.length < tokens.length ? leadTokens.join(' ') : '',
    venue: venueFeatures(e.location_name, plz),
    precise: hasPreciseCoords(e),
    plz,
    gemeinden,
    district: (e.district ?? '').toLowerCase().trim(),
    years: titleYears(folded),
  };
  cache.set(e, f);
  return f;
}

/**
 * Uhrzeit gleich dem eigenen Datum („15.10." als 15:10 gelesen, UTC oder
 * Wiener Zeit) ist ein Parser-Artefakt, keine Beginnzeit (gemeinden-generic
 * bis PR #275; Altzeilen heilen nicht per Upsert).
 */
function isDateEchoTime(d: Date): boolean {
  if (d.getUTCHours() === d.getUTCDate() && d.getUTCMinutes() === d.getUTCMonth() + 1) return true;
  const v = toViennaIso(d); // YYYY-MM-DDTHH:MM:SS+hh:mm
  return Number(v.slice(11, 13)) === Number(v.slice(8, 10)) && Number(v.slice(14, 16)) === Number(v.slice(5, 7));
}

function hasPreciseCoords(e: EventRow): boolean {
  return e.latitude != null && e.longitude != null &&
    (e.location_precision === 'building' || e.location_precision === 'street');
}

/** Koordinaten aus dem fn-25-Resolver. Zeilen ohne Präzisionsangabe tragen
 *  teils noch Pins des alten Normalizers (Venue durch gleichnamiges Dorf
 *  ersetzt) — die sind weder Beleg noch Gegenbeleg. */
const RESOLVED_PRECISION = new Set(['building', 'street', 'postcode', 'municipality']);
function hasResolvedCoords(e: EventRow): boolean {
  return e.latitude != null && e.longitude != null && RESOLVED_PRECISION.has(e.location_precision ?? '');
}

/** Vorlauf, ab dem eine nicht mehr gelieferte Zeile als verwaist gilt. Die
 *  Gemeinde-Aggregatoren rotieren und liefern aktuelle Zeilen teils erst nach
 *  7–14 Tagen wieder (Prod-Messung 2026-10-07); Altlasten behobener
 *  Scraper-Fehler liegen weit darüber. */
const ORPHAN_AFTER_MS = 21 * 24 * 3_600_000;

/**
 * Verwaist: Die Quelle liefert die Zeile nicht mehr (zuletzt gesehen deutlich
 * vor dem jüngsten Lauf derselben Quelle), obwohl das Event noch bevorstand.
 * Typisch: Altzeilen aus behobenen Scraper-Fehlern (Zeitzone, Titelformat),
 * deren source_id sich geändert hat. Sie sind kein Beleg für ein eigenes
 * Event — weder als Gegenbeleg im Cluster noch als Grund, sie wieder
 * sichtbar zu machen. Ohne last_seen_at (Tests, Altbestand) nie verwaist.
 */
export function isOrphanRow(e: EventRow, sourceLastSeen?: Map<string, string>): boolean {
  if (!e.last_seen_at || !e.source_name || !sourceLastSeen) return false;
  // Inserate (business/user) werden nie neu gescrapt; ihr last_seen_at ist
  // die Freigabezeit, kein Lebenszeichen der Quelle.
  if (e.source_type && e.source_type !== 'scraped') return false;
  const newest = sourceLastSeen.get(e.source_name);
  if (!newest) return false;
  const seen = Date.parse(e.last_seen_at);
  const start = Date.parse(e.start_date);
  if (Number.isNaN(seen) || Number.isNaN(start)) return false;
  return seen < Date.parse(newest) - ORPHAN_AFTER_MS && seen < start - 24 * 3_600_000;
}

// ---------------------------------------------------------------------------
// Titel
// ---------------------------------------------------------------------------

/** Levenshtein mit Abbruch, sobald `max` überschritten ist. */
function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function isSubset(small: Set<string>, big: Set<string>): boolean {
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

/**
 * - equal: dieselben Wörter (Schreibweise, Satzzeichen, Jahr, „(A)" egal)
 * - near: Tippfehler / „-" vs. „vs." — kleine Editierdistanz, gleiche Nummern
 * - contains: der kürzere Titel steckt ganz im längeren (Untertitel,
 *   Tourname, an den Titel geklebter Kategorie-Text der Quelle)
 * - related: nur der Hauptteil vor dem Trennzeichen ist gleich
 *   („Sarah Bosetti - Programm A" / „- Programm B")
 */
export function titleRelation(a: EventRow, b: EventRow): TitleRelation {
  const fa = features(a);
  const fb = features(b);
  if (!fa.compact || !fb.compact) return 'different';
  // Jahreszahlen zählen nicht, außer beide Titel nennen verschiedene
  // („Jahrgangstreffen 1956" / „1966" beim selben Wirt).
  if (fa.years.size > 0 && fb.years.size > 0 && ![...fa.years].some(y => fb.years.has(y))) return 'different';
  if (fa.compact === fb.compact) return 'equal';

  if (fa.numbers === fb.numbers) {
    if (fa.tokenSet.size === fb.tokenSet.size && isSubset(fa.tokenSet, fb.tokenSet)) return 'near';
    const maxLen = Math.max(fa.compact.length, fb.compact.length);
    const minLen = Math.min(fa.compact.length, fb.compact.length);
    // Tippfehler stecken in längeren Wörtern („Lebenshälte"); abweichende
    // Kürzel („JK/LJ" vs. „KJ/LJ") und kurze Wörter („Mini"/„Midi") sind
    // andere Vereine bzw. Kursstufen.
    const differing = [...fa.tokenSet].filter(t => !fb.tokenSet.has(t))
      .concat([...fb.tokenSet].filter(t => !fa.tokenSet.has(t)));
    const onlyTypos = differing.every(t => t.length >= 6 || CONNECTORS.has(t));
    if (onlyTypos && minLen >= 8 && minLen / maxLen >= 0.85) {
      const budget = Math.max(1, Math.floor(maxLen * 0.08));
      if (boundedEditDistance(fa.compact, fb.compact, budget) <= budget) return 'near';
    }
  }

  const [s, l] = fa.tokenSet.size <= fb.tokenSet.size ? [fa, fb] : [fb, fa];
  if (isSubset(s.tokenSet, l.tokenSet)) return 'contains';
  const [cs, cl] = fa.compact.length <= fb.compact.length ? [fa, fb] : [fb, fa];
  // Angeklebter Text ohne Leerzeichen („…LutzmannsburgSport, Freizeit").
  // Eine Ziffer direkt dahinter ist eine andere Nummer („Team 1" / „Team 10").
  if (cs.compact.length >= 8 && cl.compact.startsWith(cs.compact) &&
      !(/\d$/.test(cs.compact) && /\d/.test(cl.compact[cs.compact.length] ?? ''))) {
    return 'contains';
  }

  if (fa.lead && fa.lead === fb.lead && fa.lead.replace(/ /g, '').length >= 6) return 'related';
  return 'different';
}

/** Titel konkret genug, um ihn ohne Venue-Beleg im selben Ort zuzuordnen. */
export function isSpecificTitle(e: EventRow): boolean {
  const f = features(e);
  return f.tokens.length >= 3 || f.compact.length >= 18;
}

/** Schlüssel für gleiche Titel (Blocking, Audit). */
export function titleKey(e: EventRow): string {
  return features(e).compact;
}

/** Absage oder Verschiebung im Titel („ABGESAGT: …", „… entfällt", „verschoben auf …"). */
const CANCEL_MARKER = /(^|[^\p{L}])(abgesagt|absage|entf(ä|ae)llt|entfallen|f(ä|ae)llt aus|storniert|verschoben|cancell?ed|postponed)([^\p{L}]|$)/iu;

const CANCELLED = /(abgesagt|absage|entf(ä|ae)llt|entfallen|f(ä|ae)llt aus|storniert|cancell?ed)/i;

export function hasCancelMarker(e: Pick<EventRow, 'title' | 'start_date'>): boolean {
  const title = e.title ?? '';
  if (!CANCEL_MARKER.test(title)) return false;
  const day = e.start_date ? viennaDayOf(e) : null;
  if (!day) return true;
  const isRowDay = (d: string, m: string) => Number(day.slice(8, 10)) === Number(d) && Number(day.slice(5, 7)) === Number(m);
  // „VERSCHOBEN auf 12.11." am 12.11. ist das verschobene Event an seinem
  // neuen Termin, keine Absage; am alten Termin ist es eine.
  const moved = title.match(/verschoben\s+(?:auf|nach|zum|in den)?\s*(\d{1,2})\.\s?(\d{1,2})\./i);
  if (moved) return isRowDay(moved[1], moved[2]) ? CANCELLED.test(title) : true;
  // Die Absage nennt nur andere Termine („Termin 16.9. ABGESAGT" am 16.12.).
  const dates = [...title.matchAll(/(\d{1,2})\.\s?(\d{1,2})\./g)];
  if (dates.length > 0 && !dates.some(m => isRowDay(m[1], m[2]))) return false;
  return true;
}

export function titleTokensOf(e: EventRow): string[] {
  return features(e).tokens;
}

// ---------------------------------------------------------------------------
// Uhrzeit
// ---------------------------------------------------------------------------

/** Platzhalter-Uhrzeiten (00:00Z, Wien-Mitternacht, ganztägig) sind „unknown". */
export function timeRelation(a: EventRow, b: EventRow): TimeRelation {
  const ta = features(a).startMs;
  const tb = features(b).startMs;
  if (ta === null || tb === null) return 'unknown';
  const minutes = Math.abs(ta - tb) / 60_000;
  if (minutes <= 15) return 'exact';
  if (minutes <= 60) return 'near';
  if (minutes <= 120) return 'far';
  return 'conflict';
}

export function knownStartMs(e: EventRow): number | null {
  return features(e).startMs;
}

export function sameViennaDay(a: EventRow, b: EventRow): boolean {
  const da = features(a).day;
  return !!da && da === features(b).day;
}

// ---------------------------------------------------------------------------
// Ort
// ---------------------------------------------------------------------------

/** Gattungswörter: sagen „ein Saal", nicht „welcher Saal". */
const GENERIC_VENUE = new Set([
  'saal', 'halle', 'haus', 'festsaal', 'stadtsaal', 'gemeindesaal', 'pfarrsaal', 'pfarrheim', 'pfarrzentrum',
  'pfarrkirche', 'kirche', 'kapelle', 'dom', 'stift', 'kloster', 'platz', 'hauptplatz', 'marktplatz', 'dorfplatz',
  'stadtplatz', 'kirchenplatz', 'rathausplatz', 'rathaus', 'gemeindeamt', 'gemeindezentrum', 'gasthaus', 'gasthof',
  'gh', 'hotel', 'restaurant', 'cafe', 'bar', 'club', 'kulturhaus', 'kulturzentrum', 'kultursaal', 'zentrum',
  'veranstaltungszentrum', 'veranstaltungssaal', 'mehrzwecksaal', 'mehrzweckhalle', 'sporthalle', 'turnhalle',
  'turnsaal', 'volksschule', 'vs', 'ms', 'nms', 'mittelschule', 'schule', 'buehne', 'theater', 'kino', 'museum',
  'galerie', 'park', 'bad', 'freibad', 'see', 'festgelaende', 'gelaende', 'festzelt', 'zelt', 'areal', 'stadt',
  'markt', 'gemeinde', 'verein', 'st', 'sankt', 'hl', 'kleiner', 'kleine', 'grosser', 'grosse', 'mittlerer',
  'foyer', 'raum', 'keller', 'hof', 'garten', 'bibliothek', 'buecherei', 'feuerwehrhaus', 'ff', 'ffw', 'sportplatz',
  'arena', 'center', 'forum', 'stadion', 'eingang', 'treffpunkt',
  // Verwaltungsetiketten statt Venue („Politischer Bezirk Tulln")
  'politischer', 'bezirk',
]);

const BUNDESLAENDER = new Set([
  'wien', 'niederoesterreich', 'oberoesterreich', 'steiermark', 'kaernten', 'salzburg', 'tirol', 'vorarlberg',
  'burgenland', 'oesterreich', 'austria',
]);

/** Nur Straße und Hausnummer („Karlingerstraße 6", „Hauptplatz 12a"). */
const ADDRESS_LINE = /^[\p{L}][\p{L}.\- ]*(?:stra(?:ss|ß)e|str\.|gasse|weg|platz|allee|ring|zeile|ufer|kai|steig|promenade)\s*\d+\s*[a-z]?(?:\s*[/-]\s*\d+)?\s*$/iu;

/** Straße + Hausnummer zum Vergleich, aus `address` oder einer Adresse als Ortsname. */
function addressKey(e: EventRow): string[] {
  const keys: string[] = [];
  for (const raw of [e.address, ADDRESS_LINE.test((e.location_name ?? '').trim()) ? e.location_name : null]) {
    const k = foldText((raw ?? '').split(',')[0]).replace(/strasse|str\./g, 'str').replace(/[^a-z0-9]+/g, '');
    if (/\d/.test(k) && k.length >= 5) keys.push(k);
  }
  return keys;
}

function venueFeatures(name: string | null | undefined, plz: string | null): VenueFeatures {
  const raw = (name ?? '').trim();
  const folded = foldText(raw);
  const head = folded.split(',')[0].trim();
  const townLabel = !head || BUNDESLAENDER.has(head.replace(/[^a-z]/g, '')) || isKnownAustrianPlaceName(head);

  // Den eigenen Gemeindenamen (und „Wiener", „Linzer" …) entfernen:
  // „STADTSAAL Wien" und „STADTSAAL" sind derselbe Saal.
  const townWords = new Set<string>();
  const townNames: string[][] = [];
  if (plz) {
    for (const g of gemeindenByPlz(plz)) {
      const words = titleTokens(foldText(g.name));
      for (const w of words) { townWords.add(w); townWords.add(`${w}er`); }
      // „See", „Bad" allein sind Wörter, keine Ortsangabe im Venue-Namen.
      if (words.length > 1 || (words[0] && words[0].length >= 4 && !GENERIC_VENUE.has(words[0]))) townNames.push(words);
    }
  }
  const allTokens = titleTokens(folded);
  const tokens = allTokens.filter(t => !townWords.has(t));
  // Bundesländer sind kein Ort (Salzburg Land oder Stadt?), Wien schon.
  const isTown = !!head && !(BUNDESLAENDER.has(head.replace(/[^a-z]/g, '')) && head !== 'wien') && isKnownAustrianPlaceName(head);
  return {
    townLabel,
    isAddress: ADDRESS_LINE.test(raw),
    tokens,
    compact: tokens.join(''),
    core: new Set(tokens.filter(t => !GENERIC_VENUE.has(t))),
    townWords,
    allTokens,
    townKey: isTown ? head.replace(/\bst\.?\s+/g, 'sankt ').replace(/[^a-z0-9]+/g, '') : '',
    townRaw: isTown ? raw.split(',')[0].trim() : '',
    townNames,
  };
}

/** Gemeinden, die ein Venue-Name mit ganzem Namen nennt („Pfarrkirche
 *  Güssing" → güssing, „Grazer Oper" → graz). Namensteile („St.", „Maria")
 *  zählen nicht. */
function namedTowns(v: VenueFeatures, names: string[][]): Set<string> {
  const out = new Set<string>();
  for (const name of names) {
    const hit = containsSequence(v.allTokens, name) ||
      (name.length === 1 && v.allTokens.includes(`${name[0]}er`));
    if (hit) out.add(name.join(' '));
  }
  return out;
}

/** Ortsnamen der GEGENSEITE ebenfalls entfernen: „Wiener Stadthalle" ohne PLZ
 *  gegen „Wiener Stadthalle Halle D" mit PLZ 1150 ist derselbe Ort. */
function stripTowns(v: VenueFeatures, other: Set<string>): VenueFeatures {
  const tokens = v.tokens.filter(t => !other.has(t));
  if (tokens.length === v.tokens.length) return v;
  return { ...v, tokens, compact: tokens.join(''), core: new Set(tokens.filter(t => !GENERIC_VENUE.has(t))) };
}

function containsSequence(long: string[], short: string[]): boolean {
  if (short.length === 0 || short.length > long.length) return false;
  outer: for (let i = 0; i + short.length <= long.length; i++) {
    for (let j = 0; j < short.length; j++) if (long[i + j] !== short[j]) continue outer;
    return true;
  }
  return false;
}

/** 'generic': gleicher Name, aber nur aus Gattungswörtern („Pfarrkirche"). */
type VenueRelation = 'same' | 'generic' | 'related' | 'differs' | 'unknown';

function venueRelation(rawA: VenueFeatures, rawB: VenueFeatures): VenueRelation {
  // Beide nennen einen Ort, aber verschiedene: Nachbargemeinden mit geteilter
  // PLZ („Pfarrkirche Güssing" / „Pfarrkirche Inzenhof", beide 7540).
  // Nicht bei bloßen Ortsangaben: Gemeinde-Kalender setzen ihren eigenen
  // Gemeindenamen als Ort, auch für Events der Nachbargemeinde.
  const names = [...rawA.townNames, ...rawB.townNames];
  const venues = !rawA.townLabel && !rawB.townLabel;
  const ta = venues ? namedTowns(rawA, names) : new Set<string>();
  const tb = venues ? namedTowns(rawB, names) : new Set<string>();
  const sameTown = [...ta].some(t => tb.has(t));
  if (ta.size > 0 && tb.size > 0 && !sameTown) return 'differs';
  const va = stripTowns(rawA, rawB.townWords);
  const vb = stripTowns(rawB, rawA.townWords);
  if (va.townLabel || vb.townLabel || !va.compact || !vb.compact) return 'unknown';
  // Eine Adresse als Ortsname sagt nichts über den Venue-Namen der anderen Zeile.
  if (va.isAddress !== vb.isAddress) return 'unknown';
  // Nur Gattungswörter („Pfarrkirche"), außer beide nennen denselben Ort
  // („Hauptplatz Haugsdorf").
  const same: VenueRelation = va.core.size === 0 && vb.core.size === 0 && !sameTown ? 'generic' : 'same';
  if (va.compact === vb.compact) return same;
  const [s, l] = va.tokens.length <= vb.tokens.length ? [va, vb] : [vb, va];
  if (containsSequence(l.tokens, s.tokens)) return same;
  const [cs, cl] = va.compact.length <= vb.compact.length ? [va, vb] : [vb, va];
  if (cs.compact.length >= 5 && cl.compact.includes(cs.compact)) return same;
  // Schreibvariante („Madonnenschlössel" / „Madonnenschlössl")
  if (cs.compact.length >= 6) {
    const budget = Math.max(1, Math.floor(cl.compact.length * 0.1));
    if (boundedEditDistance(va.compact, vb.compact, budget) <= budget) return same;
  }
  if (va.core.size === 0 || vb.core.size === 0) return 'unknown';
  for (const t of va.core) if (vb.core.has(t)) return 'related';
  return 'differs';
}

/**
 * Widerspruch nur aus Bezirk, PLZ-Gebiet/Gemeinde und genauen Pins, ohne
 * Venue-Namen (für Altzeilen, deren Ortsname oft ein Regionsname ist).
 */
export function labelConflict(a: EventRow, b: EventRow): string | null {
  const fa = features(a);
  const fb = features(b);
  if (fa.district && fb.district && fa.district !== fb.district) return 'different_district';
  const plz = plzConflict(fa, fb);
  if (plz) return plz;
  if (fa.precise && fb.precise && a.latitude != null && b.latitude != null &&
      haversineDistance(a.latitude, a.longitude!, b.latitude, b.longitude!) > MAX_PIN_ERROR_M) {
    return 'different_place';
  }
  return null;
}

/** Beide Namen sind amtliche Gemeinden, und zwar verschiedene. */
function differentGemeinden(a: string, b: string): boolean {
  const ga = new Set(gemeindenByName(a).map(g => `${g.name}|${g.bundesland}`));
  const gb = gemeindenByName(b).map(g => `${g.name}|${g.bundesland}`);
  return ga.size > 0 && gb.length > 0 && !gb.some(g => ga.has(g));
}

function plzConflict(fa: Features, fb: Features): string | null {
  if (!fa.plz || !fb.plz || fa.plz === fb.plz) return null;
  if (fa.plz[0] !== fb.plz[0]) return 'different_plz_region';
  if (fa.gemeinden.size > 0 && fb.gemeinden.size > 0 && ![...fa.gemeinden].some(g => fb.gemeinden.has(g))) {
    return 'different_gemeinde';
  }
  return null;
}

/**
 * Reihenfolge der Belege:
 *  1. Venue-Id beider Seiten (verschiedene Ids am selben Pin: Registry-Doppel)
 *  2. beide Pins genau: ≤ 250 m derselbe Ort, ≤ 1 km je nach Venue-Name,
 *     bis 5 km nur in derselben PLZ (ein Pin liegt daneben), sonst
 *     Widerspruch — schlägt Bezirks-Etiketten (die sind bei manchen Quellen
 *     falsch, z. B. 1140 Penzing als „tulln")
 *  3. klar verschiedene Venue-Namen → Widerspruch
 *  4. verschiedener Bezirk / PLZ-Gebiet → Widerspruch
 *  5. Venue-Name enthält den anderen → derselbe Ort
 *  6. gleicher Ort im weiteren Sinn (PLZ, Gemeinde, Pins ≤ 3 km, Bezirk)
 */
export interface PlaceOptions {
  /** Bezirks-, PLZ- und Ortsnamen-Etiketten überspringen (verwaiste Altzeilen,
   *  Freigabe-Prüfung): zählt nur, was Venue, Pin und Ortsname belegen. */
  ignoreLabels?: boolean;
}

export function placeEvidence(a: EventRow, b: EventRow, opts: PlaceOptions = {}): PlaceEvidence {
  const fa = features(a);
  const fb = features(b);
  const hasCoords = a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null;
  const dist = hasCoords ? haversineDistance(a.latitude!, a.longitude!, b.latitude!, b.longitude!) : null;
  const bothPrecise = fa.precise && fb.precise && dist !== null;

  if (a.venue_id && b.venue_id) {
    if (a.venue_id === b.venue_id) return { relation: 'same', reason: 'venue_id' };
    // Zwei Venue-Datensätze am selben Pin (Registry-Doppel, z. B. „Dom im Berg").
    if (!(bothPrecise && dist! <= SAME_PLACE_M)) return { relation: 'conflict', reason: 'different_venue_id' };
  }

  const venue = venueRelation(fa.venue, fb.venue);
  const samePlz = !!fa.plz && fa.plz === fb.plz;

  // Dieselbe Straße mit Hausnummer in derselben (oder unbekannter) PLZ ist
  // derselbe Ort, auch wenn eine Quelle die Adresse als Ortsnamen führt
  // („Arthofer Arena" / „Karlingerstraße 6", Stichprobe 2026-10-09).
  const addrB = new Set(addressKey(b));
  if ((opts.ignoreLabels || samePlz || !fa.plz || !fb.plz) && addressKey(a).some(k => addrB.has(k))) return { relation: 'same', reason: 'address' };

  if (bothPrecise) {
    if (venue === 'differs') return { relation: 'conflict', reason: 'different_venue' };
    if (dist! <= SAME_PLACE_M) return { relation: 'same', reason: 'coords' };
    if (dist! <= DIFFERENT_PLACE_M) {
      return venue === 'same' || venue === 'generic' || venue === 'related'
        ? { relation: 'same', reason: 'coords_venue' }
        : { relation: 'town', reason: 'coords_near' };
    }
    // Auch „genaue" Pins liegen bei derselben Veranstaltung teils km daneben
    // (Posthof Linz 3,4 km, Steyr 1,2 km, Prod 2026-10-07). Innerhalb derselben
    // PLZ entscheiden Venue-Name bzw. Gemeinde; sonst widersprechen sie sich.
    if (dist! <= MAX_PIN_ERROR_M && samePlz) {
      return venue === 'same'
        ? { relation: 'same', reason: 'venue_name_pin_off' }
        : { relation: 'town', reason: 'plz_pin_off' };
    }
    return { relation: 'conflict', reason: 'different_place' };
  }

  if (venue === 'differs') return { relation: 'conflict', reason: 'different_venue' };
  const townA = fa.venue.townKey;
  const townB = fb.venue.townKey;
  if (!opts.ignoreLabels) {
    if (fa.district && fb.district && fa.district !== fb.district) {
      return { relation: 'conflict', reason: 'different_district' };
    }
    const plz = plzConflict(fa, fb);
    if (plz) return { relation: 'conflict', reason: plz };
    // Nur Ortsnamen statt Venue, verschiedene Gemeinden („Kirchberg an der
    // Raab" / „Feldbach"). Kein Widerspruch: Ortsteil und Gemeinde
    // („Schleinbach" / „Ulrichskirchen-Schleinbach"), nicht auflösbare
    // Ortsteile und gleiche PLZ (Gemeinde-Kalender setzen ihren eigenen Namen).
    if (townA && townB && townA !== townB && !samePlz && !townA.includes(townB) && !townB.includes(townA) &&
        differentGemeinden(fa.venue.townRaw, fb.venue.townRaw)) {
      return { relation: 'conflict', reason: 'different_town' };
    }
  }

  // Verschiedene PLZ, die nur mehrere Gemeinden teilen (5251 Höhnhart / 5252
  // Aspach), belegen keinen gemeinsamen Ort; eine Seite muss eindeutig sein.
  const sameGemeinde = fa.gemeinden.size > 0 && [...fa.gemeinden].some(g => fb.gemeinden.has(g)) &&
    (samePlz || fa.gemeinden.size === 1 || fb.gemeinden.size === 1);
  // Ohne Etiketten zählen auch die daraus abgeleiteten Gemeinde-Mittelpunkte
  // nicht (falsch konfigurierte Gemeinde-Kalender: „Buch in Tirol" für Buch
  // in Vorarlberg, Stichprobe 2026-10-09).
  const resolvedDist = !opts.ignoreLabels && hasResolvedCoords(a) && hasResolvedCoords(b) ? dist : null;
  if (resolvedDist !== null && resolvedDist > 15_000 && !samePlz && !sameGemeinde) {
    return { relation: 'conflict', reason: 'different_place' };
  }

  if (venue === 'same') return { relation: 'same', reason: 'venue_name' };
  // „Pfarrkirche"/„Pfarrkirche": nur eindeutig, wenn die PLZ genau eine
  // Gemeinde umfasst (7540 sind sechs Gemeinden mit je einer Pfarrkirche).
  if (venue === 'generic' && samePlz && fa.gemeinden.size === 1) return { relation: 'same', reason: 'venue_name_generic' };
  if (samePlz) return { relation: 'town', reason: 'plz' };
  if (sameGemeinde) return { relation: 'town', reason: 'gemeinde' };
  if (townA && townA === townB) return { relation: 'town', reason: 'town_name' };
  if (resolvedDist !== null && resolvedDist <= 3000) return { relation: 'town', reason: 'coords_town' };
  // Der Bezirk ist ein Etikett; ohne Etiketten belegt er keinen gemeinsamen Ort
  // (Halloween-Party Pfaffenhofen ≠ Telfs, Stichprobe 2026-10-09).
  if (!opts.ignoreLabels && fa.district && fa.district === fb.district) return { relation: 'town', reason: 'district' };
  if (venue === 'related') return { relation: 'town', reason: 'venue_related' };
  return { relation: 'unknown', reason: 'none' };
}

export function placeRelation(a: EventRow, b: EventRow): PlaceRelation {
  return placeEvidence(a, b).relation;
}

/** Keinerlei Ortsangabe (weder Venue, Pin, PLZ noch Bezirk). */
export function isPlaceless(e: EventRow): boolean {
  return !e.venue_id && !(e.location_name ?? '').trim() && e.latitude == null &&
    !(e.postal_code ?? '').trim() && !(e.district ?? '').trim();
}
