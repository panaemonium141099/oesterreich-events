/**
 * V4CardV — vertical grid card. Default shape for landing sections.
 *
 * Layout: image top (16:9), badge overlay top-right, body below
 * (date eyebrow · title · location). Pure RSC presentation. Receives
 * a pre-derived state on the event (V4EventState) so it does no
 * derivation logic itself.
 *
 * Image fallback: if event.image_url is null the card renders a hairline
 * placeholder with the title centered — keeps grid height stable.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { V4Badge } from './V4Badge';

interface V4CardVProps {
  event: Event & { state: V4EventState };
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

function formatDateEyebrow(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('de-AT', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('de-AT', { month: 'short' });
  const time = d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  return `${weekday}. ${day}. ${month} · ${time}`;
}

export function V4CardV({ event, priority = false }: V4CardVProps) {
  const href = buildEventUrlV2(event);
  const badgeLabel = STATE_LABELS[event.state];

  return (
    <Link
      href={href}
      className="press-haptic flex flex-col rounded-2xl overflow-hidden border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] hover:border-[var(--v4-hairline-3)] transition-colors"
      data-v4-card="vertical"
    >
      <div className="relative aspect-[16/9] bg-[var(--v4-surface)]">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--v4-ink-30)] text-sm px-4 text-center">
            {event.title}
          </div>
        )}
        {badgeLabel && (
          <div className="absolute top-3 right-3">
            <V4Badge kind={event.state}>{badgeLabel}</V4Badge>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--v4-ink-50)]">
          {formatDateEyebrow(event.start_date)}
        </p>
        <h3 className="text-[15px] font-semibold leading-tight text-[var(--v4-ink)] line-clamp-2">
          {event.title}
        </h3>
        {event.location_name && (
          <p className="text-[12.5px] text-[var(--v4-ink-70)] line-clamp-1">
            {event.location_name}
          </p>
        )}
      </div>
    </Link>
  );
}
