import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { buildSnapshot, writeSnapshot } from '@/lib/seo/snapshot';

/**
 * POST /api/admin/seo/snapshot
 *
 * Manually triggers a fresh snapshot + persists it. Intended for the
 * "Refresh now" button on the admin SEO dashboard — handy when the
 * daily cron hasn't fired yet or when debugging the GSC integration.
 *
 * Returns the freshly built metrics object.
 *
 * Admin-gated; uses admin auth rather than the CRON_SECRET because
 * it's called from a logged-in browser, not a scheduled worker.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const metrics = await buildSnapshot({ snapshotDate: today });
    await writeSnapshot(today, metrics);
    return NextResponse.json({ success: true, date: today, metrics });
  } catch (err) {
    console.error('[api/admin/seo/snapshot] build failed:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
