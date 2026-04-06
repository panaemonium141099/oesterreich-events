'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SocialNav } from '@/components/Layout/SocialNav';
import { ProfileDropdown } from '@/components/Layout/ProfileDropdown';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { ImportedArtistsList } from '@/components/Artists/ImportedArtistsList';
import { ArtistSearch } from '@/components/Artists/ArtistSearch';
import { ArtistCard } from '@/components/Artists/ArtistCard';

interface ImportedArtist {
  id: string;
  artist_name: string;
  spotify_artist_id: string;
  spotify_image_url: string | null;
  genres: string[] | null;
  popularity: number | null;
  rank: number;
}

interface FollowedArtist {
  id: string;
  artist_name: string;
  artist_name_normalized: string;
  spotify_artist_id: string | null;
  spotify_image_url: string | null;
  source: 'spotify' | 'manual';
  created_at: string;
}

export default function ArtistsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(true);
  const [importedArtists, setImportedArtists] = useState<ImportedArtist[]>([]);
  const [importedLoading, setImportedLoading] = useState(true);
  const [followedArtists, setFollowedArtists] = useState<FollowedArtist[]>([]);
  const [followedLoading, setFollowedLoading] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const [manualAdding, setManualAdding] = useState(false);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  // Check Spotify connectivity
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/spotify/status');
        if (res.ok) {
          const data = await res.json();
          setSpotifyConnected(data.connected);
        }
      } catch {
        // silently ignore
      } finally {
        setSpotifyLoading(false);
      }
    })();
  }, [user]);

  // Fetch imported Spotify artists
  const fetchImported = useCallback(async () => {
    if (!user) return;
    setImportedLoading(true);
    const { data } = await supabase
      .from('imported_spotify_artists')
      .select('id, artist_name, spotify_artist_id, spotify_image_url, genres, popularity, rank')
      .eq('user_id', user.id)
      .order('rank', { ascending: true });

    setImportedArtists((data as ImportedArtist[]) || []);
    setImportedLoading(false);
  }, [user, supabase]);

  // Fetch followed artists
  const fetchFollowed = useCallback(async () => {
    if (!user) return;
    setFollowedLoading(true);
    const res = await fetch('/api/artists/following?limit=200');
    if (res.ok) {
      const data = await res.json();
      setFollowedArtists(data.artists || []);
    }
    setFollowedLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchImported();
      fetchFollowed();
    }
  }, [user, fetchImported, fetchFollowed]);

  // Build a Set of followed artist names (normalized) for quick lookup
  const followedNames = new Set(
    followedArtists.map((a) => a.artist_name_normalized || a.artist_name.toLowerCase())
  );

  // Follow an artist
  const handleFollow = async (artist: {
    name: string;
    spotify_artist_id?: string;
    spotify_image_url?: string;
    source: 'spotify' | 'manual';
  }) => {
    const res = await fetch('/api/artists/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artist_name: artist.name,
        spotify_artist_id: artist.spotify_artist_id || null,
        spotify_image_url: artist.spotify_image_url || null,
        source: artist.source,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setFollowedArtists((prev) => [data.followed_artist, ...prev]);
    }
  };

  // Unfollow an artist
  const handleUnfollow = async (artistName: string) => {
    const res = await fetch('/api/artists/follow', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_name: artistName }),
    });

    if (res.ok) {
      setFollowedArtists((prev) =>
        prev.filter((a) => a.artist_name.toLowerCase() !== artistName.toLowerCase())
      );
    }
  };

  // Unfollow by ID (for the followed list)
  const handleUnfollowById = async (artist: FollowedArtist) => {
    setUnfollowingId(artist.id);
    const res = await fetch('/api/artists/follow', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: artist.id }),
    });

    if (res.ok) {
      setFollowedArtists((prev) => prev.filter((a) => a.id !== artist.id));
    }
    setUnfollowingId(null);
  };

  // Manual add
  const handleManualAdd = async () => {
    const name = manualInput.trim();
    if (!name) return;

    setManualAdding(true);
    await handleFollow({ name, source: 'manual' });
    setManualInput('');
    setManualAdding(false);
  };

  if (loading || !user) {
    return (
      <div className="bg-[#f8fafc] min-h-screen text-slate-800 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen text-slate-800 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#f8fafc]/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Kuenstler</h1>
          <div className="flex items-center gap-3">
            <NotificationBell className="w-9 h-9 rounded-lg hover:bg-slate-50" />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-8">
        {/* Section 1: Spotify Artists */}
        <section>
          <h2 className="text-sm uppercase tracking-[0.15em] text-slate-500 font-medium mb-3">
            Deine Spotify-Kuenstler
          </h2>
          <ImportedArtistsList
            artists={importedArtists}
            followedNames={followedNames}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            loading={spotifyLoading || importedLoading}
            spotifyConnected={spotifyConnected}
          />
        </section>

        {/* Section 2: Search */}
        <section>
          <h2 className="text-sm uppercase tracking-[0.15em] text-slate-500 font-medium mb-3">
            Kuenstler suchen
          </h2>
          <ArtistSearch
            followedNames={followedNames}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
          />
        </section>

        {/* Section 3: Manual Add */}
        <section>
          <h2 className="text-sm uppercase tracking-[0.15em] text-slate-500 font-medium mb-3">
            Manuell hinzufuegen
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualInput.trim()) {
                  handleManualAdd();
                }
              }}
              placeholder="Kuenstlername eingeben..."
              className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm"
            />
            <button
              onClick={handleManualAdd}
              disabled={!manualInput.trim() || manualAdding}
              className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {manualAdding ? (
                <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                'Hinzufuegen'
              )}
            </button>
          </div>
          {manualInput.trim() && followedNames.has(manualInput.trim().toLowerCase()) && (
            <p className="text-xs text-amber-600 mt-2">
              Du folgst diesem Kuenstler bereits
            </p>
          )}
        </section>

        {/* Section 4: Followed Artists */}
        <section>
          <h2 className="text-sm uppercase tracking-[0.15em] text-slate-500 font-medium mb-3">
            Deine gefolgten Kuenstler
            {followedArtists.length > 0 && (
              <span className="ml-2 text-slate-300">({followedArtists.length})</span>
            )}
          </h2>

          {followedLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                  <div className="w-12 h-12 rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : followedArtists.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <svg className="w-10 h-10 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <p className="text-sm text-slate-500">
                Du folgst noch keinen Kuenstlern
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Suche nach Kuenstlern oder verbinde Spotify
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {followedArtists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  name={artist.artist_name}
                  imageUrl={artist.spotify_image_url}
                  isFollowed={true}
                  isLoading={unfollowingId === artist.id}
                  source={artist.source as 'spotify' | 'manual'}
                  onToggleFollow={() => handleUnfollowById(artist)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Link to notification settings */}
        <section className="pb-4">
          <Link
            href="/settings/notifications"
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Benachrichtigungseinstellungen</p>
                <p className="text-xs text-slate-500">E-Mail, SMS und Erinnerungen konfigurieren</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>
      </main>

      <SocialNav />
    </div>
  );
}
