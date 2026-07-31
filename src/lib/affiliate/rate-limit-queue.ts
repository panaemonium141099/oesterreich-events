/**
 * Rollierende Rate-Limit-Queue (fn-18 Task 5).
 *
 * Viator Basic Access erlaubt ~150 Requests pro 10 s ROLLIEREND (nicht
 * pro festem Bucket) — ein Fixed-Window-Zaehler wuerde an der Fenster-
 * Grenze bis zu 300 Requests in 10 s durchlassen und 429er provozieren.
 * Diese Queue merkt sich daher die Zeitstempel der letzten Freigaben und
 * laesst einen neuen Request erst zu, wenn im zurueckliegenden Fenster
 * weniger als `limit` Freigaben liegen.
 *
 * Die Freigabe selbst ist serialisiert (Promise-Kette): parallele
 * Aufrufer koennen nicht gleichzeitig denselben freien Slot sehen.
 * Die eigentlichen Requests laufen danach nebenlaeufig weiter.
 *
 * `now`/`sleep` sind injizierbar, damit Tests mit einer virtuellen Uhr
 * deterministisch und ohne echte Wartezeiten laufen.
 */

export interface RateLimitQueueOptions {
  /** Max. Freigaben pro Fenster. */
  limit: number;
  /** Fensterbreite in Millisekunden. */
  windowMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class RateLimitQueue {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** Zeitstempel der Freigaben im aktuellen Fenster (aufsteigend). */
  private grants: number[] = [];
  /** Serialisiert die Slot-Vergabe. */
  private chain: Promise<void> = Promise.resolve();

  constructor(options: RateLimitQueueOptions) {
    if (options.limit < 1) throw new Error('RateLimitQueue: limit muss >= 1 sein');
    if (options.windowMs < 1) throw new Error('RateLimitQueue: windowMs muss >= 1 sein');
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? defaultSleep;
  }

  /** Wartet auf einen freien Slot und fuehrt `fn` dann aus. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }

  /** Anzahl der Freigaben im aktuellen Fenster (Diagnose/Tests). */
  get inFlightWindow(): number {
    const cutoff = this.now() - this.windowMs;
    return this.grants.filter((t) => t > cutoff).length;
  }

  private acquire(): Promise<void> {
    const next = this.chain.then(() => this.waitForSlot());
    // Fehler in einem Warte-Schritt duerfen die Kette nicht vergiften.
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async waitForSlot(): Promise<void> {
    for (;;) {
      const now = this.now();
      const cutoff = now - this.windowMs;
      this.grants = this.grants.filter((t) => t > cutoff);

      if (this.grants.length < this.limit) {
        this.grants.push(now);
        return;
      }

      // Der aelteste Grant faellt bei `oldest + windowMs` aus dem Fenster.
      const oldest = this.grants[0]!;
      const waitMs = Math.max(oldest + this.windowMs - now, 1);
      await this.sleep(waitMs);
    }
  }
}
