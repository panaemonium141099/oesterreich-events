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
