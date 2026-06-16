'use client';

/**
 * V4MatchingEvents — /artists "Gefundene Auftritte", grouped BY ARTIST.
 *
 * One row per artist (image + name + appearance count). Click expands the row
 * to that artist's appearances, rendered with the shared ArtistAppearanceCard.
 * Accordion behaviour: one artist open at a time.
 */

import { useState } from 'react';
import { ArtistAppearanceCard } from '@/components/Artists/ArtistAppearanceCard';
import type { ArtistAppearance } from '@/lib/artists/appearances';

interface V4MatchingEventsProps {
  appearances: ArtistAppearance[];
}

function initial(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : '?';
}

export function V4MatchingEvents({ appearances }: V4MatchingEventsProps) {
  const [openArtist, setOpenArtist] = useState<string | null>(null);

  if (appearances.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Wir warten auf erste Auftritte.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Sobald deine Künstler in Österreich spielen, taucht es hier auf.</p>
      </div>
    );
  }

  // Group appearances by artist; sort artists by appearance count desc, then name.
  const byArtist = new Map<string, ArtistAppearance[]>();
  for (const a of appearances) {
    const list = byArtist.get(a.artist_name);
    if (list) list.push(a);
    else byArtist.set(a.artist_name, [a]);
  }
  const artists = [...byArtist.entries()].sort((x, y) => {
    if (y[1].length !== x[1].length) return y[1].length - x[1].length;
    return x[0].localeCompare(y[0], 'de');
  });

  return (
    <div className="flex flex-col gap-2.5">
      {artists.map(([name, apps]) => {
        const isOpen = openArtist === name;
        const img = apps.find((a) => a.artist_image)?.artist_image ?? null;
        return (
          <div
            key={name}
            className="rounded-2xl border border-[rgba(245,185,66,0.34)] bg-[var(--v4-surface-elevated)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenArtist(isOpen ? null : name)}
              aria-expanded={isOpen}
              className="press-haptic relative w-full flex items-center gap-3.5 p-4 text-left hover:border-[rgba(245,185,66,0.5)] transition-colors"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--v4-match)]" />
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--v4-surface)] border border-[var(--v4-hairline-1)] flex-shrink-0 flex items-center justify-center">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[20px] font-bold text-[var(--v4-ink-30)]">{initial(name)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold leading-tight tracking-[-0.015em] truncate">
                  <span className="text-[var(--v4-match)]">{name}</span>
                </p>
                <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">
                  {apps.length} Auftritt{apps.length === 1 ? '' : 'e'} in Österreich
                </p>
              </div>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                className="flex-shrink-0 text-[var(--v4-ink-50)] transition-transform"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isOpen && (
              <div className="flex flex-col gap-2.5 px-3 pb-3">
                {apps.map((a, i) => (
                  <ArtistAppearanceCard key={`${a.event_id ?? a.context}-${i}`} a={a} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
