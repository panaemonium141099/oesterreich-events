'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArtistCard } from './ArtistCard';

interface SearchArtist {
  id: string;
  name: string;
  image_url: string | null;
  genres: string[];
  popularity: number;
}

interface ArtistSearchProps {
  followedNames: Set<string>;
  onFollow: (artist: { name: string; spotify_artist_id?: string; spotify_image_url?: string; source: 'spotify' | 'manual' }) => Promise<void>;
  onUnfollow: (artistName: string) => Promise<void>;
}

export function ArtistSearch({ followedNames, onFollow, onUnfollow }: ArtistSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [loadingArtist, setLoadingArtist] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    setError('');

    try {
      const res = await fetch(`/api/artists/search?q=${encodeURIComponent(q.trim())}&limit=10`);
      if (!res.ok) {
        if (res.status === 429) {
          setError('Zu viele Anfragen. Bitte kurz warten.');
        } else {
          setError('Suche fehlgeschlagen');
        }
        return;
      }
      const data = await res.json();
      setResults(data.artists || []);
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      search(query);
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const handleToggle = async (artist: SearchArtist) => {
    const normalized = artist.name.toLowerCase();
    setLoadingArtist(artist.id);

    try {
      if (followedNames.has(normalized)) {
        await onUnfollow(artist.name);
      } else {
        await onFollow({
          name: artist.name,
          spotify_artist_id: artist.id,
          spotify_image_url: artist.image_url || undefined,
          source: 'spotify',
        });
      }
    } finally {
      setLoadingArtist(null);
    }
  };

  return (
    <div>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kuenstler suchen..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors text-sm"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 mt-2">{error}</p>
      )}

      {results.length > 0 && (
        <div className="mt-3">
          {/* Best match */}
          <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400/70 font-medium mb-2">
            Bester Treffer
          </p>
          <ArtistCard
            key={results[0].id}
            name={results[0].name}
            imageUrl={results[0].image_url}
            genres={results[0].genres}
            popularity={results[0].popularity}
            isFollowed={followedNames.has(results[0].name.toLowerCase())}
            isLoading={loadingArtist === results[0].id}
            onToggleFollow={() => handleToggle(results[0])}
          />

          {/* Similar results */}
          {results.length > 1 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-medium mt-5 mb-2">
                Ähnliche Künstler
              </p>
              <div className="space-y-2">
                {results.slice(1).map((artist) => (
                  <ArtistCard
                    key={artist.id}
                    name={artist.name}
                    imageUrl={artist.image_url}
                    genres={artist.genres}
                    popularity={artist.popularity}
                    isFollowed={followedNames.has(artist.name.toLowerCase())}
                    isLoading={loadingArtist === artist.id}
                    onToggleFollow={() => handleToggle(artist)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {query.trim().length >= 2 && !searching && results.length === 0 && !error && (
        <p className="text-sm text-white/40 mt-3 text-center py-4">
          Keine Ergebnisse gefunden
        </p>
      )}
    </div>
  );
}
