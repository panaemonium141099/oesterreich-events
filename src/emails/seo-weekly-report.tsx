// src/emails/seo-weekly-report.tsx
//
// Weekly SEO digest — fires every Friday 10:00 UTC via
// `/api/cron/seo-weekly-report`. Lands in the admin's inbox with a
// top-line summary + top 10 keyword gainers and losers vs. the snapshot
// from 7 days ago.
//
// Content strategy:
//   - Headline (impressions + clicks for the 28d window, week-over-week %)
//   - 10 Gainers (biggest +Δ clicks over 7 days) — what to double down on
//   - 10 Losers (biggest −Δ clicks over 7 days) — what to investigate
//   - Link back to /admin/seo for the full dashboard
//
// Plain HTML string, no React-Email — matches the existing
// scrape-alert.tsx pattern. Email clients vary wildly; the template
// sticks to inline styles and table layouts that Gmail/Outlook render
// identically.

interface KeywordRow {
  query: string;
  clicks: number;
  deltaClicks: number | null;
  impressions: number;
  position: number;
}

export interface SeoWeeklyReportData {
  windowStart: string;           // yyyy-mm-dd
  windowEnd: string;             // yyyy-mm-dd
  priorWindowEnd: string;        // yyyy-mm-dd, for the delta label
  impressions: number;
  clicks: number;
  priorImpressions: number | null;
  priorClicks: number | null;
  gainers: KeywordRow[];
  losers: KeywordRow[];
  dashboardUrl: string;
}

function fmt(n: number): string { return n.toLocaleString('de-AT'); }
function pct(delta: number): string { return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`; }
function deltaColor(d: number): string {
  return d > 0 ? '#10b981' : d < 0 ? '#ef4444' : '#9ca3af';
}

export function renderSeoWeeklyReportEmail(data: SeoWeeklyReportData): string {
  const impDelta = data.priorImpressions && data.priorImpressions > 0
    ? ((data.impressions - data.priorImpressions) / data.priorImpressions) * 100
    : 0;
  const clickDelta = data.priorClicks && data.priorClicks > 0
    ? ((data.clicks - data.priorClicks) / data.priorClicks) * 100
    : 0;

  const keywordRow = (k: KeywordRow, tone: 'up' | 'down'): string => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#e5e7eb;font-size:14px">${escapeHtml(k.query)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:${tone === 'up' ? '#10b981' : '#ef4444'};font-size:14px;text-align:right;font-variant-numeric:tabular-nums;font-weight:500">
        ${k.deltaClicks === null ? '—' : (k.deltaClicks > 0 ? `+${k.deltaClicks}` : k.deltaClicks)}
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#9ca3af;font-size:13px;text-align:right;font-variant-numeric:tabular-nums">${fmt(k.clicks)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #2a2a2a;color:#6b7280;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${k.position.toFixed(1)}</td>
    </tr>`;

  const gainerRows = data.gainers.length
    ? data.gainers.map(k => keywordRow(k, 'up')).join('')
    : '<tr><td colspan="4" style="padding:12px;color:#6b7280;font-style:italic;font-size:13px">Keine Gewinner in dieser Woche.</td></tr>';
  const loserRows = data.losers.length
    ? data.losers.map(k => keywordRow(k, 'down')).join('')
    : '<tr><td colspan="4" style="padding:12px;color:#6b7280;font-style:italic;font-size:13px">Keine Verlierer in dieser Woche — das ist gut.</td></tr>';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>LassTreffen SEO — Wochenbericht</title></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:0 auto;background:#141416;color:#e5e7eb">
    <div style="padding:24px;border-bottom:1px solid #2a2a2a">
      <p style="margin:0;color:#a5b4fc;font-size:12px;letter-spacing:0.12em;text-transform:uppercase">LassTreffen.at · Wochenbericht</p>
      <h1 style="margin:8px 0 0;font-size:24px;font-weight:600;color:#fff">SEO-Performance</h1>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:13px">
        ${data.windowStart} → ${data.windowEnd} (vs. 7 Tage davor)
      </p>
    </div>

    <div style="padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <table width="100%" cellspacing="0" cellpadding="0"><tr>
        <td width="50%" style="padding:12px;background:#1c1c1e;border-radius:8px;vertical-align:top">
          <p style="margin:0;color:#9ca3af;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Impressionen</p>
          <p style="margin:4px 0 0;color:#fff;font-size:24px;font-weight:600;font-variant-numeric:tabular-nums">${fmt(data.impressions)}</p>
          <p style="margin:4px 0 0;color:${deltaColor(impDelta)};font-size:13px;font-variant-numeric:tabular-nums">${pct(impDelta)}</p>
        </td>
        <td width="8"></td>
        <td width="50%" style="padding:12px;background:#1c1c1e;border-radius:8px;vertical-align:top">
          <p style="margin:0;color:#9ca3af;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Klicks</p>
          <p style="margin:4px 0 0;color:#fff;font-size:24px;font-weight:600;font-variant-numeric:tabular-nums">${fmt(data.clicks)}</p>
          <p style="margin:4px 0 0;color:${deltaColor(clickDelta)};font-size:13px;font-variant-numeric:tabular-nums">${pct(clickDelta)}</p>
        </td>
      </tr></table>
    </div>

    <div style="padding:0 24px 24px">
      <h2 style="margin:8px 0 12px;color:#10b981;font-size:14px;letter-spacing:0.06em;text-transform:uppercase">↑ Top Gewinner</h2>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:left;border-bottom:1px solid #333">Query</th>
            <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:right;border-bottom:1px solid #333">Δ Klicks</th>
            <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:right;border-bottom:1px solid #333">Klicks 28d</th>
            <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:right;border-bottom:1px solid #333">Pos.</th>
          </tr>
        </thead>
        <tbody>${gainerRows}</tbody>
      </table>

      <h2 style="margin:24px 0 12px;color:#ef4444;font-size:14px;letter-spacing:0.06em;text-transform:uppercase">↓ Top Verlierer</h2>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:left;border-bottom:1px solid #333">Query</th>
            <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:right;border-bottom:1px solid #333">Δ Klicks</th>
            <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:right;border-bottom:1px solid #333">Klicks 28d</th>
            <th style="padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;text-align:right;border-bottom:1px solid #333">Pos.</th>
          </tr>
        </thead>
        <tbody>${loserRows}</tbody>
      </table>
    </div>

    <div style="padding:24px;border-top:1px solid #2a2a2a;text-align:center">
      <a href="${data.dashboardUrl}" style="display:inline-block;padding:10px 20px;background:#fff;color:#0a0a0c;text-decoration:none;font-size:13px;font-weight:500;border-radius:6px">
        Full dashboard öffnen →
      </a>
      <p style="margin:12px 0 0;color:#6b7280;font-size:11px">
        Automatischer Freitags-Report von LassTreffen.at. Abmelden via Admin-Panel.
      </p>
    </div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
