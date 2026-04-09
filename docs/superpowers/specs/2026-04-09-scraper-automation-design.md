# Scraper Automation Design

## Goal & Context

The platform has 141 scrapers, venue feed ingestion, scoring, geocoding, and artist matching -- but currently only the basic scraper step runs via a daily GitHub Actions cron. The cron is unreliable (GitHub scheduled workflows can be delayed or skipped), post-processing steps are missing from the automated pipeline, and there is no monitoring or alerting when things fail.

This spec defines a reliable, fully automated scraping pipeline with:
- Complete 7-step pipeline (scrape -> venues -> normalize -> geocode -> score -> artist-match -> report)
- Per-scraper retry logic for transient failures
- Run logging to Supabase (`scrape_runs` + `scraper_stats` tables)
- Email alerts on failure via Resend
- Admin dashboard showing scrape run history and per-scraper health

## Architecture

### Pipeline Steps

The current `scrape-all.ts` is replaced by a new `scrape-pipeline.ts` that orchestrates 7 steps in sequence:

| Step | Script | Description |
|------|--------|-------------|
| 1 | `scrape.ts` | Run all 141 scrapers with per-scraper retry |
| 2 | `scrape-venues.ts` | Registry-based venue feed ingestion (ICS/JSON-LD/RSS) |
| 3 | `normalize-locations.ts` | Batch normalize event locations |
| 4 | `fix-geocoding.ts` + `gemini-geocode.ts` | Re-geocode wrongly-placed events + AI geocode NULL-coord events |
| 5 | `calculate-scores.ts` | Recalculate event quality/relevance scores |
| 6 | Post-scrape hook | Trigger `match-artists` Edge Function |
| 7 | `report-scrape-run.ts` | Log results to Supabase + send email on failure |

### Step Dependencies & Fail-Forward

Steps are fail-forward but **dependency-aware**. If a step fails, downstream steps that depend on its output are marked `skipped_dependency` rather than running blindly:

| Step | Depends on | On dependency failure |
|------|-----------|----------------------|
| 1 (Scrapers) | -- | Always runs |
| 2 (Venues) | -- | Always runs (independent of Step 1) |
| 3 (Normalize) | 1, 2 | Runs even if some scrapers failed (partial data is still worth normalizing) |
| 4 (Geocoding) | 3 | **Skipped** if Step 3 hard-failed (normalize crash = location data unreliable) |
| 5 (Scoring) | 3 | **Skipped** if Step 3 hard-failed (scores depend on normalized locations) |
| 6 (Artist-Matching) | 1, 2 | Runs if any new events were ingested (Steps 1 or 2 had partial success) |
| 7 (Report) | -- | Always runs (via `try/finally`, see Crash Safety below) |

A step's `pipeline_steps` status can be:
- `success` -- completed without errors
- `failed` -- hard failure during execution
- `partial_failure` -- some sub-items failed (applies to Step 1 scrapers)
- `skipped_dependency` -- not executed because a required upstream step failed

This keeps reporting complete and honest: the admin dashboard shows exactly which steps ran, which were skipped, and why.

### Retry Logic

Applies to Step 1 (individual scrapers) only:

- **Max retries:** 2 per scraper
- **Backoff:** Exponential -- 30s after first failure, 60s after second
- **Retryable errors:** Network timeouts, connection refused, HTTP 5xx, DNS failures
- **Non-retryable errors:** Parse errors, validation errors, HTTP 4xx
- **Classification:** Error message pattern matching (e.g., `ECONNREFUSED`, `ETIMEDOUT`, `socket hang up`, `503`, `502`)
- **Tracking:** `retry_count` logged in `scraper_stats` table

The retry logic lives in `scrape-pipeline.ts` wrapping the existing `BaseScraper.scrape()` calls. The scrapers themselves are unchanged.

## Data Models

### Table: `scrape_runs`

Tracks each full pipeline execution.

```sql
CREATE TABLE scrape_runs (
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

CREATE INDEX idx_scrape_runs_started_at ON scrape_runs (started_at DESC);
CREATE INDEX idx_scrape_runs_status ON scrape_runs (status);
```

**Status logic:**
- `success` -- all steps completed without errors
- `partial_failure` -- some scrapers failed but pipeline completed
- `failed` -- a critical step (normalize, score, or report) failed

**`pipeline_steps` JSONB structure** (success example):
```json
{
  "scrapers": { "status": "partial_failure", "duration_ms": 3600000, "succeeded": 138, "failed": 3 },
  "venues": { "status": "success", "duration_ms": 120000 },
  "normalize": { "status": "success", "duration_ms": 45000 },
  "geocoding": { "status": "success", "duration_ms": 180000, "fix_count": 12, "gemini_count": 8 },
  "scoring": { "status": "success", "duration_ms": 30000 },
  "artist_matching": { "status": "success", "duration_ms": 15000 }
}
```

**`pipeline_steps` JSONB structure** (dependency-skip example):
```json
{
  "scrapers": { "status": "partial_failure", "duration_ms": 3600000, "succeeded": 130, "failed": 11 },
  "venues": { "status": "success", "duration_ms": 120000 },
  "normalize": { "status": "failed", "duration_ms": 5000, "error": "Connection refused" },
  "geocoding": { "status": "skipped_dependency", "reason": "normalize failed" },
  "scoring": { "status": "skipped_dependency", "reason": "normalize failed" },
  "artist_matching": { "status": "success", "duration_ms": 15000 }
}
```

### Table: `scraper_stats`

Tracks each individual scraper's performance per run.

```sql
CREATE TABLE scraper_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES scrape_runs(id) ON DELETE CASCADE,
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
```

**One row per scraper per run.** The row reflects the final outcome after all retry attempts.

**Status values:**
- `success` -- scraper completed successfully (possibly after retries; check `retry_count`)
- `failed` -- scraper failed after all retry attempts exhausted
- `skipped` -- scraper was intentionally skipped (e.g., disabled or filtered by `--source`)

## New Scripts

### `src/scripts/scrape-pipeline.ts`

Master orchestrator replacing `scrape-all.ts`. Responsibilities:

1. Create `scrape_runs` row at start (status: 'running')
2. Run each pipeline step, collecting results
3. For Step 1 (scrapers): run each scraper individually, apply retry logic, write `scraper_stats` rows
4. Update `scrape_runs` with final status and `pipeline_steps` JSONB
5. Accept CLI flags: `--trigger cron|manual|github_dispatch`, `--skip-scrapers`, `--skip-venues`, `--skip-geocoding`, `--skip-score`, `--dry-run`
6. Exit code: 0 on success/partial_failure, 1 on full failure

The script imports and calls the existing scraper functions directly (not via `execSync`). This allows capturing per-scraper results programmatically.

### Crash Safety

The entire pipeline body runs inside a top-level `try/finally`:

```typescript
async function main() {
  const runId = await createScrapeRun(trigger);
  try {
    // Steps 1-6...
  } finally {
    // Step 7: ALWAYS finalize, even on unhandled exception or OOM
    await finalizeScrapeRun(runId, results);
    await sendAlertIfNeeded(runId, results);
    await writeGitHubSummary(results);
  }
}
```

Additionally, the GitHub Actions workflow has a **separate fallback step** with `if: always()` that catches the case where the Node process itself is killed (e.g., OOM, timeout). This step runs a lightweight finalizer script that:
1. Queries `scrape_runs` for any row with `status = 'running'` and `started_at` within the last 8 hours
2. Sets it to `failed` with `finished_at = now()`
3. Sends the alert email

This guarantees that no run is left permanently stuck in `running` status.

### `src/lib/scrape-reporter.ts`

Reporting module called by `scrape-pipeline.ts` inside the `finally` block. Responsibilities:

1. Update the `scrape_runs` row with final status, `finished_at`, and `pipeline_steps`
2. If status is `failed` or `partial_failure`: send alert email via Resend to admin address
3. Email includes: run status, failed scraper list, total events scraped, duration, link to admin dashboard
4. If running in GitHub Actions: write Job Summary markdown to `$GITHUB_STEP_SUMMARY`

### `src/scripts/finalize-stale-runs.ts`

Lightweight fallback script for the GitHub Actions `if: always()` step. Finds `scrape_runs` stuck in `running` status (started > 1 hour ago) and marks them `failed`. Sends alert email. Idempotent -- safe to run even if `scrape-pipeline.ts` already finalized successfully.

Uses the existing `src/lib/email.ts` Resend integration. Admin email address configured via `ALERT_EMAIL` env var.

## GitHub Actions Workflow

Replace the current `scrape-events.yml`:

```yaml
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

      - name: Finalize stale runs (crash safety)
        if: always()
        run: npx tsx src/scripts/finalize-stale-runs.ts
        env:
          GITHUB_RUN_ID: ${{ github.run_id }}
          GITHUB_RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

### Required Secrets (new)

- `GEMINI_API_KEY` -- for Gemini Flash AI geocoding (Step 4)
- `RESEND_API_KEY` -- for failure email alerts (Step 7)
- `ALERT_EMAIL` -- recipient address for alert emails

## Admin Dashboard Integration

### New API Route: `GET /api/admin/scrape-runs`

Returns paginated list of scrape runs:

```typescript
// Response shape
{
  runs: Array<{
    id: string;
    started_at: string;
    finished_at: string | null;
    trigger: 'cron' | 'manual' | 'github_dispatch';
    status: 'running' | 'success' | 'partial_failure' | 'failed';
    total_events_scraped: number;
    total_events_updated: number;
    total_errors: number;
    pipeline_steps: PipelineSteps;
    github_run_url: string | null;
  }>;
  total: number;
}
```

### New API Route: `GET /api/admin/scrape-runs/[id]`

Returns detail for a single run including all `scraper_stats` rows.

### New API Route: `GET /api/admin/scraper-health`

Aggregated per-scraper health over the last 7 days:

```typescript
{
  scrapers: Array<{
    name: string;
    display_name: string;
    category: string;
    last_success_at: string | null;
    last_events_found: number;
    runs_last_7d: number;
    failures_last_7d: number;
    avg_duration_ms: number;
    health: 'healthy' | 'degraded' | 'failing' | 'inactive';
  }>;
}
```

**Health classification:**
- `healthy` -- 0 failures in last 7 days
- `degraded` -- 1-2 failures in last 7 days
- `failing` -- 3+ failures or last run failed
- `inactive` -- no runs in last 7 days

### Dashboard UI Changes

Extend the existing admin scrapers page with two new tabs:

1. **Scrape Runs** -- table of recent runs with status badge, duration, event counts, link to GitHub Actions run
2. **Scraper Health** -- grid of all 141 scrapers with health indicator (green/yellow/red dot), last run time, last event count, expandable error details

The existing scraper list and manual trigger functionality stays as-is.

## Email Alert Template

New template `src/emails/scrape-alert.tsx` using the existing React Email pattern:

- Subject: `[Osterreich Events] Scrape Pipeline: {status} - {date}`
- Body: Run summary (status, duration, events scraped), list of failed scrapers with error messages, link to admin dashboard, link to GitHub Actions run

## Boundaries

**Out of scope:**
- Changing scraper frequency (stays 1x daily)
- Modifying individual scrapers
- Real-time scraper progress WebSocket (existing file-based progress is sufficient for admin panel manual runs)
- Slack/Discord integration (email only for now)
- Automatic scraper disabling after repeated failures (manual intervention preferred)

## Acceptance Criteria

- [ ] `scrape-pipeline.ts` runs all 7 steps with dependency-aware fail-forward (downstream steps skipped if upstream hard-fails)
- [ ] Per-scraper retry logic: max 2 retries with 30s/60s backoff for network errors only
- [ ] `scrape_runs` table created and populated after each pipeline run
- [ ] `scraper_stats` table with `status IN ('success', 'failed', 'skipped')` and `retry_count` (no `retried` status)
- [ ] GitHub Actions workflow: single schedule `17 3 * * *` with `timezone: Europe/Vienna` (no dual-cron)
- [ ] GitHub Actions workflow includes `if: always()` fallback step running `finalize-stale-runs.ts`
- [ ] Pipeline wrapped in top-level `try/finally` — reporter always runs even on crash
- [ ] Geocoding (normalize + fix-geocoding + gemini-geocode) runs as Step 3-4 of pipeline
- [ ] Geocoding and scoring are `skipped_dependency` when normalize hard-fails
- [ ] Email alert sent via Resend when pipeline status is `failed` or `partial_failure`
- [ ] Admin API routes return scrape run history and per-scraper health
- [ ] Admin dashboard shows Scrape Runs tab and Scraper Health tab
- [ ] GitHub Actions run URL stored in `scrape_runs` for cross-reference
- [ ] Pipeline accepts `--dry-run` flag that logs but doesn't write to production
- [ ] `GEMINI_API_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL` documented as required GitHub secrets
