import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { readSnapshotRange } from '@/lib/seo/snapshot';

/**
 * GET /api/admin/seo/history?days=30
 *
 * Returns a time-series trail of the headline metrics from the
 * `seo_snapshots` table — impressions, clicks, avg position, ctr,
 * by day. The dashboard renders this as a sparkline row + an
 * expandable chart.
 *
 * `days` clamped to [7, 365].
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10) || 30, 7), 365);

  const endDate = new Date().toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setUTCDate(startDateObj.getUTCDate() - days);
  const startDate = startDateObj.toISOString().slice(0, 10);

  const snapshots = await readSnapshotRange(startDate, endDate);

  // Flatten the important KPIs for chart consumption. Nulls where the
  // day's snapshot has no GSC data.
  const series = snapshots.map(s => ({
    date: s.date,
    impressions: s.metrics.gsc?.impressions ?? null,
    clicks: s.metrics.gsc?.clicks ?? null,
    ctr: s.metrics.gsc?.ctr ?? null,
    avgPosition: s.metrics.gsc?.avgPosition ?? null,
    sitemapUrlsGenerated: s.metrics.internal?.sitemapUrlsGenerated ?? null,
    gemeindeHubsIndexable: s.metrics.internal?.gemeindeHubsIndexable ?? null,
    lcpMs: s.metrics.cwv?.origin?.lcp?.p75ms ?? null,
    inpMs: s.metrics.cwv?.origin?.inp?.p75ms ?? null,
    cls: s.metrics.cwv?.origin?.cls?.p75 ?? null,
  }));

  return NextResponse.json({ startDate, endDate, days, series });
}
