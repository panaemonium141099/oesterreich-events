/**
 * V4CardH — horizontal list card.
 *
 * Used by MatchesSection (logged-in landing); reusable for /saved or
 * /plans flat lists in later phases. 80×80 thumb left, content right.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { V4Badge } from './V4Badge';

interface V4CardHProps {
  event: Event & { state: V4EventState };
}

const STATE_LABELS: Partial<Record<V4EventState, string>> = {
  ticket: 'Tickets', match: 'Match', lineup: 'Line-up',
  free: 'Frei', doorsale: 'Abendkasse', inplan: 'In Plan',
  soldout: 'Ausverkauft',
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
}

export function V4CardH({ event }: V4CardHProps) {
  const href = buildEventUrlV2(event);
  const badgeLabel = STATE_LABELS[event.state];

  return (
    <Link
      href={href}
      className="press-haptic flex items-center gap-4 rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-3 hover:border-[var(--v4-hairline-3)] transition-colors"
      data-v4-card="horizontal"
    >
      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[var(--v4-surface)] flex-shrink-0">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            sizes="80px"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--v4-ink-30)] text-center px-1">
            {event.title.slice(0, 24)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)]">
          {shortDate(event.start_date)}
        </p>
        <h3 className="text-[14.5px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-1">
          {event.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {event.location_name && (
            <span className="text-[12px] text-[var(--v4-ink-70)] line-clamp-1">{event.location_name}</span>
          )}
          {badgeLabel && <V4Badge kind={event.state}>{badgeLabel}</V4Badge>}
        </div>
      </div>
    </Link>
  );
}
