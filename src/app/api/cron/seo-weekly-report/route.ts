/**
 * GET /api/cron/seo-weekly-report
 *
 * Vercel Cron — Friday 10:00 UTC (12:00 CEST). Assembles top-10
 * gainers + top-10 losers from the latest snapshot (compared to the
 * snapshot from 7 days before) and emails the HTML digest to
 * ALERT_EMAIL.
 *
 * vercel.json cron config:
 *   { "path": "/api/cron/seo-weekly-report", "schedule": "0 10 * * 5" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { readLatestSnapshot, readSnapshotRange } from '@/lib/seo/snapshot';
import { renderSeoWeeklyReportEmail } from '@/emails/seo-weekly-report';
import { sendGenericEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const latest = await readLatestSnapshot();
  if (!latest?.metrics.gsc) {
    return NextResponse.json({ skipped: true, reason: 'no GSC data in latest snapshot' });
  }

  // Prior = snapshot 7 days before latest. If not found, we still send the
  // report — deltas just get marked as null.
  const priorDate = new Date(latest.date);
  priorDate.setUTCDate(priorDate.getUTCDate() - 7);
  const priorDateStr = priorDate.toISOString().slice(0, 10);
  const [priorSnap] = await readSnapshotRange(priorDateStr, priorDateStr);

  const priorMap = new Map<string, { clicks: number; impressions: number; position: number }>();
  if (priorSnap?.metrics.gsc) {
    for (const q of priorSnap.metrics.gsc.topQueries) {
      priorMap.set(q.query, { clicks: q.clicks, impressions: q.impressions, position: q.position });
    }
  }

  const enriched = latest.metrics.gsc.topQueries.map(q => {
    const prior = priorMap.get(q.query);
    return {
      ...q,
      deltaClicks: prior ? q.clicks - prior.clicks : null,
    };
  });

  const gainers = enriched
    .filter(q => q.deltaClicks !== null && q.deltaClicks > 0)
    .sort((a, b) => (b.deltaClicks ?? 0) - (a.deltaClicks ?? 0))
    .slice(0, 10);
  const losers = enriched
    .filter(q => q.deltaClicks !== null && q.deltaClicks < 0)
    .sort((a, b) => (a.deltaClicks ?? 0) - (b.deltaClicks ?? 0))
    .slice(0, 10);

  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) {
    return NextResponse.json({ skipped: true, reason: 'ALERT_EMAIL env var missing' });
  }

  const html = renderSeoWeeklyReportEmail({
    windowStart: latest.metrics.gsc.windowStart,
    windowEnd: latest.metrics.gsc.windowEnd,
    priorWindowEnd: priorSnap?.metrics.gsc?.windowEnd ?? priorDateStr,
    impressions: latest.metrics.gsc.impressions,
    clicks: latest.metrics.gsc.clicks,
    priorImpressions: priorSnap?.metrics.gsc?.impressions ?? null,
    priorClicks: priorSnap?.metrics.gsc?.clicks ?? null,
    gainers,
    losers,
    dashboardUrl: 'https://lasstreffen.at/admin/seo',
  });
  const subject = `LassTreffen SEO — Wochenbericht · ${latest.metrics.gsc.windowEnd}`;
  const sendResult = await sendGenericEmail(alertEmail, subject, html);

  if (!sendResult.success) {
    return NextResponse.json({ success: false, error: sendResult.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    snapshotDate: latest.date,
    priorDate: priorDateStr,
    gainerCount: gainers.length,
    loserCount: losers.length,
    emailId: sendResult.id,
  });
}
