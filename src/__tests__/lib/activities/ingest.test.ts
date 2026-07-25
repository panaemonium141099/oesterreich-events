/**
 * Orchestrierungs-Tests fuer den Aktivitaeten-Ingest (fn-18, Task 2) gegen
 * einen In-Memory-Store, der die PostgREST-Semantik des echten Stores
 * nachbildet (Payload-Keys = geschriebene Spalten; monotone Sichtungs-
 * Updates). Abgedeckte Task-ACs: dry-run persistiert nichts, Insert-/
 * Update-Pfad-Trennung (slug/source_region write-once), --region ohne
 * Runs-Zeile/Sichtungen/Prune, Fingerprint-Drift, Prune-Lebenszyklus
 * (Fehllauf versteckt nichts, Fehllauf-Sighting haelt nichts am Leben,
 * Bootstrap, lebendes Duplikat + Canonical-Umwahl), seen_regions-Union,
 * Crash-Recovery via --reconcile.
 */
import { describe, it, expect } from 'vitest';
import {
  runIngest,
  type ActivityStore,
  type CompleteRunInfo,
  type ExistingActivityRow,
  type GroupMemberRow,
  type IngestDeps,
  type IngestOptions,
  type RunPatch,
  type SeenEntry,
} from '@/lib/activities/ingest';
import {
  SIGHTING_COLUMNS,
  IDENTITY_COLUMNS,
  UPDATE_BUSINESS_COLUMNS,
  type ActivityInsertRow,
  type ActivityUpdateRow,
} from '@/lib/activities/ingest-transform';
import type { GroupUpdate } from '@/lib/activities/prune';
import type { DesklineInfrastructure } from '@/lib/activities/deskline-client';

// ── In-Memory-Store ──────────────────────────────────────────────────────────

interface StoredRow {
  id: string;
  source: string;
  source_id: string;
  source_region: string;
  slug: string;
  shortid: string;
  name: string;
  content_fingerprint: string;
  visible: boolean;
  duplicate_of: string | null;
  last_seen_run_seq: number | null;
  last_seen_complete_run_seq: number | null;
  last_seen_at: string | null;
  seen_regions: string[];
  created_at: string;
  [col: string]: unknown;
}

interface RunRow {
  run_id: string;
  run_seq: number;
  started_at: string;
  finished_at: string | null;
  is_complete: boolean;
  regions_ok: string[] | null;
  regions_failed: Array<{ code: string; error: string }> | null;
}

class InMemoryStore implements ActivityStore {
  rows: StoredRow[] = [];
  runs: RunRow[] = [];
  calls: string[] = [];
  failOn = new Set<string>();
  insertPayloads: ActivityInsertRow[] = [];
  updatePayloads: ActivityUpdateRow[] = [];

  private idCounter = 0;
  private clockMs = Date.UTC(2026, 0, 1);

  tick(): string {
    this.clockMs += 1000;
    return new Date(this.clockMs).toISOString();
  }

  private guard(method: string): void {
    this.calls.push(method);
    if (this.failOn.has(method)) throw new Error(`${method} failed (simuliert)`);
  }

  bySourceId(sourceId: string): StoredRow | undefined {
    return this.rows.find((r) => r.source_id === sourceId);
  }

  visibleRows(): StoredRow[] {
    return this.rows.filter((r) => r.visible);
  }

  async createRun(): Promise<{ run_id: string; run_seq: number; started_at: string }> {
    this.guard('createRun');
    const run: RunRow = {
      run_id: `run-${this.runs.length + 1}`,
      run_seq: this.runs.length + 1,
      started_at: this.tick(),
      finished_at: null,
      is_complete: false,
      regions_ok: null,
      regions_failed: null,
    };
    this.runs.push(run);
    return { run_id: run.run_id, run_seq: run.run_seq, started_at: run.started_at };
  }

  async updateRun(runId: string, patch: RunPatch): Promise<void> {
    this.guard('updateRun');
    const run = this.runs.find((r) => r.run_id === runId);
    if (!run) throw new Error(`unknown run ${runId}`);
    Object.assign(run, patch);
  }

  async getRecentCompleteRuns(limit: number): Promise<CompleteRunInfo[]> {
    this.guard('getRecentCompleteRuns');
    return this.runs
      .filter((r) => r.is_complete && r.finished_at !== null)
      .sort((a, b) => b.run_seq - a.run_seq)
      .slice(0, limit)
      .map((r) => ({ run_seq: r.run_seq, started_at: r.started_at }));
  }

  async prefetchExisting(sourceIds: string[]): Promise<Map<string, ExistingActivityRow>> {
    this.guard('prefetchExisting');
    const wanted = new Set(sourceIds);
    const map = new Map<string, ExistingActivityRow>();
    for (const r of this.rows) {
      if (!wanted.has(r.source_id)) continue;
      map.set(r.source_id, {
        id: r.id,
        source_id: r.source_id,
        slug: r.slug,
        content_fingerprint: r.content_fingerprint,
      });
    }
    return map;
  }

  async insertActivities(rows: ActivityInsertRow[]): Promise<Array<{ id: string; source_id: string }>> {
    this.guard('insertActivities');
    const refs: Array<{ id: string; source_id: string }> = [];
    for (const payload of rows) {
      this.insertPayloads.push(payload);
      const row = {
        // DB-Defaults (Migration): visible=true, seen_regions={}, Seqs NULL.
        id: `id-${++this.idCounter}`,
        visible: true,
        duplicate_of: null,
        last_seen_run_seq: null,
        last_seen_complete_run_seq: null,
        last_seen_at: null,
        seen_regions: [] as string[],
        created_at: this.tick(),
        ...(payload as Record<string, unknown>),
      } as unknown as StoredRow;
      this.rows.push(row);
      refs.push({ id: row.id, source_id: row.source_id });
    }
    return refs;
  }

  async updateActivities(rows: ActivityUpdateRow[]): Promise<void> {
    this.guard('updateActivities');
    for (const payload of rows) {
      this.updatePayloads.push(payload);
      const row = this.bySourceId(String(payload.source_id));
      if (!row) throw new Error(`update fuer unbekannte source_id ${String(payload.source_id)}`);
      // PostgREST-Upsert-Semantik: NUR die Payload-Spalten werden gesetzt.
      Object.assign(row, payload);
    }
  }

  async markSeen(entries: SeenEntry[], runSeq: number, seenAtIso: string): Promise<void> {
    this.guard('markSeen');
    for (const entry of entries) {
      const r = this.rows.find((row) => row.id === entry.id);
      if (!r) continue;
      // Monotonie-Filter des echten Stores (last_seen_run_seq < runSeq).
      if (r.last_seen_run_seq !== null && r.last_seen_run_seq >= runSeq) continue;
      r.last_seen_run_seq = runSeq;
      r.last_seen_at = seenAtIso;
      // Live-Union zur Stempel-Zeit (Semantik des echten Stores).
      r.seen_regions = [...new Set([...r.seen_regions, ...entry.regions])].sort();
    }
  }

  async markSeenComplete(ids: string[], runSeq: number): Promise<void> {
    this.guard('markSeenComplete');
    for (const r of this.rows) {
      if (!ids.includes(r.id)) continue;
      if (r.last_seen_complete_run_seq !== null && r.last_seen_complete_run_seq >= runSeq) continue;
      r.last_seen_complete_run_seq = runSeq;
    }
  }

  async fetchGroupMembers(fingerprints: string[]): Promise<GroupMemberRow[]> {
    this.guard('fetchGroupMembers');
    const wanted = new Set(fingerprints);
    return this.rows
      .filter((r) => wanted.has(r.content_fingerprint))
      .map((r) => ({
        id: r.id,
        source_id: r.source_id,
        content_fingerprint: r.content_fingerprint,
        created_at: r.created_at,
        visible: r.visible,
        duplicate_of: r.duplicate_of,
        last_seen_complete_run_seq: r.last_seen_complete_run_seq,
      }));
  }

  async applyGroupUpdates(updates: GroupUpdate[]): Promise<void> {
    this.guard('applyGroupUpdates');
    for (const u of updates) {
      const row = this.rows.find((r) => r.id === u.id);
      if (!row) throw new Error(`group update fuer unbekannte id ${u.id}`);
      row.visible = u.visible;
      row.duplicate_of = u.duplicate_of;
    }
  }

  async fetchPruneCandidates(
    thresholdSeq: number,
    thresholdStartedAtIso: string,
  ): Promise<Array<{ id: string; content_fingerprint: string }>> {
    this.guard('fetchPruneCandidates');
    return this.rows
      .filter(
        (r) =>
          (r.last_seen_complete_run_seq === null || r.last_seen_complete_run_seq < thresholdSeq) &&
          r.created_at < thresholdStartedAtIso &&
          (r.visible || r.duplicate_of !== null),
      )
      .map((r) => ({ id: r.id, content_fingerprint: r.content_fingerprint }));
  }

  async scanGroupKeys(): Promise<Array<{ content_fingerprint: string; duplicate_of: string | null }>> {
    this.guard('scanGroupKeys');
    return this.rows.map((r) => ({
      content_fingerprint: r.content_fingerprint,
      duplicate_of: r.duplicate_of,
    }));
  }
}

// ── Fixtures / Helpers ───────────────────────────────────────────────────────

/** Importierbarer POI (Whitelist-Topic 'Strandbad', Podersdorf-Koordinaten —
 *  gleicher Name + gleiche Koordinaten => gleicher content_fingerprint). */
function poi(id: string, name: string, lat = 47.852, lng = 16.847): DesklineInfrastructure {
  return {
    id,
    name,
    topics: [{ name: 'Strandbad' }],
    location: { town: 'Podersdorf am See', coordinate: { lat, long: lng } },
  };
}

const REGIONS = [
  { code: 'r1', bundesland: 'Burgenland' },
  { code: 'r2', bundesland: 'Burgenland' },
];

interface Harness {
  store: InMemoryStore;
  data: Record<string, DesklineInfrastructure[]>;
  failRegions: Set<string>;
  run: (opts?: Partial<IngestOptions>) => ReturnType<typeof runIngest>;
}

function harness(): Harness {
  const store = new InMemoryStore();
  const data: Record<string, DesklineInfrastructure[]> = { r1: [], r2: [] };
  const failRegions = new Set<string>();
  const deps: IngestDeps = {
    store,
    fetchRegion: async (code) => {
      if (failRegions.has(code)) throw new Error(`${code} down`);
      return data[code] ?? [];
    },
    regions: REGIONS,
    log: () => {},
    nowIso: () => store.tick(),
  };
  return {
    store,
    data,
    failRegions,
    run: (opts) => runIngest(deps, { mode: 'full', dryRun: false, ...opts }),
  };
}

/** Sichtbare Rows pro Fingerprint-Gruppe — Kern-Invariante. */
function visibleCountsPerGroup(store: InMemoryStore): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of store.rows) {
    counts.set(r.content_fingerprint, (counts.get(r.content_fingerprint) ?? 0) + (r.visible ? 1 : 0));
  }
  return counts;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('runIngest — dry-run', () => {
  it('persistiert GAR NICHTS (keine Runs-Zeile, kein einziger Store-Aufruf)', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf')];
    const result = await h.run({ dryRun: true });
    expect(result.importable).toBe(1);
    expect(result.finished).toBe(true);
    expect(h.store.calls).toEqual([]);
    expect(h.store.rows).toHaveLength(0);
    expect(h.store.runs).toHaveLength(0);
  });
});

describe('runIngest — full_attempt (complete)', () => {
  it('legt Runs-Zeile VOR den Daten-Writes an, stampt Sichtungen + complete-Seq, setzt finished_at', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf'), poi('p2', 'Minigolfplatz Podersdorf')];
    h.data.r2 = [poi('p1', 'Strandbad Podersdorf')]; // Mirror: gleiche GUID in 2. Region

    const result = await h.run();

    expect(result.inserted).toBe(2);
    expect(result.isComplete).toBe(true);
    expect(result.overlap.sourceIdsInMultipleRegions).toBe(1);
    // createRun kommt vor jedem Daten-Write (run_seq existiert vorher).
    expect(h.store.calls.indexOf('createRun')).toBeLessThan(h.store.calls.indexOf('insertActivities'));

    const run = h.store.runs[0];
    expect(run.is_complete).toBe(true);
    expect(run.finished_at).not.toBeNull();
    expect(run.regions_ok).toEqual(['r1', 'r2']);
    expect(run.regions_failed).toEqual([]);

    const p1 = h.store.bySourceId('p1')!;
    expect(p1.last_seen_run_seq).toBe(1);
    expect(p1.last_seen_complete_run_seq).toBe(1);
    expect(p1.seen_regions).toEqual(['r1', 'r2']); // Union ueber beide Regionen
    expect(p1.visible).toBe(true);

    // Insert-Payloads enthalten NIE Sichtungs-/Ordnungsspalten.
    for (const payload of h.store.insertPayloads) {
      for (const col of SIGHTING_COLUMNS) expect(payload).not.toHaveProperty(col);
    }
  });

  it('Re-Import aendert weder slug noch source_region (Update-Pfad, write-once E5)', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf')];
    await h.run();
    const before = { ...h.store.bySourceId('p1')! };

    h.data.r1 = [poi('p1', 'Strandbad Podersdorf NEU')];
    const result = await h.run();

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
    const after = h.store.bySourceId('p1')!;
    expect(after.slug).toBe(before.slug);
    expect(after.shortid).toBe(before.shortid);
    expect(after.source_region).toBe(before.source_region);
    expect(after.name).toBe('Strandbad Podersdorf NEU');
    expect(after.id).toBe(before.id);
    expect(h.store.rows).toHaveLength(1);

    // Update-Payloads: exakt das fixe Spaltenset, nie slug/shortid/
    // source_region, nie Sichtungsspalten.
    const expectedKeys = [...IDENTITY_COLUMNS, ...UPDATE_BUSINESS_COLUMNS, 'updated_at'].sort();
    for (const payload of h.store.updatePayloads) {
      expect(Object.keys(payload).sort()).toEqual(expectedKeys);
    }
  });

  it('seen_regions verhaelt sich als all-time-Union', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf')];
    await h.run();
    expect(h.store.bySourceId('p1')!.seen_regions).toEqual(['r1']);

    // Spaeter liefert NUR NOCH r2 den POI: r1 bleibt in der Union.
    h.data.r1 = [];
    h.data.r2 = [poi('p1', 'Strandbad Podersdorf')];
    await h.run();
    expect(h.store.bySourceId('p1')!.seen_regions).toEqual(['r1', 'r2']);
  });
});

describe('runIngest — --region (Schreibrechte-Matrix E6)', () => {
  it('macht nur Daten-Upsert + Rekonsolidierung: keine Runs-Zeile, keine Sichtungen, kein Prune', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf')];
    await h.run();
    h.store.calls = [];

    // Region-Lauf mit geaendertem Namen + neuem Mirror-POI (andere GUID,
    // gleicher Fingerprint wie p1-NACH-Rename).
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf'), poi('p9', 'Strandbad Podersdorf')];
    const result = await h.run({ mode: 'region', region: 'r1' });

    expect(result.runId).toBeNull();
    expect(h.store.runs).toHaveLength(1); // unveraendert
    expect(h.store.calls).not.toContain('createRun');
    expect(h.store.calls).not.toContain('markSeen');
    expect(h.store.calls).not.toContain('markSeenComplete');
    expect(h.store.calls).not.toContain('fetchPruneCandidates');

    // Sichtungsfelder unveraendert (p9 frisch: alles NULL).
    expect(h.store.bySourceId('p1')!.last_seen_run_seq).toBe(1);
    expect(h.store.bySourceId('p9')!.last_seen_run_seq).toBeNull();

    // Beruehrte Gruppe wurde rekonsolidiert: genau EIN sichtbares Canonical.
    const fp = h.store.bySourceId('p1')!.content_fingerprint;
    expect(h.store.bySourceId('p9')!.content_fingerprint).toBe(fp);
    expect(visibleCountsPerGroup(h.store).get(fp)).toBe(1);
    // Incumbent p1 bleibt Canonical (E11: lebendes Canonical bleibt).
    expect(h.store.bySourceId('p1')!.visible).toBe(true);
    expect(h.store.bySourceId('p9')!.duplicate_of).toBe(h.store.bySourceId('p1')!.id);
  });

  it('unbekannter Region-Slug wirft', async () => {
    const h = harness();
    await expect(h.run({ mode: 'region', region: 'nope' })).rejects.toThrow(/Unbekannte Region/);
  });
});

describe('runIngest — Fingerprint-Drift (Task-Spec d)', () => {
  it('rekonsolidiert alte UND neue Gruppe — nie 0 oder 2 sichtbare Canonicals', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf'), poi('p2', 'Minigolfplatz Podersdorf')];
    await h.run();
    expect(h.store.visibleRows()).toHaveLength(2);

    // Drift: p2 bekommt Name+Koordinaten von p1 -> gleiche Gruppe.
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf'), poi('p2', 'Strandbad Podersdorf')];
    await h.run();
    for (const [, count] of visibleCountsPerGroup(h.store)) {
      expect(count).toBeLessThanOrEqual(1);
    }
    const p1 = h.store.bySourceId('p1')!;
    const p2 = h.store.bySourceId('p2')!;
    expect(p1.content_fingerprint).toBe(p2.content_fingerprint);
    // p1 ist aelter -> deterministisches Canonical, p2 Duplikat.
    expect(p1.visible).toBe(true);
    expect(p2.visible).toBe(false);
    expect(p2.duplicate_of).toBe(p1.id);

    // Rueck-Drift: p2 wird wieder eigenstaendig -> BEIDE Gruppen werden
    // rekonsolidiert, p2 wird wieder sichtbar (keine verwaiste Gruppe).
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf'), poi('p2', 'Minigolfplatz Podersdorf')];
    await h.run();
    expect(h.store.bySourceId('p1')!.visible).toBe(true);
    expect(h.store.bySourceId('p2')!.visible).toBe(true);
    expect(h.store.bySourceId('p2')!.duplicate_of).toBeNull();
    for (const [, count] of visibleCountsPerGroup(h.store)) {
      expect(count).toBe(1);
    }
  });
});

describe('runIngest — Prune-Lebenszyklus (E6)', () => {
  it('Bootstrap: bei <2 kompletten Laeufen wird nie geprunt', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf'), poi('p2', 'Minigolfplatz Podersdorf')];
    await h.run(); // complete_run #1

    // Lauf 2: p2 verschwunden UND r2 failt -> kein 2. complete_run.
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf')];
    h.failRegions.add('r2');
    const result = await h.run();
    expect(result.isComplete).toBe(false);
    expect(result.prunedGroups).toBe(0);
    // Bootstrap-Pfad ruft die Kandidaten-Discovery gar nicht erst auf.
    expect(h.store.calls.filter((c) => c === 'fetchPruneCandidates')).toHaveLength(0);
    expect(h.store.bySourceId('p2')!.visible).toBe(true);
  });

  it('Fehllauf (regions_failed nicht leer) versteckt keine Rows; Fehllauf-Sighting haelt keinen POI am Leben', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf')];
    h.data.r2 = [poi('p2', 'Minigolfplatz Podersdorf')];
    await h.run(); // complete #1 (seq 1)
    await h.run(); // complete #2 (seq 2)

    // Lauf 3 (Fehllauf): r2 down -> p2 ungesehen. Darf NICHTS verstecken.
    h.failRegions.add('r2');
    const r3 = await h.run();
    expect(r3.isComplete).toBe(false);
    expect(h.store.runs[2].finished_at).not.toBeNull(); // ordentlich beendet, nur nicht complete
    expect(h.store.bySourceId('p2')!.visible).toBe(true);
    expect(h.store.bySourceId('p2')!.last_seen_complete_run_seq).toBe(2);
    h.failRegions.clear();

    // Lauf 4 (complete): p2 wieder da -> Stempel frisch.
    await h.run();
    expect(h.store.bySourceId('p2')!.last_seen_complete_run_seq).toBe(4);

    // Lauf 5 (Fehllauf mit Sighting): r1 down, r2 liefert p2 -> p2 bekommt
    // NUR last_seen_run_seq (Provenienz), KEINEN complete-Stempel.
    h.failRegions.add('r1');
    await h.run();
    h.failRegions.clear();
    const p2AfterFehllauf = h.store.bySourceId('p2')!;
    expect(p2AfterFehllauf.last_seen_run_seq).toBe(5);
    expect(p2AfterFehllauf.last_seen_complete_run_seq).toBe(4);
    expect(p2AfterFehllauf.visible).toBe(true);

    // Laeufe 6+7 (complete, p2 endgueltig weg): erst nach 2 kompletten
    // Laeufen ohne Sichtung faellt p2 — das Fehllauf-Sighting aus Lauf 5
    // zaehlt NICHT.
    h.data.r2 = [];
    const r6 = await h.run(); // complete: Schwelle = seq 4 -> p2 (seq 4) lebt noch
    expect(r6.isComplete).toBe(true);
    expect(h.store.bySourceId('p2')!.visible).toBe(true);

    const r7 = await h.run(); // complete: Schwelle = seq 6 -> p2 (seq 4) ist tot
    expect(r7.isComplete).toBe(true);
    const p2Dead = h.store.bySourceId('p2')!;
    expect(p2Dead.visible).toBe(false);
    expect(p2Dead.duplicate_of).toBeNull(); // toter Gruppen-Prune leert duplicate_of
    expect(r7.prunedGroups).toBe(1);
    // p1 ist davon unberuehrt.
    expect(h.store.bySourceId('p1')!.visible).toBe(true);
  });

  it('ein gesehenes Duplikat haelt die Gruppe am Leben — Canonical wird auf das lebende Mitglied umgewaehlt', async () => {
    const h = harness();
    // Mirror-Szenario mit VERSCHIEDENEN GUIDs, gleicher Fingerprint (E11).
    h.data.r1 = [poi('a', 'Rodelbahn Podersdorf')];
    h.data.r2 = [poi('b', 'Rodelbahn Podersdorf')];
    await h.run(); // complete #1
    const fp = h.store.bySourceId('a')!.content_fingerprint;
    expect(h.store.bySourceId('b')!.content_fingerprint).toBe(fp);
    expect(visibleCountsPerGroup(h.store).get(fp)).toBe(1);
    const canonicalAfter1 = h.store.rows.find((r) => r.visible)!.id;

    // Canonical-Stabilitaet: unveraenderte Laeufe waehlen nie um (kein 301-Flapping).
    await h.run(); // complete #2
    await h.run(); // complete #3
    expect(h.store.rows.find((r) => r.visible)!.id).toBe(canonicalAfter1);

    // Quelle 'a' verschwindet; 'b' liefert weiter -> nach 2 kompletten
    // Laeufen ohne 'a' wandert das Canonical auf 'b', die Gruppe bleibt
    // sichtbar (POI verschwindet nicht, solange irgendeine Quelle liefert).
    h.data.r1 = [];
    await h.run(); // complete #4: 'a' erst 1x ungesehen -> lebt noch
    expect(visibleCountsPerGroup(h.store).get(fp)).toBe(1);
    await h.run(); // complete #5: 'a' tot -> Umwahl auf 'b'
    const a = h.store.bySourceId('a')!;
    const b = h.store.bySourceId('b')!;
    expect(b.visible).toBe(true);
    expect(b.duplicate_of).toBeNull();
    expect(a.visible).toBe(false);
    expect(a.duplicate_of).toBe(b.id);
  });
});

describe('runIngest — Crash-Recovery (--reconcile, Task-Spec d)', () => {
  it('Abbruch zwischen Daten-Write und Sweep: --reconcile stellt "genau ein sichtbares Canonical" wieder her; abgebrochener Lauf hat kein finished_at', async () => {
    const h = harness();
    h.data.r1 = [poi('a', 'Rodelbahn Podersdorf')];
    await h.run(); // sauberer complete_run #1

    // Lauf 2 liefert ein Mirror-Duplikat 'b' (gleicher Fingerprint) und
    // crasht nach dem Daten-Write; auch der Not-Sweep schlaegt fehl.
    h.data.r2 = [poi('b', 'Rodelbahn Podersdorf')];
    h.store.failOn.add('markSeen');
    h.store.failOn.add('fetchGroupMembers');
    await expect(h.run()).rejects.toThrow(/markSeen failed/);
    h.store.failOn.clear();

    // Kaputter Zustand: 2 sichtbare Rows in einer Gruppe, Lauf 2 ohne finished_at.
    const fp = h.store.bySourceId('a')!.content_fingerprint;
    expect(visibleCountsPerGroup(h.store).get(fp)).toBe(2);
    expect(h.store.runs[1].finished_at).toBeNull();

    // Recovery: --reconcile repariert die Invariante deterministisch
    // (mehrere sichtbare -> Incumbency ignoriert, aeltestes created_at gewinnt).
    const result = await runIngest(
      {
        store: h.store,
        fetchRegion: async () => [],
        regions: REGIONS,
        log: () => {},
        nowIso: () => h.store.tick(),
      },
      { mode: 'reconcile', dryRun: false },
    );
    expect(result.reconciledGroups).toBe(1);
    expect(visibleCountsPerGroup(h.store).get(fp)).toBe(1);
    const a = h.store.bySourceId('a')!;
    const b = h.store.bySourceId('b')!;
    expect(a.visible).toBe(true); // aelteste Row
    expect(b.visible).toBe(false);
    expect(b.duplicate_of).toBe(a.id);
    // Der abgebrochene Lauf bleibt als solcher markiert.
    expect(h.store.runs[1].finished_at).toBeNull();
  });

  it('Teil-Schreiber (Insert ok, Update crasht) loest den Not-Sweep trotzdem aus', async () => {
    const h = harness();
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf')];
    await h.run(); // sauberer complete_run #1

    // Lauf 2: p1-Update UND p9-Insert (gleicher Fingerprint wie p1).
    // updateActivities crasht NACH dem erfolgreichen Insert -> ohne den
    // Vorab-Set von wroteData/touchedFingerprints wuerde der Not-Sweep
    // uebersprungen und die Gruppe haette 2 sichtbare Rows.
    h.data.r1 = [poi('p1', 'Strandbad Podersdorf'), poi('p9', 'Strandbad Podersdorf')];
    h.store.failOn.add('updateActivities');
    await expect(h.run()).rejects.toThrow(/updateActivities failed/);
    h.store.failOn.clear();

    expect(h.store.bySourceId('p9')).toBeDefined(); // Insert war durch
    const fp = h.store.bySourceId('p1')!.content_fingerprint;
    expect(visibleCountsPerGroup(h.store).get(fp)).toBe(1); // Not-Sweep lief
    expect(h.store.runs[1].finished_at).toBeNull(); // Lauf gilt als abgebrochen
  });

  it('Not-Sweep im Fehlerpfad repariert beruehrte Gruppen, wenn er selbst durchlaeuft', async () => {
    const h = harness();
    h.data.r1 = [poi('a', 'Rodelbahn Podersdorf')];
    await h.run();

    // Crash NACH dem Daten-Write (markSeen failt), aber der Sweep im
    // Fehlerpfad funktioniert -> Invariante bleibt intakt, Lauf gilt
    // trotzdem als abgebrochen (kein finished_at).
    h.data.r2 = [poi('b', 'Rodelbahn Podersdorf')];
    h.store.failOn.add('markSeen');
    await expect(h.run()).rejects.toThrow(/markSeen failed/);
    h.store.failOn.clear();

    const fp = h.store.bySourceId('a')!.content_fingerprint;
    expect(visibleCountsPerGroup(h.store).get(fp)).toBe(1);
    expect(h.store.runs[1].finished_at).toBeNull();
  });
});
