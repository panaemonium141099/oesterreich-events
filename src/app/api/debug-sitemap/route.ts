import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({
      error: 'Missing env vars',
      hasUrl: !!url,
      hasKey: !!key,
    });
  }

  const supabase = createClient(url, key);
  const today = new Date().toISOString().split('T')[0];

  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('start_date', today)
    .eq('publish_status', 'published')
    .gte('quality_score', 40);

  return NextResponse.json({
    envPresent: true,
    today,
    count,
    error: error?.message ?? null,
  });
}
