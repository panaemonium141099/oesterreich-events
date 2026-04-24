/**
 * GET /api/cron/seo-daily-snapshot
 *
 * The ONE daily SEO cron on the Hobby plan.
 *
 * Vercel Hobby limits cron jobs to daily (or less frequent) schedules
 * and max 2 total crons per project. So instead of running separate
 * jobs for snapshot / traffic-alert / weekly-report / content-refresh
 * on different cadences, we run ONE job every day at 06:00 UTC that
 * orchestrates all four in sequence — each with its own gating logic:
 *
 *   1. Always:                      Build + persist daily SEO snapshot
 *   2. Always:                      Check traffic-drop threshold → email
 *   3. If today is Friday:          Email weekly gainers/losers report
 *   4. If today is the 1st of month: Rotate content on top-traffic hubs
 *
 * Why orchestrate inline (not self-fetch):
 *   Each step is cheap and the whole job fits in the 60s budget.
 *   Self-fetching our own API would add latency, auth gymnastics, and
 *   a second cron-secret layer for no gain.
 *
 * The individual per-task routes (seo-traffic-alert, seo-weekly-report,
 * seo-content-refresh) stay as separate files so the admin can trigger
 * them manually for debugging — just no longer cron-scheduled.
 *
 * vercel.json cron config:
 *   { "path": "/api/cron/seo-daily-snapshot", "schedule": "0 6 * * *" }
 *
 * Auth: CRON_SECRET Bearer token (Vercel Cron sends this automatically
 * when `CRON_SECRET` is set in the project env vars).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildSnapshot, writeSnapshot, readLatestSnapshot, readSnapshotRange, classifyPage } from '@/lib/seo/snapshot';
import { renderSeoTrafficAlertEmail } from '@/emails/seo-traffic-alert';
import { renderSeoWeeklyReportEmail } from '@/emails/seo-weekly-report';
import { sendGenericEmail } from '@/lib/email';
import { poolSize, type HubType } from '@/lib/seo/intro-pool';
import { invalidateHubRefreshCache } from '@/lib/seo/hub-refresh';

export const dynamic = 'force-dynamic';
// The full orchestrated run can hit ~50s in the worst case (slow GSC +
// slow CrUX + weekly email + content rotation). 60s maxDuration gives
// a small safety margin; individual sub-steps swallow their errors so
// one failure doesn't wipe the run.
export const maxDuration = 60;

const DROP_THRESHOLD_PCT = 30;
const MIN_BASELINE_CLICKS = 10;
const TOP_N_HUBS = 50;
const DASHBOARD_URL = 'https://lasstreffen.at/admin/seo';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayOfWeek = now.getUTCDay(); // 0 Sun ... 5 Fri ... 6 Sat
  const dayOfMonth = now.getUTCDate();

  const results: Record<string, unknown> = { today };

  // ─── Step 1: Snapshot ────────────────────────────────────────────
  try {
    const metrics = await buildSnapshot({ snapshotDate: today });
    await writeSnapshot(today, metrics);
    results.snapshot = {
      ok: true,
      gsc: metrics.gsc ? {
        impressions: metrics.gsc.impressions,
        clicks: metrics.gsc.clicks,
      } : null,
      cwv: metrics.cwv?.origin ? { originReachable: true } : { originReachable: false },
    };
  } catch (err) {
    console.error('[cron/seo-daily] snapshot failed:', err);
    results.snapshot = { ok: false, error: err instanceof Error ? err.message : String(err) };
    // If snapshot fails, traffic-alert + weekly can still try reading
    // the previous day's row. Continue.
  }

  // ─── Step 2: Traffic-drop alert ──────────────────────────────────
  try {
    results.trafficAlert = await maybeFireTrafficAlert();
  } catch (err) {
    console.error('[cron/seo-daily] traffic-alert step failed:', err);
    results.trafficAlert = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // ─── Step 3: Weekly report (Fridays only) ────────────────────────
  if (dayOfWeek === 5) {
    try {
      results.weeklyReport = await sendWeeklyReport();
    } catch (err) {
      console.error('[cron/seo-daily] weekly-report step failed:', err);
      results.weeklyReport = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  } else {
    results.weeklyReport = { skipped: true, reason: 'not friday' };
  }

  // ─── Step 4: Content refresh (1st of month only) ─────────────────
  if (dayOfMonth === 1) {
    try {
      results.contentRefresh = await rotateContent();
    } catch (err) {
      console.error('[cron/seo-daily] content-refresh step failed:', err);
      results.contentRefresh = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  } else {
    results.contentRefresh = { skipped: true, reason: 'not 1st of month' };
  }

  results.durationMs = Date.now() - startedAt;
  console.log('[cron/seo-daily] done:', JSON.stringify(results));
  return NextResponse.json(results);
}

// ─────────────────────────────────────────────────────────────────────
// Sub-step implementations — copied from the individual route files,
// deduplicated/simplified where the orchestrator already has context.
// ─────────────────────────────────────────────────────────────────────

async function maybeFireTrafficAlert(): Promise<unknown> {
  const latest = await readLatestSnapshot();
  if (!latest?.metrics.traffic) {
    return { skipped: true, reason: 'no snapshot traffic data' };
  }

  const { last24hClicks, rolling7dAvgClicks } = latest.metrics.traffic;

  if (rolling7dAvgClicks < MIN_BASELINE_CLICKS) {
    return { skipped: true, reason: 'baseline too low', last24hClicks, rolling7dAvgClicks };
  }

  const dropPct = rolling7dAvgClicks > 0
    ? Math.max(0, ((rolling7dAvgClicks - last24hClicks) / rolling7dAvgClicks) * 100)
    : 0;
  if (dropPct < DROP_THRESHOLD_PCT) {
    return { skipped: true, reason: `drop ${dropPct.toFixed(1)}% < ${DROP_THRESHOLD_PCT}%` };
  }

  const alertMarker = (latest.metrics as unknown as { alerts?: { lastTrafficAlertDate?: string } }).alerts;
  if (alertMarker?.lastTrafficAlertDate === latest.date) {
    return { skipped: true, reason: 'already alerted today' };
  }

  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) {
    return { skipped: true, reason: 'ALERT_EMAIL env var missing' };
  }

  const html = renderSeoTrafficAlertEmail({
    dropPct,
    last24hClicks,
    rolling7dAvg: rolling7dAvgClicks,
    snapshotDate: latest.date,
    dashboardUrl: DASHBOARD_URL,
  });
  const subject = `⚠️ LassTreffen.at — Traffic ${dropPct.toFixed(0)}% gegenüber 7d-Schnitt`;
  const sendResult = await sendGenericEmail(alertEmail, subject, html);

  if (!sendResult.success) return { ok: false, error: sendResult.error };

  const sb = serviceClient();
  await sb.from('seo_snapshots')
    .update({ metrics: { ...latest.metrics, alerts: { lastTrafficAlertDate: latest.date } } })
    .eq('snapshot_date', latest.date);

  return { alerted: true, dropPct, emailId: sendResult.id };
}

async function sendWeeklyReport(): Promise<unknown> {
  const latest = await readLatestSnapshot();
  if (!latest?.metrics.gsc) return { skipped: true, reason: 'no GSC data' };

  const priorDate = new Date(latest.date);
  priorDate.setUTCDate(priorDate.getUTCDate() - 7);
  const priorDateStr = priorDate.toISOString().slice(0, 10);
  const [priorSnap] = await readSnapshotRange(priorDateStr, priorDateStr);

  const priorMap = new Map<string, { clicks: number }>();
  if (priorSnap?.metrics.gsc) {
    for (const q of priorSnap.metrics.gsc.topQueries) {
      priorMap.set(q.query, { clicks: q.clicks });
    }
  }

  const enriched = latest.metrics.gsc.topQueries.map(q => ({
    ...q,
    deltaClicks: priorMap.has(q.query) ? q.clicks - (priorMap.get(q.query)?.clicks ?? 0) : null,
  }));

  const gainers = enriched
    .filter(q => q.deltaClicks !== null && q.deltaClicks > 0)
    .sort((a, b) => (b.deltaClicks ?? 0) - (a.deltaClicks ?? 0)).slice(0, 10);
  const losers = enriched
    .filter(q => q.deltaClicks !== null && q.deltaClicks < 0)
    .sort((a, b) => (a.deltaClicks ?? 0) - (b.deltaClicks ?? 0)).slice(0, 10);

  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) return { skipped: true, reason: 'ALERT_EMAIL missing' };

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
    dashboardUrl: DASHBOARD_URL,
  });

  const sendResult = await sendGenericEmail(
    alertEmail,
    `LassTreffen SEO — Wochenbericht · ${latest.metrics.gsc.windowEnd}`,
    html,
  );
  if (!sendResult.success) return { ok: false, error: sendResult.error };

  return { sent: true, gainers: gainers.length, losers: losers.length, emailId: sendResult.id };
}

async function rotateContent(): Promise<unknown> {
  const latest = await readLatestSnapshot();
  if (!latest?.metrics.gsc) return { skipped: true, reason: 'no GSC data' };

  const supported = new Set<HubType>(['gemeinde', 'thema', 'bundesland']);
  const candidates = latest.metrics.gsc.topPages
    .map(p => {
      const classified = classifyPage(p.page);
      if (!supported.has(classified as HubType)) return null;
      return {
        hub: classified as HubType,
        path: new URL(p.page, 'https://lasstreffen.at').pathname,
        impressions: p.impressions,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, TOP_N_HUBS);

  if (candidates.length === 0) return { skipped: true, reason: 'no candidates' };

  const sb = serviceClient();
  let rotated = 0;
  const failures: Array<{ path: string; error: string }> = [];

  for (const c of candidates) {
    const max = poolSize(c.hub);
    const { data: existing, error: readErr } = await sb
      .from('seo_hub_refreshes')
      .select('intro_variant_index, refresh_count')
      .eq('hub_path', c.path)
      .maybeSingle();
    if (readErr) { failures.push({ path: c.path, error: readErr.message }); continue; }

    const newIndex = ((existing?.intro_variant_index ?? 0) + 1) % max;
    const newCount = (existing?.refresh_count ?? 0) + 1;

    const { error: upsertErr } = await sb.from('seo_hub_refreshes').upsert({
      hub_path: c.path,
      intro_variant_index: newIndex,
      last_refreshed_at: new Date().toISOString(),
      refresh_count: newCount,
    });
    if (upsertErr) { failures.push({ path: c.path, error: upsertErr.message }); continue; }

    invalidateHubRefreshCache(c.path);
    rotated++;
  }

  return { rotated, failed: failures.length, samples: failures.slice(0, 5) };
}
