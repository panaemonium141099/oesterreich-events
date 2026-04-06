import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/** Lazy Supabase client — validates env vars at call time, not module load time */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** All valid Bundesland and category values for counting */
const BUNDESLAENDER = [
  'Burgenland', 'Kärnten', 'Niederösterreich', 'Oberösterreich',
  'Salzburg', 'Steiermark', 'Tirol', 'Vorarlberg', 'Wien',
];

const CATEGORIES = [
  'Musik', 'Kultur', 'Sport', 'Familie', 'Natur', 'Nightlife',
  'Wein & Kulinarik', 'Märkte', 'Feste & Brauchtum', 'Bildung',
  'Gesundheit', 'Business', 'Sonstiges',
];

export async function GET() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Service unavailable', code: 'ENV_MISSING' },
      { status: 503 }
    );
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Run all count queries in parallel — each returns just a number, not full rows
    const [regionResults, categoryResults] = await Promise.all([
      Promise.all(
        BUNDESLAENDER.map(async (bl) => {
          const { count } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('bundesland', bl)
            .or('visibility.eq.public,visibility.is.null')
            .gte('start_date', today);
          return [bl, count || 0] as const;
        })
      ),
      Promise.all(
        CATEGORIES.map(async (cat) => {
          const { count } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('category', cat)
            .or('visibility.eq.public,visibility.is.null')
            .gte('start_date', today);
          return [cat, count || 0] as const;
        })
      ),
    ]);

    const regions: Record<string, number> = {};
    for (const [bl, count] of regionResults) {
      if (count > 0) regions[bl] = count;
    }

    const categories: Record<string, number> = {};
    for (const [cat, count] of categoryResults) {
      if (count > 0) categories[cat] = count;
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
