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
import { closeSharedBrowser } from '../lib/scrapers/puppeteerBrowser';
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

  const targetScrapers = opts.source
    ? [getScraperByName(opts.source)].filter(Boolean)
    : [...scrapers];

  if (opts.source && targetScrapers.length === 0) {
    throw new Error(`Scraper not found: ${opts.source}`);
  }

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
          events_updated: result.events_inserted + result.events_updated,
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
        const { stepExtras, scraperResults: sr } = await runScrapersStep(opts);
        scraperResults = sr;
        return stepExtras;
      }, steps);
    }

    if (!opts.skipVenues) {
      steps.venues = await runStep('venues', async () => {
        execStep('Venue feed ingestion', 'npx tsx --env-file=.env.local src/scripts/scrape-venues.ts');
      }, steps);
    }

    steps.normalize = await runStep('normalize', async () => {
      execStep('Normalize locations', 'npx tsx --env-file=.env.local src/scripts/normalize-locations.ts');
    }, steps);

    if (!opts.skipGeocoding) {
      steps.geocoding = await runStep('geocoding', async () => {
        execStep('Fix geocoding', 'npx tsx --env-file=.env.local src/scripts/fix-geocoding.ts');
        execStep('Gemini geocode NULLs', 'npx tsx --env-file=.env.local src/scripts/gemini-geocode.ts --null');
      }, steps);
    }

    if (!opts.skipScore) {
      steps.scoring = await runStep('scoring', async () => {
        execStep('Calculate scores', 'npx tsx --env-file=.env.local src/scripts/calculate-scores.ts');
      }, steps);
    }

    steps.artist_matching = await runStep('artist_matching', async () => {
      await triggerMatchArtists();
    }, steps);

  } finally {
    results.steps = steps;
    results.scraper_results = scraperResults;
    results.finished_at = new Date().toISOString();

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

    const status = computeFinalStatus(results.steps, results.total_errors);
    const elapsed = results.finished_at
      ? ((new Date(results.finished_at).getTime() - new Date(results.started_at).getTime()) / 1000 / 60).toFixed(1)
      : '?';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Pipeline ${status} | ${elapsed} min | ${results.total_events_scraped} events | ${results.total_errors} errors`);
    if (opts.dryRun) console.log('  (DRY RUN — nothing written to Supabase)');
    console.log(`${'='.repeat(60)}\n`);

    if (status === 'failed') {
      process.exit(1);
    }
  }
}

main();
