import type { StepResult } from './scrape-pipeline-types';

export const STEP_DEPENDENCIES: Record<string, string[]> = {
  scrapers: [],
  venues: [],
  normalize: [],
  geocoding: ['normalize'],
  scoring: ['normalize'],
  artist_matching: [],
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
