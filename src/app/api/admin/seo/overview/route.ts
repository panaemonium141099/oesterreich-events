import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { readLatestSnapshot, readSnapshotRange, buildSnapshot, GSC_SITE_URL, SITE_URL } from '@/lib/seo/snapshot';
import { healthCheck } from '@/lib/seo/gsc';

/**
 * GET /api/admin/seo/overview
 *
 * The top-of-dashboard "state of SEO" card. Returns:
 *   - latest snapshot (the numbers that populate the KPI tiles)
 *   - 7d-prior snapshot (for delta arrows: "impressions +12% vs last week")
 *   - setup health: are GSC + CrUX env vars wired up and reachable?
 *   - cached: true/false — if latest is >36h old we label it "stale" in the UI
 *
 * Falls back to `buildSnapshot({ skipExternal: true })` when no snapshot
 * exists yet (first deploy before the daily cron has run) so the page
 * shows *something* on the internal-counter side while the user sets
 * up the external APIs.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const [latest, health] = await Promise.all([
    readLatestSnapshot(),
    healthCheck(GSC_SITE_URL).catch(err => ({
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    })),
  ]);

  // Prior snapshot — 7 days before latest, for delta calculation
  let prior = null;
  if (latest) {
    const latestDate = new Date(latest.date);
    latestDate.setUTCDate(latestDate.getUTCDate() - 7);
    const priorDate = latestDate.toISOString().slice(0, 10);
    const range = await readSnapshotRange(priorDate, priorDate);
    prior = range[0] ?? null;
  }

  // If no snapshot exists yet, synthesise a live internal-only one so
  // the dashboard has something to render.
  let current = latest;
  let synthetic = false;
  if (!current) {
    const metrics = await buildSnapshot({ skipExternal: true });
    current = { date: new Date().toISOString().slice(0, 10), metrics };
    synthetic = true;
  }

  const latestTs = current.date;
  const ageHours = Math.floor(
    (Date.now() - new Date(latestTs).getTime()) / (1000 * 60 * 60),
  );

  return NextResponse.json({
    site: SITE_URL,
    gscSite: GSC_SITE_URL,
    current,
    prior,
    synthetic,
    ageHours,
    stale: ageHours > 36,
    setup: {
      gsc: health.ok
        ? { ok: true, sitesVerified: health.sitesVerified }
        : { ok: false, error: health.error },
      crux: process.env.CRUX_API_KEY ? { ok: true } : { ok: false, error: 'CRUX_API_KEY env var missing' },
    },
  });
}
