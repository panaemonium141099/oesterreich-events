/**
 * GET /api/cron/seo-daily-snapshot
 *
 * Vercel Cron job — daily at 06:00 UTC (08:00 CEST).
 *
 * Builds a full SEO snapshot (GSC 28-day window + CrUX + internal DB
 * counters) and upserts one row into `seo_snapshots` keyed on the
 * current UTC date. Idempotent — if re-run, it overwrites the day's
 * row, which is fine because the source data monotonically improves.
 *
 * vercel.json cron config:
 *   { "path": "/api/cron/seo-daily-snapshot", "schedule": "0 6 * * *" }
 *
 * Auth: CRON_SECRET Bearer token (Vercel Cron sends this automatically
 * when `CRON_SECRET` is set in the project env vars).
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildSnapshot, writeSnapshot } from '@/lib/seo/snapshot';

export const dynamic = 'force-dynamic';
// Snapshot build can run up to ~30s when both GSC and CrUX are slow;
// 60s gives headroom.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const metrics = await buildSnapshot({ snapshotDate: today });
    await writeSnapshot(today, metrics);

    const summary = {
      success: true,
      snapshotDate: today,
      durationMs: Date.now() - startedAt,
      gsc: metrics.gsc ? {
        windowStart: metrics.gsc.windowStart,
        windowEnd: metrics.gsc.windowEnd,
        impressions: metrics.gsc.impressions,
        clicks: metrics.gsc.clicks,
        topQueryCount: metrics.gsc.topQueries.length,
        topPageCount: metrics.gsc.topPages.length,
      } : null,
      cwv: metrics.cwv ? {
        originReachable: metrics.cwv.origin !== null,
        hubTypesWithData: Object.entries(metrics.cwv.byHubType ?? {})
          .filter(([, v]) => v !== null)
          .map(([k]) => k),
      } : null,
      internal: metrics.internal,
    };
    console.log('[cron/seo-daily-snapshot] done:', summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[cron/seo-daily-snapshot] failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
