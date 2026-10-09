// src/lib/pipeline/garbage-filter.ts

import { isEventSpecificUrl, normalizeUrlForDedup } from './event-url';

/**
 * Garbage title filter — identifies non-event pages that scrapers accidentally pick up.
 * These get publish_status = 'suppressed' + flag 'garbage_title' before any dedup.
 */

const GARBAGE_TITLES = new Set([
  'oeffnungszeiten', 'offnungszeiten', 'öffnungszeiten', 'opening hours',
  'kontakt', 'contact', 'impressum', 'imprint',
  'datenschutz', 'datenschutzerklärung', 'datenschutzerklaerung', 'privacy', 'privacy policy',
  'agb', 'allgemeine geschäftsbedingungen', 'terms',
  'startseite', 'home', 'homepage', 'willkommen', 'welcome',
  'ueber uns', 'über uns', 'about', 'about us',
  'newsletter', 'anmeldung', 'registrierung', 'registration', 'sign up',
  'suche', 'search', 'sitemap', 'login', 'anmelden',
  'warenkorb', 'cart', 'checkout', 'zahlung', 'payment',
  'cookie', 'cookies', 'cookie einstellungen',
  'archiv', 'archive', 'kalender', 'calendar',
  'unterkünfte', 'unterkuenfte', 'accommodation',
  'anfahrt', 'directions', 'lageplan',
  'galerie', 'gallery', 'fotos', 'photos',
  'downloads', 'presse', 'press',
  'faq', 'hilfe', 'help',
  'jobs', 'karriere', 'career',
  'sponsoren', 'sponsors', 'partner',
  'mehr informationen', 'more information',
  'weitere informationen', 'details',
  'event',
  // Listen-Überschriften und Buttons, die der Gemeinde-Parser vor #275 als
  // Titel las (Befund 2026-10-06)
  'mehr infos', 'mehr info', 'mehr erfahren', 'weiterlesen',
  'gefundene veranstaltungen', 'suche ab',
  // Sprungmarken der Seitennavigation (Abschlussprüfung 2026-10-08)
  'zum footer', 'springe zum footer', 'zum inhalt', 'springe zum inhalt', 'zum hauptinhalt',
  'springe zum hauptinhalt', 'zur navigation', 'springe zur navigation', 'zur hauptnavigation',
  'springe zur hauptnavigation', 'nach oben', 'skip to content', 'skip to main content',
]);

/**
 * Einzelwörter, die bei Gemeinde-Kalendern nie ein Titel sind, sondern ein
 * Datums-Badge oder die Ortszeile einer Kachel. Anderswo können sie echt
 * sein: Eventim führt ein Stück namens "Montag" (Dschungel Wien).
 */
const GEMEINDE_TILE_WORDS = new Set([
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
  'heute', 'morgen', 'gemeindesaal',
]);
const GEMEINDE_AGGREGATORS = new Set([
  'gemeinden-generic', 'gem2go', 'gemeinde-registry', 'gemeinden', 'gemeinde-fallback',
]);

/**
 * Wörter reiner Datums- und Uhrzeitangaben. '' steht für ein Token, das nur
 * aus Ziffern bestand.
 */
const DATE_TOKENS = new Set([
  '',
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
  'mo', 'di', 'mi', 'do', 'fr', 'sa', 'so',
  'januar', 'jaenner', 'jänner', 'jän', 'februar', 'feber', 'maerz', 'märz', 'april', 'mai',
  'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  'jan', 'feb', 'mär', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'okt', 'nov', 'dez',
  'uhr', 'h', 'ab', 'bis', 'von', 'um', 'am', 'und',
]);

function normalizeTitle(title: string): string {
  return title
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uhrzeit („19:30", „19.30") oder Tag.Monat („15.10.") oder ISO-Datum. */
const DATE_TIME_SHAPE = /\d{1,2}[:.]\d{2}(?!\d)|\d{1,2}\.\s?\d{1,2}\.|\d{4}-\d{2}-\d{2}/;

/**
 * Nur Datum, Wochentag und Uhrzeit, kein Name: „Samstag, 24.10.2026, 13:00",
 * „Mi.19:30-21:00Uhr". Ziffern innerhalb eines Worts zählen nicht als Datum
 * („Ufo361" bleibt ein Name), bloße Zahlen ohne Datums- oder Uhrzeitform
 * auch nicht („17 & 18", „1984" sind Stücktitel).
 */
export function isDateOnlyText(title: string | null | undefined): boolean {
  const tokens = normalizeTitle(title ?? '').split(' ');
  if (!tokens.every(t => DATE_TOKENS.has(t.replace(/\d/g, '')))) return false;
  const onlyNumbers = tokens.every(t => t.replace(/\d/g, '') === '') && tokens.some(t => t !== '');
  return !onlyNumbers || DATE_TIME_SHAPE.test(title ?? '');
}

export interface GarbageContext {
  sourceName?: string | null;
  /** Ein Link auf genau dieses Event (Ticket-Deeplink) belegt ein Event,
   *  auch wenn der Titel wie ein Navigationswort aussieht (Band „Archive"). */
  ticketUrl?: string | null;
}

/**
 * Check if a title (after normalization/lowercasing) is a garbage non-event page.
 */
export function isGarbageTitle(title: string, context: GarbageContext = {}): boolean {
  // Badge-Leiste statt Titel: Kartentext wie "Event\n   Pop / Rock\n …"
  // (partytimer 2026-09). Ein echter Titel bricht nie direkt nach "Event" um.
  if (/^\s*event[ \t]*[\r\n]/i.test(title)) return true;

  // Dateiname statt Titel (Anhang-Link der Gemeinde-Seite)
  if (/^\S+\.(pdf|jpe?g|png|gif|docx?|xlsx?)\s*$/i.test(title)) return true;

  const normalized = normalizeTitle(title);

  // Navigationswort statt Titel. Auf Prod (2026-10-08) kamen alle Treffer
  // von Gemeinde-Seiten ohne Ticket-Link; ein Link auf genau dieses Event
  // (Eventim „Archive", Gasometer) belegt dagegen ein echtes Event.
  if (GARBAGE_TITLES.has(normalized) && !hasEventLink(context.ticketUrl)) return true;

  // Feldbeschriftung statt Titel: "Datum der VeranstaltungMi,"
  if (normalized.startsWith('datum der veranstaltung')) return true;

  if (GEMEINDE_AGGREGATORS.has(context.sourceName ?? '') && GEMEINDE_TILE_WORDS.has(normalized)) return true;

  // Zeichenrest: ein Zeichen, oder zwei ohne Buchstabe-Ziffer-Paar
  // („U2", „Ö3" sind Namen).
  const hasDigit = /\d/.test(normalized);
  if (normalized.length < 2) return true;
  if (normalized.length === 2 && !(hasDigit && /\p{L}/u.test(normalized))) return true;

  // Datum/Uhrzeit statt Titel: „15.04.2026 15:00 - 17:00 Uhr", „15 Okt".
  // Ohne Ziffer ist ein Wochentag ein möglicher Name (Stück „Montag").
  if (hasDigit && isDateOnlyText(title)) return true;

  return false;
}

function hasEventLink(url: string | null | undefined): boolean {
  const normalized = normalizeUrlForDedup(url);
  return !!normalized && isEventSpecificUrl(normalized);
}

/**
 * Get all garbage titles for testing/admin display.
 */
export function getGarbageTitles(): ReadonlySet<string> {
  return GARBAGE_TITLES;
}
