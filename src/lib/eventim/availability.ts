import type { EventimEvent } from './types';

/** Eventim eventStatus "1" = CANCELED. */
export function isCancelled(e: Pick<EventimEvent, 'eventStatus'>): boolean {
  return String(e.eventStatus) === '1';
}

/**
 * An event is bookable (→ show "Tickets kaufen") only when it is AVAILABLE,
 * deliverable, and at least one price category is "buchbar".
 */
export function isBookable(
  e: Pick<EventimEvent, 'eventStatus' | 'deliverable' | 'priceCategories'>,
): boolean {
  if (String(e.eventStatus) !== '2') return false; // 2 = AVAILABLE
  if (e.deliverable === false) return false;
  return (e.priceCategories ?? []).some((p) => p.inventory === 'buchbar');
}

/** Human-readable price, German formatting (comma decimal, € suffix). */
export function priceText(min?: number, max?: number): string | undefined {
  const fmt = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
  const lo = typeof min === 'number' ? min : undefined;
  const hi = typeof max === 'number' ? max : undefined;
  if (lo === undefined && hi === undefined) return undefined;
  if (lo !== undefined && hi !== undefined) return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
  return fmt((lo ?? hi) as number);
}
