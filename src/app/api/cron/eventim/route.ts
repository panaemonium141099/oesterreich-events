import { NextResponse } from 'next/server';
import { fetchAndParseEventim, upsertEventimEvents, hasEventimCredentials } from '@/lib/eventim/import';

/**
 * Daily Eventim PFT-feed import.
 *
 * The feed is a full mirror (no incremental API), so each run re-imports the
 * whole future catalogue (~22k events) via the shared write-path. Idempotent
 * upserts + last_seen_at bumps mean a partial run is self-healing on the next.
 *
 * Auth: Vercel sets `Authorization: Bearer ${CRON_SECRET}` automatically.
 * Credentials: needs EVENTIM_FEED_USER / EVENTIM_FEED_PASS in the environment;
 * without them this is a clean no-op (not a 500) so it doesn't spam errors.
 *
 * Timeout: 57 MB download + ~22k upserts. maxDuration is the ceiling; if cron
 * logs show timeouts, switch feed-client to a streaming gunzip+parse (design
 * Slice 5 note) and/or chunk the upserts across invocations.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  if (!hasEventimCredentials()) {
    console.warn('[cron:eventim] skipped — EVENTIM_FEED_USER / EVENTIM_FEED_PASS not set');
    return NextResponse.json({ ok: false, skipped: 'EVENTIM_FEED_USER / EVENTIM_FEED_PASS not configured' });
  }

  const start = Date.now();
  try {
    const events = await fetchAndParseEventim(new Date().toISOString());
    const r = await upsertEventimEvents(events, (m) => console.log('[cron:eventim]', m));
    const body = { ok: true, durationMs: Date.now() - start, parsed: events.length, ...r };
    console.log('[cron:eventim] done', body);
    return NextResponse.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron:eventim] failed', { err: msg, durationMs: Date.now() - start });
    return NextResponse.json({ ok: false, durationMs: Date.now() - start, error: msg }, { status: 500 });
  }
}
