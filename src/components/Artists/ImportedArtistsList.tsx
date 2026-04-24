'use client';

import { useState } from 'react';
import { ArtistCard } from './ArtistCard';

interface ImportedArtist {
  id: string;
  artist_name: string;
  spotify_artist_id: string;
  spotify_image_url: string | null;
  genres: string[] | null;
  popularity: number | null;
  rank: number;
}

interface ImportedArtistsListProps {
  artists: ImportedArtist[];
  followedNames: Set<string>;
  onFollow: (artist: { name: string; spotify_artist_id?: string; spotify_image_url?: string; source: 'spotify' | 'manual' }) => Promise<void>;
  onUnfollow: (artistName: string) => Promise<void>;
  loading: boolean;
  spotifyConnected: boolean;
}

export function ImportedArtistsList({
  artists,
  followedNames,
  onFollow,
  onUnfollow,
  loading,
  spotifyConnected,
}: ImportedArtistsListProps) {
  const [loadingArtist, setLoadingArtist] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-white/[0.04]">
            <div className="w-12 h-12 rounded-full bg-white/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-white/[0.06] rounded w-2/3" />
              <div className="h-3 bg-white/[0.06] rounded w-1/3" />
            </div>
            <div className="w-16 h-7 bg-white/[0.06] rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  // When not connected, render nothing — the AddArtistsPanel + the
  // collapsed "Spotify Pioneer Programm" section in src/app/artists/page.tsx
  // handle discovery + the limited-slot OAuth path. Previously this fallback
  // was the primary call-to-action on the page, but after Spotify's May-2025
  // quota clampdown (only 5 Dev-Mode users per app) the auto-import can't
  // scale and shouldn't be presented as the default flow.
  if (!spotifyConnected) return null;

  if (artists.length === 0) {
    return (
      <p className="text-sm text-white/40 text-center py-6">
        Keine importierten Kuenstler gefunden
      </p>
    );
  }

  const handleToggle = async (artist: ImportedArtist) => {
    const normalized = artist.artist_name.toLowerCase();
    setLoadingArtist(artist.id);

    try {
      if (followedNames.has(normalized)) {
        await onUnfollow(artist.artist_name);
      } else {
        await onFollow({
          name: artist.artist_name,
          spotify_artist_id: artist.spotify_artist_id,
          spotify_image_url: artist.spotify_image_url || undefined,
          source: 'spotify',
        });
      }
    } finally {
      setLoadingArtist(null);
    }
  };

  return (
    <div className="space-y-2">
      {artists.map((artist) => (
        <ArtistCard
          key={artist.id}
          name={artist.artist_name}
          imageUrl={artist.spotify_image_url}
          genres={artist.genres ?? undefined}
          popularity={artist.popularity}
          isFollowed={followedNames.has(artist.artist_name.toLowerCase())}
          isLoading={loadingArtist === artist.id}
          rank={artist.rank}
          source="spotify"
          onToggleFollow={() => handleToggle(artist)}
        />
      ))}
    </div>
  );
}
