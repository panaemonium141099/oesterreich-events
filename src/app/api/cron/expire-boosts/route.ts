/**
 * GET /api/cron/expire-boosts
 *
 * Vercel Cron job (täglich). Beendet automatisch alle Boosts, deren
 * boost_until in der Vergangenheit liegt: is_boosted -> false und
 * boost_until / boost_tier werden geleert.
 *
 * Boosts ohne boost_until (NULL = "unbegrenzt") bleiben aktiv und müssen
 * manuell im Admin beendet werden.
 *
 * Authentication via CRON_SECRET Bearer token.
 * vercel.json cron config: { "path": "/api/cron/expire-boosts", "schedule": "0 1 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel Cron sends this automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('events')
    .update({ is_boosted: false, boost_until: null, boost_tier: null })
    .eq('is_boosted', true)
    .not('boost_until', 'is', null)
    .lt('boost_until', nowIso)
    .select('id');

  if (error) {
    console.error('[cron/expire-boosts] update failed:', error);
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 });
  }

  const expired = data?.length ?? 0;
  if (expired > 0) {
    console.log(`[cron/expire-boosts] expired ${expired} boost(s)`);
  }

  return NextResponse.json({ ok: true, expired });
}
