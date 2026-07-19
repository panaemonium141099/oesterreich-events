'use client';

/**
 * V4ArtistsPageClient — v4 redesign of /artists.
 *
 * Loads followed-artists + matched-events client-side via existing
 * /api/artists/following and /api/artists/events endpoints. Follow-Search
 * is now in V4ArtistSearchResult only (oben im Hero) — die alte
 * AddArtistsPanel-Sektion am Seitenende ist Phase-6 entfernt, weil sie
 * doppelt war und die Seite künstlich verlängert hat.
 *
 * Auth: anon users still see the hero + search input. Follow click
 * redirects them to /auth/login?next=. Followed-grid + matches show
 * empty-states when no user / no data.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import {
  V4ArtistsHero,
  V4ArtistSearchResult,
  V4FollowedArtistsGrid,
  V4MatchingEvents,
  type FollowedArtistWithMatches,
} from '@/components/Artists/v4';
import type { ArtistAppearance } from '@/lib/artists/appearances';

export function V4ArtistsPageClient() {
  const { user, loading } = useAuth();
  const [followed, setFollowed] = useState<FollowedArtistWithMatches[]>([]);
  const [appearances, setAppearances] = useState<ArtistAppearance[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);

  useEffect(() => {
    if (loading || !user) {
      setMatchesLoading(false);
      return;
    }
    let alive = true;
    setMatchesLoading(true);

    (async () => {
      try {
        const [followingRes, eventsRes] = await Promise.all([
          fetch('/api/artists/following?limit=100'),
          fetch('/api/artists/events?limit=50'),
        ]);

        if (!alive) return;

        // Response-Body kann nur einmal konsumiert werden — wir lesen
        // beide Responses GENAU einmal und nutzen die parsed-Daten in
        // beiden setState-Pfaden.
        const followingData = followingRes.ok ? await followingRes.json() : null;
        const eventsData = eventsRes.ok ? await eventsRes.json() : null;

        if (!alive) return;

        // ─── Auftritte ───────────────────────────────────────
        const apps = (eventsData?.appearances ?? []) as ArtistAppearance[];
        setAppearances(apps);

        // ─── Followed-Liste mit Upcoming-Counts ─────────────
        const artists = (followingData?.artists ?? []) as Array<{
          id: string;
          artist_name: string;
          artist_name_normalized: string;
          spotify_image_url: string | null;
        }>;
        const countByArtist = new Map<string, number>();
        for (const a of apps) {
          const k = a.artist_name.toLowerCase();
          countByArtist.set(k, (countByArtist.get(k) ?? 0) + 1);
        }
        setFollowed(artists.map(a => ({
          ...a,
          upcoming_matches: countByArtist.get(a.artist_name.toLowerCase()) ?? 0,
        })));
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[/artists] fetch failed:', err);
        }
      } finally {
        if (alive) setMatchesLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <V4ArtistsHero/>

      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-8 md:py-12 pb-24">
        <div className="mb-10">
          <V4ArtistSearchResult/>
        </div>

        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 md:gap-12">
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
                  Gefundene Auftritte in Österreich
                </h2>
                {appearances.length > 0 && (
                  <span className="text-[11.5px] text-[var(--v4-ink-50)] uppercase tracking-[0.16em] font-bold">
                    {appearances.length}
                  </span>
                )}
              </div>
              {matchesLoading ? (
                <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-2)] p-6 text-center text-[var(--v4-ink-50)] text-[13px] animate-pulse">
                  Treffer werden geladen …
                </div>
              ) : (
                <V4MatchingEvents appearances={appearances}/>
              )}
            </section>
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[var(--v4-ink)]">
                  Deine Lieblingskünstler
                </h2>
                <span className="text-[11.5px] text-[var(--v4-ink-50)] uppercase tracking-[0.16em] font-bold">
                  {followed.length}
                </span>
              </div>
              <V4FollowedArtistsGrid artists={followed}/>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
