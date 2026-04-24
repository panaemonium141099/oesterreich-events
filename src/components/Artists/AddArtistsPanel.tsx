'use client';

/**
 * AddArtistsPanel — three unified ways to add Spotify artists without
 * triggering the OAuth 5-user Dev-Mode cap.
 *
 *   1. Suche         — typeahead against /api/artists/search (Spotify)
 *   2. Link          — paste a Spotify artist or track URL → one-click follow
 *   3. Ähnliche      — based on currently followed artists, fetch similar
 *                      ones from Last.fm's crowd-sourced artist-similarity
 *                      graph (unrestricted, free), then hydrate each via
 *                      Spotify /search for cover + Spotify ID.
 *
 * Why no Playlist tab and no Spotify /recommendations: both endpoints are
 * blocked post-Nov-2024 for apps registered after that date. Last.fm's
 * `artist.getSimilar` replaces the recommendations path with better data
 * for niche artists (20y scrobble history) and is invisible to end users —
 * UI copy never mentions Last.fm.
 *
 * All three land in the same `followed_artists` table via the existing
 * /api/artists/follow endpoint — no schema changes. Users who came in via
 * the old OAuth import stay exactly as they were (their rows in
 * `followed_artists` and `imported_spotify_artists` are untouched).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface SpotifySearchArtist {
  id: string;
  name: string;
  image_url: string | null;
  genres: string[];
  popularity: number;
}

export interface FollowPayload {
  name: string;
  spotify_artist_id?: string;
  spotify_image_url?: string;
  source: 'spotify' | 'manual';
}

interface AddArtistsPanelProps {
  followedNames: Set<string>;
  /** Names of currently followed artists. Used as seeds for the "Ähnliche"
   *  tab via Last.fm similarity. Last.fm keys on name, not Spotify ID. */
  followedArtistNames: string[];
  onFollow: (artist: FollowPayload) => Promise<void>;
  onUnfollow: (artistName: string) => Promise<void>;
}

type Tab = 'suche' | 'link' | 'aehnlich';

export function AddArtistsPanel({
  followedNames,
  followedArtistNames,
  onFollow,
}: AddArtistsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('suche');

  return (
    <section className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-white font-bold text-base mb-0.5">Künstler:innen folgen</h2>
        <p className="text-xs text-white/50">
          Du wirst benachrichtigt, sobald gefolgte Artists in Österreich auftreten.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-2 pb-2 overflow-x-auto scrollbar-hide" role="tablist">
        {([
          { id: 'suche', label: 'Suche' },
          { id: 'link', label: 'Spotify-Link' },
          { id: 'aehnlich', label: 'Ähnliche finden' },
        ] as Array<{ id: Tab; label: string }>).map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              activeTab === t.id
                ? 'bg-white/[0.10] text-white'
                : 'text-white/50 hover:bg-white/[0.04] hover:text-white/80',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-4 border-t border-white/[0.05]">
        {activeTab === 'suche' && (
          <SearchTab followedNames={followedNames} onFollow={onFollow} />
        )}
        {activeTab === 'link' && (
          <LinkTab followedNames={followedNames} onFollow={onFollow} />
        )}
        {activeTab === 'aehnlich' && (
          <SimilarTab
            followedNames={followedNames}
            followedArtistNames={followedArtistNames}
            onFollow={onFollow}
          />
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared bits
// ═══════════════════════════════════════════════════════════════

function isFollowed(name: string, followedNames: Set<string>): boolean {
  return followedNames.has(name.toLowerCase());
}

/** Compact artist tile with a checkbox for bulk-select flows.
 *
 *  Optional `reason` line (e.g. "Weil du NF folgst") is rendered under
 *  the genres — gives the user the provenance of a similarity-based
 *  suggestion so the list doesn't feel random. */
function SelectableArtistTile({
  artist,
  checked,
  onToggle,
  disabled,
  alreadyFollowed,
  reason,
}: {
  artist: SpotifySearchArtist;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  alreadyFollowed?: boolean;
  reason?: string | null;
}) {
  return (
    <label
      className={[
        'flex items-center gap-3 p-2 rounded-xl border transition-colors cursor-pointer',
        alreadyFollowed
          ? 'border-green-500/30 bg-green-500/[0.04] cursor-default'
          : checked
          ? 'border-white/25 bg-white/[0.06]'
          : 'border-white/[0.06] hover:border-white/15',
        disabled ? 'opacity-50 cursor-wait' : '',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={alreadyFollowed ? true : checked}
        disabled={alreadyFollowed || disabled}
        onChange={onToggle}
        className="shrink-0 w-4 h-4 rounded accent-green-500"
      />
      <div className="relative w-10 h-10 rounded-full bg-white/5 overflow-hidden shrink-0">
        {artist.image_url ? (
          <Image
            src={artist.image_url}
            alt={artist.name}
            fill
            sizes="40px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-white/40">
            {artist.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate">{artist.name}</p>
        {artist.genres.length > 0 && (
          <p className="text-[11px] text-white/45 truncate">
            {artist.genres.slice(0, 2).join(' · ')}
          </p>
        )}
        {reason && (
          <p className="text-[10px] text-white/35 truncate italic">
            Weil du <span className="text-white/55 not-italic">{reason}</span> folgst
          </p>
        )}
      </div>
      {alreadyFollowed && (
        <span className="text-[10px] text-green-400 uppercase tracking-wider shrink-0">
          Folge
        </span>
      )}
    </label>
  );
}

/** Bulk-follow button that fans follow calls out one at a time. */
async function bulkFollow(
  artists: SpotifySearchArtist[],
  followedNames: Set<string>,
  onFollow: (payload: FollowPayload) => Promise<void>,
  onProgress: (done: number, total: number) => void,
): Promise<{ followed: number; skipped: number; errors: number }> {
  const targets = artists.filter(a => !isFollowed(a.name, followedNames));
  let followed = 0;
  let errors = 0;
  for (let i = 0; i < targets.length; i++) {
    const a = targets[i];
    try {
      await onFollow({
        name: a.name,
        spotify_artist_id: a.id,
        spotify_image_url: a.image_url ?? undefined,
        source: 'spotify',
      });
      followed++;
    } catch (err) {
      console.error(`follow ${a.name} failed:`, err);
      errors++;
    }
    onProgress(i + 1, targets.length);
  }
  return { followed, skipped: artists.length - targets.length, errors };
}

// ═══════════════════════════════════════════════════════════════
// Tab: Suche
// ═══════════════════════════════════════════════════════════════

function SearchTab({
  followedNames,
  onFollow,
}: {
  followedNames: Set<string>;
  onFollow: (a: FollowPayload) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifySearchArtist[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followingId, setFollowingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/artists/search?q=${encodeURIComponent(q.trim())}&limit=10`);
      if (res.status === 429) { setError('Zu viele Anfragen – warte kurz.'); return; }
      if (!res.ok) { setError('Suche fehlgeschlagen.'); return; }
      const data = await res.json();
      setResults(data.artists || []);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void runSearch(query); }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  const followOne = async (artist: SpotifySearchArtist) => {
    setFollowingId(artist.id);
    try {
      await onFollow({
        name: artist.name,
        spotify_artist_id: artist.id,
        spotify_image_url: artist.image_url ?? undefined,
        source: 'spotify',
      });
    } finally {
      setFollowingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Suche nach Künstler:innen …"
        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
        autoFocus
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {searching && <p className="text-xs text-white/40">Suche …</p>}
      {!searching && results.length === 0 && query.trim().length >= 2 && !error && (
        <p className="text-xs text-white/40">Keine Treffer für „{query}".</p>
      )}
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {results.map(a => {
            const followed = isFollowed(a.name, followedNames);
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 p-2 rounded-xl border border-white/[0.06] hover:border-white/15 transition-colors"
              >
                <div className="relative w-10 h-10 rounded-full bg-white/5 overflow-hidden shrink-0">
                  {a.image_url ? (
                    <Image src={a.image_url} alt={a.name} fill sizes="40px" className="object-cover" unoptimized />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-xs text-white/40">
                      {a.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{a.name}</p>
                  {a.genres.length > 0 && (
                    <p className="text-[11px] text-white/45 truncate">{a.genres.slice(0, 2).join(' · ')}</p>
                  )}
                </div>
                <button
                  onClick={() => followOne(a)}
                  disabled={followed || followingId === a.id}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-medium shrink-0',
                    followed
                      ? 'bg-green-500/15 text-green-400 cursor-default'
                      : 'bg-white/[0.06] text-white hover:bg-white/10 transition-colors',
                  ].join(' ')}
                >
                  {followed ? 'Folge' : followingId === a.id ? '…' : 'Folgen'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Ähnliche finden — Last.fm-backed, invisible to end user
// ═══════════════════════════════════════════════════════════════

/** Artist-with-provenance — returned by /api/artists/similar. The
 *  `seed_name` carries which of the user's followed artists was the
 *  strongest driver of this suggestion, so the UI can render
 *  "Weil du {seed_name} folgst" under the card. */
interface SimilarArtist extends SpotifySearchArtist {
  seed_name?: string;
}

function SimilarTab({
  followedNames,
  followedArtistNames,
  onFollow,
}: {
  followedNames: Set<string>;
  followedArtistNames: string[];
  onFollow: (a: FollowPayload) => Promise<void>;
}) {
  const [results, setResults] = useState<SimilarArtist[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const seedCount = followedArtistNames.length;
  const canRecommend = seedCount >= 1;

  const fetchSimilar = async () => {
    setLoading(true); setError(null); setResultMsg(null);
    try {
      // Use the 5 most recent follows as seeds. Last.fm aggregates
      // matches across seeds — more seeds = sharper taste cluster.
      const seeds = followedArtistNames.slice(0, 5);
      const res = await fetch('/api/artists/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedArtistNames: seeds }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Ähnliche-Suche fehlgeschlagen.'); return; }
      const artists = (data.artists ?? []) as SimilarArtist[];
      const fresh = artists.filter(a => !isFollowed(a.name, followedNames));
      setResults(fresh);
      setSelected(new Set(fresh.map(a => a.id)));
    } finally {
      setLoading(false);
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const followSelected = async () => {
    const chosen = results.filter(a => selected.has(a.id));
    setProgress({ done: 0, total: chosen.length });
    const result = await bulkFollow(chosen, followedNames, onFollow, (done, total) => setProgress({ done, total }));
    setProgress(null);
    setResultMsg(`${result.followed} Artists gefolgt${result.errors > 0 ? ` · ${result.errors} Fehler` : ''}.`);
    setResults([]);
    setSelected(new Set());
  };

  if (!canRecommend) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-white/60 mb-1">Noch keine Seeds da.</p>
        <p className="text-xs text-white/40">
          Folge zuerst 1–5 Artists (via Suche oder Link), dann finden wir ähnliche.
        </p>
      </div>
    );
  }

  const allSelected = results.length > 0 && results.every(a => selected.has(a.id));

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50 leading-relaxed">
        Basierend auf deinen zuletzt {Math.min(seedCount, 5)} gefolgten Artists suchen wir
        Künstler:innen die ähnlich klingen und zu deinem Geschmack passen.
      </p>
      <button
        onClick={fetchSimilar}
        disabled={loading}
        className="w-full px-4 py-2.5 rounded-lg bg-white/[0.10] text-white text-sm font-medium hover:bg-white/[0.16] disabled:opacity-40"
      >
        {loading ? 'Suche ähnliche Artists …' : 'Ähnliche Artists finden'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {resultMsg && <p className="text-xs text-green-400">{resultMsg}</p>}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/60">
              <strong className="text-white">{results.length}</strong> Vorschläge
            </p>
            <button
              onClick={() => {
                if (allSelected) setSelected(new Set());
                else setSelected(new Set(results.map(a => a.id)));
              }}
              className="text-xs text-white/60 hover:text-white"
            >
              {allSelected ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          </div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {results.map(a => (
              <SelectableArtistTile
                key={a.id}
                artist={a}
                checked={selected.has(a.id)}
                onToggle={() => toggleOne(a.id)}
                reason={a.seed_name ?? null}
              />
            ))}
          </div>
          <button
            onClick={followSelected}
            disabled={selected.size === 0 || progress !== null}
            className="w-full px-4 py-2.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 disabled:opacity-40"
          >
            {progress
              ? `Folge… ${progress.done}/${progress.total}`
              : `${selected.size} Artists folgen`}
          </button>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Tab: Link (single artist / track URL)
// ═══════════════════════════════════════════════════════════════

function LinkTab({
  followedNames,
  onFollow,
}: {
  followedNames: Set<string>;
  onFollow: (a: FollowPayload) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [artist, setArtist] = useState<SpotifySearchArtist | null>(null);
  const [fromTrack, setFromTrack] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [done, setDone] = useState(false);

  const resolve = async () => {
    setLoading(true); setError(null); setArtist(null); setDone(false);
    try {
      const res = await fetch('/api/artists/by-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Konnte nicht geladen werden.'); return; }
      setArtist(data.artist);
      setFromTrack(!!data.fromTrack);
    } finally {
      setLoading(false);
    }
  };

  const followIt = async () => {
    if (!artist) return;
    setFollowing(true);
    try {
      await onFollow({
        name: artist.name,
        spotify_artist_id: artist.id,
        spotify_image_url: artist.image_url ?? undefined,
        source: 'spotify',
      });
      setDone(true);
    } finally {
      setFollowing(false);
    }
  };

  const alreadyFollowed = artist ? isFollowed(artist.name, followedNames) : false;

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50 leading-relaxed">
        Kopier in Spotify den Share-Link einer:eines Künstler:in (oder Song) und füg ihn hier ein.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://open.spotify.com/artist/… oder /track/…"
          className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-white/30 focus:border-white/20 focus:outline-none"
        />
        <button
          onClick={resolve}
          disabled={loading || !url.trim()}
          className="px-4 py-2 rounded-lg bg-white/[0.10] text-white text-sm font-medium hover:bg-white/[0.16] disabled:opacity-40 shrink-0"
        >
          {loading ? '…' : 'Prüfen'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {artist && (
        <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
          {fromTrack && (
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
              Aus Track: Hauptkünstler:in
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-full bg-white/5 overflow-hidden shrink-0">
              {artist.image_url ? (
                <Image src={artist.image_url} alt={artist.name} fill sizes="56px" className="object-cover" unoptimized />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-white/40">
                  {artist.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-medium truncate">{artist.name}</p>
              {artist.genres.length > 0 && (
                <p className="text-xs text-white/50 truncate">{artist.genres.slice(0, 3).join(' · ')}</p>
              )}
            </div>
            <button
              onClick={followIt}
              disabled={alreadyFollowed || following || done}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium shrink-0',
                alreadyFollowed || done
                  ? 'bg-green-500/15 text-green-400 cursor-default'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
              ].join(' ')}
            >
              {alreadyFollowed ? 'Folge' : done ? 'Gefolgt' : following ? '…' : 'Folgen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
