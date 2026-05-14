'use client';

/**
 * V4ArtistSearchResult — primary follow-funnel on /artists.
 *
 * State machine:
 *   idle            → input only
 *   searching       → spinner while GET /api/artists/search
 *   results         → list of result cards (search returned ≥1)
 *   empty           → "Keine Künstler gefunden"
 *   error           → inline error with retry
 *
 * Follow click → POST /api/artists/follow then mount V4Toast.
 * Anon-user-follow redirect to /auth/login is handled at the API level
 * (returns 401); we catch it and redirect client-side.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/auth-context';
import { V4Toast } from '@/components/Events/v4';

interface ArtistResult {
  id: string;
  name: string;
  genres: string[] | null;
  image_url: string | null;
  spotify_artist_id: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'results'; results: ArtistResult[]; query: string }
  | { kind: 'empty'; query: string }
  | { kind: 'error'; message: string };

export function V4ArtistSearchResult() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  async function runSearch(q: string) {
    setState({ kind: 'searching' });
    try {
      const res = await fetch('/api/artists/search?q=' + encodeURIComponent(q));
      if (!res.ok) {
        setState({ kind: 'error', message: 'Suche fehlgeschlagen — probier es nochmal.' });
        return;
      }
      const data = await res.json();
      const results: ArtistResult[] = data.artists ?? [];
      if (results.length === 0) {
        setState({ kind: 'empty', query: q });
      } else {
        setState({ kind: 'results', results, query: q });
      }
    } catch {
      setState({ kind: 'error', message: 'Netzwerkfehler — probier es nochmal.' });
    }
  }

  async function follow(artist: ArtistResult) {
    if (!user) {
      router.push(`/auth/login?next=/artists?q=${encodeURIComponent(artist.name)}`);
      return;
    }
    try {
      const res = await fetch('/api/artists/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_name: artist.name,
          spotify_artist_id: artist.spotify_artist_id,
          spotify_image_url: artist.image_url,
        }),
      });
      if (!res.ok) {
        return;
      }
      setFollowed(prev => new Set(prev).add(artist.id));
      setToast(`Du folgst jetzt ${artist.name}. Wir benachrichtigen dich bei Österreich-Terminen.`);
    } catch {
      // silent — UI stays unchanged
    }
  }

  return (
    <div data-v4-artist-search="">
      <form
        onSubmit={e => { e.preventDefault(); if (query.trim()) runSearch(query.trim()); }}
        className="mb-6"
      >
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Artist, Band oder DJ suchen …"
          className="w-full px-5 py-4 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-base placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)] transition-colors"
        />
      </form>

      {state.kind === 'searching' && (
        <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Suche läuft …</div>
      )}

      {state.kind === 'error' && (
        <div className="px-4 py-3 rounded-xl bg-[rgba(198,112,121,0.10)] border border-[rgba(198,112,121,0.30)] text-[var(--v4-alert)] text-sm">
          {state.message}
        </div>
      )}

      {state.kind === 'empty' && (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">Keine Künstler gefunden für „{state.query}".</p>
          <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Anderen Namen probieren?</p>
        </div>
      )}

      {state.kind === 'results' && (
        <div className="flex flex-col gap-3">
          {state.results.map(artist => {
            const isFollowed = followed.has(artist.id);
            return (
              <div key={artist.id} className="rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-5 flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] flex items-center justify-center text-[var(--v4-ink)] overflow-hidden flex-shrink-0"
                  style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontSize: 28 }}
                >
                  {artist.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={artist.image_url} alt={artist.name} className="w-full h-full object-cover"/>
                  ) : artist.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-bold text-[var(--v4-ink)] tracking-[-0.015em]">{artist.name}</div>
                  {artist.genres && artist.genres.length > 0 && (
                    <div className="text-[12.5px] text-[var(--v4-ink-50)] mt-0.5">{artist.genres.slice(0, 3).join(' · ')}</div>
                  )}
                </div>
                {isFollowed ? (
                  <button
                    type="button"
                    disabled
                    className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink-70)]"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    Folgst du
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => follow(artist)}
                    className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                    Folgen
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50">
          <V4Toast kind="match" duration={6000} onDismiss={() => setToast(null)}>
            {toast}
          </V4Toast>
        </div>
      )}
    </div>
  );
}
