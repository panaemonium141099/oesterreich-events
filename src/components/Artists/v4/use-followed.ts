'use client';

/**
 * Folgen-Zustand der Künstlerseiten (Plakatwand und /kuenstler/[slug]).
 *
 * Nur mit sb-*-auth-token-Cookie holt der Hook `/api/artists/following`
 * (wie ArtistsLive auf der Startseite), sonst kein Request und die Seite
 * bleibt anonym. Folgen und Entfolgen laufen optimistisch über POST bzw.
 * DELETE `/api/artists/follow` und rollen bei Nicht-2xx zurück; die
 * Rückmeldung steht in `toast` für eine Statuszeile.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { hasSupabaseAuthCookie } from '@/lib/ads/ads-allowed';
import { normalizeArtistName } from '@/lib/artists/normalize-name';

export interface FollowedArtist {
  id: string;
  artist_name: string;
  spotify_image_url: string | null;
}

export function useFollowed() {
  const t = useTranslations('Artists');
  const [signedIn, setSignedIn] = useState(false);
  const [followed, setFollowed] = useState<Map<string, FollowedArtist>>(() => new Map());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasSupabaseAuthCookie()) return;
    const controller = new AbortController();
    fetch('/api/artists/following?limit=200', { signal: controller.signal, credentials: 'same-origin' })
      .then(r => (r.ok ? (r.json() as Promise<{ artists?: FollowedArtist[] }>) : null))
      .then(data => {
        if (!data) return;
        setFollowed(new Map((data.artists ?? []).map(f => [normalizeArtistName(f.artist_name), f])));
        setSignedIn(true);
      })
      .catch(() => {
        // Personalisierung ist Kür: ohne Antwort bleibt die Seite anonym.
      });
    return () => controller.abort();
  }, []);

  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const isFollowed = useCallback((name: string) => followed.has(normalizeArtistName(name)), [followed]);

  const toggle = useCallback(async (name: string, image: string | null, spotifyId?: string) => {
    const key = normalizeArtistName(name);
    const was = followed.get(key);
    setFollowed(prev => {
      const next = new Map(prev);
      if (was) next.delete(key);
      else next.set(key, { id: `tmp:${key}`, artist_name: name, spotify_image_url: image });
      return next;
    });
    notify(was ? t('toastUnfollowed', { name }) : t('toastFollowed', { name }));
    try {
      const res = await fetch('/api/artists/follow', {
        method: was ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(
          was
            ? { artist_name: name }
            : { artist_name: name, spotify_image_url: image ?? undefined, spotify_artist_id: spotifyId, source: spotifyId ? 'spotify' : 'manual' },
        ),
      });
      // 404 beim Entfolgen heißt: war schon nicht mehr gefolgt, Zustand stimmt.
      if (!res.ok && !(was && res.status === 404)) throw new Error(String(res.status));
      if (!was) {
        const data = (await res.json().catch(() => null)) as { followed_artist?: { id?: string } } | null;
        const id = data?.followed_artist?.id;
        if (id) setFollowed(prev => { const next = new Map(prev); const f = next.get(key); if (f) next.set(key, { ...f, id }); return next; });
      }
    } catch {
      setFollowed(prev => {
        const next = new Map(prev);
        if (was) next.set(key, was); else next.delete(key);
        return next;
      });
      notify(t('toastError'));
    }
  }, [followed, notify, t]);

  return { signedIn, followed, isFollowed, toggle, toast };
}

/** Statuszeile für Folgen-Rückmeldungen, über der Tab-Leiste. */
export const TOAST_CLASS = 'pointer-events-none fixed left-1/2 z-[70] max-w-[min(92vw,480px)] -translate-x-1/2 rounded-xl bg-white px-4 py-3 text-center text-[13.5px] font-semibold text-[#0a0a0c] shadow-lg transition-all duration-200 bottom-[90px] md:bottom-8';
