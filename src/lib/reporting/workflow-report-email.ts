/**
 * HTML der Workflow-Bericht-Mail.
 *
 * Ein Gerüst für alle Workflows statt zwanzig Templates: die Kopfzeile
 * trägt Status und Dauer, darunter die Kennzahlen als Tabelle, dann die
 * Einzelposten (Blogposts mit Auszug und Link, gescheiterte Scraper …)
 * und zuletzt die Fehlertexte. Was ein Workflow nicht liefert, fällt weg.
 */

import type { WorkflowItem, WorkflowStatus } from './workflow-run';

export interface WorkflowReportData {
  workflow: string;
  status: WorkflowStatus;
  startedAt: string;
  finishedAt: string | null;
  metrics: Record<string, string | number>;
  items: WorkflowItem[];
  errors: string[];
  runUrl?: string | null;
  /** Gesetzt, wenn der Lauf nie abgeschlossen wurde (Timeout/OOM). */
  stalled?: boolean;
}

const TONE: Record<WorkflowStatus, { label: string; color: string; bg: string }> = {
  success: { label: 'Erfolgreich', color: '#047857', bg: '#ecfdf5' },
  partial: { label: 'Teilweise fehlgeschlagen', color: '#b45309', bg: '#fffbeb' },
  failed: { label: 'Fehlgeschlagen', color: '#b91c1c', bg: '#fef2f2' },
  running: { label: 'Hängengeblieben', color: '#b91c1c', bg: '#fef2f2' },
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function duration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)} s`;
  const min = Math.floor(ms / 60_000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function workflowReportSubject(d: WorkflowReportData): string {
  if (d.stalled) return `[LassTreffen] ${d.workflow}: hängengeblieben`;
  const prefix = d.status === 'success' ? '' : d.status === 'partial' ? 'Teilfehler — ' : 'FEHLER — ';
  return `[LassTreffen] ${prefix}${d.workflow}`;
}

export function renderWorkflowReport(d: WorkflowReportData): string {
  const tone = TONE[d.stalled ? 'running' : d.status];
  const when = new Date(d.startedAt).toLocaleString('de-AT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Vienna',
  });

  const metricRows = Object.entries(d.metrics)
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:7px 16px 7px 0;color:#4b5563;border-bottom:1px solid #f3f4f6;">${esc(k)}</td>
        <td style="padding:7px 0;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;white-space:nowrap;">
          ${esc(typeof v === 'number' ? v.toLocaleString('de-AT') : String(v))}
        </td>
      </tr>`,
    )
    .join('');

  const itemCards = d.items
    .map(item => {
      const meta = Object.entries(item.meta ?? {})
        .map(([k, v]) => `<span style="color:#6b7280;">${esc(k)}:</span> ${esc(String(v))}`)
        .join(' &nbsp;·&nbsp; ');
      return `
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 10px;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111827;line-height:1.35;">${esc(item.title)}</p>
        ${item.excerpt ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#4b5563;">${esc(item.excerpt)}</p>` : ''}
        ${meta ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;">${meta}</p>` : ''}
        ${item.url ? `<a href="${esc(item.url)}" style="font-size:13px;color:#2563eb;text-decoration:none;word-break:break-all;">${esc(item.url)}</a>` : ''}
      </div>`;
    })
    .join('');

  const errorList = d.errors
    .map(
      e => `<pre style="margin:0 0 8px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;line-height:1.5;color:#7f1d1d;white-space:pre-wrap;word-break:break-word;">${esc(e)}</pre>`,
    )
    .join('');

  const section = (title: string, body: string) =>
    body
      ? `<p style="margin:22px 0 10px;font-size:13px;font-weight:700;color:#111827;letter-spacing:.01em;">${title}</p>${body}`
      : '';

  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:26px;">

    <p style="margin:0 0 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;font-weight:700;">LassTreffen.at · Workflow-Bericht</p>
    <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#111827;">${esc(d.workflow)}</h1>

    <div style="background:${tone.bg};border-radius:8px;padding:10px 14px;margin:0 0 6px;">
      <span style="color:${tone.color};font-weight:700;font-size:14px;">${tone.label}</span>
      <span style="color:#6b7280;font-size:13px;"> · ${when} · Dauer ${duration(d.startedAt, d.finishedAt)}</span>
    </div>
    ${d.stalled
      ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#7f1d1d;">Der Lauf hat begonnen, aber nie abgeschlossen — typischerweise ein Timeout oder ein abgestürzter Prozess. Er konnte sich deshalb nicht selbst melden.</p>`
      : ''}

    ${section('Kennzahlen', metricRows ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">${metricRows}</table>` : '')}
    ${section(d.items.length === 1 ? 'Ergebnis' : `Ergebnisse (${d.items.length})`, itemCards)}
    ${section(d.errors.length === 1 ? 'Fehler' : `Fehler (${d.errors.length})`, errorList)}

    ${d.runUrl ? `<p style="margin:22px 0 0;font-size:13px;"><a href="${esc(d.runUrl)}" style="color:#2563eb;text-decoration:none;">Vollständiges Log ansehen →</a></p>` : ''}
  </div>
</body></html>`;
}
