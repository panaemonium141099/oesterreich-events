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
    .slice(0, 20)
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
