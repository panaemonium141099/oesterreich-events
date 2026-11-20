/**
 * Schutz für teure App-Endpunkte (Startseite, Entdecken-Übersicht).
 *
 * Eine Ausgabe sind viele Datenbank-Abfragen. Scheitert sie, weil die
 * Datenbank gerade überlastet ist (Deploy-Build auf demselben Server,
 * 2026-11-20: Startseite lief 15 s in die Zeitgrenze), darf nicht jede
 * weitere App-Anfrage dieselben Abfragen noch einmal losschicken und die
 * Last vergrößern. Deshalb:
 *
 *  - gleichzeitige Anfragen teilen sich einen Lauf,
 *  - nach einem Fehlschlag gibt es eine Pause, in der gar nicht geladen wird,
 *  - solange es eine letzte gelungene Antwort gibt, bekommt die App diese
 *    (als `stale` markiert) statt eines Fehlers.
 *
 * Der Zustand lebt im Speicher des Serverprozesses: nach einem Neustart
 * gibt es bis zum ersten gelungenen Lauf keine letzte Antwort.
 */
export interface ResilientResult<T> {
  value: T;
  /** Die Antwort ist die letzte gelungene, der aktuelle Lauf ist gescheitert. */
  stale: boolean;
}

export interface ResilientOptions {
  /** Pause nach einem Fehlschlag, in der nicht neu geladen wird. */
  retryAfterMs?: number;
  /** Uhr, für Tests. */
  now?: () => number;
}

export const DEFAULT_RETRY_AFTER_MS = 60_000;

export function resilient<T>(
  load: () => Promise<T>,
  { retryAfterMs = DEFAULT_RETRY_AFTER_MS, now = Date.now }: ResilientOptions = {},
): () => Promise<ResilientResult<T>> {
  let last: { value: T } | null = null;
  let failedAt: number | null = null;
  let lastError: unknown = null;
  let inflight: Promise<T> | null = null;

  const fallback = (error: unknown): ResilientResult<T> => {
    if (last) return { value: last.value, stale: true };
    throw error;
  };

  return async () => {
    if (failedAt !== null && now() - failedAt < retryAfterMs) return fallback(lastError);

    inflight ??= load().finally(() => {
      inflight = null;
    });
    try {
      const value = await inflight;
      last = { value };
      failedAt = null;
      return { value, stale: false };
    } catch (error) {
      failedAt = now();
      lastError = error;
      return fallback(error);
    }
  };
}
