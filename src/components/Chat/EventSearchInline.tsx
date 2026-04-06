'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface EventSearchResult {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  image_url: string | null;
  category: string | null;
}

interface EventSearchInlineProps {
  onSelectEvent: (event: EventSearchResult) => void;
  onClose: () => void;
}

export function EventSearchInline({ onSelectEvent, onClose }: EventSearchInlineProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchEvents = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/events/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const data = await res.json();
      setResults(data.events || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => searchEvents(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchEvents]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">Event teilen</h2>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Event suchen..."
          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-colors mb-4"
        />

        {searching && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((evt) => (
              <button
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                  {evt.image_url ? (
                    <img src={evt.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{evt.title}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {evt.start_date ? formatDate(evt.start_date) : ''}
                    {evt.location_name ? ` - ${evt.location_name}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {query.trim() && !searching && results.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-4">Keine Events gefunden</p>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
