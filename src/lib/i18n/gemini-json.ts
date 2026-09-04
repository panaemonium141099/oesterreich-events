/**
 * Gemeinsamer Gemini-Aufruf für die Übersetzungs-Pfade (fn-17).
 *
 * Timeout, Retry mit Backoff und die Fehler-Weitergabe waren zuerst nur in
 * `translate-event.ts` implementiert. Als die Freizeit-POIs dazukamen,
 * hätte das eine zweite Kopie derselben Schleife bedeutet — inklusive der
 * teuer erarbeiteten Details (Backoff gegen das Gemini-Fehlerfenster,
 * `onAttemptError`, damit ein Batch-Lauf die Ursache nennen kann). Deshalb
 * liegt die Mechanik hier und die Aufrufer bringen nur Prompt, Schema und
 * Parser mit.
 */

import { GoogleGenAI } from '@google/genai';

/** Default-Abbruch pro Versuch — das Render-Budget des Lazy-Pfads. */
export const DEFAULT_TIMEOUT_MS = 8000;

export interface TranslateOptions {
  /** Abbruch pro Versuch. Default 8 s. */
  timeoutMs?: number;
  /**
   * Zusätzliche Versuche nach einem Fehlschlag. Default 0.
   *
   * ~15-25 % der Calls schlagen transient fehl: Gemini degeneriert in
   * endlose Zeilenumbrüche bis `maxOutputTokens` (finishReason
   * MAX_TOKENS, abgeschnittenes JSON) oder blockt mit RECITATION bei
   * wörtlich von Veranstalterseiten übernommenen Texten. Bei Wiederholung
   * mit identischem Input geht der Großteil durch, deshalb nutzen die
   * Batch-Pfade retries=1. Der Lazy-Pfad bleibt bei 0: er rendert eine
   * Seite und fällt bei Fehlschlag folgenlos auf Deutsch zurück.
   */
  retries?: number;
  /**
   * Wartezeit vor jedem Wiederholungsversuch, verdoppelt sich je Versuch.
   *
   * Gemessen im Backfill am 2026-09-04: bei Concurrency 20 lief eine
   * Fehlerserie über ~470 aufeinanderfolgende Events, die sich von selbst
   * wieder fing — ein zeitlich begrenztes Fenster auf Gemini-Seite, kein
   * harter Deckel (25 parallele Test-Calls gingen währenddessen durch).
   * Ein sofortiger Retry fällt in genau dasselbe Fenster; mit Backoff
   * landet er dahinter. Default 0 — der Lazy-Pfad darf einen Render nicht
   * verzögern.
   */
  retryDelayMs?: number;
  /**
   * Wird bei jedem gescheiterten Versuch gerufen. Ohne diesen Haken
   * verschluckt der catch-Block die Ursache und ein Batch-Lauf meldet nur
   * eine Zahl — genau die Situation, in der man wissen will, ob es Quota,
   * Timeout oder kaputtes JSON war.
   */
  onAttemptError?: (reason: string, attempt: number) => void;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout> | null = null;
  return Promise.race<T | null>([
    p,
    new Promise<null>(resolve => {
      t = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => {
    if (t) clearTimeout(t);
  });
}

/**
 * Führt `request` aus und gibt das Ergebnis von `parse` zurück, sobald ein
 * Versuch etwas Verwertbares liefert. `null` heißt: alle Versuche
 * gescheitert — der Aufrufer fällt dann auf Deutsch zurück.
 *
 * `request` ist absichtlich untypisiert durchgereicht: die Signatur von
 * `models.generateContent` ist bei @google/genai generisch über den
 * Schema-Typ, und ein eigener Wrapper-Typ hier würde bei jedem
 * SDK-Update nachgezogen werden müssen, ohne etwas abzusichern.
 */
export async function generateJsonWithRetry<T>(
  apiKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any,
  parse: (text: string | undefined) => T | null,
  options: TranslateOptions = {},
): Promise<T | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = Math.max(1, (options.retries ?? 0) + 1);
  const retryDelayMs = options.retryDelayMs ?? 0;
  const ai = new GoogleGenAI({ apiKey });

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0 && retryDelayMs > 0) {
      await new Promise(r => setTimeout(r, retryDelayMs * 2 ** (attempt - 1)));
    }

    let resp: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let thrown: string | null = null;
    try {
      resp = await withTimeout(ai.models.generateContent(request), timeoutMs);
      if (resp === null) thrown = 'timeout';
    } catch (err) {
      thrown = err instanceof Error ? err.message : String(err);
    }

    const parsed = parse(resp?.text);
    if (parsed) return parsed;

    options.onAttemptError?.(
      thrown ?? `finishReason=${resp?.candidates?.[0]?.finishReason ?? 'unbekannt'}`,
      attempt,
    );
  }
  return null;
}
