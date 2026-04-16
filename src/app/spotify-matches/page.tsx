'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { EventImage } from '@/components/Events/EventImage';

interface SpotifyMatch {
  id: string;
  spotify_artist_id: string;
  artist_name: string;
  event_id: string;
  match_type: string;
  match_score: number;
  dismissed: boolean;
  event?: {
    id: string;
    title: string;
    start_date: string;
    location_name: string | null;
    bundesland: string | null;
    image_url: string | null;
    ticket_url: string | null;
    source_url: string | null;
  };
}

export default function SpotifyMatchesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [matches, setMatches] = useState<SpotifyMatch[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    const { data } = await supabase
      .from('spotify_artist_matches')
      .select('id, spotify_artist_id, artist_name, event_id, match_type, match_score, dismissed')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('match_score', { ascending: false });

    if (!data || data.length === 0) {
      setMatches([]);
      setLoadingData(false);
      return;
    }

    // Enrich with event data
    const eventIds = data.map((m: { event_id: string }) => m.event_id).filter(Boolean);
    const { data: events } = await supabase
      .from('events')
      .select('id, title, start_date, location_name, bundesland, image_url, ticket_url, source_url')
      .in('id', eventIds)
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true });

    const eventMap = new Map((events || []).map((e: { id: string; [key: string]: unknown }) => [e.id, e]));

    const enriched: SpotifyMatch[] = data
      .map((m: { event_id: string; [key: string]: unknown }) => ({
        ...m,
        event: eventMap.get(m.event_id) || undefined,
      }))
      .filter((m: { event?: unknown }) => m.event); // Only show matches with upcoming events

    setMatches(enriched);
    setLoadingData(false);
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchMatches();
  }, [user, fetchMatches]);

  const dismissMatch = async (matchId: string) => {
    setDismissing(matchId);
    await supabase
      .from('spotify_artist_matches')
      .update({ dismissed: true })
      .eq('id', matchId);
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setDismissing(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-AT', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const isSpotifyConnected = profile?.spotify_connected;

  return (
    <div
      className="min-h-screen text-white pb-24 gradient-mesh"
    >
<main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 text-lg">&#9834;</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Spotify Matches</h1>
            <p className="text-white/40 text-sm mt-0.5">Events basierend auf deiner Musik</p>
          </div>
        </div>

        {!isSpotifyConnected ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-green-400 text-2xl">&#9834;</span>
            </div>
            <p className="text-white/40 text-sm mb-3">Verbinde dein Spotify-Konto</p>
            <p className="text-white/20 text-xs mb-6 max-w-sm mx-auto">
              Wir finden Events basierend auf deinen Lieblingsk&uuml;nstlern
            </p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-400 transition-colors"
            >
              Spotify verbinden
            </Link>
          </div>
        ) : loadingData ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm mb-1">Keine Matches gefunden</p>
            <p className="text-white/20 text-xs">Aktuell passen keine Events zu deinen Spotify-K&uuml;nstlern</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => (
              <div
                key={m.id}
                className="relative rounded-xl bg-white/5 border border-white/10 overflow-hidden hover:border-white/20 transition-all"
              >
                <div className="flex gap-4 p-4">
                  {/* Event Image */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                    <EventImage
                      src={m.event?.image_url}
                      title={m.event?.title}
                      className="w-full h-full"
                      wrapperClassName="w-full h-full"
                      showSkeleton={false}
                      loading="lazy"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Match Tag */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        &#9834; {m.artist_name}
                      </span>
                      {m.match_type === 'artist_exact' && (
                        <span className="text-[10px] text-white/20">Exakter Match</span>
                      )}
                    </div>

                    {/* Event Title */}
                    <h3 className="font-medium text-sm truncate">{m.event?.title}</h3>

                    {/* Event Details */}
                    <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                      <span>{m.event?.start_date ? formatDate(m.event.start_date) : ''}</span>
                      {m.event?.location_name && (
                        <>
                          <span className="text-white/10">|</span>
                          <span>{m.event.location_name}</span>
                        </>
                      )}
                    </div>

                    {/* Suggestion text */}
                    <p className="text-xs text-white/30 mt-2">
                      Hey, <span className="text-green-400/80">{m.artist_name}</span> kommt
                      {m.event?.location_name ? ` nach ${m.event.location_name}` : ''}! Magst du hin?
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      <Link
                        href={`/events/${m.event?.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors"
                      >
                        Event ansehen
                      </Link>
                      {(m.event?.ticket_url || m.event?.source_url) && (
                        <a
                          href={m.event?.ticket_url || m.event?.source_url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                        >
                          Tickets
                        </a>
                      )}
                      <button
                        onClick={() => dismissMatch(m.id)}
                        disabled={dismissing === m.id}
                        className="text-xs px-3 py-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-50 ml-auto"
                      >
                        {dismissing === m.id ? '...' : 'Ausblenden'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
