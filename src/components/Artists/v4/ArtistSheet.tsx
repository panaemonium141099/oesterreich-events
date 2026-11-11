'use client';

/**
 * Künstlerblatt als Sheet auf /artists (Plakatwand, 2026-11): Inhalt aus
 * ArtistProfile, am Desktop ein Panel am rechten Rand, am Handy ein Sheet
 * von unten. Per Portal an <body>: innerhalb der Seite läge ein
 * fixed-Overlay unter V4TopNav und V4TabBar (Stacking-Context durch
 * view-transition-name, Mobile-Audit 2026-10-22). Escape schließt, Fokus
 * geht auf den Schließen-Knopf, der Seitenscroll steht still.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { DirectoryArtist } from '@/lib/artists/directory';
import { ArtistProfile } from './ArtistProfile';

export function ArtistSheet({ artist, related, followed, signedIn, onToggle, onOpen, onClose }: {
  artist: DirectoryArtist;
  related: DirectoryArtist[];
  followed: boolean;
  signedIn: boolean;
  onToggle: (artist: DirectoryArtist) => void;
  onOpen: (artist: DirectoryArtist) => void;
  onClose: () => void;
}) {
  const t = useTranslations('Artists');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="artist-sheet-title"
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[18px] border-t border-[var(--v4-hairline-3)] bg-[var(--v4-surface)] px-4 pt-5 pb-24 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[520px] md:rounded-none md:border-t-0 md:border-l md:px-7 md:pt-7 md:pb-10"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-3.5 top-3 grid h-[34px] w-[34px] place-items-center rounded-full border border-[var(--v4-hairline-3)] text-[20px] leading-none text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
        >
          ×
        </button>
        <ArtistProfile artist={artist} related={related} followed={followed} signedIn={signedIn} onToggle={onToggle} onOpen={onOpen} />
      </div>
    </div>,
    document.body,
  );
}
