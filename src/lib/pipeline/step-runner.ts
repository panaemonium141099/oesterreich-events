import type { StepResult } from './scrape-pipeline-types';

export const STEP_DEPENDENCIES: Record<string, string[]> = {
  scrapers: [],
  venues: [],
  normalize: [],
  // Deterministic backfill runs first — cheap, free, bulk. Writes cat-v2 rules_*
  // confidence on every stale row, so the AI-residue step only sees events the
  // rules genuinely could not resolve.
  categorization_backfill: ['normalize'],
  categorization: ['normalize', 'categorization_backfill'],
  geocoding: ['normalize'],
  scoring: ['normalize'],
  // Dedup runs after scoring so the cluster-primary selection can use the
  // quality score as a tiebreaker. Writes publish_status='duplicate' and
  // duplicate_of=<primary> on losers; the App filters those out.
  dedup: ['normalize', 'scoring'],
  artist_matching: ['dedup'],
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
