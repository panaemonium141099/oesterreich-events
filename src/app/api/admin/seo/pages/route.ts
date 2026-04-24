import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { readLatestSnapshot } from '@/lib/seo/snapshot';
import { classifyPage, type HubType } from '@/lib/seo/snapshot';

/**
 * GET /api/admin/seo/pages?hub=gemeinde|thema|event_detail|bundesland|blog|other&limit=50
 *
 * Top pages by clicks in the most recent snapshot, optionally scoped to
 * one hub-type. Every row comes with its computed HubType tag so the
 * dashboard can colour-group without re-classifying on the client.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 250);
  const hub = searchParams.get('hub') as HubType | null;

  const latest = await readLatestSnapshot();
  if (!latest?.metrics.gsc) {
    return NextResponse.json({
      pages: [],
      byHubType: null,
      message: 'No GSC data yet — run /api/cron/seo-daily-snapshot or wait for the next cron tick.',
    });
  }

  const annotated = latest.metrics.gsc.topPages.map(p => ({
    ...p,
    hubType: classifyPage(p.page),
  }));

  const filtered = hub ? annotated.filter(p => p.hubType === hub) : annotated;

  return NextResponse.json({
    windowStart: latest.metrics.gsc.windowStart,
    windowEnd: latest.metrics.gsc.windowEnd,
    byHubType: latest.metrics.gsc.byHubType,
    pages: filtered.slice(0, limit),
  });
}
