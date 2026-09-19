/**
 * Handoff für den Smart-Suche-Deep-Link (2026-09-19).
 *
 * `/entdecken?mode=smart&q=…` hat die Gemini-Anfrage bisher beim Laden
 * automatisch abgeschickt. Ein Headless-Crawler, der ab 13.09. jedem Link
 * der Gemeinde-Hubs folgte, hat so ~1.000 Concierge-Anfragen pro Tag auf
 * unsere Kosten ausgelöst (Gemini-Kontingent ist geteilt).
 *
 * Deshalb startet die Suche nur noch automatisch, wenn der Deep-Link
 * innerhalb der App angeklickt wurde: der CTA merkt sich die Query in
 * sessionStorage, der Chat löst den Vermerk beim Mounten ein. Wer die URL
 * direkt aufruft (Lesezeichen, geteilter Link, Crawler), bekommt die Query
 * nur vorbefüllt und schickt sie selbst ab.
 *
 * sessionStorage statt document.referrer, weil der Referrer bei
 * Client-Navigation (next/link) auf dem Wert des Erstaufrufs stehen bleibt
 * (Google → Gemeinde-Hub → CTA hätte sonst nie automatisch gestartet).
 */

const KEY = 'lt.smart.autorun';

/** Vom CTA beim Klick aufgerufen: diese Query darf beim Mount starten. */
export function markSmartAutorun(query: string): void {
  try {
    window.sessionStorage.setItem(KEY, query.trim());
  } catch {
    /* Storage gesperrt (privater Modus, Policy) — dann eben ohne Auto-Start */
  }
}

/** Vom Chat beim Mount aufgerufen: löst den Vermerk ein (einmalig). */
export function consumeSmartAutorun(query: string): boolean {
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored === null) return false;
    window.sessionStorage.removeItem(KEY);
    return stored === query.trim();
  } catch {
    return false;
  }
}
