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

export function computeFinalStatus(
  steps: Record<string, StepResult>,
  totalErrors: number,
): PipelineRunStatus {
  for (const [name, step] of Object.entries(steps)) {
    if (name === 'scrapers') continue;
    if (step.status === 'failed') return 'failed';
  }
  const scraperStep = steps.scrapers;
  if (totalErrors > 0 || scraperStep?.status === 'partial_failure') {
    return 'partial_failure';
  }
  return 'success';
}

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

export async function insertScraperStats(
  runId: string,
  results: ScraperResult[],
): Promise<void> {
  if (results.length === 0) return;
  const supabase = getSupabaseAdmin();
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
    if (error) console.error(`Failed to insert scraper_stats batch: ${error.message}`);
  }
}

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
  if (error) console.error(`Failed to finalize pipeline_runs: ${error.message}`);
}

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
    dashboard_url: 'https://osterreich.events/admin/scraper-runs',
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
    if (res.ok) console.log(`[reporter] Alert email sent to ${alertEmail}`);
    else console.error(`[reporter] Email send failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`[reporter] Email send error: ${err}`);
  }
}

export function buildGitHubSummary(results: PipelineResults): string {
  const status = computeFinalStatus(results.steps, results.total_errors);
  const icon = status === 'success' ? '✅' : status === 'partial_failure' ? '⚠️' : '❌';
  const duration = results.finished_at
    ? Math.round(
        (new Date(results.finished_at).getTime() - new Date(results.started_at).getTime()) /
          1000 /
          60,
      )
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
    const stepIcon =
      step.status === 'success'
        ? '✅'
        : step.status === 'failed'
          ? '❌'
          : step.status === 'partial_failure'
            ? '⚠️'
            : '⏭️';
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
