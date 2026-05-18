import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isFalsePositiveMatch } from '@/lib/artist-matching';

// Personal context lives in a route handler — NOT in the event detail
// server component — because the detail page runs with `revalidate=3600`
// (ISR) and Next.js 16 throws "Page changed from static to dynamic at
// runtime, reason: cookies" if a dynamic API is touched during the
// static prerender pass. Route handlers are always dynamic, so cookies()
// is safe here.
export const dynamic = 'force-dynamic';

interface PersonalContextResponse {
  signedIn: boolean;
  saved?: boolean;
  artistMatch?: boolean;
  lineupMatch?: boolean;
  matchedArtistName?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;

  const anon: PersonalContextResponse = { signedIn: false };
  const headers = { 'Cache-Control': 'private, no-store' };

  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch {
    return NextResponse.json(anon, { headers });
  }

  let user;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return NextResponse.json(anon, { headers });
  }

  if (!user) {
    return NextResponse.json(anon, { headers });
  }

  const [savedRes, notifRes] = await Promise.all([
    supabase
      .from('saved_events')
      .select('event_id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('artist_event_notifications')
      .select('artist_name, match_source, events!inner(title)')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .limit(5),
  ]);

  const saved = Boolean(savedRes.data?.event_id);

  type NotifRow = {
    artist_name: string;
    match_source: string;
    events: { title: string } | Array<{ title: string }> | null;
  };

  let artistMatch = false;
  let lineupMatch = false;
  let matchedArtistName: string | undefined;

  for (const n of (notifRes.data ?? []) as NotifRow[]) {
    const eventInfo = Array.isArray(n.events) ? n.events[0] : n.events;
    const eventTitle = eventInfo?.title ?? '';
    if (n.match_source === 'lineup') {
      lineupMatch = true;
      matchedArtistName ??= n.artist_name;
    } else if (!isFalsePositiveMatch(n.artist_name, eventTitle)) {
      artistMatch = true;
      matchedArtistName ??= n.artist_name;
    }
  }

  const body: PersonalContextResponse = {
    signedIn: true,
    saved,
    artistMatch,
    lineupMatch,
    matchedArtistName,
  };
  return NextResponse.json(body, { headers });
}
