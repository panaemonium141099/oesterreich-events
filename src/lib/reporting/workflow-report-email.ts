/**
 * HTML der Workflow-Bericht-Mail.
 *
 * Ein Gerüst für alle Workflows statt zwanzig Templates. Aufbau von oben
 * nach unten so, wie man die Mail liest:
 *
 *   1. Kopf — WELCHER Job ist das, was tut er, wann läuft er. Die erste
 *      Fassung trug hier nur den Slug ("blog-autowriter") und setzte
 *      voraus, dass man ihn kennt.
 *   2. Status + Ein-Satz-Fazit — die Antwort auf "muss ich etwas tun?".
 *   3. Kennzahlen, Ergebnisse, Fehler — die Belege, in dieser Reihenfolge.
 *
 * Was ein Workflow nicht liefert, fällt weg.
 */

import type { WorkflowItem, WorkflowStatus } from './workflow-run';
import { workflowInfo, workflowName } from './workflow-catalog';

export interface WorkflowReportData {
  workflow: string;
  status: WorkflowStatus;
  startedAt: string;
  finishedAt: string | null;
  summary?: string | null;
  metrics: Record<string, string | number>;
  items: WorkflowItem[];
  errors: string[];
  runUrl?: string | null;
  /** Gesetzt, wenn der Lauf nie abgeschlossen wurde (Timeout/OOM). */
  stalled?: boolean;
}

const TONE: Record<WorkflowStatus, { label: string; color: string; bg: string; border: string }> = {
  success: { label: 'Erfolgreich', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  partial: { label: 'Teilweise fehlgeschlagen', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  failed: { label: 'Fehlgeschlagen', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
  running: { label: 'Hängengeblieben', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
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

/**
 * Betreff nennt Job UND Ergebnis. Vorher stand dort nur der Slug — im
 * Postfach sahen fünf Berichte damit identisch aus.
 */
export function workflowReportSubject(d: WorkflowReportData): string {
  const name = workflowName(d.workflow);
  if (d.stalled) return `⚠ ${name}: hängengeblieben`;
  const mark = d.status === 'success' ? '✓' : d.status === 'partial' ? '⚠' : '✗';
  const tail = d.summary ? ` — ${d.summary}` : ` — ${TONE[d.status].label}`;
  // Betreffzeilen werden in Mail-Clients bei ~78 Zeichen abgeschnitten.
  const subject = `${mark} ${name}${tail}`;
  return subject.length <= 78 ? subject : `${subject.slice(0, 77)}…`;
}

export function renderWorkflowReport(d: WorkflowReportData): string {
  const tone = TONE[d.stalled ? 'running' : d.status];
  const info = workflowInfo(d.workflow);
  const name = workflowName(d.workflow);
  const when = new Date(d.startedAt).toLocaleString('de-AT', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna',
  });

  const heading = (text: string) => `
    <p style="margin:26px 0 12px;padding:0 0 8px;border-bottom:2px solid #111827;
              font-size:12px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:#111827;">
      ${esc(text)}
    </p>`;

  const metricRows = Object.entries(d.metrics)
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:9px 16px 9px 0;color:#4b5563;border-bottom:1px solid #f3f4f6;font-size:14px;">${esc(k)}</td>
        <td style="padding:9px 0;color:#111827;font-weight:700;text-align:right;border-bottom:1px solid #f3f4f6;font-size:15px;white-space:nowrap;font-variant-numeric:tabular-nums;">
          ${esc(typeof v === 'number' ? v.toLocaleString('de-AT') : String(v))}
        </td>
      </tr>`,
    )
    .join('');

  const itemCards = d.items
    .map(item => {
      const meta = Object.entries(item.meta ?? {})
        .map(([k, v]) => `<span style="color:#6b7280;">${esc(k)}</span> ${esc(String(v))}`)
        .join(' &nbsp;<span style="color:#d1d5db;">|</span>&nbsp; ');
      return `
      <div style="border:1px solid #e5e7eb;border-left:3px solid #111827;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 10px;background:#fcfcfd;">
        <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111827;line-height:1.35;">${esc(item.title)}</p>
        ${item.excerpt ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#4b5563;">${esc(item.excerpt)}</p>` : ''}
        ${meta ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.6;">${meta}</p>` : ''}
        ${item.url ? `<a href="${esc(item.url)}" style="font-size:13px;color:#2563eb;text-decoration:none;word-break:break-all;">${esc(item.url)}</a>` : ''}
      </div>`;
    })
    .join('');

  const errorList = d.errors
    .map(
      e => `<pre style="margin:0 0 8px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12px;line-height:1.55;color:#7f1d1d;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${esc(e)}</pre>`,
    )
    .join('');

  return `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">

    <!-- Kopf: welcher Job, was tut er, wann laeuft er -->
    <div style="padding:22px 26px 18px;border-bottom:1px solid #e5e7eb;background:#fafafa;">
      <p style="margin:0 0 6px;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;font-weight:700;">
        LassTreffen.at · Workflow-Bericht
      </p>
      <h1 style="margin:0 0 ${info ? '8px' : '0'};font-size:22px;line-height:1.25;color:#111827;font-weight:700;">${esc(name)}</h1>
      ${info ? `<p style="margin:0 0 4px;font-size:13.5px;line-height:1.55;color:#4b5563;">${esc(info.purpose)}</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">Läuft ${esc(info.schedule)} · <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px;">${esc(d.workflow)}</code></p>` : ''}
    </div>

    <div style="padding:20px 26px 26px;">

      <!-- Status + Fazit: die Antwort auf "muss ich etwas tun?" -->
      <div style="background:${tone.bg};border:1px solid ${tone.border};border-radius:8px;padding:12px 16px;">
        <p style="margin:0;font-size:15px;font-weight:700;color:${tone.color};">${tone.label}</p>
        ${d.summary ? `<p style="margin:5px 0 0;font-size:14px;line-height:1.55;color:#374151;">${esc(d.summary)}</p>` : ''}
        <p style="margin:7px 0 0;font-size:12px;color:#6b7280;">${when} · Dauer ${duration(d.startedAt, d.finishedAt)}</p>
      </div>
      ${d.stalled
        ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#7f1d1d;">Der Lauf hat begonnen, aber nie abgeschlossen — typischerweise ein Timeout oder ein abgestürzter Prozess. Er konnte sich deshalb nicht selbst melden.</p>`
        : ''}

      ${metricRows ? heading('Kennzahlen') + `<table style="width:100%;border-collapse:collapse;">${metricRows}</table>` : ''}
      ${itemCards ? heading(d.items.length === 1 ? 'Ergebnis' : `Ergebnisse — ${d.items.length}`) + itemCards : ''}
      ${errorList ? heading(d.errors.length === 1 ? 'Fehler' : `Fehler — ${d.errors.length}`) + errorList : ''}

      ${d.runUrl ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #f3f4f6;font-size:13px;"><a href="${esc(d.runUrl)}" style="color:#2563eb;text-decoration:none;">Vollständiges Log ansehen →</a></p>` : ''}
    </div>
  </div>
</body></html>`;
}
