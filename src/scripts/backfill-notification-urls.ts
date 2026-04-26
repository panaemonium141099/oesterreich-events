/**
 * Backfill legacy UUID-form `action_url` values in `notifications` to
 * the canonical V3 form `/events/{plz-ort}/{date}/{slug}`.
 *
 * Why: prior versions of `cron/send-reminders` and `artist-matching`
 * wrote `/events/<full-uuid>` straight into action_url. Those URLs
 * still resolve via the catch-all 308-redirect in
 * `src/app/events/[...slug]/page.tsx`, but the redirect doesn't
 * survive a client-side router.push() RSC fetch — users see "This
 * page couldn't load" and have to manually reload before they reach
 * the canonical page.
 *
 * The defensive client-nav helper (src/lib/utils/notification-nav.ts)
 * already detects the legacy shape and uses hard-nav for those rows,
 * so this backfill isn't strictly required. But getting all rows to
 * canonical state means every notification gets the fast soft-nav
 * UX, AND we can drop the defense layer in a future cleanup.
 *
 * Run:
 *   npx tsx src/scripts/backfill-notification-urls.ts          # dry-run
 *   npx tsx src/scripts/backfill-notification-urls.ts --apply  # writes
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

// Load .env.local — same trick the other scripts in this dir use
// (tsx doesn't auto-load env files; Next.js does at runtime).
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* .env.local missing, rely on shell env */ }

const APPLY = process.argv.includes('--apply');
const LEGACY_UUID_RE = /^\/events\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE env vars missing');

  const sb = createClient(url, key);

  // Pull every notification row whose action_url matches the legacy
  // UUID shape. Joining via Supabase is awkward; we fetch event rows
  // separately to keep the query simple.
  const { data: notifs, error: notifErr } = await sb
    .from('notifications')
    .select('id, event_id, action_url')
    .like('action_url', '/events/%')
    .not('event_id', 'is', null)
    .limit(10_000);
  if (notifErr) throw notifErr;

  const legacy = (notifs ?? []).filter(n =>
    typeof n.action_url === 'string' && LEGACY_UUID_RE.test(n.action_url),
  );
  console.log(`[backfill] found ${legacy.length} rows with legacy UUID action_url`);

  if (legacy.length === 0) {
    console.log('[backfill] nothing to do');
    return;
  }

  const eventIds = [...new Set(legacy.map(n => n.event_id as string))];
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, slug, start_date, postal_code, address, bundesland, location_name')
    .in('id', eventIds);
  if (evErr) throw evErr;

  const eventMap = new Map(
    (events ?? []).map(e => [e.id as string, e as Record<string, string | null>]),
  );

  let planned = 0;
  let applied = 0;
  let skipped = 0;
  const samples: string[] = [];

  for (const n of legacy) {
    const event = eventMap.get(n.event_id as string);
    if (!event) {
      skipped++;
      continue;
    }
    const newUrl = buildEventUrlV2({
      id: event.id as string,
      slug: event.slug ?? null,
      start_date: event.start_date ?? null,
      postal_code: event.postal_code ?? null,
      address: event.address ?? null,
      bundesland: event.bundesland ?? null,
      location_name: event.location_name ?? null,
    });
    if (newUrl === n.action_url) {
      skipped++;
      continue;
    }
    planned++;
    if (samples.length < 5) samples.push(`${n.action_url} → ${newUrl}`);

    if (APPLY) {
      const { error } = await sb
        .from('notifications')
        .update({ action_url: newUrl })
        .eq('id', n.id);
      if (error) {
        console.error(`[backfill] update failed for notif ${n.id}:`, error.message);
      } else {
        applied++;
      }
    }
  }

  console.log('[backfill] sample rewrites:');
  for (const s of samples) console.log(`  ${s}`);
  console.log(`[backfill] planned=${planned} applied=${applied} skipped=${skipped} total_legacy=${legacy.length}`);
  if (!APPLY) {
    console.log('[backfill] dry-run only — re-run with --apply to write');
  }
}

main().catch(err => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
