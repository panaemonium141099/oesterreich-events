'use client';

/**
 * V4FollowedArtistsGrid — 2-Spalten-Grid (1-Spalte mobile) der gefolgten
 * Künstler mit Upcoming-Match-Counts.
 *
 * Bei mehr als `INITIAL_VISIBLE` Einträgen klappt der Rest ein —
 * sonst wird die Seite bei 50+ Künstlern unbenutzbar lang.
 * Pure render; Daten kommen server-seitig pre-aggregiert von
 * V4ArtistsPageClient.
 */

import { useState } from 'react';

export interface FollowedArtistWithMatches {
  id: string;
  artist_name: string;
  artist_name_normalized: string;
  spotify_image_url: string | null;
  upcoming_matches: number;
}

interface V4FollowedArtistsGridProps {
  artists: FollowedArtistWithMatches[];
  /** Optional override for initial visible count. Default 8. */
  initialVisible?: number;
}

const DEFAULT_INITIAL_VISIBLE = 8;

export function V4FollowedArtistsGrid({ artists, initialVisible = DEFAULT_INITIAL_VISIBLE }: V4FollowedArtistsGridProps) {
  const [expanded, setExpanded] = useState(false);

  if (artists.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Du folgst noch keinem Künstler.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Such einen Künstler oben — wir benachrichtigen dich bei Österreich-Terminen.</p>
      </div>
    );
  }

  // Artists mit Upcoming-Matches zuerst, dann nach Name sortiert. So bleibt
  // die Liste auch im eingeklappten Zustand interessant.
  const sorted = [...artists].sort((a, b) => {
    if (b.upcoming_matches !== a.upcoming_matches) return b.upcoming_matches - a.upcoming_matches;
    return a.artist_name.localeCompare(b.artist_name, 'de');
  });

  const canCollapse = sorted.length > initialVisible;
  const visible = expanded || !canCollapse ? sorted : sorted.slice(0, initialVisible);
  const hiddenCount = sorted.length - initialVisible;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {visible.map(a => (
          <div key={a.id} className="rounded-2xl border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)] p-3.5 flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-full bg-[var(--v4-surface)] border border-[var(--v4-hairline-2)] flex items-center justify-center text-[var(--v4-ink)] overflow-hidden flex-shrink-0"
              style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontSize: 19 }}
            >
              {a.spotify_image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={a.spotify_image_url} alt={a.artist_name} className="w-full h-full object-cover"/>
              ) : a.artist_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-[var(--v4-ink)] tracking-[-0.005em] truncate">{a.artist_name}</div>
              {a.upcoming_matches > 0 ? (
                <div className="text-[11.5px] mt-1 font-semibold text-[var(--v4-match)]">
                  {a.upcoming_matches} kommend{a.upcoming_matches === 1 ? 'er' : 'e'} Auftritt{a.upcoming_matches === 1 ? '' : 'e'}
                </div>
              ) : (
                <div className="text-[11.5px] text-[var(--v4-ink-50)] mt-1">Kein Termin · wir bleiben dran</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {canCollapse && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            className="press-haptic inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--v4-hairline-2)] text-[12.5px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)] hover:border-[var(--v4-hairline-3)]"
          >
            {expanded ? (
              <>
                Weniger anzeigen
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </>
            ) : (
              <>
                Alle {sorted.length} anzeigen <span className="text-[var(--v4-ink-50)] font-medium">(+{hiddenCount})</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
