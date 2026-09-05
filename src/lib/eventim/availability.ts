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

/**
 * Warum ein Event NICHT buchbar ist — eine Kategorie je Event.
 *
 * `isBookable` entscheidet ueber den Ticket-Link und damit ueber die
 * Affiliate-Einnahme einer Seite. Bisher stand im Import-Log nur die
 * Summe ("20363/22272 bookable"); ohne Aufschluesselung liess sich nicht
 * beurteilen, ob die ~1900 Events ohne Link wirklich unverkaeuflich sind
 * oder ob eine der drei Bedingungen zu streng greift.
 *
 * Rueckgabe `null` = buchbar.
 */
export function notBookableReason(
  e: Pick<EventimEvent, 'eventStatus' | 'deliverable' | 'priceCategories'>,
): string | null {
  if (isBookable(e)) return null;
  const parts: string[] = [];
  if (String(e.eventStatus) !== '2') parts.push(`eventStatus=${e.eventStatus}`);
  if (e.deliverable === false) parts.push('deliverable=false');
  const pcs = e.priceCategories ?? [];
  if (pcs.length === 0) parts.push('keine priceCategories');
  else if (!pcs.some((p) => p.inventory === 'buchbar')) {
    const kinds = [...new Set(pcs.map((p) => String(p.inventory)))].sort().join('|');
    parts.push(`inventory=${kinds}`);
  }
  return parts.join(' + ') || 'unklar';
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
