/**
 * Erkennt, ob ein Gemini-Fehler das erschöpfte Tageskontingent ist.
 *
 * REIN — nur Formprüfung, kein I/O.
 *
 * WARUM DAS GEBRAUCHT WIRD
 * ────────────────────────
 * Der Gemini-Key läuft auf dem Free Tier: 10.000 Requests pro Tag und
 * Modell. Ist das Kontingent leer, antwortet die API mit HTTP 429 und
 * `status: "RESOURCE_EXHAUSTED"` — und zwar bis zum Reset am nächsten
 * Tag, nicht nur für einen Moment.
 *
 * Am 2026-09-07 lief der Concierge deshalb ab dem frühen Nachmittag in
 * die generische Meldung "Concierge-Chat derzeit nicht verfügbar".
 * Weder Nutzer noch Betreiber konnten daraus ablesen, dass ein
 * Batch-Job (die DE→EN-Übersetzung, gleicher Key) das Kontingent
 * aufgebraucht hatte — der Fehler sah aus wie eine kurze Störung und war
 * in Wahrheit ein Zustand für den Rest des Tages.
 *
 * Ein erschöpftes Kontingent ist keine Störung, sondern eine Grenze.
 * Das gehört anders formuliert als ein Ausfall.
 */

/** Feldnamen, die die Gemini-SDK bei einem Kontingentfehler mitschickt. */
const QUOTA_MARKERS = [
  'RESOURCE_EXHAUSTED',
  'exceeded your current quota',
  'generate_requests_per_model_per_day',
];

export function isQuotaExhausted(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Die SDK legt den HTTP-Status als `status` auf den Fehler.
  const status = (error as { status?: unknown }).status;
  if (status === 429) return true;

  // Fallback über den Text: die SDK verpackt die JSON-Antwort der API in
  // `message`, dort steht "RESOURCE_EXHAUSTED" bzw. der Quota-Hinweis.
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return false;
  return QUOTA_MARKERS.some(marker => message.includes(marker));
}
