/**
 * GET /api/cron/seo-traffic-alert
 *
 * Vercel Cron — hourly. Checks whether the last-24h click count has
 * dropped >30% below the rolling 7-day average. If so, emails an alert
 * to ALERT_EMAIL. If not, returns a quiet no-op.
 *
 * De-duplication: if a drop alert was already sent for this
 * snapshot_date, don't re-send the same day. Tracked via a small
 * marker in the snapshot's `metrics.alerts` sub-object.
 *
 * Guardrails:
 *   - Only fires when rolling7dAvg >= 10 clicks/day. Below that the
 *     drop % is noise (absolute delta of 3→2 clicks is not a real signal).
 *   - Only fires when dropPct >= 30.
 *
 * vercel.json cron config:
 *   { "path": "/api/cron/seo-traffic-alert", "schedule": "15 * * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readLatestSnapshot } from '@/lib/seo/snapshot';
import { renderSeoTrafficAlertEmail } from '@/emails/seo-traffic-alert';
import { sendGenericEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DROP_THRESHOLD_PCT = 30;
const MIN_BASELINE_CLICKS = 10;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const latest = await readLatestSnapshot();
  if (!latest?.metrics.traffic) {
    return NextResponse.json({ skipped: true, reason: 'no snapshot with traffic yet' });
  }

  const { last24hClicks, rolling7dAvgClicks } = latest.metrics.traffic;

  if (rolling7dAvgClicks < MIN_BASELINE_CLICKS) {
    return NextResponse.json({
      skipped: true,
      reason: `baseline too low (${rolling7dAvgClicks.toFixed(1)} < ${MIN_BASELINE_CLICKS})`,
      last24hClicks, rolling7dAvgClicks,
    });
  }

  const dropPct = rolling7dAvgClicks > 0
    ? Math.max(0, ((rolling7dAvgClicks - last24hClicks) / rolling7dAvgClicks) * 100)
    : 0;

  if (dropPct < DROP_THRESHOLD_PCT) {
    return NextResponse.json({
      skipped: true,
      reason: `drop ${dropPct.toFixed(1)}% < threshold ${DROP_THRESHOLD_PCT}%`,
      last24hClicks, rolling7dAvgClicks,
    });
  }

  // Dedupe — did we already alert for this snapshot date?
  const alertMarker = (latest.metrics as unknown as { alerts?: { lastTrafficAlertDate?: string } }).alerts;
  if (alertMarker?.lastTrafficAlertDate === latest.date) {
    return NextResponse.json({
      skipped: true,
      reason: 'alert already sent for this snapshot date',
      dropPct,
    });
  }

  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) {
    return NextResponse.json({
      skipped: true,
      reason: 'ALERT_EMAIL env var missing',
    });
  }

  const html = renderSeoTrafficAlertEmail({
    dropPct,
    last24hClicks,
    rolling7dAvg: rolling7dAvgClicks,
    snapshotDate: latest.date,
    dashboardUrl: 'https://lasstreffen.at/admin/seo',
  });
  const subject = `⚠️ LassTreffen.at — Traffic ${dropPct.toFixed(0)}% gegenüber 7d-Schnitt`;
  const sendResult = await sendGenericEmail(alertEmail, subject, html);

  if (!sendResult.success) {
    return NextResponse.json(
      { success: false, error: sendResult.error, dropPct },
      { status: 500 },
    );
  }

  // Mark the snapshot so we don't re-send today. Direct service-role
  // update via JSONB merge — avoids re-computing the whole snapshot.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const newMetrics = {
    ...latest.metrics,
    alerts: { lastTrafficAlertDate: latest.date },
  };
  await sb.from('seo_snapshots')
    .update({ metrics: newMetrics })
    .eq('snapshot_date', latest.date);

  return NextResponse.json({
    success: true,
    alerted: true,
    dropPct,
    last24hClicks,
    rolling7dAvg: rolling7dAvgClicks,
    emailId: sendResult.id,
  });
}
