/**
 * V4CardHero — full-bleed sektion anchor card.
 *
 * Used as the visual hero of WeekendSection. Larger image (default 380 px
 * desktop / 320 px mobile), gradient overlay for legibility, large title
 * + sublines + state-badge floating top-left over the image.
 *
 * When mounted as the section's first event with priority=true it serves
 * as the LCP element (next/image preload).
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4Badge } from './V4Badge';

interface V4CardHeroProps {
  event: Event & { state: V4EventState };
  height?: number;
  priority?: boolean;
}

const STATE_LABELS: Partial<Record<V4EventState, string>> = {
  ticket:   'Tickets verfügbar',
  match:    'Du folgst diesem Artist',
  lineup:   'Artist im Line-up',
  free:     'Eintritt frei',
  doorsale: 'Abendkasse',
  inplan:   'In deinem Plan',
  soldout:  'Ausverkauft',
};

function formatHeroEyebrow(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
}

export function V4CardHero({ event, height, priority = false }: V4CardHeroProps) {
  const slug = event.slug ?? event.id;
  const badgeLabel = STATE_LABELS[event.state];
  const heightClass = height ? '' : 'h-[320px] md:h-[380px]';

  return (
    <Link
      href={`/events/${slug}`}
      className={`press-haptic relative block rounded-3xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] ${heightClass}`}
      style={height ? { height } : undefined}
      data-v4-card="hero"
    >
      {event.image_url ? (
        <Image
          src={event.image_url}
          alt={event.title}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 1180px"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--v4-ink-30)] text-xl px-6 text-center">
          {event.title}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,12,0.92)] via-[rgba(10,10,12,0.4)] to-transparent" aria-hidden="true"/>

      {badgeLabel && (
        <div className="absolute top-5 left-5">
          <V4Badge kind={event.state}>{badgeLabel}</V4Badge>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col gap-2 text-[var(--v4-ink)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-70)]">
          {formatHeroEyebrow(event.start_date)}
        </p>
        <h3 className="text-2xl md:text-3xl font-bold leading-tight tracking-[-0.02em] line-clamp-2 max-w-[36ch]">
          {event.title}
        </h3>
        {event.location_name && (
          <p className="text-sm text-[var(--v4-ink-70)] line-clamp-1">{event.location_name}</p>
        )}
      </div>
    </Link>
  );
}
