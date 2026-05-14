/**
 * V4FollowedArtistsGrid — 2-column grid (1-col mobile) showing the user's
 * followed artists with upcoming-match counts. Pure render; data is
 * pre-aggregated server-side by V4ArtistsPageClient.
 */

export interface FollowedArtistWithMatches {
  id: string;
  artist_name: string;
  artist_name_normalized: string;
  spotify_image_url: string | null;
  upcoming_matches: number;
}

interface V4FollowedArtistsGridProps {
  artists: FollowedArtistWithMatches[];
}

export function V4FollowedArtistsGrid({ artists }: V4FollowedArtistsGridProps) {
  if (artists.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Du folgst noch keinem Künstler.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Such einen Künstler oben — wir benachrichtigen dich bei Österreich-Terminen.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
      {artists.map(a => (
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
            <div className="text-[14px] font-semibold text-[var(--v4-ink)] tracking-[-0.005em]">{a.artist_name}</div>
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
  );
}
