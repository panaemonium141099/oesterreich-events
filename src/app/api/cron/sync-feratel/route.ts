import { NextRequest, NextResponse } from 'next/server';
import { FeratelScraper } from '@/lib/scrapers/FeratelScraper';
import { syncEventsToSupabase } from '@/lib/db/supabase-sync';

/**
 * Hourly Feratel/Deskline re-sync.
 *
 * Why hourly: tourism boards correct typos and add events throughout the day;
 * the previous 24h cadence meant their fixes only appeared the next morning.
 * The TVB Abtenau email from 2026-05-22 was the explicit trigger.
 *
 * What it does:
 *   1. Run FeratelScraper.scrape() — all 71+ regions, max 500 events each
 *   2. Hand off to syncEventsToSupabase() which:
 *      - prefetches existing rows
 *      - applies upsert-guards (image, description, price_text, address —
 *        "don't NULL on missing" rules)
 *      - protects refined coordinates, slugs, venue matches
 *      - never overwrites enrichment columns (they're not in the row shape)
 *
 * Vercel timing budget:
 *   - FeratelScraper is sequential by region + 500ms rateLimit between regions.
 *     71 regions × (≤3s API + 0.5s delay) = ~250s worst case.
 *   - Add ~30s for syncEventsToSupabase batch-upserts.
 *   - Set maxDuration=300 (Fluid Compute default) with safety margin.
 *
 * Auth: Vercel sets `Authorization: Bearer ${CRON_SECRET}` automatically.
 * Reject anything else when CRON_SECRET is configured (production).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Fluid Compute hard cap

interface CronResponse {
  ok: boolean;
  durationMs: number;
  scraped: number;
  upserted: number;
  filtered: number;
  errors: number;
  message?: string;
}

export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const start = Date.now();

  try {
    const scraper = new FeratelScraper();
    const events = await scraper.scrape();

    if (events.length === 0) {
      const body: CronResponse = {
        ok: true,
        durationMs: Date.now() - start,
        scraped: 0,
        upserted: 0,
        filtered: 0,
        errors: 0,
        message: 'Feratel scrape returned 0 events (check upstream API).',
      };
      console.warn('[cron:sync-feratel] No events', body);
      return NextResponse.json(body);
    }

    const sync = await syncEventsToSupabase(events);
    const body: CronResponse = {
      ok: true,
      durationMs: Date.now() - start,
      scraped: events.length,
      upserted: sync.upserted,
      filtered: sync.filtered,
      errors: sync.errors,
    };
    console.log('[cron:sync-feratel] done', body);
    return NextResponse.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron:sync-feratel] failed', { err: msg, durationMs: Date.now() - start });
    return NextResponse.json(
      { ok: false, durationMs: Date.now() - start, error: msg } satisfies Record<string, unknown>,
      { status: 500 },
    );
  }
}
