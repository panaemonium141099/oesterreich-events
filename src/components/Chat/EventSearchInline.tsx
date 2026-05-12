'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EventImage } from '@/components/Events/EventImage';

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
      // Default cache → respektiert s-maxage=60 vom Server. Identische Suche
      // innerhalb 60 s kommt instant aus dem Vercel-Edge.
      const res = await fetch(`/api/events/search?q=${encodeURIComponent(q)}`);
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
    // Use date-only safe parsing: append T12:00 to avoid UTC timezone shift
    const dateOnly = dateStr.length === 10 && !dateStr.includes('T');
    const d = dateOnly ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1c1c1e] border border-white/[0.10] rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white/90 mb-4">Event teilen</h2>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Event suchen..."
          className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors mb-4"
        />

        {searching && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((evt) => (
              <button
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] transition-colors text-left"
              >
                <EventImage
                  src={evt.image_url}
                  category={evt.category}
                  title={evt.title}
                  sizes="40px"
                  wrapperClassName="w-10 h-10 rounded-lg shrink-0 bg-white/[0.06]"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate">{evt.title}</p>
                  <p className="text-xs text-white/40 truncate">
                    {evt.start_date ? formatDate(evt.start_date) : ''}
                    {evt.location_name ? ` - ${evt.location_name}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {query.trim() && !searching && results.length === 0 && (
          <p className="text-center text-white/30 text-sm py-4">Keine Events gefunden</p>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 text-sm text-white/30 hover:text-white/50 transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
