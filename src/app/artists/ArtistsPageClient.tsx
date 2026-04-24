'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProfileDropdown } from '@/components/Layout/ProfileDropdown';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { ImportedArtistsList } from '@/components/Artists/ImportedArtistsList';
import { AddArtistsPanel } from '@/components/Artists/AddArtistsPanel';
import { PopularArtistsSuggestions } from '@/components/Artists/PopularArtistsSuggestions';
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

export function ArtistsPageClient() {
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
      <div className="bg-surface min-h-screen text-white">
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="h-5 w-24 rounded bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
              <div className="w-8 h-8 rounded-full bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-6 animate-pulse motion-reduce:animate-none" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="w-12 h-12 rounded-full bg-white/[0.06] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/[0.06] rounded w-1/3" />
                  <div className="h-3 bg-white/[0.04] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Kuenstler</h1>
          <div className="flex items-center gap-3">
            <NotificationBell className="w-9 h-9 rounded-lg hover:bg-white/[0.06]" />
            <ProfileDropdown />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-8">
        {/* Section 1: Add Artists — four Spotify-backed discovery methods
            in one unified panel (Suche / Playlist / Link / Empfehlungen).
            All four use Client-Credentials (no OAuth cap) and land in the
            same followed_artists table via /api/artists/follow. */}
        <AddArtistsPanel
          followedNames={followedNames}
          followedArtistNames={followedArtists.map(a => a.artist_name)}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
        />

        {/* Curated popular-artists starter block — shows when user hasn't
            built up their own momentum yet (auto-hides past 10 follows).
            Replaces the OAuth top-artists-import grid for the 99 % who
            aren't Pioneer-slot users. */}
        <PopularArtistsSuggestions
          followedNames={followedNames}
          onFollow={handleFollow}
        />

        {/* Section 2: Manual add — ONLY for artists that aren't on Spotify
            at all (indie/underground). Kept small + secondary because the
            Suche tab above already covers 99 % of cases with richer data. */}
        <section>
          <details className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
            <summary className="cursor-pointer px-4 py-2.5 text-xs text-white/50 hover:text-white/80 transition-colors select-none">
              Artist nicht auf Spotify? Manuell hinzufügen
            </summary>
            <div className="px-4 pb-4 pt-1">
              <p className="text-[11px] text-white/40 mb-2 leading-relaxed">
                Ohne Spotify-ID können wir nur gegen den Namen matchen — kein Bild,
                keine Empfehlungen. Nutz die Suche oben wenn möglich.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualInput.trim()) handleManualAdd();
                  }}
                  placeholder="Artist-Name …"
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-white/15 transition-colors"
                />
                <button
                  onClick={handleManualAdd}
                  disabled={!manualInput.trim() || manualAdding}
                  className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.10] font-medium text-sm transition-colors disabled:opacity-50 shrink-0"
                >
                  {manualAdding ? '…' : 'Hinzufügen'}
                </button>
              </div>
              {manualInput.trim() && followedNames.has(manualInput.trim().toLowerCase()) && (
                <p className="text-xs text-amber-400 mt-2">Folgst du schon.</p>
              )}
            </div>
          </details>
        </section>

        {/* Section 3: Imported Spotify artists — only shown when the user
            HAS imported via the OAuth flow (i.e. one of the 5 Dev-Mode
            Pioneers). The OAuth-connect empty state was hidden — a small
            "Spotify Pioneer Programm" link at the bottom reveals it on
            demand without blocking the new discovery flows. */}
        {spotifyConnected && importedArtists.length > 0 && (
          <section>
            <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3">
              Deine Spotify-Top-Artists
              <span className="ml-2 text-white/30 normal-case tracking-normal text-xs">
                (aus Spotify importiert)
              </span>
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
        )}

        {/* Section 4: Followed Artists */}
        <section>
          <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3">
            Deine gefolgten Kuenstler
            {followedArtists.length > 0 && (
              <span className="ml-2 text-white/30">({followedArtists.length})</span>
            )}
          </h2>

          {followedLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-white/[0.04]">
                  <div className="w-12 h-12 rounded-full bg-white/[0.06]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/[0.06] rounded w-2/3" />
                    <div className="h-3 bg-white/[0.06] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : followedArtists.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <svg className="w-10 h-10 text-white/20 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <p className="text-sm text-white/50">
                Du folgst noch keinen Kuenstlern
              </p>
              <p className="text-xs text-white/30 mt-1">
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
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Benachrichtigungseinstellungen</p>
                <p className="text-xs text-white/40">E-Mail, SMS und Erinnerungen konfigurieren</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>

        {/* Spotify Pioneer Programm — only shown to users who haven't
            OAuth'd yet. Tiny + secondary on purpose: Spotify's May-2025
            quota policy caps this at 5 users/app in Dev Mode, so the
            auto-import is a limited-edition path, not the primary one.
            Everyone else uses the four discovery methods above. */}
        {!spotifyConnected && (
          <section>
            <details className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
              <summary className="cursor-pointer px-4 py-2.5 text-xs text-white/50 hover:text-white/80 transition-colors select-none flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-green-400/60" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Spotify Pioneer Programm
                <span className="ml-auto text-[10px] text-white/30 uppercase tracking-wider">5 Plätze</span>
              </summary>
              <div className="px-4 pb-4 pt-1 space-y-2.5">
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Experimentelles Feature: verbinde dein Spotify-Konto und wir importieren
                  automatisch deine 50 meistgehörten Artists. Seit Mai 2025 cappt Spotify diese
                  Funktion auf wenige Tester:innen pro App — wenn dein Spot noch frei ist
                  läuft's, sonst bleibt dein regulärer Zugang hier unverändert.
                </p>
                <button
                  onClick={() => {
                    const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
                    const params = new URLSearchParams({
                      client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '',
                      response_type: 'code',
                      redirect_uri: `${ORIGIN}/auth/spotify/callback`,
                      scope: 'user-top-read user-read-recently-played user-follow-read',
                      show_dialog: 'true',
                    });
                    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                >
                  Spotify verbinden (Pionier-Slot prüfen)
                </button>
              </div>
            </details>
          </section>
        )}
      </main>
</div>
  );
}
