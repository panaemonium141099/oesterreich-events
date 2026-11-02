'use client';

/**
 * Client-Insel der Künstlerseite /kuenstler/[slug]: Folgen-Zustand über
 * useFollowed (nur mit sb-Cookie ein Request), Inhalt aus ArtistProfile,
 * verwandte Künstler als Links auf ihre Seiten.
 */

import { useCallback } from 'react';
import type { DirectoryArtist } from '@/lib/artists/directory';
import { ArtistProfile } from './ArtistProfile';
import { TOAST_CLASS, useFollowed } from './use-followed';

export function ArtistPageClient({ artist, related }: { artist: DirectoryArtist; related: DirectoryArtist[] }) {
  const { signedIn, isFollowed, toggle, toast } = useFollowed();
  const onToggle = useCallback((a: DirectoryArtist) => { void toggle(a.name, a.image); }, [toggle]);
  return (
    <>
      <ArtistProfile artist={artist} related={related} followed={isFollowed(artist.name)} signedIn={signedIn} onToggle={onToggle} page />
      <div role="status" aria-live="polite" className={`${TOAST_CLASS} ${toast ? 'opacity-100' : 'translate-y-3 opacity-0'}`}>
        {toast}
      </div>
    </>
  );
}
