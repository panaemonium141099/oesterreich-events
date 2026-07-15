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
    // fn-16 Slice 2: der Karten-Snapshot liefert 12-Hex-Short-IDs — die
    // lösen wir per UUID-Range-Scan über den PK-Index auf (uuid-Ordnung
    // = Byte-Ordnung = Hex-Präfix-Ordnung). Volle UUIDs wie gehabt.
    const shortId = /^[0-9a-f]{12}$/i.test(id) ? id.toLowerCase() : null;
    const query = supabase.from('events').select('*');
    const { data: event, error } = shortId
      ? await query
          .gte('id', `${shortId.slice(0, 8)}-${shortId.slice(8, 12)}-0000-0000-000000000000`)
          .lte('id', `${shortId.slice(0, 8)}-${shortId.slice(8, 12)}-ffff-ffff-ffffffffffff`)
          .limit(1)
          .maybeSingle()
      : await query.eq('id', id).single();

    if (error || !event) {
      return NextResponse.json({ error: 'Event nicht gefunden' }, { status: 404 });
    }

    const res = NextResponse.json(event);
    // Event-Detail ändert sich nach dem Scrape quasi nie — 1 h Edge + 24 h SWR.
    // Detail-Modal + SEO-Page treffen beide diesen Endpoint pro ID.
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
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
