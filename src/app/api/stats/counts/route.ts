import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required — refusing to fall back to anon key which bypasses RLS');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('events')
      .select('bundesland, category')
      .or('visibility.eq.public,visibility.is.null')
      .gte('start_date', today);

    if (error) {
      console.error('Supabase query error (stats/counts):', error);
      return NextResponse.json(
        { error: 'Fehler beim Laden der Event-Statistiken' },
        { status: 500 }
      );
    }

    const regions: Record<string, number> = {};
    const categories: Record<string, number> = {};

    for (const row of data ?? []) {
      if (row.bundesland) {
        regions[row.bundesland] = (regions[row.bundesland] ?? 0) + 1;
      }
      if (row.category) {
        categories[row.category] = (categories[row.category] ?? 0) + 1;
      }
    }

    return NextResponse.json(
      { regions, categories },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (err) {
    console.error('API Error (stats/counts):', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden der Event-Statistiken' },
      { status: 500 }
    );
  }
}
