/**
 * Ingest-Orchestrierung fuer poi_activities (fn-18, Task 2).
 *
 * Bewusst mit injizierbarem Store + Region-Fetcher gebaut, damit die
 * kritischen Lauf-Semantiken (Run-Bookkeeping, Insert-/Update-Trennung,
 * Sichtungs-Monotonie, Gruppen-Rekonsolidierung, Crash-Recovery, Prune)
 * gegen einen In-Memory-Store getestet werden koennen — der echte
 * Supabase-Store lebt in activity-store.ts, das CLI in
 * src/scripts/import-activities.ts.
 *
 * ── Lauftypen (Schreibrechte-Matrix, Epic E6 — verbindlich) ────────────────
 *   full (Default)  = full_attempt: alle Regionen VERSUCHT. Schreibt
 *                     Runs-Zeile (VOR dem ersten Region-Fetch — run_seq
 *                     existiert vor jedem Daten-Write) + Daten +
 *                     Sichtungsfelder + Rekonsolidierung + Prune.
 *                     complete_run (0 failed) stampt ZUSAETZLICH
 *                     last_seen_complete_run_seq — Prune und Canonical-
 *                     Liveness rechnen AUSSCHLIESSLICH damit.
 *                     finished_at erst NACH erfolgreichem Reconcile+Prune —
 *                     fehlendes finished_at = abgebrochener Lauf.
 *   --region <slug> = nur Daten-Upsert + Rekonsolidierung der beruehrten
 *                     Fingerprint-Gruppen. KEINE Runs-Zeile, KEINE
 *                     Sichtungsfelder, kein Prune.
 *   --reconcile     = Recovery: rekonsolidiert alle Gruppen mit >1 Mitglied
 *                     oder gesetztem duplicate_of (Reparatur nach
 *                     abgebrochenen Laeufen).
 *   --dry-run       = schreibt GAR NICHTS (auch keine Runs-Zeile).
 *
 * ── Ueberlappungsschutz (2. Ebene neben der GH-concurrency-Group) ──────────
 * Sichtungs-Updates sind monoton: der Store filtert auf
 * last_seen_run_seq < run_seq (GREATEST-Semantik) — ein spaeter fertig
 * werdender AELTERER Lauf trifft nur Rows, die kein neuerer Lauf schon
 * gestempelt hat, und kann daher weder die Seq-Felder noch seen_regions
 * zuruecksetzen. seen_regions wird client-seitig als all-time-Union
 * berechnet (union-only) und im selben monotonen Update geschrieben.
 */

import {
  transformInfrastructure,
  buildInsertRow,
  buildUpdateRow,
  type TransformedActivity,
  type SkipReason,
  type ActivityInsertRow,
  type ActivityUpdateRow,
} from './ingest-transform';
import {
  buildLivenessContext,
  groupByFingerprint,
  pruneGroup,
  reconcileGroup,
  type GroupMember,
  type GroupUpdate,
  type LivenessContext,
} from './prune';
import type { DesklineInfrastructure } from './deskline-client';

// ── Store-Interface (Supabase-Implementierung: activity-store.ts) ───────────

export interface ExistingActivityRow {
  id: string;
  source_id: string;
  slug: string;
  content_fingerprint: string;
  seen_regions: string[];
}

export interface GroupMemberRow extends GroupMember {
  content_fingerprint: string;
}

export interface CompleteRunInfo {
  run_seq: number;
  started_at: string;
}

export interface RunPatch {
  regions_ok?: string[];
  regions_failed?: Array<{ code: string; error: string }>;
  is_complete?: boolean;
  finished_at?: string;
}

export interface ActivityStore {
  /** Legt die Runs-Zeile an (VOR dem ersten Region-Fetch). */
  createRun(): Promise<{ run_id: string; run_seq: number; started_at: string }>;
  updateRun(runId: string, patch: RunPatch): Promise<void>;
  /** Juengste complete_runs (is_complete UND finished_at gesetzt),
   *  absteigend nach run_seq. */
  getRecentCompleteRuns(limit: number): Promise<CompleteRunInfo[]>;
  prefetchExisting(sourceIds: string[]): Promise<Map<string, ExistingActivityRow>>;
  insertActivities(rows: ActivityInsertRow[]): Promise<Array<{ id: string; source_id: string }>>;
  /** Update-Pfad via Upsert ON CONFLICT (source, source_id). */
  updateActivities(rows: ActivityUpdateRow[]): Promise<void>;
  /** Monotones Sichtungs-Update (nur Rows mit last_seen_run_seq < runSeq). */
  markSeen(ids: string[], runSeq: number, seenAtIso: string, seenRegions: string[]): Promise<void>;
  /** Monotones complete-Stamping (nur last_seen_complete_run_seq < runSeq). */
  markSeenComplete(ids: string[], runSeq: number): Promise<void>;
  fetchGroupMembers(fingerprints: string[]): Promise<GroupMemberRow[]>;
  applyGroupUpdates(updates: GroupUpdate[]): Promise<void>;
  /** Potentiell tote, noch nicht fertig geprunte Rows (Kandidaten-Discovery). */
  fetchPruneCandidates(
    thresholdSeq: number,
    thresholdStartedAtIso: string,
  ): Promise<Array<{ id: string; content_fingerprint: string }>>;
  /** Alle (fingerprint, duplicate_of)-Paare fuer --reconcile (paged). */
  scanGroupKeys(): Promise<Array<{ content_fingerprint: string; duplicate_of: string | null }>>;
}

// ── Optionen / Ergebnis ──────────────────────────────────────────────────────

export type IngestMode = 'full' | 'region' | 'reconcile';

export interface IngestOptions {
  mode: IngestMode;
  /** Pflicht bei mode 'region'. */
  region?: string;
  dryRun: boolean;
}

export interface IngestRegionConfig {
  code: string;
  bundesland: string;
}

export interface IngestDeps {
  store: ActivityStore;
  fetchRegion: (regionCode: string) => Promise<DesklineInfrastructure[]>;
  regions: readonly IngestRegionConfig[];
  log: (msg: string) => void;
  /** Injizierbar fuer deterministische Tests. */
  nowIso?: () => string;
}

export interface IngestResult {
  mode: IngestMode;
  dryRun: boolean;
  fetched: number;
  importable: number;
  skipped: Record<SkipReason, number>;
  inserted: number;
  updated: number;
  reconciledGroups: number;
  prunedGroups: number;
  runId: string | null;
  runSeq: number | null;
  isComplete: boolean | null;
  finished: boolean;
  regionsOk: string[];
  regionsFailed: Array<{ code: string; error: string }>;
  fatalTransformErrors: string[];
  /** Mirror-Overlap-Report (GUID-Annahme, Epic E11). */
  overlap: {
    sourceIdsInMultipleRegions: number;
    fingerprintGroupsAcrossSourceIds: number;
  };
}

const EMPTY_SKIPS: Record<SkipReason, number> = {
  invalid: 0,
  'excluded-topic': 0,
  'no-importable-topic': 0,
  'no-coordinates': 0,
  'no-gemeinde-match': 0,
  'bundesland-unresolved': 0,
};

const FETCH_CONCURRENCY = 6; // Feratel-IP-Limit ~3500 calls/h (Epic E2)
const GROUP_FETCH_CHUNK = 150;

interface CollectState {
  /** Erste Business-Sicht pro source_id (first-wins bei Mirror-GUIDs). */
  bySourceId: Map<string, TransformedActivity>;
  /** Alle Regionen, die die source_id in DIESEM Lauf geliefert haben. */
  regionsBySourceId: Map<string, Set<string>>;
  fetched: number;
  skipped: Record<SkipReason, number>;
  fatalErrors: string[];
  fatalRegions: Set<string>;
  unmappedTopicCounts: Map<string, number>;
}

function newCollectState(): CollectState {
  return {
    bySourceId: new Map(),
    regionsBySourceId: new Map(),
    fetched: 0,
    skipped: { ...EMPTY_SKIPS },
    fatalErrors: [],
    fatalRegions: new Set(),
    unmappedTopicCounts: new Map(),
  };
}

function collectRegion(
  state: CollectState,
  regionCode: string,
  regionBundesland: string,
  items: DesklineInfrastructure[],
  log: (msg: string) => void,
): void {
  let importable = 0;
  for (const raw of items) {
    state.fetched++;
    const outcome = transformInfrastructure(raw, regionCode, regionBundesland);
    for (const topic of outcome.unmappedTopics) {
      state.unmappedTopicCounts.set(topic, (state.unmappedTopicCounts.get(topic) ?? 0) + 1);
    }
    if (!outcome.ok) {
      state.skipped[outcome.reason]++;
      if (outcome.fatal) {
        const msg = `${regionCode}: bundesland unresolved for source_id=${typeof raw.id === 'string' ? raw.id : '?'}`;
        state.fatalErrors.push(msg);
        state.fatalRegions.add(regionCode);
      }
      continue;
    }
    if (outcome.bundeslandFromConfigFallback) {
      log(`[ingest] ${regionCode}: bundesland via REGIONS-Config-Fallback fuer ${outcome.activity.source_id}`);
    }
    importable++;
    const sourceId = outcome.activity.source_id;
    if (!state.bySourceId.has(sourceId)) {
      state.bySourceId.set(sourceId, outcome.activity);
    }
    let regions = state.regionsBySourceId.get(sourceId);
    if (!regions) {
      regions = new Set();
      state.regionsBySourceId.set(sourceId, regions);
    }
    regions.add(regionCode);
  }
  // Hinweis: zaehlt Whitelist-Treffer inkl. Dubletten (gleiche GUID kann
  // mehrfach auftauchen) — die Lauf-Summary zaehlt unique source_ids.
  log(`[ingest] ${regionCode}: ${items.length} geliefert, ${importable} Whitelist-Treffer`);
}

function overlapReport(state: CollectState, log: (msg: string) => void): IngestResult['overlap'] {
  let multiRegion = 0;
  for (const regions of state.regionsBySourceId.values()) {
    if (regions.size > 1) multiRegion++;
  }
  const bySourceFingerprint = new Map<string, Set<string>>();
  for (const a of state.bySourceId.values()) {
    let set = bySourceFingerprint.get(a.content_fingerprint);
    if (!set) {
      set = new Set();
      bySourceFingerprint.set(a.content_fingerprint, set);
    }
    set.add(a.source_id);
  }
  let crossSourceGroups = 0;
  for (const set of bySourceFingerprint.values()) {
    if (set.size > 1) crossSourceGroups++;
  }
  log(
    `[ingest] Mirror-Overlap-Report: ${multiRegion} source_ids in >1 Region ` +
      `(GUID-Annahme ${multiRegion > 0 ? 'BESTAETIGT — Mirrors teilen GUIDs' : 'nicht beobachtet'}), ` +
      `${crossSourceGroups} Fingerprint-Gruppen ueber verschiedene source_ids ` +
      `(dort greift die E11-Fallback-Regel)`,
  );
  return { sourceIdsInMultipleRegions: multiRegion, fingerprintGroupsAcrossSourceIds: crossSourceGroups };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Rekonsolidiert die Gruppen der uebergebenen Fingerprints (E11).
 *  Liefert die Anzahl geaenderter Gruppen. */
async function reconcileFingerprints(
  store: ActivityStore,
  fingerprints: Set<string>,
  ctx: LivenessContext | null,
): Promise<number> {
  if (fingerprints.size === 0) return 0;
  const updates: GroupUpdate[] = [];
  let changedGroups = 0;
  for (const fps of chunk([...fingerprints], GROUP_FETCH_CHUNK)) {
    const members = await store.fetchGroupMembers(fps);
    for (const group of groupByFingerprint(members).values()) {
      const groupUpdates = reconcileGroup(group, ctx);
      if (groupUpdates.length > 0) {
        changedGroups++;
        updates.push(...groupUpdates);
      }
    }
  }
  if (updates.length > 0) await store.applyGroupUpdates(updates);
  return changedGroups;
}

/**
 * Schreibphase (Insert-/Update-Trennung nach dem prefetchExistingRows-
 * Muster, supabase-sync.ts:174-224) + Ermittlung der beruehrten
 * Fingerprint-Gruppen (alte UND neue — Fingerprint-Drift, Task-Spec d).
 */
async function writeActivities(
  store: ActivityStore,
  activities: TransformedActivity[],
  nowIso: string,
): Promise<{
  inserted: number;
  updated: number;
  idBySourceId: Map<string, string>;
  existingBySourceId: Map<string, ExistingActivityRow>;
  touchedFingerprints: Set<string>;
}> {
  const existing = await store.prefetchExisting(activities.map((a) => a.source_id));

  const insertRows: ActivityInsertRow[] = [];
  const updateRows: ActivityUpdateRow[] = [];
  const touched = new Set<string>();
  const idBySourceId = new Map<string, string>();

  for (const a of activities) {
    touched.add(a.content_fingerprint); // neue Gruppe
    const row = existing.get(a.source_id);
    if (row) {
      touched.add(row.content_fingerprint); // alte Gruppe (Drift!)
      idBySourceId.set(a.source_id, row.id);
      updateRows.push(buildUpdateRow(a, nowIso));
    } else {
      insertRows.push(buildInsertRow(a));
    }
  }

  const insertedRefs = insertRows.length > 0 ? await store.insertActivities(insertRows) : [];
  for (const ref of insertedRefs) idBySourceId.set(ref.source_id, ref.id);
  if (updateRows.length > 0) await store.updateActivities(updateRows);

  return {
    inserted: insertRows.length,
    updated: updateRows.length,
    idBySourceId,
    existingBySourceId: existing,
    touchedFingerprints: touched,
  };
}

/** Sichtungs-Updates (NUR Voll-Laeufe): Rows nach resultierender
 *  seen_regions-Union gruppieren (all-time-Union aus Bestand + diesem Lauf)
 *  und monoton stempeln. */
async function markSightings(
  store: ActivityStore,
  state: CollectState,
  idBySourceId: Map<string, string>,
  existingBySourceId: Map<string, ExistingActivityRow>,
  runSeq: number,
  isComplete: boolean,
  nowIso: string,
): Promise<void> {
  const byUnion = new Map<string, { ids: string[]; regions: string[] }>();
  const allIds: string[] = [];

  for (const [sourceId, regionsNow] of state.regionsBySourceId) {
    const id = idBySourceId.get(sourceId);
    if (!id) continue;
    allIds.push(id);
    const existingRegions = existingBySourceId.get(sourceId)?.seen_regions ?? [];
    const union = [...new Set([...existingRegions, ...regionsNow])].sort();
    const key = union.join('|');
    const group = byUnion.get(key);
    if (group) group.ids.push(id);
    else byUnion.set(key, { ids: [id], regions: union });
  }

  for (const group of byUnion.values()) {
    await store.markSeen(group.ids, runSeq, nowIso, group.regions);
  }
  if (isComplete && allIds.length > 0) {
    await store.markSeenComplete(allIds, runSeq);
  }
}

/** Gruppen-Prune (E6): Kandidaten-Discovery ueber tote, noch nicht fertig
 *  geprunte Rows; Entscheidung pro Fingerprint-Gruppe. */
async function pruneDeadGroups(
  store: ActivityStore,
  ctx: LivenessContext | null,
): Promise<number> {
  if (ctx === null) return 0; // Bootstrap: <2 complete_runs -> nie prunen
  const candidates = await store.fetchPruneCandidates(ctx.thresholdSeq, ctx.thresholdStartedAt);
  const fingerprints = new Set(candidates.map((c) => c.content_fingerprint));
  if (fingerprints.size === 0) return 0;

  const updates: GroupUpdate[] = [];
  let prunedGroups = 0;
  for (const fps of chunk([...fingerprints], GROUP_FETCH_CHUNK)) {
    const members = await store.fetchGroupMembers(fps);
    for (const group of groupByFingerprint(members).values()) {
      const groupUpdates = pruneGroup(group, ctx);
      if (groupUpdates.length > 0) {
        updates.push(...groupUpdates);
        if (groupUpdates.every((u) => !u.visible)) prunedGroups++;
      }
    }
  }
  if (updates.length > 0) await store.applyGroupUpdates(updates);
  return prunedGroups;
}

// ── Haupteinstieg ────────────────────────────────────────────────────────────

export async function runIngest(deps: IngestDeps, opts: IngestOptions): Promise<IngestResult> {
  const { store, log } = deps;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  const result: IngestResult = {
    mode: opts.mode,
    dryRun: opts.dryRun,
    fetched: 0,
    importable: 0,
    skipped: { ...EMPTY_SKIPS },
    inserted: 0,
    updated: 0,
    reconciledGroups: 0,
    prunedGroups: 0,
    runId: null,
    runSeq: null,
    isComplete: null,
    finished: false,
    regionsOk: [],
    regionsFailed: [],
    fatalTransformErrors: [],
    overlap: { sourceIdsInMultipleRegions: 0, fingerprintGroupsAcrossSourceIds: 0 },
  };

  // ── Modus: --reconcile (Recovery nach abgebrochenen Laeufen) ──────────────
  if (opts.mode === 'reconcile') {
    const ctx = buildLivenessContext(await store.getRecentCompleteRuns(2));
    const keys = await store.scanGroupKeys();
    const counts = new Map<string, number>();
    const candidates = new Set<string>();
    for (const key of keys) {
      const n = (counts.get(key.content_fingerprint) ?? 0) + 1;
      counts.set(key.content_fingerprint, n);
      if (n > 1 || key.duplicate_of !== null) candidates.add(key.content_fingerprint);
    }
    log(`[ingest] reconcile: ${candidates.size} Kandidaten-Gruppen (von ${counts.size} Fingerprints)`);
    if (!opts.dryRun) {
      result.reconciledGroups = await reconcileFingerprints(store, candidates, ctx);
    }
    log(`[ingest] reconcile: ${result.reconciledGroups} Gruppen korrigiert`);
    result.finished = true;
    return result;
  }

  // ── Fetch + Transform ──────────────────────────────────────────────────────
  const regionConfigs =
    opts.mode === 'region'
      ? deps.regions.filter((r) => r.code === opts.region)
      : [...deps.regions];
  if (opts.mode === 'region' && regionConfigs.length === 0) {
    throw new Error(`Unbekannte Region '${opts.region}' — muss ein REGIONS-Slug sein (FeratelScraper.ts)`);
  }

  // Runs-Zeile VOR dem ersten Region-Fetch (nur full_attempt, nie dry-run):
  // run_seq existiert damit vor jedem Daten-Write (Epic E6).
  let run: { run_id: string; run_seq: number; started_at: string } | null = null;
  if (opts.mode === 'full' && !opts.dryRun) {
    run = await store.createRun();
    result.runId = run.run_id;
    result.runSeq = run.run_seq;
    log(`[ingest] full_attempt gestartet: run_seq=${run.run_seq}`);
  }

  const state = newCollectState();
  const failed: Array<{ code: string; error: string }> = [];
  const okCodes: string[] = [];

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < regionConfigs.length) {
      const region = regionConfigs[cursor++];
      try {
        const items = await deps.fetchRegion(region.code);
        collectRegion(state, region.code, region.bundesland, items, log);
        okCodes.push(region.code);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ code: region.code, error: msg });
        log(`[ingest] ${region.code}: FEHLER — ${msg}`);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, regionConfigs.length) }, () => worker()),
  );

  // Fatale Transform-Fehler (bundesland-unresolved) sind Lauf-Fehler:
  // die betroffene Region gilt als failed -> der Lauf kann nicht complete
  // sein und stampt keine last_seen_complete_run_seq (prune-sicher).
  for (const code of state.fatalRegions) {
    if (!failed.some((f) => f.code === code)) {
      failed.push({ code, error: 'bundesland-unresolved (Registry-Fehlwert, Task-2-Spec)' });
    }
  }

  result.fetched = state.fetched;
  result.importable = state.bySourceId.size;
  result.skipped = state.skipped;
  result.fatalTransformErrors = state.fatalErrors;
  result.regionsOk = okCodes.sort();
  result.regionsFailed = failed;
  result.overlap = overlapReport(state, log);

  const topUnmapped = [...state.unmappedTopicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  if (topUnmapped.length > 0) {
    log(`[ingest] Top unmapped Topics (Skip-Log): ${topUnmapped.map(([t, n]) => `${t} (${n})`).join(', ')}`);
  }
  log(
    `[ingest] Transform: ${state.fetched} geliefert -> ${result.importable} importierbar; Skips: ` +
      Object.entries(state.skipped)
        .filter(([, n]) => n > 0)
        .map(([r, n]) => `${r}=${n}`)
        .join(', '),
  );

  if (opts.dryRun) {
    log('[ingest] DRY RUN — es wird nichts geschrieben (auch keine Runs-Zeile).');
    result.finished = true;
    return result;
  }

  const isComplete = opts.mode === 'full' ? failed.length === 0 : null;
  result.isComplete = isComplete;

  if (opts.mode === 'full' && run) {
    // Lauf-Metadaten sofort nach der Fetch-Phase persistieren —
    // finished_at bleibt bewusst offen bis nach Reconcile+Prune.
    await store.updateRun(run.run_id, {
      regions_ok: result.regionsOk,
      regions_failed: failed,
      is_complete: isComplete === true,
    });
  }

  // ── Schreibphase + Rekonsolidierung + Prune (crash-konsistent) ────────────
  const activities = [...state.bySourceId.values()];
  const finishedCompletes = await store.getRecentCompleteRuns(2);
  // Fuer Liveness/Prune zaehlt der AKTUELLE Lauf mit, sobald er complete ist
  // (seine Sichtungen sind vor Reconcile/Prune vollstaendig gestempelt).
  const runsForCtx =
    run && isComplete === true
      ? [{ run_seq: run.run_seq, started_at: run.started_at }, ...finishedCompletes]
      : finishedCompletes;
  const ctx = buildLivenessContext(runsForCtx);

  let touchedFingerprints = new Set<string>();
  let sweepDone = false;
  let wroteData = false;

  try {
    if (activities.length > 0) {
      const writeResult = await writeActivities(store, activities, nowIso());
      wroteData = true;
      result.inserted = writeResult.inserted;
      result.updated = writeResult.updated;
      touchedFingerprints = writeResult.touchedFingerprints;
      log(`[ingest] Writes: ${writeResult.inserted} inserts, ${writeResult.updated} updates`);

      if (opts.mode === 'full' && run) {
        await markSightings(
          store,
          state,
          writeResult.idBySourceId,
          writeResult.existingBySourceId,
          run.run_seq,
          isComplete === true,
          nowIso(),
        );
        log(`[ingest] Sichtungen gestempelt (complete=${isComplete})`);
      }
    }

    // Pflicht-Sweep: Rekonsolidierung der beruehrten Gruppen (alte UND
    // neue Fingerprints) — laeuft bei ALLEN schreibenden Lauftypen.
    result.reconciledGroups = await reconcileFingerprints(store, touchedFingerprints, ctx);
    sweepDone = true;
    log(`[ingest] Rekonsolidierung: ${result.reconciledGroups} Gruppen geaendert (${touchedFingerprints.size} beruehrt)`);

    if (opts.mode === 'full' && run) {
      result.prunedGroups = await pruneDeadGroups(store, ctx);
      log(
        ctx === null
          ? '[ingest] Prune uebersprungen (Bootstrap: <2 complete_runs)'
          : `[ingest] Prune: ${result.prunedGroups} tote Gruppen versteckt`,
      );
      await store.updateRun(run.run_id, { finished_at: nowIso() });
      result.finished = true;
    } else {
      result.finished = true;
    }
  } catch (err) {
    // Crash-Konsistenz (Task-Spec d): der Reconcile-Sweep laeuft auch bei
    // Abbruch nach Daten-Write im finally-Pfad. Schlaegt er selbst fehl,
    // bleibt die Runs-Zeile ohne finished_at (Lauf gilt als abgebrochen).
    if (wroteData && !sweepDone && touchedFingerprints.size > 0) {
      try {
        const changed = await reconcileFingerprints(store, touchedFingerprints, ctx);
        log(`[ingest] Not-Sweep nach Abbruch: ${changed} Gruppen korrigiert`);
      } catch (sweepErr) {
        const msg = sweepErr instanceof Error ? sweepErr.message : String(sweepErr);
        log(`[ingest] Not-Sweep FEHLGESCHLAGEN (Recovery: --reconcile): ${msg}`);
      }
    }
    throw err;
  }

  return result;
}
