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
 *   1. Run FeratelScraper.scrape() — all 131 regions in parallel pool
 *      (concurrency 6), max 500 events each
 *   2. Hand off to syncEventsToSupabase() which:
 *      - prefetches existing rows
 *      - applies upsert-guards (image, description, price_text, address —
 *        "don't NULL on missing" rules)
 *      - protects refined coordinates, slugs, venue matches
 *      - never overwrites enrichment columns (they're not in the row shape)
 *
 * Vercel timing budget:
 *   - FeratelScraper runs 131 regions through a parallel pool (concurrency 6).
 *     Worst case ~80s for scrape, ~30s for syncEventsToSupabase batch-upserts.
 *   - Sequential variant (the previous implementation) timed out at 300s once
 *     we expanded from 71 to 131 regions (2026-05-28).
 *
 * Auth: Vercel sets `Authorization: Bearer ${CRON_SECRET}` automatically.
 * Reject anything else when CRON_SECRET is configured (production).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Fluid Compute default — parallel scrape stays well under this

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
