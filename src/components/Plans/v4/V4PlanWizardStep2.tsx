'use client';

import { useState, useEffect } from 'react';
import type { Event } from '@/types/events';
import type { WizardState } from './V4PlanWizard';

interface Props {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

interface EventOption {
  id: string; title: string; start_date: string; location_name: string | null;
}

export function V4PlanWizardStep2({ state, update }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EventOption[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: '8' });
        const res = await fetch(`/api/events?${params}`);
        const data = await res.json();
        if (alive) setResults((data.events ?? []).slice(0, 8));
      } finally { if (alive) setSearching(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  function addEvent(ev: EventOption) {
    if (state.events.find(e => e.id === ev.id)) return;
    update({ events: [...state.events, ev as unknown as Event] });
    setQuery('');
    setResults([]);
  }
  function removeEvent(id: string) {
    update({ events: state.events.filter(e => e.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4">
      {state.events.length > 0 && (
        <div className="flex flex-col gap-2">
          {state.events.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[var(--v4-ink)] truncate">{ev.title}</div>
                <div className="text-[12px] text-[var(--v4-ink-50)] truncate">
                  {new Date(ev.start_date).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {ev.location_name ? ` · ${ev.location_name}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => removeEvent(ev.id)} aria-label="Entfernen" className="press-haptic w-8 h-8 rounded-full flex items-center justify-center text-[var(--v4-ink-50)] hover:text-[var(--v4-alert)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="plan-event-search" className="text-[12px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">Event suchen</label>
        <input
          id="plan-event-search"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Titel oder Künstler …"
          className="w-full px-4 py-3 rounded-xl bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] text-[15px] placeholder-[var(--v4-ink-30)] focus:outline-none focus:border-[var(--v4-hairline-3)]"
        />
      </div>

      {searching && <div className="text-[12px] text-[var(--v4-ink-50)] animate-pulse">Suche läuft …</div>}

      {results.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
          {results.map(ev => (
            <button
              key={ev.id}
              type="button"
              onClick={() => addEvent(ev)}
              className="press-haptic text-left px-3.5 py-2.5 rounded-lg bg-[var(--v4-surface-inset)] border border-transparent hover:border-[var(--v4-hairline-3)]"
            >
              <div className="text-[13.5px] font-semibold text-[var(--v4-ink)] truncate">{ev.title}</div>
              <div className="text-[11.5px] text-[var(--v4-ink-50)]">
                {new Date(ev.start_date).toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })}
                {ev.location_name ? ` · ${ev.location_name}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {state.events.length === 0 && results.length === 0 && !query && (
        <p className="text-[12.5px] text-[var(--v4-ink-50)]">Optional — du kannst auch einen Plan ohne Events speichern.</p>
      )}
    </div>
  );
}
