'use client';

/**
 * V4EntdeckenFilterMode — chip+sort+grid mode for /entdecken.
 *
 * Maps URL-state (active chips, sort) into /api/events query params and
 * renders V4CardV cards. Parent owns chip+sort state for URL persistence.
 *
 * Chip-to-API-param mapping (best-effort with current /api/events):
 *   tickets   → hasTicket=true
 *   free      → freeOnly=true
 *   doorsale  → priceFlag=abendkasse
 *   today     → date=today
 *   weekend   → date=weekend
 *   concerts  → category=music
 *   festivals → category=festival
 *   nearby    → (would need geolocation; Phase-4 sends nearby=true as a hint
 *               and lets the API fall back to relevance if not supported)
 *   mine      → matchedOnly=true (requires auth; falls back to all if anon)
 */

import { useEffect, useState } from 'react';
import {
  V4FilterChips, type V4FilterChipKey,
  V4SortRow, type V4SortKey,
  V4CardV,
} from '@/components/Events/v4';
import { deriveEventState } from '@/lib/v4/derive-event-state';
import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';

interface V4EntdeckenFilterModeProps {
  activeChips: Set<string>;
  sort: V4SortKey;
  onChipsChange: (next: Set<string>) => void;
  onSortChange: (next: V4SortKey) => void;
}

function chipsToParams(chips: Set<string>): URLSearchParams {
  const p = new URLSearchParams();
  if (chips.has('tickets'))   p.set('hasTicket', 'true');
  if (chips.has('free'))      p.set('freeOnly', 'true');
  if (chips.has('doorsale'))  p.set('priceFlag', 'abendkasse');
  if (chips.has('today'))     p.set('date', 'today');
  if (chips.has('weekend'))   p.set('date', 'weekend');
  if (chips.has('concerts'))  p.set('category', 'music');
  if (chips.has('festivals')) p.set('category', 'festival');
  return p;
}

export function V4EntdeckenFilterMode({ activeChips, sort, onChipsChange, onSortChange }: V4EntdeckenFilterModeProps) {
  const [events, setEvents] = useState<Array<Event & { state: V4EventState }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = chipsToParams(activeChips);
    params.set('sort', sort);
    params.set('limit', '24');

    fetch(`/api/events?${params.toString()}`)
      .then(r => r.ok ? r.json() : { events: [], total: 0 })
      .then(data => {
        if (!alive) return;
        const evs = (data.events ?? []) as Event[];
        const ctx = {
          savedEventIds: new Set<string>(),
          followedArtistIds: new Set<string>(),
          artistMatchEventIds: new Set<string>(),
          lineupMatchEventIds: new Set<string>(),
        };
        setEvents(evs.map(e => ({ ...e, state: deriveEventState(e, ctx) })));
        setTotal(data.total ?? evs.length);
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [activeChips, sort]);

  function toggleChip(key: V4FilterChipKey) {
    const next = new Set(activeChips);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChipsChange(next);
  }

  return (
    <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-20">
      <div className="mt-1 mb-5">
        <V4FilterChips active={activeChips} onToggle={toggleChip}/>
      </div>

      <div className="pb-3 mb-5 border-b border-[var(--v4-hairline-1)]">
        <V4SortRow current={sort} total={total} onChange={onSortChange}/>
      </div>

      {loading ? (
        <div className="text-[var(--v4-ink-50)] text-sm animate-pulse">Lade Events …</div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-8 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">Keine Events passen zu deinen Filtern.</p>
          <button
            type="button"
            onClick={() => onChipsChange(new Set())}
            className="press-haptic mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]"
          >
            Filter zurücksetzen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {events.map(ev => <V4CardV key={ev.id} event={ev}/>)}
        </div>
      )}
    </div>
  );
}
