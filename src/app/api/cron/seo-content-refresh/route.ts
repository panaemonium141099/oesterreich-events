/**
 * GET /api/cron/seo-content-refresh
 *
 * Vercel Cron — monthly, first of the month 04:00 UTC. Rotates the
 * visible intro paragraph on the top-traffic hubs.
 *
 * What it does:
 *   1. Reads the latest `seo_snapshots` row for current GSC traffic
 *      breakdown per page.
 *   2. Picks the top N (default 50) hub pages by impressions, grouped
 *      across gemeinde / thema / bundesland scopes.
 *   3. For each, increments `intro_variant_index` (mod pool length)
 *      and updates `last_refreshed_at` + `refresh_count`.
 *   4. Invalidates the in-memory cache so the new intro shows on the
 *      next page render.
 *
 * Why top-traffic only: refreshing ALL 1,933 gemeinden every month
 * would dump 1,933 updated timestamps into Google's sitemap,
 * diluting the signal. Top-50 concentrated signal tells Google
 * "these pages are actively maintained" which boosts crawl priority.
 *
 * vercel.json cron config:
 *   { "path": "/api/cron/seo-content-refresh", "schedule": "0 4 1 * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readLatestSnapshot, classifyPage } from '@/lib/seo/snapshot';
import { poolSize, type HubType } from '@/lib/seo/intro-pool';
import { invalidateHubRefreshCache } from '@/lib/seo/hub-refresh';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TOP_N_HUBS = 50;

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

  const latest = await readLatestSnapshot();
  if (!latest?.metrics.gsc) {
    return NextResponse.json({ skipped: true, reason: 'no GSC data' });
  }

  // Candidates: only hub types that have intro-pool support
  const supportedHubs = new Set<HubType>(['gemeinde', 'thema', 'bundesland']);
  const candidates = latest.metrics.gsc.topPages
    .map(p => {
      let hub: HubType | null = null;
      const classified = classifyPage(p.page);
      if (supportedHubs.has(classified as HubType)) hub = classified as HubType;
      if (!hub) return null;
      const path = new URL(p.page, 'https://lasstreffen.at').pathname;
      return { hub, path, impressions: p.impressions };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, TOP_N_HUBS);

  if (candidates.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no qualifying top pages' });
  }

  const sb = serviceClient();
  const results: Array<{ hub: HubType; path: string; newIndex: number }> = [];
  // Per-hub error tracking — monthly rotation is critical enough that we
  // want to surface silent DB failures instead of just incrementing the
  // "rotated" count optimistically.
  const failures: Array<{ path: string; stage: string; error: string }> = [];

  for (const c of candidates) {
    const max = poolSize(c.hub);

    const { data: existing, error: readErr } = await sb
      .from('seo_hub_refreshes')
      .select('intro_variant_index, refresh_count')
      .eq('hub_path', c.path)
      .maybeSingle();

    if (readErr) {
      failures.push({ path: c.path, stage: 'read', error: readErr.message });
      continue;
    }

    const currentIndex = existing?.intro_variant_index ?? 0;
    const newIndex = (currentIndex + 1) % max;
    const newCount = (existing?.refresh_count ?? 0) + 1;

    const { error: upsertErr } = await sb.from('seo_hub_refreshes').upsert({
      hub_path: c.path,
      intro_variant_index: newIndex,
      last_refreshed_at: new Date().toISOString(),
      refresh_count: newCount,
    });

    if (upsertErr) {
      failures.push({ path: c.path, stage: 'upsert', error: upsertErr.message });
      continue;
    }

    invalidateHubRefreshCache(c.path);
    results.push({ hub: c.hub, path: c.path, newIndex });
  }

  if (failures.length > 0) {
    console.error('[cron/seo-content-refresh] partial failure:', failures);
  }
  console.log('[cron/seo-content-refresh] rotated', results.length, 'hubs,',
              failures.length, 'failed');

  return NextResponse.json({
    success: failures.length === 0,
    rotated: results.length,
    failed: failures.length,
    byHub: {
      gemeinde: results.filter(r => r.hub === 'gemeinde').length,
      thema: results.filter(r => r.hub === 'thema').length,
      bundesland: results.filter(r => r.hub === 'bundesland').length,
    },
    samples: results.slice(0, 5),
    failures: failures.slice(0, 10),
  }, { status: failures.length > 0 ? 207 : 200 });
}
