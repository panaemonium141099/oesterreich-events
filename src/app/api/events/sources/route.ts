import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events/sources
 * Returns a list of unique source_name values from the events table.
 * Used by the god-role SourceFilter dropdown.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json([], { status: 503 });
  }

  const supabase = createClient(url, key);

  // Use a distinct query on source_name — Supabase doesn't have DISTINCT,
  // so we use RPC or a workaround. Simplest: fetch source_name column and dedupe client-side.
  // With ~97k events this is fast since we only select one column.
  const { data, error } = await supabase
    .from('events')
    .select('source_name')
    .not('source_name', 'is', null)
    .order('source_name', { ascending: true })
    .limit(100000);

  if (error) {
    return NextResponse.json([], { status: 500 });
  }

  const unique = [...new Set((data || []).map((r: { source_name: string }) => r.source_name))].sort();

  return NextResponse.json(unique, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
