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
  'veranstaltungskalender', 'kalender', 'programm', 'spielplan', 'konzerte',
]);

/**
 * Link auf genau ein Event, nicht auf eine Shop-Startseite oder Tour-/
 * Terminliste („oeticket.com/", „…/tour/2026"), die viele Events teilen.
 */
export function isEventSpecificUrl(normalized: string): boolean {
  let url: URL;
  try { url = new URL(normalized); } catch { return false; }
  const parts = url.pathname.split('/').filter(Boolean).map(s => s.toLowerCase());
  if (url.search.length > 1) return true;
  return parts.some(s => !LIST_URL_SEGMENTS.has(s) && !/^(19|20)\d{2}$/.test(s));
}
