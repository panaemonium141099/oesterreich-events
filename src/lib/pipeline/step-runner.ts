import type { StepResult } from './scrape-pipeline-types';

export const STEP_DEPENDENCIES: Record<string, string[]> = {
  scrapers: [],
  venues: [],
  normalize: [],
  // Deterministic rule-based backfill runs first as a cheap fallback.
  // Writes a coarse `category` on every stale row so events without
  // enrichment still have SOMETHING. Since v3 (2026-04-23) the enrichment
  // step further down overwrites this with a better AI-derived category
  // using the 11-Hauptkategorie taxonomy — but this step stays as the
  // safety net for events that skip enrichment (--skip-enrichment flag).
  categorization_backfill: ['normalize'],
  // Legacy AI-residue step via OpenAI (categorize-events.ts without flags).
  // Fully superseded by the enrichment step, kept in the map only so code
  // referencing it doesn't break. Never scheduled.
  categorization: ['normalize', 'categorization_backfill'],
  geocoding: ['normalize'],
  scoring: ['normalize'],
  // Dedup runs after scoring so the cluster-primary selection can use the
  // quality score as a tiebreaker. Writes publish_status='duplicate' and
  // duplicate_of=<primary> on losers; the App filters those out.
  dedup: ['normalize', 'scoring'],
  artist_matching: ['dedup'],
  // Enrichment runs AFTER dedup so Claude only processes the canonical
  // events, not the duplicate losers. Relies on the enricher's own
  // resume-safe filter (enrichment_version IS NULL OR != current) to
  // skip already-enriched rows — i.e. only NEW events from this scrape
  // get enriched. Re-runs are cheap: a second pass is a ~no-op.
  enrichment: ['dedup'],
  // Indexing submits event URLs to IndexNow (Bing/Yandex) and Google Indexing
  // API. Runs last, after dedup has marked canonical rows, so we don't spend
  // API quota on duplicates the apps then redirect away from.
  indexing: ['dedup', 'enrichment'],
  report: [],
};

export function shouldSkipStep(
  stepName: string,
  completedSteps: Record<string, StepResult>,
): string | null {
  const deps = STEP_DEPENDENCIES[stepName] ?? [];

  for (const dep of deps) {
    const depResult = completedSteps[dep];
    if (!depResult) continue;

    if (depResult.status === 'failed' || depResult.status === 'skipped_dependency') {
      return `${dep} failed`;
    }
  }

  return null;
}

export async function runStep(
  stepName: string,
  fn: () => Promise<Partial<StepResult> | void>,
  completedSteps: Record<string, StepResult>,
): Promise<StepResult> {
  const skipReason = shouldSkipStep(stepName, completedSteps);
  if (skipReason) {
    console.log(`[pipeline] Skipping ${stepName}: ${skipReason}`);
    return {
      status: 'skipped_dependency',
      duration_ms: 0,
      reason: skipReason,
    };
  }

  const start = Date.now();
  console.log(`[pipeline] Starting ${stepName}...`);

  try {
    const extras = await fn();
    const duration_ms = Date.now() - start;
    console.log(`[pipeline] ${stepName} completed in ${(duration_ms / 1000).toFixed(1)}s`);
    return {
      status: 'success',
      duration_ms,
      ...extras,
    };
  } catch (err) {
    const duration_ms = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] ${stepName} FAILED after ${(duration_ms / 1000).toFixed(1)}s: ${message}`);
    return {
      status: 'failed',
      duration_ms,
      error: message,
    };
  }
}
