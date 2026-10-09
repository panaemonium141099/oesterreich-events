// src/lib/pipeline/event-url.ts

/**
 * Event-Links für Dedup und Müll-Filter: Normalisierung und die Frage, ob
 * ein Link auf genau ein Event zeigt.
 */

import { normalizeUrl } from '@/lib/pipeline/normalize-url';

export function normalizeUrlForDedup(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const normalized = normalizeUrl(url);
    return normalized ? normalized.toLowerCase() : url.toLowerCase().trim();
  } catch {
    return (url ?? '').toLowerCase().trim();
  }
}

/** Pfadteile von Listen- und Shop-Seiten, die viele Events teilen. */
const LIST_URL_SEGMENTS = new Set([
  'de', 'en', 'at', 'home', 'index', 'index.html', 'index.php', 'shop', 'tickets', 'ticket', 'tour', 'tours',
  'tourdaten', 'dates', 'live', 'events', 'event', 'termine', 'termin', 'veranstaltungen', 'veranstaltung',
  'veranstaltungskalender', 'veranstaltungstermine', 'kalender', 'eventkalender', 'programm', 'spielplan', 'konzerte',
  // Blätter-, Monats- und Kategorieseiten von Listen (Stichprobe 2026-10-09)
  'liste', 'list', 'seite', 'page', 'monat', 'woche', 'event-category', 'kategorie', 'category', 'archiv',
  'uebersicht', 'übersicht', 'alle', 'aktuelles', 'unsere-gemeinde', 'gemeinde', 'stadt', 'buergerservice',
  'events-nach-tag', 'termine-nach-tag', 'listenansicht', 'kundmachungen', 'news', 'neuigkeiten',
  'veranstaltungen-termine', 'termine-veranstaltungen',
]);

/** Jahr, Jahr-Monat oder Datum als Pfadteil (Monats-/Tagesansicht einer Liste). */
const DATE_SEGMENT = /^(19|20)\d{2}(-\d{2}){0,2}$/;
/** Pfadteile, nach denen eine Zahl die Seitenzahl ist („…/liste/seite/2"). */
const PAGER_WORDS = new Set(['seite', 'page', 'liste', 'list']);

/** Abfrage-Parameter von Listen: Blättern, Monat/Tag, Sprache, Menü, Ansicht
 *  („?pno=2", „?month=202609", „veranstaltung.aspx?sprache=1",
 *  „?ajaxCalendar=1&mo=9&yr=2026", „?eventDisplay=past", gem2go „?menuonr=…"). */
const LIST_PARAMS = new Set([
  'pno', 'page', 'seite', 'currentpage', 'paged', 'p_page', 'offset', 'start', 'month', 'monat', 'day', 'tag', 'date',
  'datum', 'year', 'jahr', 'menuonr', 'sprache', 'typ', 'lang', 'language', 'ajaxcalendar', 'mo', 'yr', 'eventdisplay',
  'view', 'ansicht', 'kategorie', 'category', 'cat', 'chash',
]);

/** Name eines Abfrage-Parameters, bei TYPO3-Arrays der letzte Teil
 *  („tx_tulln_events[@widget_1][currentPage]" → „currentpage"). */
const paramName = (k: string) => k.toLowerCase().replace(/^.*\[([^\]]*)\]$/, '$1');

/** Bild statt Seite (Anhang-Link einer Liste). */
const IMAGE_PATH = /\.(?:png|jpe?g|gif|webp|svg)$/i;

/**
 * Link auf genau ein Event, nicht auf eine Shop-Startseite, Tour-/
 * Terminliste oder Blätterseite („oeticket.com/", „…/tour/2026",
 * „…/events/liste/seite/2", „…/termine/?pno=2"), die viele Events teilen.
 */
export function isEventSpecificUrl(normalized: string): boolean {
  let url: URL;
  try { url = new URL(normalized); } catch { return false; }
  const parts = url.pathname.split('/').filter(Boolean).map(s => s.toLowerCase());
  if (IMAGE_PATH.test(url.pathname)) return false;
  if ([...url.searchParams.keys()].some(k => !LIST_PARAMS.has(paramName(k)))) return true;
  // Endet der Pfad mit einem Listen-Teil, ist es die Liste eines Bereichs
  // („…/keramik/veranstaltungen/", „…/aktiv-in-hard/veranstaltungen/").
  if (LIST_URL_SEGMENTS.has(parts[parts.length - 1] ?? '')) return false;
  // „unser-<ort>" ist ein Navigationsbereich (Kärntner Gemeinde-Websites), ein
  // Pfadteil ohne Buchstaben und Ziffern („-") kein Inhalt.
  return parts.some((s, i) => !LIST_URL_SEGMENTS.has(s) && !DATE_SEGMENT.test(s) && !/^unser-/.test(s) &&
    /[\p{L}\p{N}]/u.test(s) &&
    !(/^\d{1,3}$/.test(s) && PAGER_WORDS.has(parts[i - 1] ?? '')));
}
