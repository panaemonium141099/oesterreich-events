/**
 * V4MatchingEvents — Liste der Künstler-Auftritte auf /artists. Nutzt jetzt
 * die geteilte ArtistAppearanceCard (identisch zur Landing).
 */

import { ArtistAppearanceCard } from '@/components/Artists/ArtistAppearanceCard';
import type { ArtistAppearance } from '@/lib/artists/appearances';

interface V4MatchingEventsProps {
  appearances: ArtistAppearance[];
}

export function V4MatchingEvents({ appearances }: V4MatchingEventsProps) {
  if (appearances.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Wir warten auf erste Auftritte.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Sobald deine Künstler in Österreich spielen, taucht es hier auf.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {appearances.map((a, i) => (
        <ArtistAppearanceCard key={`${a.artist_name}-${a.event_id ?? a.context}-${i}`} a={a} />
      ))}
    </div>
  );
}
