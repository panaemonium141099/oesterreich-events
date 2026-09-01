import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { collectCtrFindings, type CtrFindings } from '@/lib/seo/ctr-findings';
import { sendGenericEmail } from '@/lib/email';

/**
 * Täglicher CTR-Wächter (2026-09-01).
 *
 * Misst, wie viele der Google-Impressionen tatsächlich zu Klicks werden —
 * je Seitentyp und für Events getrennt nach kommenden und vergangenen
 * Terminen. Jede Messung landet in `seo_ctr_findings`, damit die Wirkung
 * von Snippet-Änderungen belegbar wird statt geschätzt.
 *
 * Anlass: die 2.849 Aktivitäts-URLs brachten bei 20.492 Impressionen pro
 * Woche nur 157 Klicks (0,8 %). Die Snippet-Vorlagen wurden daraufhin
 * umgebaut (lib/seo/activity-meta.ts) — dieser Job zeigt, ob es wirkt.
 *
 * Der Job schreibt IMMER eine Messzeile. Eine Mail geht nur raus, wenn es
 * etwas zu entscheiden gibt: montags ein Wochenbericht mit Vorher/Nachher,
 * oder sofort, wenn die Klickrate eines Typs gegenüber dem Wochenschnitt
 * deutlich einbricht.
 *
 * Auth: CRON_SECRET als Bearer-Token (wie die übrigen Cron-Routen).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Ab dieser relativen Verschlechterung wird sofort gemeldet. */
const CTR_DROP_ALERT = 0.3;

function pct(n: number): string {
  return `${(n * 100).toFixed(2)} %`;
}

function num(n: number): string {
  return Math.round(n).toLocaleString('de-AT');
}

const TYPE_LABELS: Record<string, string> = {
  event_detail: 'Events',
  aktivitaet: 'Aktivitäten',
  gemeinde: 'Gemeinden',
  thema: 'Themen',
  bundesland: 'Bundesländer',
  blog: 'Blog',
  other: 'Andere',
};

function renderReport(
  current: CtrFindings,
  previous: CtrFindings | null,
  reason: string,
): string {
  const rows = Object.entries(current.byType)
    .sort((a, b) => b[1].impressions - a[1].impressions)
    .map(([type, s]) => {
      const before = previous?.byType[type];
      const delta = before && before.ctr > 0 ? (s.ctr - before.ctr) / before.ctr : null;
      const trend = delta == null
        ? '–'
        : `${delta >= 0 ? '▲' : '▼'} ${(Math.abs(delta) * 100).toFixed(0)} %`;
      return `<tr>
        <td style="padding:6px 10px">${TYPE_LABELS[type] ?? type}</td>
        <td style="padding:6px 10px;text-align:right">${num(s.impressions)}</td>
        <td style="padding:6px 10px;text-align:right">${num(s.clicks)}</td>
        <td style="padding:6px 10px;text-align:right"><b>${pct(s.ctr)}</b></td>
        <td style="padding:6px 10px;text-align:right">${s.avgPosition.toFixed(1)}</td>
        <td style="padding:6px 10px;text-align:right">${trend}</td>
      </tr>`;
    })
    .join('');

  const gaps = current.ctrGap
    .slice(0, 10)
    .map(
      (g) => `<li style="margin-bottom:4px">
        <a href="${g.url}">${g.path}</a><br>
        <span style="color:#666;font-size:12px">Pos. ${g.position.toFixed(1)} · ${num(g.impressions)} Impr. · CTR ${pct(g.ctr)} · geschätzt <b>+${g.missedClicks}</b> Klicks möglich</span>
      </li>`,
    )
    .join('');

  return `<div style="font-family:system-ui,sans-serif;max-width:720px">
    <h2 style="margin-bottom:4px">SEO-Klickraten — ${reason}</h2>
    <p style="color:#666;margin-top:0">Zeitraum ${current.window.startDate} bis ${current.window.endDate}${
      previous ? ` · Vergleich mit Messung vom ${previous.window.endDate}` : ''
    }</p>

    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <thead><tr style="background:#f4f4f5;text-align:left">
        <th style="padding:6px 10px">Seitentyp</th>
        <th style="padding:6px 10px;text-align:right">Impr.</th>
        <th style="padding:6px 10px;text-align:right">Klicks</th>
        <th style="padding:6px 10px;text-align:right">CTR</th>
        <th style="padding:6px 10px;text-align:right">Ø Pos.</th>
        <th style="padding:6px 10px;text-align:right">Trend</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <h3 style="margin-top:24px">Größte Klick-Lücken</h3>
    <p style="color:#666;font-size:13px;margin-top:0">Gute Position, aber deutlich weniger Klicks als üblich — hier lohnt ein besserer Titel.</p>
    <ol style="font-size:13px;padding-left:18px">${gaps || '<li>Keine auffälligen Lücken.</li>'}</ol>

    <p style="margin-top:24px;font-size:13px">
      Details im Admin-Panel: <a href="https://lasstreffen.at/admin/seo">lasstreffen.at/admin/seo</a>
    </p>
  </div>`;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase-Zugang fehlt' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let current: CtrFindings;
  try {
    current = await collectCtrFindings(7);
  } catch (err) {
    return NextResponse.json(
      { error: 'GSC-Abfrage fehlgeschlagen', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  // Vergleichswert: die Messung, die dem 7-Tage-Fenster am nächsten vor
  // einer Woche liegt — so vergleichen wir gleich lange, nicht
  // überlappende Zeiträume.
  const { data: prevRows } = await supabase
    .from('seo_ctr_findings')
    .select('window_start, window_end, by_type, events, totals')
    .lte('measured_at', new Date(Date.now() - 6 * 86400_000).toISOString())
    .order('measured_at', { ascending: false })
    .limit(1);

  const previous: CtrFindings | null = prevRows?.[0]
    ? ({
        window: { startDate: prevRows[0].window_start, endDate: prevRows[0].window_end, days: 7 },
        byType: prevRows[0].by_type,
        events: prevRows[0].events,
        totals: prevRows[0].totals,
        ctrGap: [],
        striking: [],
      } as CtrFindings)
    : null;

  const { error: insertError } = await supabase.from('seo_ctr_findings').insert({
    window_start: current.window.startDate,
    window_end: current.window.endDate,
    by_type: current.byType,
    events: current.events,
    ctr_gap: current.ctrGap.slice(0, 50),
    striking: current.striking.slice(0, 50),
    totals: current.totals,
  });
  if (insertError) {
    return NextResponse.json({ error: `Speichern fehlgeschlagen: ${insertError.message}` }, { status: 500 });
  }

  // Mail-Entscheidung: Wochenbericht (montags) oder akuter Einbruch.
  const drops: string[] = [];
  if (previous) {
    for (const [type, s] of Object.entries(current.byType)) {
      const before = previous.byType[type];
      if (!before || before.ctr <= 0 || s.impressions < 500) continue;
      const rel = (s.ctr - before.ctr) / before.ctr;
      if (rel <= -CTR_DROP_ALERT) {
        drops.push(`${TYPE_LABELS[type] ?? type}: ${pct(before.ctr)} → ${pct(s.ctr)}`);
      }
    }
  }

  const isMonday = new Date().getUTCDay() === 1;
  const alertEmail = process.env.ALERT_EMAIL;
  let mailed = false;

  if (alertEmail && (drops.length > 0 || isMonday)) {
    const reason = drops.length > 0 ? 'Klickrate eingebrochen' : 'Wochenbericht';
    const subject = drops.length > 0
      ? `⚠️ SEO: Klickrate gefallen (${drops.join(', ')})`
      : '📊 SEO-Wochenbericht: Klickraten';
    const res = await sendGenericEmail(alertEmail, subject, renderReport(current, previous, reason));
    mailed = res.success;
  }

  return NextResponse.json({
    ok: true,
    window: current.window,
    totals: current.totals,
    byType: current.byType,
    events: current.events,
    ctrGapCount: current.ctrGap.length,
    drops,
    mailed,
  });
}
