/**
 * Bulk-Update Helper für Pipeline-Scripts.
 *
 * Statt N Single-Row UPDATEs gegen `events` zu feuern (N PostgREST-
 * Round-Trips, N Query-Plans, N Row-Locks), sammelt dieser Helper
 * Updates in einer Queue und schickt sie als jsonb-Batch an eine der
 * `bulk_update_event_*` RPCs.
 *
 * Vor dem Refactor:
 *   for (const event of events) {
 *     await supabase.from('events').update({...}).eq('id', event.id);
 *   }
 *   // = N Round-Trips × ~2-200ms = stundenlanger Pipeline-Lauf
 *
 * Nach dem Refactor:
 *   const u = makeBulkUpdater(supabase, 'bulk_update_event_geocoding');
 *   for (const event of events) {
 *     await u.add({ id: event.id, latitude: ..., longitude: ... });
 *   }
 *   await u.flush();
 *   // = N/500 Round-Trips × ~50-200ms = Minuten statt Stunden
 *
 * Genutzt von:
 *   - normalize-locations.ts        → bulk_update_event_geocoding
 *   - fix-geocoding.ts              → bulk_update_event_geocoding
 *   - openai-geocode.ts             → bulk_update_event_geocoding
 *   - enrich-openai.ts              → bulk_update_event_enrichment
 *   - enrich-claude-cli.ts          → bulk_update_event_enrichment
 *   - backfill-slugs.ts             → bulk_update_event_slugs
 *   - backfill-quality.ts           → bulk_update_event_publish
 *
 * RPCs sind in supabase/migrations/20260428230000_bulk_update_event_rpcs.sql
 * + 20260428230100_bulk_update_event_rpcs_v2.sql (mit korrigierten Types).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type BulkRpcName =
  | 'bulk_update_event_scores'
  | 'bulk_update_event_geocoding'
  | 'bulk_update_event_enrichment'
  | 'bulk_update_event_slugs'
  | 'bulk_update_event_publish'
  | 'bulk_replace_event_quality_flags'
  | 'bulk_upsert_event_quality_scores';

export interface BulkUpdaterOptions {
  /** Ziel-RPC (muss in der DB existieren). */
  rpc: BulkRpcName;
  /** Supabase service-role Client. */
  supabase: SupabaseClient;
  /** Wie groß ein Batch werden darf bevor automatisch geflusht wird. Default 500. */
  flushSize?: number;
  /** Optionaler Logger statt console.log (für ruhige Scripts). */
  log?: (msg: string) => void;
  /** Soft-fail bei Errors (logged + counted) statt throw. Default false. */
  softFail?: boolean;
}

export interface BulkUpdaterStats {
  enqueued: number;
  flushed: number;
  affected: number;
  flushes: number;
  retries: number;
  errors: number;
}

/** Marker — heißt: alle Felder mit `id`-Schlüssel + Payload-Felder. */
export type BulkUpdateRow = { id: string; [key: string]: unknown };

/**
 * Sammelt Update-Rows und flusht sie als RPC-Batches.
 *
 * Threadsafe genug für concurrent Workers in Single-Threaded Node:
 *   - `queue()` ist synchron-genug — kein await zwischen push und length-check.
 *   - `flush()` swap-out array atomic, danach kein State-Race.
 */
export class BulkUpdater {
  private queue: BulkUpdateRow[] = [];
  readonly stats: BulkUpdaterStats = {
    enqueued: 0, flushed: 0, affected: 0, flushes: 0, retries: 0, errors: 0,
  };

  constructor(private readonly opts: BulkUpdaterOptions) {
    if (!opts.supabase) throw new Error('BulkUpdater: supabase client required');
    if (!opts.rpc) throw new Error('BulkUpdater: rpc name required');
  }

  /**
   * Row in die Queue legen. Wenn flushSize erreicht, wird automatisch geflusht.
   * Achtung: ein implizites Auto-Flush wartet auf den RPC-Round-Trip.
   */
  async add(row: BulkUpdateRow): Promise<void> {
    if (!row.id) throw new Error('BulkUpdater.add: row.id is required');
    this.queue.push(row);
    this.stats.enqueued++;
    if (this.queue.length >= (this.opts.flushSize ?? 500)) {
      await this.flush();
    }
  }

  /**
   * Forciert einen Flush — am Ende des Scripts/Workers MUSS einmal aufgerufen werden,
   * um die letzten <500 Rows rauszuschicken.
   * Returns Anzahl der wirklich in der DB upgedateten Rows.
   */
  async flush(): Promise<number> {
    if (this.queue.length === 0) return 0;
    const batch = this.queue.splice(0, this.queue.length);
    this.stats.flushes++;

    // 3-attempt retry mit exponential backoff bei transienten Fehlern
    // (gleiche Heuristik wie enrich-openai.ts und calculate-scores.ts).
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await this.opts.supabase.rpc(this.opts.rpc, {
        p_updates: batch,
      });
      if (!error) {
        const affected = typeof data === 'number' ? data : batch.length;
        this.stats.flushed += batch.length;
        this.stats.affected += affected;
        return affected;
      }
      lastError = error;
      const msg = error.message ?? String(error);
      const isTransient =
        msg.includes('502') || msg.includes('504') ||
        msg.includes('Bad gateway') || msg.includes('fetch failed') ||
        msg.includes('timeout') || msg.includes('ECONN');
      if (!isTransient || attempt >= 3) break;
      this.stats.retries++;
      const wait = Math.min(15000 * attempt, 30000);
      this.log(`[bulk-update:${this.opts.rpc}] transient error, retry ${attempt}/3 in ${wait}ms: ${msg.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, wait));
    }

    // Alle 3 Versuche durch → entweder hard-fail oder soft-fail
    this.stats.errors++;
    this.log(`[bulk-update:${this.opts.rpc}] failed after 3 attempts (batch=${batch.length}): ${(lastError as Error)?.message ?? lastError}`);
    if (!this.opts.softFail) {
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    return 0;
  }

  /** Pending Queue-Länge (für Progress-Logs). */
  get pending(): number {
    return this.queue.length;
  }

  private log(msg: string): void {
    (this.opts.log ?? console.log)(msg);
  }
}

/**
 * Convenience-Factory: erzeugt BulkUpdater pro RPC mit Default-Settings.
 * Beispiel:
 *   const updater = makeBulkUpdater(supabase, 'bulk_update_event_geocoding');
 *   await updater.add({ id, latitude, longitude });
 *   ...
 *   await updater.flush();
 *   console.log(updater.stats);
 */
export function makeBulkUpdater(
  supabase: SupabaseClient,
  rpc: BulkRpcName,
  overrides?: Partial<BulkUpdaterOptions>,
): BulkUpdater {
  return new BulkUpdater({ supabase, rpc, ...overrides });
}
