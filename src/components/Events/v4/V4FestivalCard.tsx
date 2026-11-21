/**
 * V4FestivalCard — compact festival card.
 *
 * Layout: small image header, festival name, date range, optional
 * lineup-match indicator. Used on /festivals.
 *
 * URL-Handling:
 *   `festival.href` kommt pre-built vom landing-loader (siehe
 *   get-landing-data.ts). Aktuell ist das entweder die canonical
 *   /events/[...slug]-URL des parent_event, ODER ein Fallback auf
 *   /festivals/[slug] wenn kein parent_event existiert. Card rendert
 *   als `<div>` (nicht klickbar) nur noch wenn der Loader explizit
 *   null/undefined liefert — defensiv, falls je wieder ein Pfad ohne
 *   Slug auftaucht.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Festival } from '@/types/festivals';
import { V4Badge } from './V4Badge';
import { festivalCardDateRange } from '@/lib/festivals/display';

interface V4FestivalCardProps {
  /** Festival-Row plus pre-built `href` (siehe LandingFestival type). */
  festival: Festival & { image_url?: string | null; href?: string | null };
  /** If true, shows a "Artist im Line-up" gold badge. Phase 2 always derives this on the server. */
  lineupMatch?: boolean;
}

export function V4FestivalCard({ festival, lineupMatch = false }: V4FestivalCardProps) {
  const href = festival.href ?? null;
  const displayName = festival.canonical_name;

  const cardClass = 'press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] ' +
    (href ? 'hover:border-[var(--v4-hairline-3)] transition-colors' : 'cursor-default');

  const body = (
    <>
      <div className="relative aspect-[4/3] bg-[var(--v4-surface)]">
        {festival.image_url ? (
          <Image
            src={festival.image_url}
            alt={displayName}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            unoptimized
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
          {festival.date_status === 'expected' ? 'vorauss. ' : ''}
          {festivalCardDateRange(festival.starts_at, festival.ends_at)}
          {festival.city ? ` · ${festival.city}` : ''}
        </p>
        {festival.price_text && (
          <p className="text-[11.5px] font-medium text-[var(--v4-ink-70)] line-clamp-1">
            {festival.price_text}
          </p>
        )}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cardClass}
        data-v4-card="festival"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={cardClass} data-v4-card="festival">
      {body}
    </div>
  );
}
