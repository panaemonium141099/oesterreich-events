import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { readLatestSnapshot, readSnapshotRange } from '@/lib/seo/snapshot';

/**
 * GET /api/admin/seo/keywords?limit=50&sort=clicks|impressions|position|gain|loss
 *
 * Top queries from the latest snapshot, with optional gain/loss sort
 * that compares latest vs the snapshot 7 days before. "Gainers" and
 * "Losers" are the two most actionable views for weekly SEO work —
 * gainers tell you what's trending up (double down), losers tell you
 * what's slipping (investigate / rewrite).
 */
export const dynamic = 'force-dynamic';

type SortMode = 'clicks' | 'impressions' | 'position' | 'gain' | 'loss';

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
  const sort = (searchParams.get('sort') as SortMode | null) ?? 'clicks';

  const latest = await readLatestSnapshot();
  if (!latest?.metrics.gsc) {
    return NextResponse.json({
      keywords: [],
      message: 'No GSC data yet — run /api/cron/seo-daily-snapshot or wait for the next cron tick.',
    });
  }

  const current = latest.metrics.gsc.topQueries;

  // Gain/loss needs the 7d-prior snapshot. For other sorts, skip the lookup.
  let priorMap: Map<string, { clicks: number; impressions: number; position: number }> = new Map();
  if (sort === 'gain' || sort === 'loss') {
    const priorDate = new Date(latest.date);
    priorDate.setUTCDate(priorDate.getUTCDate() - 7);
    const priorDateStr = priorDate.toISOString().slice(0, 10);
    const [prior] = await readSnapshotRange(priorDateStr, priorDateStr);
    if (prior?.metrics.gsc) {
      priorMap = new Map(
        prior.metrics.gsc.topQueries.map(q => [
          q.query,
          { clicks: q.clicks, impressions: q.impressions, position: q.position },
        ]),
      );
    }
  }

  const enriched = current.map(q => {
    const prior = priorMap.get(q.query);
    return {
      ...q,
      deltaClicks: prior ? q.clicks - prior.clicks : null,
      deltaImpressions: prior ? q.impressions - prior.impressions : null,
      // Lower position = better — positive delta means dropped in ranking
      deltaPosition: prior ? q.position - prior.position : null,
    };
  });

  const sorted = (() => {
    switch (sort) {
      case 'clicks': return enriched.sort((a, b) => b.clicks - a.clicks);
      case 'impressions': return enriched.sort((a, b) => b.impressions - a.impressions);
      case 'position': return enriched.sort((a, b) => a.position - b.position);
      case 'gain': return enriched
        .filter(q => q.deltaClicks !== null)
        .sort((a, b) => (b.deltaClicks ?? 0) - (a.deltaClicks ?? 0));
      case 'loss': return enriched
        .filter(q => q.deltaClicks !== null)
        .sort((a, b) => (a.deltaClicks ?? 0) - (b.deltaClicks ?? 0));
    }
  })();

  return NextResponse.json({
    windowStart: latest.metrics.gsc.windowStart,
    windowEnd: latest.metrics.gsc.windowEnd,
    priorDate: sort === 'gain' || sort === 'loss'
      ? new Date(new Date(latest.date).getTime() - 7 * 86400000).toISOString().slice(0, 10)
      : null,
    sort,
    keywords: sorted.slice(0, limit),
  });
}
