/**
 * Deskline-`infrastructures`-Ingest fuer poi_activities (fn-18, Task 2).
 *
 *   npx tsx src/scripts/import-activities.ts                       # full_attempt (alle 131 Regionen)
 *   npx tsx src/scripts/import-activities.ts --region blsalzb --dry-run
 *   npx tsx src/scripts/import-activities.ts --reconcile           # Recovery nach abgebrochenem Lauf
 *
 * Flags:
 *   --region <slug>  nur diese Region: Daten-Upsert + Rekonsolidierung der
 *                    beruehrten Gruppen — KEINE Runs-Zeile, KEINE
 *                    Sichtungsfelder, kein Prune (Epic E6)
 *   --dry-run        schreibt GAR NICHTS (auch keine Runs-Zeile)
 *   --reconcile      rekonsolidiert alle Gruppen mit >1 Mitglied oder
 *                    gesetztem duplicate_of (Reparatur, Task-Spec d)
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (oder SUPABASE_URL) +
 *      SUPABASE_SERVICE_ROLE_KEY (nur fuer Schreib-Laeufe; --dry-run
 *      braucht keine Secrets). Kein Eintrag in der Scraper-Registry —
 *      die ist hart auf events verdrahtet (src/lib/scrapers/index.ts).
 *
 * OPS-HINWEIS (dokumentiert, KEIN Script-Schritt — PostgREST/Service-Key
 * kann kein Maintenance-SQL): nach dem Initial-Vollimport die Index-
 * Migration 20260724121000_poi_activities_indexes.sql im Supabase-
 * Dashboard anwenden und dort einmalig `ANALYZE public.poi_activities;`
 * ausfuehren (danach uebernimmt Autovacuum).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REGIONS } from '@/lib/scrapers/FeratelScraper';
import {
  fetchRegionInfrastructures,
  generateDesklineSessionId,
} from '@/lib/activities/deskline-client';
import { runIngest, type ActivityStore, type IngestMode } from '@/lib/activities/ingest';
import {
  SupabaseActivityStore,
  createActivityStoreClient,
} from '@/lib/activities/activity-store';

// .env.local laden (Next.js macht das automatisch, tsx nicht) — Muster
// aus import-eventim.ts.
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    if (!process.env[key]) process.env[key] = trimmed.substring(eqIdx + 1).trim();
  }
} catch {
  /* rely on the real environment */
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? '') : undefined;
}
const hasFlag = (name: string) => process.argv.includes(name);

async function main(): Promise<void> {
  const dryRun = hasFlag('--dry-run');
  const reconcile = hasFlag('--reconcile');
  const region = arg('--region');

  if (reconcile && region !== undefined) {
    throw new Error('--reconcile und --region schliessen sich aus');
  }
  if (reconcile && dryRun) {
    // Sonst saehe ein Operator einen gruenen "Recovery"-Lauf, der in
    // Wahrheit ein Read-only-No-op war.
    throw new Error('--reconcile ist ein Schreib-Kommando und nicht mit --dry-run kombinierbar');
  }
  if (region !== undefined && (region === '' || region.startsWith('--'))) {
    // Ohne diesen Guard wuerde ein vergessener Slug ('--region --dry-run')
    // stillschweigend zum Voll-Lauf degradieren.
    throw new Error('--region braucht einen REGIONS-Slug (z. B. --region blsalzb)');
  }
  const mode: IngestMode = reconcile ? 'reconcile' : region ? 'region' : 'full';

  const log = (msg: string) => console.log(msg);

  // dry-run braucht keinen DB-Zugriff fuer den Fetch-/Transform-Teil,
  // aber der Store wird fuer Liveness-Kontexte des reconcile-Modus
  // gebraucht — dort ist dry-run rein lesend. Fuer den reinen
  // Fetch-Smoke (--region X --dry-run) darf das Script auch ganz ohne
  // Supabase-Secrets laufen.
  const needsDb = !dryRun || mode === 'reconcile';
  const store = needsDb
    ? new SupabaseActivityStore(createActivityStoreClient())
    : createDryRunStoreStub();

  const sessionId = generateDesklineSessionId();
  const result = await runIngest(
    {
      store,
      fetchRegion: (code) => fetchRegionInfrastructures(code, sessionId, log),
      regions: REGIONS.map((r) => ({ code: r.code, bundesland: r.bundesland })),
      log,
    },
    { mode, region, dryRun },
  );

  console.log(
    `[import-activities] DONE — mode=${result.mode} dryRun=${result.dryRun} ` +
      `fetched=${result.fetched} importable=${result.importable} ` +
      `inserted=${result.inserted} updated=${result.updated} ` +
      `reconciledGroups=${result.reconciledGroups} prunedGroups=${result.prunedGroups} ` +
      `runSeq=${result.runSeq ?? '-'} complete=${result.isComplete ?? '-'}`,
  );
  if (result.regionsFailed.length > 0) {
    console.error(
      `[import-activities] ${result.regionsFailed.length} Regionen FAILED: ` +
        result.regionsFailed.map((f) => f.code).join(', '),
    );
    // full_attempt mit Fehl-Regionen: Daten/Sichtungen sind geschrieben,
    // aber der Lauf ist nicht complete -> Exit 1, damit die GH-Action rot
    // wird und der Fehllauf auffaellt (Prune ist davon unberuehrt, E6).
    process.exit(1);
  }

  // Explizites exit(0): verwaiste Sockets getimeouteter Fetches duerfen
  // den Job nicht am Leben halten (CLAUDE.md-Muster aus scrape.ts).
  process.exit(0);
}

/** Store-Stub fuer reine Fetch-/Transform-Smokes ohne Secrets
 *  (--dry-run ausserhalb von --reconcile). Der Orchestrator ruft im
 *  dry-run keinerlei Store-Methoden auf — jeder Aufruf hier ist ein Bug. */
function createDryRunStoreStub(): ActivityStore {
  const forbid = (method: string) => () => {
    throw new Error(`[import-activities] dry-run darf keine Store-Methode aufrufen (${method})`);
  };
  return {
    createRun: forbid('createRun'),
    updateRun: forbid('updateRun'),
    getRecentCompleteRuns: forbid('getRecentCompleteRuns'),
    prefetchExisting: forbid('prefetchExisting'),
    insertActivities: forbid('insertActivities'),
    updateActivities: forbid('updateActivities'),
    markSeen: forbid('markSeen'),
    markSeenComplete: forbid('markSeenComplete'),
    fetchGroupMembers: forbid('fetchGroupMembers'),
    applyGroupUpdates: forbid('applyGroupUpdates'),
    fetchPruneCandidates: forbid('fetchPruneCandidates'),
    scanGroupKeys: forbid('scanGroupKeys'),
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
