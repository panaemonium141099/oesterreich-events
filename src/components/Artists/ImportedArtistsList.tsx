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
          <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-slate-50">
            <div className="w-12 h-12 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
            </div>
            <div className="w-16 h-7 bg-slate-100 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (!spotifyConnected) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-green-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500 mb-2">
          Verbinde Spotify, um deine Top-Kuenstler zu importieren
        </p>
        <p className="text-xs text-slate-400 mb-4 max-w-sm">
          Wir importieren deine 50 meistgehoerten Kuenstler und folgen automatisch den Top 10
        </p>
        <button
          onClick={() => {
            const params = new URLSearchParams({
              client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '',
              response_type: 'code',
              redirect_uri: `${window.location.origin}/auth/spotify/callback`,
              scope: 'user-top-artists user-read-recently-played',
              show_dialog: 'true',
            });
            window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
          }}
          className="px-5 py-2.5 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium text-sm transition-colors"
        >
          Spotify verbinden
        </button>
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-6">
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
