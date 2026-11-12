/**
 * Wiederholung bei vollem Verbindungspool von PostgREST (PGRST003,
 * „Timed out acquiring connection from connection pool“).
 *
 * Prod 2026-11-11, 13:48 UTC: rund 25 Sekunden lang beantwortete PostgREST
 * jede Anfrage mit 504 (572 in einer Minute, fast alle von der Website).
 * Solche Wellen gab es seit 09.11. fünfmal. Die Bildprüfung lief hinein,
 * brach beim ersten Update ab und machte den AT-Nachtlauf rot. Ein voller
 * Pool sagt nichts über die Anfrage: dieselbe Anfrage gelingt kurz danach.
 * Jeder andere Fehler geht sofort an den Aufrufer zurück.
 */

interface WithError {
  error: { message?: string; code?: string } | null;
}

/** Pausen vor dem 2., 3. und 4. Versuch: zusammen länger als eine Welle. */
export const POOL_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;

export function isPoolTimeout(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST003' || /acquiring connection from connection pool/i.test(error.message ?? '');
}

export interface PoolRetryOptions {
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

/**
 * Führt `run` aus und wiederholt nur bei vollem Pool. Gibt das letzte
 * Ergebnis zurück, der Aufrufer prüft `error` wie bisher.
 */
export async function retryOnPoolTimeout<T extends WithError>(
  run: () => PromiseLike<T>,
  options: PoolRetryOptions = {},
): Promise<T> {
  const delays = options.delaysMs ?? POOL_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const log = options.log ?? console.log;
  let result = await run();
  for (let attempt = 0; attempt < delays.length && isPoolTimeout(result.error); attempt++) {
    log(`[pool-retry] Verbindungspool voll, Versuch ${attempt + 2} in ${delays[attempt] / 1000} s`);
    await sleep(delays[attempt]);
    result = await run();
  }
  return result;
}
