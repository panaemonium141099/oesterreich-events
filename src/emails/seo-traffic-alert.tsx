// src/emails/seo-traffic-alert.tsx
//
// Traffic-drop alert email — fires from `/api/cron/seo-traffic-alert`
// when the rolling 24h click count falls >30% below the rolling 7d
// average. "Something is off, check it."
//
// Kept lean — this lands in the admin's phone as a push-worthy ping,
// not a long-form report. One colour (red), one number, one CTA.

export interface SeoTrafficAlertData {
  dropPct: number;           // e.g. 42 → "42% Drop"
  last24hClicks: number;
  rolling7dAvg: number;
  snapshotDate: string;      // yyyy-mm-dd
  dashboardUrl: string;
}

export function renderSeoTrafficAlertEmail(data: SeoTrafficAlertData): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Traffic-Drop bei LassTreffen.at</title></head>
<body style="margin:0;padding:0;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#141416;color:#e5e7eb">
    <div style="padding:20px;background:#3f1d1d;border-bottom:1px solid #7f1d1d">
      <p style="margin:0;color:#fecaca;font-size:11px;letter-spacing:0.12em;text-transform:uppercase">⚠️ Traffic-Alert</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;color:#fff">SEO-Einbruch erkannt</h1>
    </div>

    <div style="padding:24px">
      <p style="margin:0 0 16px;color:#e5e7eb;font-size:15px;line-height:1.5">
        Die Klicks aus Google Search Console für die letzten 24 Stunden liegen
        <strong style="color:#f87171">${data.dropPct.toFixed(0)}% unter dem 7-Tage-Durchschnitt</strong>.
      </p>

      <table width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0">
        <tr>
          <td style="padding:12px;background:#1c1c1e;border-radius:8px 0 0 8px;vertical-align:top;border-right:1px solid #2a2a2a">
            <p style="margin:0;color:#9ca3af;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Letzte 24h</p>
            <p style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:600;font-variant-numeric:tabular-nums">${data.last24hClicks.toLocaleString('de-AT')}</p>
          </td>
          <td style="padding:12px;background:#1c1c1e;border-radius:0 8px 8px 0;vertical-align:top">
            <p style="margin:0;color:#9ca3af;font-size:11px;letter-spacing:0.1em;text-transform:uppercase">Ø 7 Tage</p>
            <p style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:600;font-variant-numeric:tabular-nums">${Math.round(data.rolling7dAvg).toLocaleString('de-AT')}</p>
          </td>
        </tr>
      </table>

      <div style="margin:20px 0 12px;padding:12px;background:#1c1c1e;border-radius:8px">
        <p style="margin:0;color:#d1d5db;font-size:13px;line-height:1.5">
          <strong style="color:#fff">Mögliche Ursachen, in Reihenfolge der Wahrscheinlichkeit:</strong>
        </p>
        <ul style="margin:8px 0 0;padding-left:20px;color:#9ca3af;font-size:13px;line-height:1.6">
          <li>Googlebot-Crawling-Problem (robots.txt, 5xx-Wellen)</li>
          <li>Breaking Change am URL-Schema (kürzliche Redirect-Kette?)</li>
          <li>Google Core-Update — auf <a href="https://status.search.google.com/" style="color:#a5b4fc">status.search.google.com</a> prüfen</li>
          <li>False Positive — kleine absolute Zahlen → prüfe ob &gt;10 Klicks/Tag an Normaltagen</li>
        </ul>
      </div>

      <div style="text-align:center;margin-top:24px">
        <a href="${data.dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#fff;color:#0a0a0c;text-decoration:none;font-size:14px;font-weight:500;border-radius:6px">
          Dashboard öffnen →
        </a>
      </div>

      <p style="margin:16px 0 0;color:#6b7280;font-size:11px;text-align:center">
        Snapshot vom ${data.snapshotDate} · LassTreffen.at Admin-Alerting
      </p>
    </div>
  </div>
</body></html>`;
}
