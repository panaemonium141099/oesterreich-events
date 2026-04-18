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
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load .env.local (Next.js does this automatically, but tsx does not)
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env.local not found, rely on environment */ }

import { execSync } from 'child_process';
import { triggerMatchArtists } from '../lib/post-scrape-hook';

// In CI there's no .env.local — env vars come from GitHub Secrets.
// Only pass --env-file flag when the file actually exists.
const envFlag = existsSync(join(process.cwd(), '.env.local')) ? '--env-file=.env.local ' : '';
import { runStep } from '../lib/pipeline/step-runner';
import {
  createPipelineRun,
  finalizePipelineRun,
  sendAlertIfNeeded,
  writeGitHubSummary,
  computeFinalStatus,
} from '../lib/scrape-reporter';
import type {
  PipelineOptions,
  PipelineResults,
  StepResult,
} from '../lib/pipeline/scrape-pipeline-types';

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
    skipCategorization: has('--skip-categorization'),
    skipCategorizationBackfill: has('--skip-categorization-backfill'),
    skipDedup: has('--skip-dedup'),
    skipIndexing: has('--skip-indexing'),
    dryRun: has('--dry-run'),
  };
}

function execStep(label: string, cmd: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

async function main() {
  const opts = parseArgs();
  const steps: Record<string, StepResult> = {};
  let runId: string | null = null;

  const results: PipelineResults & { _exitCode?: number } = {
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
    }
  }

  try {
    if (!opts.skipScrapers) {
      steps.scrapers = await runStep('scrapers', async () => {
        if (opts.source) {
          execStep(`Scraping: ${opts.source}`, `npx tsx src/scripts/scrape.ts --source ${opts.source}`);
        } else {
          execStep('Running all 141 scrapers', 'npx tsx src/scripts/scrape.ts');
        }
      }, steps);
    }

    if (!opts.skipVenues) {
      steps.venues = await runStep('venues', async () => {
        execStep('Venue feed ingestion', `npx tsx ${envFlag}src/scripts/scrape-venues.ts`);
      }, steps);
    }

    steps.normalize = await runStep('normalize', async () => {
      execStep('Normalize locations', `npx tsx ${envFlag}src/scripts/normalize-locations.ts`);
    }, steps);

    if (!opts.skipCategorization) {
      if (!opts.skipCategorizationBackfill) {
        steps.categorization_backfill = await runStep('categorization_backfill', async () => {
          // Step 4a: free, deterministic, idempotent. Brings all stale rows
          // to the current classifier version using rules only. Must run
          // before the AI-residue step so 4b only sees genuinely hard cases.
          execStep('Categorize events (deterministic backfill)',
            `npx tsx ${envFlag}src/scripts/categorize-events.ts --deterministic-backfill`);
        }, steps);
      }

      steps.categorization = await runStep('categorization', async () => {
        // Step 4b: AI on the reduced residue. Runs only on events where the
        // deterministic backfill could not resolve (`category_needs_review=true`).
        execStep('Categorize events (AI residue for hard cases)',
          `npx tsx ${envFlag}src/scripts/categorize-events.ts`);
      }, steps);
    }

    if (!opts.skipGeocoding) {
      steps.geocoding = await runStep('geocoding', async () => {
        execStep('Fix geocoding', `npx tsx ${envFlag}src/scripts/fix-geocoding.ts`);
        execStep('OpenAI geocode NULLs', `npx tsx ${envFlag}src/scripts/openai-geocode.ts --null`);
      }, steps);
    }

    if (!opts.skipScore) {
      steps.scoring = await runStep('scoring', async () => {
        execStep('Calculate scores', `npx tsx ${envFlag}src/scripts/calculate-scores.ts`);
      }, steps);
    }

    if (!opts.skipDedup) {
      steps.dedup = await runStep('dedup', async () => {
        // Cross-source dedup: garbage filter + fingerprint blocks + fuzzy
        // within (date, venue, location) blocks. Marks losers with
        // publish_status='duplicate'; the app filters those out.
        execStep('Deduplicate events', `npx tsx ${envFlag}src/scripts/dedup.ts`);
      }, steps);
    }

    steps.artist_matching = await runStep('artist_matching', async () => {
      await triggerMatchArtists();
    }, steps);

    if (!opts.skipIndexing) {
      steps.indexing = await runStep('indexing', async () => {
        // Submits event URLs to IndexNow (Bing/Yandex) and Google Indexing
        // API. Defaults to --since<pipeline_start_iso> so only freshly-
        // scraped or updated rows are notified, saving daily API quota.
        const since = results.started_at;
        execStep('Submit URLs to IndexNow + Google Indexing API',
          `npx tsx ${envFlag}src/scripts/submit-to-indexing.ts --since ${since}`);
      }, steps);
    }

    // Report generation (always runs, no dependencies)
    steps.report = await runStep('report', async () => {
      execStep('Generate scrape report', `npx tsx ${envFlag}src/scripts/generate-scrape-report.ts`);
    }, steps);

  } finally {
    results.steps = steps;
    results.finished_at = new Date().toISOString();
    results.total_errors = Object.values(steps).filter((s) => s.status === 'failed').length;

    if (!opts.dryRun && runId) {
      console.log(`[pipeline] Finalizing run ${runId}...`);
      try {
        await finalizePipelineRun(runId, results);
        console.log(`[pipeline] Run ${runId} finalized successfully`);
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

    const status = computeFinalStatus(results.steps, results.total_errors);
    const elapsed = results.finished_at
      ? ((new Date(results.finished_at).getTime() - new Date(results.started_at).getTime()) / 1000 / 60).toFixed(1)
      : '?';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Pipeline ${status} | ${elapsed} min | ${results.total_errors} step errors`);
    if (opts.dryRun) console.log('  (DRY RUN — nothing written to Supabase)');
    console.log(`${'='.repeat(60)}\n`);

    // Store exit code but don't call process.exit() inside finally —
    // let main() resolve first so all async work completes.
    results._exitCode = status === 'failed' ? 1 : 0;
  }

  return results;
}

main()
  .then((results) => {
    if (results._exitCode) process.exit(results._exitCode);
  })
  .catch((err) => {
    console.error(`[pipeline] Unhandled error: ${err}`);
    process.exit(1);
  });
