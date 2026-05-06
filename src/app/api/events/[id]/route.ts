import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required — refusing to fall back to anon key which bypasses RLS');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Ungültige Event-ID' }, { status: 400 });
  }

  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 });
    }

    const res = NextResponse.json(event);
    // Event-Detail ändert sich nach dem Scrape quasi nie. 5 min Edge + 10 min
    // SWR — pro Event-ID separater Cache-Key. Detail-Modal + SEO-Page treffen
    // beide diesen Endpoint und profitieren so vom CDN.
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600'
    );
    return res;
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Events' },
      { status: 500 }
    );
  }
}
