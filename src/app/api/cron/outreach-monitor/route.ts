import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSearchProvider } from '@/lib/outreach/search-provider';
import { findReferrerMentions, findSearchMentions } from '@/lib/outreach/monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

  const rows = [...(await findReferrerMentions(supabase))];
  const provider = getSearchProvider();
  if (provider) rows.push(...(await findSearchMentions(provider)));

  let inserted = 0;
  for (const m of rows) {
    const { error } = await supabase.from('outreach_mentions').insert({
      url: m.url, domain: m.domain, kind: m.kind, source: m.source,
    });
    if (!error) inserted += 1; // unique(domain,source) conflict => already known
  }

  return NextResponse.json({ ok: true, found: rows.length, inserted });
}
