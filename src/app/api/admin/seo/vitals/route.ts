import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { readLatestSnapshot } from '@/lib/seo/snapshot';

/**
 * GET /api/admin/seo/vitals
 *
 * Core Web Vitals from the latest snapshot — origin-level summary + one
 * representative URL per hub-type. Each entry is already bucketed
 * good/ni/poor against Google's 2025 thresholds (see `src/lib/seo/crux.ts`).
 *
 * Returns `{ origin: null, byHubType: {} }` if CrUX isn't configured or
 * none of our pages have enough field data yet. The dashboard component
 * renders a friendly "waiting for traffic" state in that case.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const latest = await readLatestSnapshot();
  if (!latest?.metrics.cwv) {
    return NextResponse.json({
      origin: null,
      byHubType: {},
      message: 'No CrUX data yet. Waiting for the next daily snapshot cron run.',
    });
  }

  return NextResponse.json({
    snapshotDate: latest.date,
    origin: latest.metrics.cwv.origin,
    byHubType: latest.metrics.cwv.byHubType,
  });
}
