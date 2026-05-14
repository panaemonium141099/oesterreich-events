/**
 * V4FestivalCard — compact festival card.
 *
 * Layout: small image header, festival name, date range, optional
 * lineup-match indicator. Used in FestivalsSection.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Festival } from '@/types/festivals';
import { V4Badge } from './V4Badge';

/* The Festival table itself has no image column — getLandingData JOINs the
   parent_event row to surface its image_url here. When no parent event
   exists (or it has no image), we fall back to a neutral SVG placeholder
   so the grid height stays stable. */

interface V4FestivalCardProps {
  festival: Festival & { image_url?: string | null };
  /** If true, shows a "Artist im Line-up" gold badge. Phase 2 always derives this on the server. */
  lineupMatch?: boolean;
}

function dateRange(startIso: string | null, endIso?: string | null): string {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const startStr = start.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
  if (!end || end.toDateString() === start.toDateString()) return startStr;
  const sameMonth = start.getMonth() === end.getMonth();
  const startDay = start.getDate();
  const endDay = end.getDate();
  if (sameMonth) {
    const month = start.toLocaleDateString('de-AT', { month: 'short' });
    return `${startDay}.–${endDay}. ${month}`;
  }
  const endStr = end.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
  return `${startStr} – ${endStr}`;
}

export function V4FestivalCard({ festival, lineupMatch = false }: V4FestivalCardProps) {
  const slug = festival.slug ?? festival.id;
  const displayName = festival.canonical_name;

  return (
    <Link
      href={`/events/${slug}`}
      className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
      data-v4-card="festival"
    >
      <div className="relative aspect-[4/3] bg-[var(--v4-surface)]">
        {festival.image_url ? (
          <Image
            src={festival.image_url}
            alt={displayName}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[var(--v4-ink-30)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
        )}
        {lineupMatch && (
          <div className="absolute top-2 right-2">
            <V4Badge kind="lineup">Line-up</V4Badge>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <h3 className="text-[14px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-2">
          {displayName}
        </h3>
        <p className="text-[11.5px] text-[var(--v4-ink-50)]">
          {dateRange(festival.starts_at, festival.ends_at)}
        </p>
      </div>
    </Link>
  );
}
