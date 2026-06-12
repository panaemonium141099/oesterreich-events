import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSearchProvider } from '@/lib/outreach/search-provider';
import { buildColdQueries, discoverColdProspects } from '@/lib/outreach/discover-cold';
import { DISTRICTS_BY_BUNDESLAND, displayDistrictName, BUNDESLAND_NAMES } from '@/lib/districtsAT';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const QUERIES_PER_RUN = 30; // keep well under the CSE free tier (100/day)

export async function GET(request: Request) {
  if (process.env.CRON_SECRET) {
    if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const provider = getSearchProvider();
  if (!provider) {
    return NextResponse.json({ ok: true, skipped: 'GOOGLE_CSE_KEY/GOOGLE_CSE_CX not set' });
  }

  // Build the full query pool from every Bezirk + Bundesland, then process a
  // rotating window each day so the whole country gets covered over ~2 weeks.
  const places = [
    ...Object.values(DISTRICTS_BY_BUNDESLAND).flat().map((d) => displayDistrictName(d.name)),
    ...Object.values(BUNDESLAND_NAMES),
  ];
  const all = buildColdQueries(places);
  const windows = Math.max(1, Math.ceil(all.length / QUERIES_PER_RUN));
  const offset = Math.floor(Date.now() / 86_400_000) % windows;
  const queries = all.slice(offset * QUERIES_PER_RUN, offset * QUERIES_PER_RUN + QUERIES_PER_RUN);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const candidates = await discoverColdProspects(supabase, provider, queries, 50);

  let inserted = 0;
  for (const c of candidates) {
    const { error } = await supabase.from('outreach_prospects').insert({
      domain: c.domain, kind: c.kind, website: c.website, discovered_via: c.discoveredVia,
    });
    if (!error) inserted += 1;
  }

  return NextResponse.json({ ok: true, queries: queries.length, candidates: candidates.length, inserted });
}
