# Scraper Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken daily GitHub Actions scraper cron with a reliable 7-step pipeline that includes geocoding, scoring, retry logic, Supabase run tracking, email alerts, and an admin dashboard.

**Architecture:** A new `scrape-pipeline.ts` orchestrates 7 dependency-aware steps (scrape -> venues -> normalize -> geocode -> score -> artist-match -> report). Results are logged to `pipeline_runs` + `scraper_stats` Supabase tables. A reporter module sends email alerts via Resend on failure. The GitHub Actions workflow is replaced with a single `timezone: Europe/Vienna` schedule at 03:17.

**Tech Stack:** TypeScript, Supabase PostgreSQL, GitHub Actions, Resend (email), React Email templates, Next.js API Routes

**Spec:** `docs/superpowers/specs/2026-04-09-scraper-automation-design.md`

**Spec deviation:** The spec calls the table `scrape_runs`, but a table with that name already exists in Supabase (tracks per-scraper runs with a `source_name` column). To avoid breaking the existing system, this plan uses `pipeline_runs` for the new pipeline-level tracking table. The existing `scrape_runs` table and its API remain untouched.

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/lib/pipeline/scrape-pipeline-types.ts` | Shared types for pipeline runs, step results, scraper stats |
| `src/lib/pipeline/retry.ts` | Retryable error classification + exponential backoff wrapper |
| `src/lib/pipeline/step-runner.ts` | Generic step runner with dependency checking and timing |
| `src/lib/scrape-reporter.ts` | Finalize run in Supabase, send alert email, write GitHub summary |
| `src/emails/scrape-alert.tsx` | React Email template for pipeline failure alerts |
| `src/scripts/scrape-pipeline.ts` | Master orchestrator (replaces `scrape-all.ts`) |
| `src/scripts/finalize-stale-runs.ts` | GitHub Actions crash-safety fallback |
| `src/app/api/admin/scraper-health/route.ts` | Per-scraper health aggregation API |
| `src/__tests__/pipeline/retry.test.ts` | Tests for retry logic |
| `src/__tests__/pipeline/step-runner.test.ts` | Tests for step dependency logic |
| `src/__tests__/pipeline/scrape-reporter.test.ts` | Tests for reporter |

### Modified files
| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_pipeline_runs.sql` | Create `pipeline_runs` + `scraper_stats` tables |
| `.github/workflows/scrape-events.yml` | Replace with single-schedule pipeline workflow |
| `src/lib/scrapers/index.ts` | Export `scrapers` array + new `runScraperWithResult()` returning stats |
| `src/app/api/admin/scrape-runs/route.ts` | Update to query `pipeline_runs` instead of `scrape_runs` |
| `src/app/api/admin/scrape-runs/[id]/route.ts` | Update to return `scraper_stats` rows for a pipeline run |
| `src/app/admin/scraper-runs/page.tsx` | Update UI for pipeline run data + add Scraper Health tab |
| `package.json` | Add `scrape:pipeline` npm script |

---

## Task 1: Pipeline Types

**Files:**
- Create: `src/lib/pipeline/scrape-pipeline-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/pipeline/scrape-pipeline-types.ts

export type PipelineTrigger = 'cron' | 'manual' | 'github_dispatch';

export type PipelineRunStatus = 'running' | 'success' | 'partial_failure' | 'failed';

export type StepStatus = 'success' | 'failed' | 'partial_failure' | 'skipped_dependency';

export type ScraperStatStatus = 'success' | 'failed' | 'skipped';

export interface StepResult {
  status: StepStatus;
  duration_ms: number;
  error?: string;
  reason?: string;
  // Step-specific extras (scrapers)
  succeeded?: number;
  failed?: number;
  // Step-specific extras (geocoding)
  fix_count?: number;
  gemini_count?: number;
}

export interface ScraperResult {
  scraper_name: string;
  status: ScraperStatStatus;
  events_found: number;
  events_updated: number;
  duration_ms: number;
  error_message: string | null;
  retry_count: number;
}

export interface PipelineResults {
  trigger: PipelineTrigger;
  run_id: string | null; // null in dry-run
  started_at: string;
  finished_at: string | null;
  steps: Record<string, StepResult>;
  scraper_results: ScraperResult[];
  total_events_scraped: number;
  total_events_updated: number;
  total_errors: number;
  github_run_id: string | null;
  github_run_url: string | null;
  dry_run: boolean;
}

export interface PipelineOptions {
  trigger: PipelineTrigger;
  source?: string; // run only this scraper
  skipScrapers?: boolean;
  skipVenues?: boolean;
  skipGeocoding?: boolean;
  skipScore?: boolean;
  dryRun?: boolean;
}

/** Error patterns that indicate transient/retryable failures */
export const RETRYABLE_PATTERNS = [
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'socket hang up',
  'network timeout',
  'UND_ERR_CONNECT_TIMEOUT',
  'fetch failed',
  '502',
  '503',
  '504',
  '429',
] as const;

export const MAX_RETRIES = 2;
export const RETRY_DELAYS_MS = [30_000, 60_000] as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/lib/pipeline/scrape-pipeline-types.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/pipeline/scrape-pipeline-types.ts
git commit -m "feat(pipeline): add scrape pipeline types"
```

---

## Task 2: Retry Logic

**Files:**
- Create: `src/lib/pipeline/retry.ts`
- Create: `src/__tests__/pipeline/retry.test.ts`

- [ ] **Step 1: Write failing tests for retry logic**

```typescript
// src/__tests__/pipeline/retry.test.ts
import { describe, it, expect, vi } from 'vitest';
import { isRetryableError, withRetry } from '@/lib/pipeline/retry';

describe('isRetryableError', () => {
  it('returns true for ECONNREFUSED', () => {
    expect(isRetryableError(new Error('connect ECONNREFUSED 127.0.0.1:443'))).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    expect(isRetryableError(new Error('connect ETIMEDOUT 10.0.0.1:443'))).toBe(true);
  });

  it('returns true for 503 status', () => {
    expect(isRetryableError(new Error('Request failed with status 503'))).toBe(true);
  });

  it('returns true for socket hang up', () => {
    expect(isRetryableError(new Error('socket hang up'))).toBe(true);
  });

  it('returns false for parse errors', () => {
    expect(isRetryableError(new Error('Unexpected token < in JSON'))).toBe(false);
  });

  it('returns false for 404', () => {
    expect(isRetryableError(new Error('Request failed with status 404'))).toBe(false);
  });

  it('returns false for validation errors', () => {
    expect(isRetryableError(new Error('Invalid date format'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result.value).toBe('ok');
    expect(result.retryCount).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { delaysMs: [10, 20] });
    expect(result.value).toBe('ok');
    expect(result.retryCount).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Unexpected token <'));
    const result = await withRetry(fn, { delaysMs: [10, 20] });
    expect(result.error).toBe('Unexpected token <');
    expect(result.retryCount).toBe(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('connect ETIMEDOUT'));
    const result = await withRetry(fn, { delaysMs: [10, 20] });
    expect(result.error).toContain('ETIMEDOUT');
    expect(result.retryCount).toBe(2);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/pipeline/retry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement retry logic**

```typescript
// src/lib/pipeline/retry.ts
import {
  RETRYABLE_PATTERNS,
  RETRY_DELAYS_MS,
  MAX_RETRIES,
} from './scrape-pipeline-types';

export function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return RETRYABLE_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

export interface RetryResult<T> {
  value?: T;
  error?: string;
  retryCount: number;
}

export interface RetryOptions {
  maxRetries?: number;
  delaysMs?: readonly number[];
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const delays = options.delaysMs ?? RETRY_DELAYS_MS;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn();
      return { value, retryCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (!isRetryableError(err) || attempt === maxRetries) {
        return { error: message, retryCount };
      }

      retryCount++;
      const delay = delays[Math.min(attempt, delays.length - 1)];
      console.log(
        `[retry] Attempt ${attempt + 1}/${maxRetries} failed (${message}), ` +
        `retrying in ${delay / 1000}s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // unreachable, but TypeScript needs it
  return { error: 'Max retries exceeded', retryCount };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pipeline/retry.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/retry.ts src/__tests__/pipeline/retry.test.ts
git commit -m "feat(pipeline): add retry logic with retryable error classification"
```

---

## Task 3: Step Runner with Dependency Checking

**Files:**
- Create: `src/lib/pipeline/step-runner.ts`
- Create: `src/__tests__/pipeline/step-runner.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/pipeline/step-runner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runStep, shouldSkipStep, STEP_DEPENDENCIES } from '@/lib/pipeline/step-runner';
import type { StepResult } from '@/lib/pipeline/scrape-pipeline-types';

describe('STEP_DEPENDENCIES', () => {
  it('scrapers has no dependencies', () => {
    expect(STEP_DEPENDENCIES.scrapers).toEqual([]);
  });

  it('geocoding depends on normalize', () => {
    expect(STEP_DEPENDENCIES.geocoding).toContain('normalize');
  });

  it('scoring depends on normalize', () => {
    expect(STEP_DEPENDENCIES.scoring).toContain('normalize');
  });

  it('report has no dependencies', () => {
    expect(STEP_DEPENDENCIES.report).toEqual([]);
  });
});

describe('shouldSkipStep', () => {
  it('returns null for steps with no dependencies', () => {
    const completed: Record<string, StepResult> = {};
    expect(shouldSkipStep('scrapers', completed)).toBeNull();
  });

  it('returns null when dependency succeeded', () => {
    const completed: Record<string, StepResult> = {
      normalize: { status: 'success', duration_ms: 1000 },
    };
    expect(shouldSkipStep('geocoding', completed)).toBeNull();
  });

  it('returns null when dependency had partial_failure', () => {
    const completed: Record<string, StepResult> = {
      normalize: { status: 'partial_failure', duration_ms: 1000 },
    };
    expect(shouldSkipStep('geocoding', completed)).toBeNull();
  });

  it('returns skip reason when dependency failed', () => {
    const completed: Record<string, StepResult> = {
      normalize: { status: 'failed', duration_ms: 1000, error: 'Connection refused' },
    };
    const reason = shouldSkipStep('geocoding', completed);
    expect(reason).toContain('normalize failed');
  });

  it('returns skip reason when dependency was skipped', () => {
    const completed: Record<string, StepResult> = {
      normalize: { status: 'skipped_dependency', duration_ms: 0, reason: 'something' },
    };
    expect(shouldSkipStep('geocoding', completed)).toContain('normalize');
  });
});

describe('runStep', () => {
  it('runs function and returns success result', async () => {
    const fn = vi.fn().mockResolvedValue({ extra: 42 });
    const result = await runStep('scrapers', fn, {});
    expect(result.status).toBe('success');
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('returns failed result on error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await runStep('scrapers', fn, {});
    expect(result.status).toBe('failed');
    expect(result.error).toBe('boom');
  });

  it('returns skipped_dependency when dependency failed', async () => {
    const fn = vi.fn();
    const completed: Record<string, StepResult> = {
      normalize: { status: 'failed', duration_ms: 100, error: 'crash' },
    };
    const result = await runStep('geocoding', fn, completed);
    expect(result.status).toBe('skipped_dependency');
    expect(result.reason).toContain('normalize failed');
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/pipeline/step-runner.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement step runner**

```typescript
// src/lib/pipeline/step-runner.ts
import type { StepResult } from './scrape-pipeline-types';

/**
 * Step dependency map. Each key depends on the listed steps.
 * If a dependency has status 'failed' or 'skipped_dependency',
 * the step is skipped with status 'skipped_dependency'.
 */
export const STEP_DEPENDENCIES: Record<string, string[]> = {
  scrapers: [],
  venues: [],
  normalize: [], // Runs even if scrapers partially failed — partial data worth normalizing
  geocoding: ['normalize'],
  scoring: ['normalize'],
  artist_matching: [], // Runs if any new events ingested (checked inside the step)
  report: [],
};

/**
 * Check if a step should be skipped due to failed dependencies.
 * Returns skip reason string if should skip, null if OK to run.
 */
export function shouldSkipStep(
  stepName: string,
  completedSteps: Record<string, StepResult>,
): string | null {
  const deps = STEP_DEPENDENCIES[stepName] ?? [];

  for (const dep of deps) {
    const depResult = completedSteps[dep];
    if (!depResult) continue; // dependency hasn't run (shouldn't happen in sequence)

    if (depResult.status === 'failed' || depResult.status === 'skipped_dependency') {
      return `${dep} failed`;
    }
  }

  return null;
}

/**
 * Run a pipeline step with dependency checking and timing.
 * The step function can return extra fields to merge into the StepResult.
 */
export async function runStep(
  stepName: string,
  fn: () => Promise<Partial<StepResult> | void>,
  completedSteps: Record<string, StepResult>,
): Promise<StepResult> {
  // Check dependencies first
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pipeline/step-runner.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline/step-runner.ts src/__tests__/pipeline/step-runner.test.ts
git commit -m "feat(pipeline): add step runner with dependency-aware skip logic"
```

---

## Task 4: Database Migration — `pipeline_runs` + `scraper_stats`

**Files:**
- Create: `supabase/migrations/20260409_pipeline_runs.sql`

**Why `pipeline_runs` not `scrape_runs`?** The existing `scrape_runs` table tracks per-scraper runs (has `source_name` column). The spec's new table tracks full pipeline runs. To avoid breaking the existing admin page, we create a new table with a distinct name.

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260409_pipeline_runs.sql

-- Pipeline-level run tracking (one row per full pipeline execution)
CREATE TABLE pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  trigger text NOT NULL CHECK (trigger IN ('cron', 'manual', 'github_dispatch')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial_failure', 'failed')),
  total_events_scraped int DEFAULT 0,
  total_events_updated int DEFAULT 0,
  total_errors int DEFAULT 0,
  pipeline_steps jsonb DEFAULT '{}',
  github_run_id bigint,
  github_run_url text
);

CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs (started_at DESC);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs (status);

-- Per-scraper stats per pipeline run
CREATE TABLE scraper_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  scraper_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  events_found int DEFAULT 0,
  events_updated int DEFAULT 0,
  duration_ms int DEFAULT 0,
  error_message text,
  retry_count int DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scraper_stats_run_id ON scraper_stats (run_id);
CREATE INDEX idx_scraper_stats_scraper_name ON scraper_stats (scraper_name);
CREATE INDEX idx_scraper_stats_started_at ON scraper_stats (started_at DESC);

-- RLS: No RLS needed — these tables are only accessed by service_role from
-- server-side scripts and admin API routes (which verify admin role in code).
```

- [ ] **Step 2: Apply the migration**

Run via Supabase MCP: `apply_migration` with project_id and the SQL above.

- [ ] **Step 3: Verify tables exist**

Run: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('pipeline_runs', 'scraper_stats');`
Expected: Both tables returned

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260409_pipeline_runs.sql
git commit -m "feat(db): add pipeline_runs and scraper_stats tables"
```

---

## Task 5: Scraper Result Export

**Files:**
- Modify: `src/lib/scrapers/index.ts`

The existing `runScraper()` returns `Promise<void>`. We need to capture per-scraper results (events found, duration, errors). Add a new `runScraperWithResult()` that wraps the existing logic and returns a result object.

- [ ] **Step 1: Add `runScraperWithResult` function to `src/lib/scrapers/index.ts`**

Add after the existing `runScraper` function (around line 369):

```typescript
export interface ScraperRunResult {
  scraper_name: string;
  status: 'success' | 'error';
  events_found: number;
  events_inserted: number;
  events_updated: number;
  duration_ms: number;
  error_message: string | null;
}

export async function runScraperWithResult(scraper: BaseScraper): Promise<ScraperRunResult> {
  const start = Date.now();

  writeProgress(scraper.name, {
    status: 'running',
    current: 0,
    total: 0,
    eventsFound: 0,
    message: `Scraping ${scraper.name} (Pipeline)...`,
    startedAt: new Date().toISOString(),
  });

  try {
    const result = await runPipeline(scraper);
    clearProgress(scraper.name);

    return {
      scraper_name: scraper.name,
      status: result.status === 'error' ? 'error' : 'success',
      events_found: result.metrics.items_found,
      events_inserted: result.metrics.items_inserted,
      events_updated: result.metrics.items_updated,
      duration_ms: Date.now() - start,
      error_message: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${scraper.name}] Pipeline FEHLER: ${message}`);
    writeProgress(scraper.name, {
      status: 'error',
      current: 0,
      total: 0,
      eventsFound: 0,
      message: `Fehler: ${message}`,
      startedAt: new Date().toISOString(),
    });

    return {
      scraper_name: scraper.name,
      status: 'error',
      events_found: 0,
      events_inserted: 0,
      events_updated: 0,
      duration_ms: Date.now() - start,
      error_message: message,
    };
  }
}
```

- [ ] **Step 2: Export the `scrapers` array**

Change `const scrapers: BaseScraper[] = [` (line ~114) to:

```typescript
export const scrapers: BaseScraper[] = [
```

This lets `scrape-pipeline.ts` iterate over individual scrapers.

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/scrapers/index.ts
git commit -m "feat(scrapers): add runScraperWithResult + export scrapers array"
```

---

## Task 6: Email Alert Template

**Files:**
- Create: `src/emails/scrape-alert.tsx`

- [ ] **Step 1: Create the email template**

Follow the same pattern as `src/emails/artist-alert.tsx` (inline styles, 600px max-width, HTML string output):

```tsx
// src/emails/scrape-alert.tsx

import type { PipelineRunStatus, ScraperResult } from '@/lib/pipeline/scrape-pipeline-types';

interface ScrapeAlertEmailData {
  status: PipelineRunStatus;
  started_at: string;
  finished_at: string;
  total_events_scraped: number;
  total_errors: number;
  failed_scrapers: ScraperResult[];
  pipeline_steps: Record<string, { status: string; duration_ms?: number; error?: string; reason?: string }>;
  dashboard_url: string;
  github_run_url: string | null;
}

export function renderScrapeAlertEmail(data: ScrapeAlertEmailData): string {
  const duration = Math.round(
    (new Date(data.finished_at).getTime() - new Date(data.started_at).getTime()) / 1000 / 60,
  );

  const statusColor = data.status === 'failed' ? '#ef4444' : '#f59e0b';
  const statusLabel = data.status === 'failed' ? 'FEHLGESCHLAGEN' : 'TEILWEISE FEHLGESCHLAGEN';

  const stepRows = Object.entries(data.pipeline_steps)
    .map(([name, step]) => {
      const icon = step.status === 'success' ? '✅' :
                   step.status === 'failed' ? '❌' :
                   step.status === 'partial_failure' ? '⚠️' :
                   step.status === 'skipped_dependency' ? '⏭️' : '❓';
      const durationStr = step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : '--';
      const detail = step.error || step.reason || '';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #333">${icon} ${name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333">${step.status}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333">${durationStr}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #333;color:#999;font-size:12px">${detail}</td>
      </tr>`;
    })
    .join('');

  const failedScraperRows = data.failed_scrapers
    .slice(0, 20) // max 20 in email
    .map((s) => `<tr>
      <td style="padding:6px 12px;border-bottom:1px solid #333">${s.scraper_name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #333;color:#ef4444;font-size:12px">${s.error_message || 'Unknown error'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #333">${s.retry_count}</td>
    </tr>`)
    .join('');

  const githubLink = data.github_run_url
    ? `<a href="${data.github_run_url}" style="color:#60a5fa;text-decoration:none">GitHub Actions Run &rarr;</a>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:${statusColor}22;border:1px solid ${statusColor}44;border-radius:12px;padding:20px;margin-bottom:24px">
      <h1 style="margin:0;color:${statusColor};font-size:20px">Scrape Pipeline: ${statusLabel}</h1>
      <p style="margin:8px 0 0;color:#ccc;font-size:14px">${new Date(data.started_at).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    </div>

    <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:16px">
      <table style="width:100%;color:#ccc;font-size:14px">
        <tr><td style="padding:4px 0;color:#999">Dauer</td><td style="padding:4px 0;text-align:right">${duration} Minuten</td></tr>
        <tr><td style="padding:4px 0;color:#999">Events gescraped</td><td style="padding:4px 0;text-align:right">${data.total_events_scraped}</td></tr>
        <tr><td style="padding:4px 0;color:#999">Fehler gesamt</td><td style="padding:4px 0;text-align:right;color:${data.total_errors > 0 ? '#ef4444' : '#ccc'}">${data.total_errors}</td></tr>
      </table>
    </div>

    <h2 style="color:#ccc;font-size:16px;margin:24px 0 12px">Pipeline Steps</h2>
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;overflow:hidden">
      <table style="width:100%;color:#ccc;font-size:13px;border-collapse:collapse">
        <thead><tr style="background:#222">
          <th style="padding:8px 12px;text-align:left;color:#999">Step</th>
          <th style="padding:8px 12px;text-align:left;color:#999">Status</th>
          <th style="padding:8px 12px;text-align:left;color:#999">Dauer</th>
          <th style="padding:8px 12px;text-align:left;color:#999">Detail</th>
        </tr></thead>
        <tbody>${stepRows}</tbody>
      </table>
    </div>

    ${data.failed_scrapers.length > 0 ? `
    <h2 style="color:#ccc;font-size:16px;margin:24px 0 12px">Fehlgeschlagene Scraper (${data.failed_scrapers.length})</h2>
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;overflow:hidden">
      <table style="width:100%;color:#ccc;font-size:13px;border-collapse:collapse">
        <thead><tr style="background:#222">
          <th style="padding:6px 12px;text-align:left;color:#999">Scraper</th>
          <th style="padding:6px 12px;text-align:left;color:#999">Fehler</th>
          <th style="padding:6px 12px;text-align:left;color:#999">Retries</th>
        </tr></thead>
        <tbody>${failedScraperRows}</tbody>
      </table>
    </div>` : ''}

    <div style="margin-top:24px;text-align:center">
      <a href="${data.dashboard_url}" style="display:inline-block;background:#3b82f6;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;margin-right:8px">Admin Dashboard</a>
      ${githubLink}
    </div>
  </div>
</body>
</html>`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/emails/scrape-alert.tsx
git commit -m "feat(emails): add scrape pipeline alert email template"
```

---

## Task 7: Scrape Reporter

**Files:**
- Create: `src/lib/scrape-reporter.ts`
- Create: `src/__tests__/pipeline/scrape-reporter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/pipeline/scrape-reporter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeFinalStatus, buildGitHubSummary } from '@/lib/scrape-reporter';
import type { PipelineResults, StepResult } from '@/lib/pipeline/scrape-pipeline-types';

describe('computeFinalStatus', () => {
  it('returns success when all steps succeeded', () => {
    const steps: Record<string, StepResult> = {
      scrapers: { status: 'success', duration_ms: 1000 },
      venues: { status: 'success', duration_ms: 500 },
      normalize: { status: 'success', duration_ms: 200 },
    };
    expect(computeFinalStatus(steps, 0)).toBe('success');
  });

  it('returns partial_failure when scrapers partially failed', () => {
    const steps: Record<string, StepResult> = {
      scrapers: { status: 'partial_failure', duration_ms: 1000, succeeded: 138, failed: 3 },
      venues: { status: 'success', duration_ms: 500 },
    };
    expect(computeFinalStatus(steps, 3)).toBe('partial_failure');
  });

  it('returns failed when a critical step failed', () => {
    const steps: Record<string, StepResult> = {
      scrapers: { status: 'success', duration_ms: 1000 },
      normalize: { status: 'failed', duration_ms: 100, error: 'crash' },
    };
    expect(computeFinalStatus(steps, 0)).toBe('failed');
  });

  it('returns partial_failure when only scrapers had errors', () => {
    const steps: Record<string, StepResult> = {
      scrapers: { status: 'success', duration_ms: 1000 },
    };
    expect(computeFinalStatus(steps, 5)).toBe('partial_failure');
  });
});

describe('buildGitHubSummary', () => {
  it('produces markdown with status and step table', () => {
    const results: PipelineResults = {
      trigger: 'cron',
      run_id: 'test-id',
      started_at: '2026-04-09T03:17:00Z',
      finished_at: '2026-04-09T04:30:00Z',
      steps: {
        scrapers: { status: 'success', duration_ms: 3600000, succeeded: 141, failed: 0 },
      },
      scraper_results: [],
      total_events_scraped: 5000,
      total_events_updated: 200,
      total_errors: 0,
      github_run_id: '12345',
      github_run_url: 'https://github.com/test/actions/runs/12345',
      dry_run: false,
    };
    const md = buildGitHubSummary(results);
    expect(md).toContain('Scrape Pipeline');
    expect(md).toContain('5000');
    expect(md).toContain('scrapers');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/pipeline/scrape-reporter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the reporter**

```typescript
// src/lib/scrape-reporter.ts
import { createClient } from '@supabase/supabase-js';
import { renderScrapeAlertEmail } from '@/emails/scrape-alert';
import type {
  PipelineResults,
  PipelineRunStatus,
  StepResult,
  ScraperResult,
} from './pipeline/scrape-pipeline-types';
import fs from 'fs';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Determine the overall pipeline status from step results and error count.
 */
export function computeFinalStatus(
  steps: Record<string, StepResult>,
  totalErrors: number,
): PipelineRunStatus {
  // Any non-scraper step that failed = overall failed
  for (const [name, step] of Object.entries(steps)) {
    if (name === 'scrapers') continue;
    if (step.status === 'failed') return 'failed';
  }

  // Scraper-level errors or partial_failure = partial_failure
  const scraperStep = steps.scrapers;
  if (
    totalErrors > 0 ||
    scraperStep?.status === 'partial_failure'
  ) {
    return 'partial_failure';
  }

  return 'success';
}

/**
 * Create a pipeline_runs row at the start. Returns the row ID.
 */
export async function createPipelineRun(
  trigger: string,
  githubRunId: string | null,
  githubRunUrl: string | null,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({
      trigger,
      status: 'running',
      github_run_id: githubRunId ? parseInt(githubRunId, 10) : null,
      github_run_url: githubRunUrl,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create pipeline_runs row: ${error.message}`);
  return data.id;
}

/**
 * Insert scraper_stats rows for a pipeline run.
 */
export async function insertScraperStats(
  runId: string,
  results: ScraperResult[],
): Promise<void> {
  if (results.length === 0) return;
  const supabase = getSupabaseAdmin();

  // Insert in batches of 50
  for (let i = 0; i < results.length; i += 50) {
    const batch = results.slice(i, i + 50).map((r) => ({
      run_id: runId,
      scraper_name: r.scraper_name,
      status: r.status,
      events_found: r.events_found,
      events_updated: r.events_updated,
      duration_ms: r.duration_ms,
      error_message: r.error_message,
      retry_count: r.retry_count,
    }));

    const { error } = await supabase.from('scraper_stats').insert(batch);
    if (error) {
      console.error(`Failed to insert scraper_stats batch: ${error.message}`);
    }
  }
}

/**
 * Finalize the pipeline_runs row with results.
 */
export async function finalizePipelineRun(
  runId: string,
  results: PipelineResults,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const status = computeFinalStatus(results.steps, results.total_errors);

  const { error } = await supabase
    .from('pipeline_runs')
    .update({
      finished_at: new Date().toISOString(),
      status,
      total_events_scraped: results.total_events_scraped,
      total_events_updated: results.total_events_updated,
      total_errors: results.total_errors,
      pipeline_steps: results.steps,
    })
    .eq('id', runId);

  if (error) {
    console.error(`Failed to finalize pipeline_runs: ${error.message}`);
  }
}

/**
 * Send alert email if status warrants it.
 */
export async function sendAlertIfNeeded(results: PipelineResults): Promise<void> {
  const status = computeFinalStatus(results.steps, results.total_errors);
  if (status === 'success') return;

  const alertEmail = process.env.ALERT_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (!alertEmail || !resendKey) {
    console.log('[reporter] ALERT_EMAIL or RESEND_API_KEY not set, skipping email');
    return;
  }

  const failedScrapers = results.scraper_results.filter((s) => s.status === 'failed');
  const html = renderScrapeAlertEmail({
    status,
    started_at: results.started_at,
    finished_at: results.finished_at || new Date().toISOString(),
    total_events_scraped: results.total_events_scraped,
    total_errors: results.total_errors,
    failed_scrapers: failedScrapers,
    pipeline_steps: results.steps,
    dashboard_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://osterreich.events' : 'http://localhost:3000'}/admin/scraper-runs`,
    github_run_url: results.github_run_url,
  });

  const statusLabel = status === 'failed' ? 'FAILED' : 'Partial Failure';
  const dateStr = new Date(results.started_at).toLocaleDateString('de-AT', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'alerts@osterreich.events',
        to: alertEmail,
        subject: `[Osterreich Events] Scrape Pipeline: ${statusLabel} - ${dateStr}`,
        html,
      }),
    });

    if (res.ok) {
      console.log(`[reporter] Alert email sent to ${alertEmail}`);
    } else {
      console.error(`[reporter] Email send failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[reporter] Email send error: ${err}`);
  }
}

/**
 * Build GitHub Actions Job Summary markdown.
 */
export function buildGitHubSummary(results: PipelineResults): string {
  const status = computeFinalStatus(results.steps, results.total_errors);
  const icon = status === 'success' ? '✅' : status === 'partial_failure' ? '⚠️' : '❌';
  const duration = results.finished_at
    ? Math.round((new Date(results.finished_at).getTime() - new Date(results.started_at).getTime()) / 1000 / 60)
    : '?';

  let md = `## ${icon} Scrape Pipeline: ${status}\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Duration | ${duration} min |\n`;
  md += `| Events scraped | ${results.total_events_scraped} |\n`;
  md += `| Events updated | ${results.total_events_updated} |\n`;
  md += `| Errors | ${results.total_errors} |\n\n`;

  md += `### Pipeline Steps\n\n`;
  md += `| Step | Status | Duration |\n|------|--------|----------|\n`;
  for (const [name, step] of Object.entries(results.steps)) {
    const stepIcon = step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : step.status === 'partial_failure' ? '⚠️' : '⏭️';
    const dur = step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : '--';
    md += `| ${stepIcon} ${name} | ${step.status} | ${dur} |\n`;
  }

  const failedScrapers = results.scraper_results.filter((s) => s.status === 'failed');
  if (failedScrapers.length > 0) {
    md += `\n### Failed Scrapers (${failedScrapers.length})\n\n`;
    md += `| Scraper | Error | Retries |\n|---------|-------|--------|\n`;
    for (const s of failedScrapers.slice(0, 30)) {
      md += `| ${s.scraper_name} | ${s.error_message || '?'} | ${s.retry_count} |\n`;
    }
  }

  return md;
}

/**
 * Write GitHub summary to GITHUB_STEP_SUMMARY file.
 */
export function writeGitHubSummary(results: PipelineResults): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  try {
    const md = buildGitHubSummary(results);
    fs.appendFileSync(summaryFile, md);
    console.log('[reporter] GitHub summary written');
  } catch (err) {
    console.error(`[reporter] Failed to write GitHub summary: ${err}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pipeline/scrape-reporter.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/scrape-reporter.ts src/__tests__/pipeline/scrape-reporter.test.ts
git commit -m "feat(pipeline): add scrape reporter with Supabase logging and email alerts"
```

---

## Task 8: Master Pipeline Orchestrator

**Files:**
- Create: `src/scripts/scrape-pipeline.ts`

This is the central script that replaces `scrape-all.ts`. It uses all the modules from Tasks 1-7.

- [ ] **Step 1: Create the pipeline script**

```typescript
// src/scripts/scrape-pipeline.ts
/**
 * Master scrape pipeline orchestrator.
 *
 * Usage:
 *   npx tsx src/scripts/scrape-pipeline.ts --trigger cron
 *   npx tsx src/scripts/scrape-pipeline.ts --trigger manual --source burgenland.info
 *   npx tsx src/scripts/scrape-pipeline.ts --trigger github_dispatch --skip-geocoding
 *   npx tsx src/scripts/scrape-pipeline.ts --dry-run --trigger manual
 */
import { execSync } from 'child_process';
import {
  scrapers,
  getScraperByName,
  runScraperWithResult,
} from '../lib/scrapers';
import type { ScraperRunResult } from '../lib/scrapers';
import { closeSharedBrowser } from '../lib/scrapers/shared-browser';
import { triggerMatchArtists } from '../lib/post-scrape-hook';
import { withRetry } from '../lib/pipeline/retry';
import { runStep } from '../lib/pipeline/step-runner';
import {
  createPipelineRun,
  insertScraperStats,
  finalizePipelineRun,
  sendAlertIfNeeded,
  writeGitHubSummary,
  computeFinalStatus,
} from '../lib/scrape-reporter';
import type {
  PipelineOptions,
  PipelineResults,
  ScraperResult,
  StepResult,
} from '../lib/pipeline/scrape-pipeline-types';

const SCRAPER_CONCURRENCY = 10;

function parseArgs(): PipelineOptions {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  const has = (flag: string) => args.includes(flag);

  return {
    trigger: (get('--trigger') as PipelineOptions['trigger']) || 'manual',
    source: get('--source'),
    skipScrapers: has('--skip-scrapers'),
    skipVenues: has('--skip-venues'),
    skipGeocoding: has('--skip-geocoding'),
    skipScore: has('--skip-score'),
    dryRun: has('--dry-run'),
  };
}

function execStep(label: string, cmd: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

async function runScrapersStep(
  opts: PipelineOptions,
): Promise<{ stepExtras: Partial<StepResult>; scraperResults: ScraperResult[] }> {
  const scraperResults: ScraperResult[] = [];

  // Determine which scrapers to run
  const targetScrapers = opts.source
    ? [getScraperByName(opts.source)].filter(Boolean)
    : [...scrapers];

  if (opts.source && targetScrapers.length === 0) {
    throw new Error(`Scraper not found: ${opts.source}`);
  }

  // Mark non-targeted scrapers as skipped
  if (opts.source) {
    for (const s of scrapers) {
      if (s.name !== opts.source) {
        scraperResults.push({
          scraper_name: s.name,
          status: 'skipped',
          events_found: 0,
          events_updated: 0,
          duration_ms: 0,
          error_message: null,
          retry_count: 0,
        });
      }
    }
  }

  // Run with concurrency queue + retry
  const queue = [...targetScrapers];
  let succeeded = 0;
  let failed = 0;

  const workers = Array.from({ length: SCRAPER_CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const scraper = queue.shift();
      if (!scraper) continue;

      const retryResult = await withRetry(
        () => runScraperWithResult(scraper),
        { delaysMs: [30_000, 60_000] },
      );

      if (retryResult.value) {
        const result = retryResult.value;
        const isSuccess = result.status === 'success';
        scraperResults.push({
          scraper_name: result.scraper_name,
          status: isSuccess ? 'success' : 'failed',
          events_found: result.events_found,
          events_updated: result.events_updated,
          duration_ms: result.duration_ms,
          error_message: result.error_message,
          retry_count: retryResult.retryCount,
        });
        if (isSuccess) succeeded++;
        else failed++;
      } else {
        scraperResults.push({
          scraper_name: scraper.name,
          status: 'failed',
          events_found: 0,
          events_updated: 0,
          duration_ms: 0,
          error_message: retryResult.error || 'Unknown error',
          retry_count: retryResult.retryCount,
        });
        failed++;
      }
    }
  });

  await Promise.all(workers);
  await closeSharedBrowser();

  const status = failed === 0 ? 'success' : succeeded === 0 ? 'failed' : 'partial_failure';

  return {
    stepExtras: { status, succeeded, failed },
    scraperResults,
  };
}

async function main() {
  const opts = parseArgs();
  const steps: Record<string, StepResult> = {};
  let scraperResults: ScraperResult[] = [];
  let runId: string | null = null;

  const results: PipelineResults = {
    trigger: opts.trigger,
    run_id: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    steps: {},
    scraper_results: [],
    total_events_scraped: 0,
    total_events_updated: 0,
    total_errors: 0,
    github_run_id: process.env.GITHUB_RUN_ID || null,
    github_run_url: process.env.GITHUB_RUN_URL || null,
    dry_run: opts.dryRun || false,
  };

  // Create pipeline_runs row (unless dry-run)
  if (!opts.dryRun) {
    try {
      runId = await createPipelineRun(
        opts.trigger,
        process.env.GITHUB_RUN_ID || null,
        process.env.GITHUB_RUN_URL || null,
      );
      results.run_id = runId;
      console.log(`[pipeline] Created pipeline_runs row: ${runId}`);
    } catch (err) {
      console.error(`[pipeline] Failed to create pipeline_runs row: ${err}`);
      // Continue without tracking — the pipeline itself should still run
    }
  }

  try {
    // Step 1: Scrapers
    if (!opts.skipScrapers) {
      steps.scrapers = await runStep('scrapers', async () => {
        const { stepExtras, scraperResults: sr } = await runScrapersStep(opts);
        scraperResults = sr;
        return stepExtras;
      }, steps);
    }

    // Step 2: Venue feed ingestion
    if (!opts.skipVenues) {
      steps.venues = await runStep('venues', async () => {
        execStep('Venue feed ingestion', 'npx tsx --env-file=.env.local src/scripts/scrape-venues.ts');
      }, steps);
    }

    // Step 3: Normalize locations
    steps.normalize = await runStep('normalize', async () => {
      execStep('Normalize locations', 'npx tsx --env-file=.env.local src/scripts/normalize-locations.ts');
    }, steps);

    // Step 4: Geocoding (depends on normalize)
    if (!opts.skipGeocoding) {
      steps.geocoding = await runStep('geocoding', async () => {
        execStep('Fix geocoding', 'npx tsx --env-file=.env.local src/scripts/fix-geocoding.ts');
        execStep('Gemini geocode NULLs', 'npx tsx --env-file=.env.local src/scripts/gemini-geocode.ts --null');
      }, steps);
    }

    // Step 5: Score calculation (depends on normalize)
    if (!opts.skipScore) {
      steps.scoring = await runStep('scoring', async () => {
        execStep('Calculate scores', 'npx tsx --env-file=.env.local src/scripts/calculate-scores.ts');
      }, steps);
    }

    // Step 6: Artist matching
    steps.artist_matching = await runStep('artist_matching', async () => {
      await triggerMatchArtists();
    }, steps);

  } finally {
    // Step 7: ALWAYS finalize (crash safety via try/finally)
    results.steps = steps;
    results.scraper_results = scraperResults;
    results.finished_at = new Date().toISOString();

    // Aggregate totals
    results.total_events_scraped = scraperResults
      .filter((s) => s.status === 'success')
      .reduce((sum, s) => sum + s.events_found, 0);
    results.total_events_updated = scraperResults
      .filter((s) => s.status === 'success')
      .reduce((sum, s) => sum + s.events_updated, 0);
    results.total_errors = scraperResults.filter((s) => s.status === 'failed').length;

    if (!opts.dryRun && runId) {
      try {
        await insertScraperStats(runId, scraperResults);
        await finalizePipelineRun(runId, results);
      } catch (err) {
        console.error(`[pipeline] Failed to finalize: ${err}`);
      }

      try {
        await sendAlertIfNeeded(results);
      } catch (err) {
        console.error(`[pipeline] Failed to send alert: ${err}`);
      }
    }

    writeGitHubSummary(results);

    // Summary
    const status = computeFinalStatus(results.steps, results.total_errors);
    const elapsed = results.finished_at
      ? ((new Date(results.finished_at).getTime() - new Date(results.started_at).getTime()) / 1000 / 60).toFixed(1)
      : '?';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Pipeline ${status} | ${elapsed} min | ${results.total_events_scraped} events | ${results.total_errors} errors`);
    if (opts.dryRun) console.log('  (DRY RUN — nothing written to Supabase)');
    console.log(`${'='.repeat(60)}\n`);

    // Exit code: 0 on success/partial, 1 on failed
    if (status === 'failed') {
      process.exit(1);
    }
  }
}

main();
```

- [ ] **Step 2: Add npm script to `package.json`**

Add to the `"scripts"` section:

```json
"scrape:pipeline": "tsx src/scripts/scrape-pipeline.ts"
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors (the `closeSharedBrowser` import may need checking — verify the actual export name from `src/lib/scrapers/shared-browser.ts`)

- [ ] **Step 4: Commit**

```bash
git add src/scripts/scrape-pipeline.ts package.json
git commit -m "feat(pipeline): add master scrape pipeline orchestrator"
```

---

## Task 9: Crash-Safety Fallback Script

**Files:**
- Create: `src/scripts/finalize-stale-runs.ts`

- [ ] **Step 1: Create the fallback script**

```typescript
// src/scripts/finalize-stale-runs.ts
/**
 * Crash-safety fallback for GitHub Actions.
 * Scoped to a single github_run_id — will NOT sweep arbitrary stale runs.
 *
 * Usage: npx tsx src/scripts/finalize-stale-runs.ts --github-run-id 12345
 */
import { createClient } from '@supabase/supabase-js';
import { sendAlertIfNeeded } from '../lib/scrape-reporter';
import type { PipelineResults } from '../lib/pipeline/scrape-pipeline-types';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function main() {
  const args = process.argv.slice(2);
  const runIdIndex = args.indexOf('--github-run-id');
  const githubRunId = runIdIndex !== -1 ? args[runIdIndex + 1] : process.env.GITHUB_RUN_ID;

  if (!githubRunId) {
    console.log('[finalize] No --github-run-id provided, nothing to do');
    return;
  }

  const supabase = getSupabaseAdmin();

  // Find exactly this run's pipeline_runs row that's still 'running'
  const { data: run, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('github_run_id', parseInt(githubRunId, 10))
    .eq('status', 'running')
    .maybeSingle();

  if (error) {
    console.error(`[finalize] Query error: ${error.message}`);
    return;
  }

  if (!run) {
    console.log('[finalize] No stuck running pipeline found for this GitHub run — pipeline finalized normally');
    return;
  }

  // Mark as failed
  console.log(`[finalize] Found stuck pipeline_runs row ${run.id}, marking as failed`);
  const { error: updateError } = await supabase
    .from('pipeline_runs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      pipeline_steps: {
        ...((run.pipeline_steps as Record<string, unknown>) || {}),
        _crash_note: 'Pipeline process was killed before finalization. Marked as failed by crash-safety fallback.',
      },
    })
    .eq('id', run.id);

  if (updateError) {
    console.error(`[finalize] Update error: ${updateError.message}`);
    return;
  }

  // Send alert email
  const results: PipelineResults = {
    trigger: run.trigger,
    run_id: run.id,
    started_at: run.started_at,
    finished_at: new Date().toISOString(),
    steps: (run.pipeline_steps as Record<string, unknown>) || {},
    scraper_results: [],
    total_events_scraped: run.total_events_scraped || 0,
    total_events_updated: run.total_events_updated || 0,
    total_errors: 1,
    github_run_id: githubRunId,
    github_run_url: run.github_run_url || process.env.GITHUB_RUN_URL || null,
    dry_run: false,
  } as PipelineResults;

  try {
    await sendAlertIfNeeded(results);
  } catch (err) {
    console.error(`[finalize] Alert email failed: ${err}`);
  }

  console.log('[finalize] Done — pipeline marked as failed and alert sent');
}

main();
```

- [ ] **Step 2: Commit**

```bash
git add src/scripts/finalize-stale-runs.ts
git commit -m "feat(pipeline): add crash-safety fallback script (scoped to github_run_id)"
```

---

## Task 10: GitHub Actions Workflow

**Files:**
- Modify: `.github/workflows/scrape-events.yml`

- [ ] **Step 1: Replace the workflow file**

```yaml
# .github/workflows/scrape-events.yml
name: Scrape Events Pipeline

on:
  schedule:
    - cron: '17 3 * * *'  # 03:17 AM Vienna time (off-minute to avoid GitHub congestion)
      timezone: Europe/Vienna
  workflow_dispatch:
    inputs:
      scraper:
        description: 'Specific scraper to run (leave empty for all)'
        required: false
        default: ''
      skip_geocoding:
        description: 'Skip geocoding step'
        required: false
        default: 'false'
        type: boolean

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 360

    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      MAPBOX_ACCESS_TOKEN: ${{ secrets.MAPBOX_ACCESS_TOKEN }}
      GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
      ALERT_EMAIL: ${{ secrets.ALERT_EMAIL }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Run scrape pipeline
        run: |
          TRIGGER="cron"
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            TRIGGER="github_dispatch"
          fi
          ARGS="--trigger $TRIGGER"
          if [ -n "${{ github.event.inputs.scraper }}" ]; then
            ARGS="$ARGS --source ${{ github.event.inputs.scraper }}"
          fi
          if [ "${{ github.event.inputs.skip_geocoding }}" = "true" ]; then
            ARGS="$ARGS --skip-geocoding"
          fi
          npx tsx src/scripts/scrape-pipeline.ts $ARGS
        env:
          GITHUB_RUN_ID: ${{ github.run_id }}
          GITHUB_RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}

      - name: Finalize if pipeline crashed (scoped to this run)
        if: always()
        run: npx tsx src/scripts/finalize-stale-runs.ts --github-run-id "$GITHUB_RUN_ID"
        env:
          GITHUB_RUN_ID: ${{ github.run_id }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/scrape-events.yml
git commit -m "feat(ci): replace scrape workflow with full pipeline + crash safety"
```

---

## Task 11: Admin API — Scraper Health Endpoint

**Files:**
- Create: `src/app/api/admin/scraper-health/route.ts`

- [ ] **Step 1: Create the health endpoint**

```typescript
// src/app/api/admin/scraper-health/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// Import scraper registry for display names
const SCRAPER_DISPLAY_NAMES: Record<string, { displayName: string; category: string }> = {
  'burgenland.info': { displayName: 'Burgenland Info', category: 'Tourismus' },
  'burgenland.at': { displayName: 'Landesregierung Bgld', category: 'Burgenland' },
  'oeticket': { displayName: 'oeticket', category: 'Ticket-Plattformen' },
  'wien-clubs': { displayName: 'Wien Clubs', category: 'Wien' },
  'falter': { displayName: 'Falter', category: 'Wien' },
  // Full registry will be imported from shared constant — see step 2
};

export async function GET() {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all scraper_stats from last 7 days
    const { data: stats, error } = await supabase
      .from('scraper_stats')
      .select('scraper_name, status, events_found, duration_ms, started_at')
      .gte('started_at', sevenDaysAgo)
      .order('started_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate per scraper
    const byName: Record<string, {
      runs: number;
      failures: number;
      last_success_at: string | null;
      last_events_found: number;
      total_duration_ms: number;
    }> = {};

    for (const row of stats || []) {
      if (!byName[row.scraper_name]) {
        byName[row.scraper_name] = {
          runs: 0,
          failures: 0,
          last_success_at: null,
          last_events_found: 0,
          total_duration_ms: 0,
        };
      }
      const entry = byName[row.scraper_name];
      if (row.status !== 'skipped') {
        entry.runs++;
        entry.total_duration_ms += row.duration_ms || 0;
      }
      if (row.status === 'failed') entry.failures++;
      if (row.status === 'success' && !entry.last_success_at) {
        entry.last_success_at = row.started_at;
        entry.last_events_found = row.events_found;
      }
    }

    const scrapers = Object.entries(byName).map(([name, data]) => {
      const info = SCRAPER_DISPLAY_NAMES[name];
      let health: 'healthy' | 'degraded' | 'failing' | 'inactive';
      if (data.runs === 0) health = 'inactive';
      else if (data.failures >= 3) health = 'failing';
      else if (data.failures >= 1) health = 'degraded';
      else health = 'healthy';

      return {
        name,
        display_name: info?.displayName || name,
        category: info?.category || 'Sonstige',
        last_success_at: data.last_success_at,
        last_events_found: data.last_events_found,
        runs_last_7d: data.runs,
        failures_last_7d: data.failures,
        avg_duration_ms: data.runs > 0 ? Math.round(data.total_duration_ms / data.runs) : 0,
        health,
      };
    });

    // Sort: failing first, then degraded, then healthy, then inactive
    const healthOrder = { failing: 0, degraded: 1, healthy: 2, inactive: 3 };
    scrapers.sort((a, b) => healthOrder[a.health] - healthOrder[b.health]);

    return NextResponse.json({ scrapers });
  } catch (err) {
    console.error('Scraper health error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/scraper-health/route.ts
git commit -m "feat(admin): add scraper health API endpoint"
```

---

## Task 12: Update Admin API — Pipeline Runs

**Files:**
- Modify: `src/app/api/admin/scrape-runs/route.ts`
- Modify: `src/app/api/admin/scrape-runs/[id]/route.ts`

- [ ] **Step 1: Update the list endpoint to query `pipeline_runs`**

Replace the full content of `src/app/api/admin/scrape-runs/route.ts`:

```typescript
// src/app/api/admin/scrape-runs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10) || 0;

    let query = supabase
      .from('pipeline_runs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: runs, count, error } = await query;

    if (error) {
      console.error('Pipeline runs query error:', error);
      return NextResponse.json({ error: 'Fehler beim Laden der Pipeline-Runs' }, { status: 500 });
    }

    return NextResponse.json({ runs: runs || [], total: count || 0 });
  } catch (err) {
    console.error('Pipeline runs error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Pipeline-Runs' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update the detail endpoint to return `scraper_stats`**

Replace the full content of `src/app/api/admin/scrape-runs/[id]/route.ts`:

```typescript
// src/app/api/admin/scrape-runs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['god', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: run, error: runError } = await supabase
      .from('pipeline_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: 'Pipeline-Run nicht gefunden' }, { status: 404 });
    }

    const { data: scraperStats, error: statsError } = await supabase
      .from('scraper_stats')
      .select('*')
      .eq('run_id', id)
      .order('started_at', { ascending: true });

    if (statsError) {
      console.error('Scraper stats query error:', statsError);
    }

    return NextResponse.json({ run, scraper_stats: scraperStats || [] });
  } catch (err) {
    console.error('Pipeline run detail error:', err);
    return NextResponse.json({ error: 'Fehler beim Laden des Pipeline-Runs' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/scrape-runs/route.ts src/app/api/admin/scrape-runs/\[id\]/route.ts
git commit -m "feat(admin): update scrape-runs API to use pipeline_runs + scraper_stats"
```

---

## Task 13: Update Admin Dashboard UI

**Files:**
- Modify: `src/app/admin/scraper-runs/page.tsx`

- [ ] **Step 1: Rewrite the page for pipeline runs + scraper health tabs**

Replace the full content of `src/app/admin/scraper-runs/page.tsx` with a page that has two tabs:
1. **Pipeline Runs** — table showing runs from `pipeline_runs` with status badge, trigger, duration, event counts, link to GitHub Actions run, expandable pipeline_steps detail
2. **Scraper Health** — grid of scrapers from `/api/admin/scraper-health` with health dot (green/yellow/red), last success, events found, failure count

The full component code is long (300+ lines of React) — use the same patterns as the existing page: `useState`/`useEffect`, `fetch` from API, same Tailwind classes (`bg-white/[0.03]`, `border-white/[0.06]`, etc.), `StatusBadge` component, `lucide-react` icons.

Key changes from the current page:
- Remove `source_name` filter (pipeline runs are whole-pipeline, not per-source)
- Add `trigger` column (cron/manual/github_dispatch)
- Add `pipeline_steps` expandable detail showing step status/duration
- Add GitHub link column
- New tab for scraper health grid

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev`
Navigate to `http://localhost:3000/admin/scraper-runs`
Expected: Page loads without errors, shows empty state (no runs yet)

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/scraper-runs/page.tsx
git commit -m "feat(admin): update scraper-runs page with pipeline runs + health tabs"
```

---

## Task 14: Run All Tests

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All existing tests pass + new tests pass. Fix any import issues.

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds without errors

- [ ] **Step 4: Test dry-run locally**

Run: `npx tsx src/scripts/scrape-pipeline.ts --trigger manual --dry-run --skip-scrapers --skip-venues --skip-geocoding --skip-score`
Expected: Pipeline runs through all steps (mostly skipped), logs to stdout, no Supabase writes. Exit code 0.

---

## Task 15: Apply Migration + Final Verification

- [ ] **Step 1: Apply the migration to Supabase**

Use the Supabase MCP `apply_migration` tool with the SQL from Task 4.

- [ ] **Step 2: Verify tables exist**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_name IN ('pipeline_runs', 'scraper_stats');`
Expected: Both tables returned.

- [ ] **Step 3: Test pipeline with a single scraper (non-dry-run)**

Run: `npx tsx src/scripts/scrape-pipeline.ts --trigger manual --source burgenland.info --skip-geocoding --skip-score`
Expected: Pipeline runs, creates a `pipeline_runs` row and `scraper_stats` row for burgenland.info in Supabase.

- [ ] **Step 4: Verify admin dashboard shows the run**

Navigate to `http://localhost:3000/admin/scraper-runs`
Expected: The test run appears with correct status, duration, and event count.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(pipeline): complete scraper automation pipeline"
```
