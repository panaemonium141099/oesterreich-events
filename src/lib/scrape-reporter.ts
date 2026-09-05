// src/lib/scrape-reporter.ts
import { createClient } from '@supabase/supabase-js';
import { startWorkflowRun, finishWorkflowRun } from './reporting/workflow-run';
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

/**
 * Meldet den Pipeline-Lauf ueber `workflow_runs` (die Mail verschickt
 * `/api/cron/workflow-reports` auf dem Server).
 *
 * Vorher stand hier ein direkter Resend-Aufruf an
 * `alerts@osterreich.events`, der NUR bei Fehlern feuerte. Zwei Gruende,
 * warum davon nie eine Mail ankam:
 *
 *   - `RESEND_API_KEY` war weder auf dem Server noch in den
 *     GitHub-Actions-Secrets gesetzt. Die Funktion loggte "skipping email"
 *     und kehrte zurueck — ein stiller No-op ueber Monate.
 *   - Die Absender-Domain osterreich.events ist seit dem Umzug auf
 *     lasstreffen.at tot; selbst mit Key waere die Zustellung an SPF/DKIM
 *     gescheitert.
 *
 * Jetzt wird JEDER Lauf gemeldet, nicht nur der gescheiterte — "lief
 * durch" ohne Zahlen ist keine brauchbare Auskunft (der
 * Uebersetzungs-Timer meldete tagelang Erfolg und uebersetzte nichts).
 */
export async function sendAlertIfNeeded(results: PipelineResults): Promise<void> {
  const status = computeFinalStatus(results.steps, results.total_errors);
  const failedScrapers = results.scraper_results.filter((s) => s.status === 'failed');
  const okScrapers = results.scraper_results.filter((s) => s.status === 'success');

  // Schritte, die nicht sauber durchliefen, gehoeren in den Bericht —
  // auch wenn die Gesamtbilanz 'success' lautet.
  const stepErrors = Object.entries(results.steps)
    .filter(([, step]) => step.status === 'failed' || step.status === 'partial_failure')
    .map(([name, step]) => `Schritt "${name}": ${step.status}${step.error ? ` — ${step.error}` : ''}`);

  const runId = await startWorkflowRun(
    'scrape-pipeline',
    results.trigger === 'manual' ? 'manual' : results.trigger === 'cron' ? 'cron' : 'github_dispatch',
  );

  await finishWorkflowRun(runId, {
    status: status === 'success' ? 'success' : status === 'partial_failure' ? 'partial' : 'failed',
    summary:
      `${results.total_events_scraped.toLocaleString('de-AT')} Events gefunden, `
      + `${results.total_events_updated.toLocaleString('de-AT')} aktualisiert`
      + (failedScrapers.length ? `, ${failedScrapers.length} von ${results.scraper_results.length} Scrapern gescheitert` : ''),
    metrics: {
      'Events gefunden': results.total_events_scraped,
      'Events aktualisiert': results.total_events_updated,
      'Scraper erfolgreich': okScrapers.length,
      'Scraper gescheitert': failedScrapers.length,
      'Fehler gesamt': results.total_errors,
      ...stepMetrics(results.steps),
    },
    // Gescheiterte Scraper als Einzelposten: Name, Fehlertext und wie oft
    // es probiert wurde stehen damit direkt in der Mail.
    items: failedScrapers.slice(0, 25).map((sc) => ({
      title: sc.scraper_name,
      excerpt: sc.error_message ?? 'ohne Fehlermeldung abgebrochen',
      meta: {
        Versuche: sc.retry_count + 1,
        Dauer: `${Math.round(sc.duration_ms / 1000)} s`,
        Gefunden: sc.events_found,
      },
    })),
    errors: stepErrors,
    runUrl: results.github_run_url,
  });
}

/**
 * Die aussagekraeftigen Zahlen der Post-Processing-Schritte in die
 * Kennzahlen-Tabelle heben — Dedup und Geocoding sind genau das, wonach
 * man nach einem Lauf schaut.
 */
function stepMetrics(steps: Record<string, StepResult>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, step] of Object.entries(steps)) {
    if (typeof step.fix_count === 'number') out[`${name}: korrigiert`] = step.fix_count;
    if (typeof step.gemini_count === 'number') out[`${name}: via KI`] = step.gemini_count;
    if (typeof step.succeeded === 'number') out[`${name}: ok`] = step.succeeded;
    if (typeof step.failed === 'number' && step.failed > 0) out[`${name}: Fehler`] = step.failed;
  }
  return out;
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
