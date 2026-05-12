'use client';

/**
 * PopularArtistsSuggestions — "Beliebte Artists in Österreich" discovery
 * block. Replaces the old OAuth top-artists-import grid for the 99 % of
 * users who aren't Pioneer-slot OAuth users.
 *
 * Data: /api/artists/popular → Last.fm Austria scrobble chart hydrated
 * via Spotify /search. Real "what Austrians are listening to right now"
 * signal, not an editorial curation.
 *
 * UX: list of 20+ cards. When the user taps "Folgen", that card slides
 * out with a smooth spring exit (Framer AnimatePresence + layout), the
 * ones below shift up, and a fresh card from the queue slides in from
 * the bottom. Gives the feeling of "working through a curated queue"
 * instead of a static grid — very Tinder-for-artists energy, but built
 * from real AT listening data.
 *
 * Block hides once the user follows ≥10 artists (they have their own
 * momentum, further starter suggestions become noise).
 */

import { useEffect, useState, useMemo } from 'react';
import { ArtistCard } from './ArtistCard';

// fn-15.5: AnimatePresence popLayout + spring layout migrated to a
// simple per-item enter animation (`animate-fade-in-up`). The
// "card slides up to take the slot above it" effect is dropped in
// favor of a clean fade-in for the new card; users perceive both as
// "queue progressing" with the simpler version losing only the
// subtle rearrangement transition. Saves the framer runtime payload.

interface SpotifyArtistLite {
  id: string;
  name: string;
  image_url: string | null;
  genres: string[];
  popularity: number;
}

interface PopularArtistsSuggestionsProps {
  followedNames: Set<string>;
  onFollow: (artist: {
    name: string;
    spotify_artist_id?: string;
    spotify_image_url?: string;
    source: 'spotify' | 'manual';
  }) => Promise<void>;
}

/** How many cards are visible at once (the "queue" on screen). */
const VISIBLE_COUNT = 8;

export function PopularArtistsSuggestions({
  followedNames,
  onFollow,
}: PopularArtistsSuggestionsProps) {
  const [pool, setPool] = useState<SpotifyArtistLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingId, setFollowingId] = useState<string | null>(null);
  /** IDs we've explicitly acted on this session — follow or dismiss —
   *  so they don't pop back in when followedNames updates asynchronously. */
  const [consumedIds, setConsumedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/artists/popular');
        if (!res.ok) { setPool([]); return; }
        const data = await res.json();
        if (!cancelled) setPool(data.artists ?? []);
      } catch {
        if (!cancelled) setPool([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const queue = useMemo(() => {
    return pool
      .filter(a => !followedNames.has(a.name.toLowerCase()))
      .filter(a => !consumedIds.has(a.id));
  }, [pool, followedNames, consumedIds]);

  const handleFollowOne = async (a: SpotifyArtistLite) => {
    setFollowingId(a.id);
    try {
      await onFollow({
        name: a.name,
        spotify_artist_id: a.id,
        spotify_image_url: a.image_url ?? undefined,
        source: 'spotify',
      });
      // Mark as consumed immediately — the next slot opens before
      // followedNames prop updates, which keeps the animation snappy.
      setConsumedIds(prev => new Set(prev).add(a.id));
    } finally {
      setFollowingId(null);
    }
  };

  const handleDismiss = (a: SpotifyArtistLite) => {
    setConsumedIds(prev => new Set(prev).add(a.id));
  };

  // Hide entirely when user has their own momentum.
  if (followedNames.size >= 10) return null;
  // Loading skeleton.
  if (loading) {
    return (
      <section>
        <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3">
          Beliebte Artists in Österreich
        </h2>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-white/[0.04]"
            >
              <div className="w-12 h-12 rounded-full bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/[0.06] rounded w-2/3" />
                <div className="h-3 bg-white/[0.06] rounded w-1/3" />
              </div>
              <div className="w-16 h-7 bg-white/[0.06] rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  // Queue empty (user has burned through all 30+ suggestions or pool
  // returned nothing).
  if (queue.length === 0) return null;

  const visible = queue.slice(0, VISIBLE_COUNT);
  const remaining = queue.length - visible.length;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium">
          Beliebte Artists in Österreich
        </h2>
        {remaining > 0 && (
          <span className="text-[10px] text-white/30 uppercase tracking-wider">
            +{remaining} weitere
          </span>
        )}
      </div>
      <p className="text-xs text-white/40 mb-3 leading-relaxed">
        Was Österreicher:innen gerade hören. Tap zum Folgen — der nächste Vorschlag rutscht
        automatisch nach.
      </p>
      <div className="space-y-2 relative">
        {visible.map(a => (
          <div
            key={a.id}
            className="animate-fade-in-up motion-reduce:animate-none"
          >
            <div className="relative group">
                <ArtistCard
                  name={a.name}
                  imageUrl={a.image_url}
                  genres={a.genres}
                  popularity={a.popularity}
                  isFollowed={false}
                  isLoading={followingId === a.id}
                  source="spotify"
                  onToggleFollow={() => handleFollowOne(a)}
                />
                {/* Subtle dismiss button — hover / focus reveal so the
                    primary action (Folgen) stays visually dominant. */}
                <button
                  type="button"
                  onClick={() => handleDismiss(a)}
                  aria-label={`${a.name} aus Vorschlägen entfernen`}
                  className="absolute top-1/2 -translate-y-1/2 right-[88px] opacity-0 group-hover:opacity-60 focus:opacity-100 focus:outline-none hover:!opacity-100 text-white/50 transition-opacity text-xs px-1.5 py-1"
                >
                  ✕
                </button>
              </div>
          </div>
        ))}
      </div>
    </section>
  );
}
