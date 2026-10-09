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
  'events-nach-tag', 'termine-nach-tag',
]);

/** Jahr, Jahr-Monat oder Datum als Pfadteil (Monats-/Tagesansicht einer Liste). */
const DATE_SEGMENT = /^(19|20)\d{2}(-\d{2}){0,2}$/;
/** Pfadteile, nach denen eine Zahl die Seitenzahl ist („…/liste/seite/2"). */
const PAGER_WORDS = new Set(['seite', 'page', 'liste', 'list']);

/** Abfrage nur zum Blättern („?pno=2", „?currentpage=3", „?page=2"). */
const PAGING_QUERY = /^\??(?:(?:pno|page|seite|currentpage|paged|p_page|offset|start|month|monat|day|tag|date|datum|year|jahr)=[\d-]+&?)+$/i;

/**
 * Link auf genau ein Event, nicht auf eine Shop-Startseite, Tour-/
 * Terminliste oder Blätterseite („oeticket.com/", „…/tour/2026",
 * „…/events/liste/seite/2", „…/termine/?pno=2"), die viele Events teilen.
 */
export function isEventSpecificUrl(normalized: string): boolean {
  let url: URL;
  try { url = new URL(normalized); } catch { return false; }
  const parts = url.pathname.split('/').filter(Boolean).map(s => s.toLowerCase());
  if (url.search.length > 1 && !PAGING_QUERY.test(url.search)) return true;
  // „unser-<ort>" ist ein Navigationsbereich (Kärntner Gemeinde-Websites), ein
  // Pfadteil ohne Buchstaben und Ziffern („-") kein Inhalt.
  return parts.some((s, i) => !LIST_URL_SEGMENTS.has(s) && !DATE_SEGMENT.test(s) && !/^unser-/.test(s) &&
    /[\p{L}\p{N}]/u.test(s) &&
    !(/^\d{1,3}$/.test(s) && PAGER_WORDS.has(parts[i - 1] ?? '')));
}
