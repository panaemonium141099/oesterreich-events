/**
 * Supabase-Implementierung des ActivityStore (fn-18, Task 2).
 *
 * Schreibt via Service-Role direkt in poi_activities / poi_activity_runs
 * (die Public-View poi_activities_public ist nur fuer Client-Reads der
 * spaeteren Tasks). Supabase Micro: alle Batches <=500 Rows, Prefetch-
 * .in()-Slices a 200 (Muster supabase-sync.ts:174-224), keine count(*)
 * exact — Mengen werden client-seitig aus den gelesenen Rows abgeleitet.
 *
 * Monotonie (Epic E6 / Ueberlappungsschutz Ebene 2): Sichtungs-Updates
 * filtern server-seitig auf `last_seen_run_seq < runSeq` bzw.
 * `last_seen_complete_run_seq < runSeq` (GREATEST-Semantik) — ein spaeter
 * fertig werdender aelterer Lauf trifft nur Rows, die kein neuerer Lauf
 * schon gestempelt hat, und kann daher weder Seq-Felder noch seen_regions
 * zuruecksetzen.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityStore,
  CompleteRunInfo,
  ExistingActivityRow,
  GroupMemberRow,
  RunPatch,
  SeenEntry,
} from './ingest';
import type { ActivityInsertRow, ActivityUpdateRow } from './ingest-transform';
import type { GroupUpdate } from './prune';

const TABLE = 'poi_activities';
const RUNS_TABLE = 'poi_activity_runs';

const WRITE_BATCH = 500; // Supabase Micro (MASTERPLAN §10)
const IN_BATCH = 200; // .in()-Slice-Groesse (supabase-sync-Muster)
const PAGE_SIZE = 1000; // PostgREST-Default-Limit fuer paged Reads

export function createActivityStoreClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL (oder SUPABASE_URL) und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function fail(op: string, message: string): never {
  throw new Error(`[activity-store] ${op}: ${message}`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class SupabaseActivityStore implements ActivityStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async createRun(): Promise<{ run_id: string; run_seq: number; started_at: string }> {
    const { data, error } = await this.supabase
      .from(RUNS_TABLE)
      .insert({ is_complete: false })
      .select('run_id, run_seq, started_at')
      .single();
    if (error || !data) fail('createRun', error?.message ?? 'no row returned');
    return data as { run_id: string; run_seq: number; started_at: string };
  }

  async updateRun(runId: string, patch: RunPatch): Promise<void> {
    const { error } = await this.supabase.from(RUNS_TABLE).update(patch).eq('run_id', runId);
    if (error) fail('updateRun', error.message);
  }

  async getRecentCompleteRuns(limit: number): Promise<CompleteRunInfo[]> {
    // complete_run = is_complete UND finished_at gesetzt (ein complete
    // markierter, aber abgebrochener Lauf zaehlt nicht als Prune-Schwelle).
    const { data, error } = await this.supabase
      .from(RUNS_TABLE)
      .select('run_seq, started_at')
      .eq('is_complete', true)
      .not('finished_at', 'is', null)
      .order('run_seq', { ascending: false })
      .limit(limit);
    if (error) fail('getRecentCompleteRuns', error.message);
    return (data ?? []) as CompleteRunInfo[];
  }

  async prefetchExisting(sourceIds: string[]): Promise<Map<string, ExistingActivityRow>> {
    const map = new Map<string, ExistingActivityRow>();
    for (const slice of chunk([...new Set(sourceIds)], IN_BATCH)) {
      const { data, error } = await this.supabase
        .from(TABLE)
        .select('id, source_id, slug, content_fingerprint')
        .eq('source', 'deskline')
        .in('source_id', slice);
      if (error) fail('prefetchExisting', error.message);
      for (const row of (data ?? []) as ExistingActivityRow[]) {
        map.set(row.source_id, row);
      }
    }
    return map;
  }

  async insertActivities(rows: ActivityInsertRow[]): Promise<Array<{ id: string; source_id: string }>> {
    const refs: Array<{ id: string; source_id: string }> = [];
    for (const batch of chunk(rows, WRITE_BATCH)) {
      const { data, error } = await this.supabase.from(TABLE).insert(batch).select('id, source_id');
      if (error) fail('insertActivities', error.message);
      refs.push(...((data ?? []) as Array<{ id: string; source_id: string }>));
    }
    return refs;
  }

  async updateActivities(rows: ActivityUpdateRow[]): Promise<void> {
    // Update-Pfad als Upsert ON CONFLICT (source, source_id): Rows
    // existieren garantiert (prefetchExisting), es feuert also immer der
    // UPDATE-Zweig mit exakt den Payload-Spalten. poi_activities-Rows
    // werden nie geloescht (nur visible=false), der INSERT-Zweig ist
    // damit unerreichbar.
    for (const batch of chunk(rows, WRITE_BATCH)) {
      const { error } = await this.supabase
        .from(TABLE)
        .upsert(batch, { onConflict: 'source,source_id' });
      if (error) fail('updateActivities', error.message);
    }
  }

  async markSeen(entries: SeenEntry[], runSeq: number, seenAtIso: string): Promise<void> {
    for (const batch of chunk(entries, WRITE_BATCH)) {
      // seen_regions-Union zur STEMPEL-Zeit: aktuelle seen_regions frisch
      // lesen und row-genau mergen (union-only) — NIE aus einem aelteren
      // Prefetch-Snapshot, sonst koennte ein Lauf die Regionen eines
      // parallel dazugekommenen Laufs ueberschreiben. Das Restfenster
      // zwischen Read und Update deckt der monotone last_seen_run_seq-
      // Filter plus die GH-concurrency-Group (Ebene 1) ab: ein AELTERER
      // spaeter schreibender Lauf trifft gestempelte Rows gar nicht mehr.
      const ids = batch.map((e) => e.id);
      const { data, error } = await this.supabase
        .from(TABLE)
        .select('id, seen_regions')
        .in('id', ids);
      if (error) fail('markSeen(read)', error.message);
      const liveRegions = new Map(
        ((data ?? []) as Array<{ id: string; seen_regions: string[] | null }>).map((r) => [
          r.id,
          r.seen_regions ?? [],
        ]),
      );

      // Identische Ziel-Unions buendeln (im Regelfall wenige distinkte
      // Regionen-Sets) -> wenige .in()-Updates statt Row-fuer-Row.
      const byUnion = new Map<string, { ids: string[]; regions: string[] }>();
      for (const entry of batch) {
        const union = [...new Set([...(liveRegions.get(entry.id) ?? []), ...entry.regions])].sort();
        const key = union.join('|');
        const group = byUnion.get(key);
        if (group) group.ids.push(entry.id);
        else byUnion.set(key, { ids: [entry.id], regions: union });
      }

      for (const group of byUnion.values()) {
        const { error: updateError } = await this.supabase
          .from(TABLE)
          .update({ last_seen_run_seq: runSeq, last_seen_at: seenAtIso, seen_regions: group.regions })
          .in('id', group.ids)
          .or(`last_seen_run_seq.is.null,last_seen_run_seq.lt.${runSeq}`);
        if (updateError) fail('markSeen', updateError.message);
      }
    }
  }

  async markSeenComplete(ids: string[], runSeq: number): Promise<void> {
    for (const batch of chunk(ids, WRITE_BATCH)) {
      const { error } = await this.supabase
        .from(TABLE)
        .update({ last_seen_complete_run_seq: runSeq })
        .in('id', batch)
        .or(`last_seen_complete_run_seq.is.null,last_seen_complete_run_seq.lt.${runSeq}`);
      if (error) fail('markSeenComplete', error.message);
    }
  }

  async fetchGroupMembers(fingerprints: string[]): Promise<GroupMemberRow[]> {
    const rows: GroupMemberRow[] = [];
    for (const slice of chunk(fingerprints, IN_BATCH)) {
      // Innerhalb einer Slice zusaetzlich paged lesen — theoretisch kann
      // eine Fingerprint-Menge > PAGE_SIZE Mitglieder haben.
      let from = 0;
      for (;;) {
        const { data, error } = await this.supabase
          .from(TABLE)
          .select('id, source_id, content_fingerprint, created_at, visible, duplicate_of, last_seen_complete_run_seq')
          .in('content_fingerprint', slice)
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) fail('fetchGroupMembers', error.message);
        const page = (data ?? []) as GroupMemberRow[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    }
    return rows;
  }

  async applyGroupUpdates(updates: GroupUpdate[]): Promise<void> {
    // Gleiche Payloads buendeln: Canonicals aller Gruppen teilen
    // {visible:true, duplicate_of:null}; Duplikate gruppieren sich pro
    // Canonical-Id. So bleiben es wenige .in()-Updates statt Row-fuer-Row.
    const byPayload = new Map<string, { visible: boolean; duplicate_of: string | null; ids: string[] }>();
    for (const u of updates) {
      const key = `${u.visible}|${u.duplicate_of ?? ''}`;
      const group = byPayload.get(key);
      if (group) group.ids.push(u.id);
      else byPayload.set(key, { visible: u.visible, duplicate_of: u.duplicate_of, ids: [u.id] });
    }
    for (const group of byPayload.values()) {
      for (const batch of chunk(group.ids, WRITE_BATCH)) {
        const { error } = await this.supabase
          .from(TABLE)
          .update({ visible: group.visible, duplicate_of: group.duplicate_of })
          .in('id', batch);
        if (error) fail('applyGroupUpdates', error.message);
      }
    }
  }

  async fetchPruneCandidates(
    thresholdSeq: number,
    thresholdStartedAtIso: string,
  ): Promise<Array<{ id: string; content_fingerprint: string }>> {
    // Tote Kandidaten: in den letzten 2 complete_runs ungesehen UND aelter
    // als der vorletzte complete_run (Young-Row-Guard server-seitig) UND
    // noch nicht fertig geprunt (visible ODER duplicate_of gesetzt) —
    // fertig geprunte Gruppen (visible=false, duplicate_of=null) tauchen
    // damit in spaeteren Laeufen nicht mehr als Kandidaten auf.
    const rows: Array<{ id: string; content_fingerprint: string }> = [];
    let from = 0;
    for (;;) {
      const { data, error } = await this.supabase
        .from(TABLE)
        .select('id, content_fingerprint')
        .or(`last_seen_complete_run_seq.is.null,last_seen_complete_run_seq.lt.${thresholdSeq}`)
        .lt('created_at', thresholdStartedAtIso)
        .or('visible.eq.true,duplicate_of.not.is.null')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) fail('fetchPruneCandidates', error.message);
      const page = (data ?? []) as Array<{ id: string; content_fingerprint: string }>;
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return rows;
  }

  async scanGroupKeys(): Promise<Array<{ content_fingerprint: string; duplicate_of: string | null }>> {
    // --reconcile-Discovery: paged Scan der (fingerprint, duplicate_of)-
    // Paare (schmale Spalten, fingerprint-Index vorhanden). Bewusst kein
    // count(*)/GROUP BY auf der Micro-Instanz.
    const rows: Array<{ content_fingerprint: string; duplicate_of: string | null }> = [];
    let from = 0;
    for (;;) {
      const { data, error } = await this.supabase
        .from(TABLE)
        .select('content_fingerprint, duplicate_of')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) fail('scanGroupKeys', error.message);
      const page = (data ?? []) as Array<{ content_fingerprint: string; duplicate_of: string | null }>;
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return rows;
  }
}
