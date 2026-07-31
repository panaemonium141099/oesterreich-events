/**
 * In-Memory-TTL-Cache für identische Smart-Suche-Queries — per
 * Function-Instance, gleiche Begründung wie rate-limit.ts: mit Vercel
 * Fluid Compute werden Instances über Requests hinweg wiederverwendet,
 * der Cache lebt also solange die Instance läuft. Cold Start = leer;
 * das ist als Best-Effort-Schutz für den Gemini-Intent-Call gedacht
 * (Doppel-Submits, Sample-Query-Chips, Back-Navigation), nicht als
 * verteilter Cache. Für mehr später Upstash — gleiches Interface.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private map = new Map<string, CacheEntry<T>>();

  constructor(
    private ttlMs: number,
    private maxEntries: number = 300,
  ) {}

  get(key: string, now: number = Date.now()): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (now >= entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, now: number = Date.now()): void {
    // delete-before-set schiebt den Key ans Insertion-Ende — der älteste
    // Eintrag ist damit immer der erste Key der Map (billige Eviction
    // ohne LRU-Bookkeeping; Re-Set zählt als "frisch").
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: now + this.ttlMs });
    if (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}
