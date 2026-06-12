import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { discoverWarmProspects } from '@/lib/outreach/discover-warm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const candidates = await discoverWarmProspects(supabase, 200);
  let inserted = 0;
  for (const c of candidates) {
    const { error } = await supabase.from('outreach_prospects').insert({
      domain: c.domain,
      kind: c.kind,
      org_name: c.orgName,
      website: c.website,
      bundesland: c.bundesland,
      source_event_ids: c.sourceEventIds,
      discovered_via: c.discoveredVia,
    });
    if (!error) inserted += 1; // unique(domain) conflict => skip silently
  }

  return NextResponse.json({ ok: true, candidates: candidates.length, inserted });
}
