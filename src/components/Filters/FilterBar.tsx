'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { EventFilters } from '@/types/events';
import { CategoryFilter } from './CategoryFilter';
import { SourceFilter } from './SourceFilter';
import { DistrictFilter } from './DistrictFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/lib/supabase/auth-context';

interface Gemeinde {
  n: string;
  b: string;
  i: string;
  p: string;
  lat: number;
  lng: number;
}

interface EventSuggestion {
  id: string;
  title: string;
  category?: string;
  location_name?: string;
}

interface FilterBarProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  eveningMode?: boolean;
  bundeslandId?: string;
  onGemeindeSelect?: (gemeinde: { name: string; bundeslandId: string; lat: number; lng: number }) => void;
}

export function FilterBar({ filters, onFiltersChange, eveningMode, bundeslandId, onGemeindeSelect }: FilterBarProps) {
  const { isGod } = useAuth();
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [suggestions, setSuggestions] = useState<Gemeinde[]>([]);
  const [eventSuggestions, setEventSuggestions] = useState<EventSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [gemeinden, setGemeinden] = useState<Gemeinde[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const eventFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the user is actively typing so we never reopen a just-closed dropdown
  const isUserTypingRef = useRef(false);
  // AbortController for in-flight autocomplete requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load gemeinden data on mount
  useEffect(() => {
    fetch('/gemeinden.json')
      .then(r => r.json())
      .then(setGemeinden)
      .catch(() => {});
  }, []);

  // Filter gemeinde suggestions
  useEffect(() => {
    if (!searchValue.trim() || searchValue.length < 2 || gemeinden.length === 0) {
      setSuggestions([]);
      return;
    }
    const query = searchValue.toLowerCase().trim();
    const matches = gemeinden
      .filter(g => g.n.toLowerCase().includes(query) || g.p.startsWith(query))
      .sort((a, b) => {
        const aStarts = a.n.toLowerCase().startsWith(query) ? 0 : 1;
        const bStarts = b.n.toLowerCase().startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.n.localeCompare(b.n);
      })
      .slice(0, 4);
    setSuggestions(matches);
    setSelectedIndex(-1);
  }, [searchValue, gemeinden]);

  // Fetch live event title suggestions (debounced, with AbortController for cancellation)
  useEffect(() => {
    if (!searchValue.trim() || searchValue.length < 2) {
      setEventSuggestions([]);
      return;
    }
    if (eventFetchRef.current) clearTimeout(eventFetchRef.current);
    eventFetchRef.current = setTimeout(async () => {
      // Cancel any previous in-flight request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        // suggest=true → lightweight path: only id/title/category/location_name, no exact count
        const res = await fetch(
          `/api/events?search=${encodeURIComponent(searchValue.trim())}&limit=5&sort=score&suggest=true`,
          { signal: controller.signal, cache: 'no-store' }
        );
        if (!res.ok) { setEventSuggestions([]); return; }
        const data = await res.json();
        setEventSuggestions((data.events ?? []).slice(0, 5));
        // Only open dropdown if the user is still typing (not just after a selection)
        if (isUserTypingRef.current) {
          setShowSuggestions((data.events ?? []).length > 0 || suggestions.length > 0);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setEventSuggestions([]);
      }
    }, 250);
    return () => { if (eventFetchRef.current) clearTimeout(eventFetchRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const handleSelectGemeinde = (g: Gemeinde) => {
    isUserTypingRef.current = false;
    abortControllerRef.current?.abort();
    setSearchValue(g.n);
    setShowSuggestions(false);
    setSuggestions([]);
    setEventSuggestions([]);
    onFiltersChange({ ...filters, search: g.n });
    onGemeindeSelect?.({ name: g.n, bundeslandId: g.i, lat: g.lat, lng: g.lng });
  };

  const handleSearch = () => {
    isUserTypingRef.current = false;
    setShowSuggestions(false);
    if (searchValue?.trim()) {
      trackEvent('search', { query: searchValue.trim() });
    }
    onFiltersChange({ ...filters, search: searchValue || undefined });
  };

  const totalSuggestions = eventSuggestions.length + suggestions.length;

  const handleSelectEvent = (ev: EventSuggestion) => {
    isUserTypingRef.current = false;
    abortControllerRef.current?.abort();
    setSearchValue(ev.title);
    setShowSuggestions(false);
    setSuggestions([]);
    setEventSuggestions([]);
    onFiltersChange({ ...filters, search: ev.title });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, totalSuggestions - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < eventSuggestions.length) {
        handleSelectEvent(eventSuggestions[selectedIndex]);
      } else if (selectedIndex >= eventSuggestions.length && suggestions[selectedIndex - eventSuggestions.length]) {
        handleSelectGemeinde(suggestions[selectedIndex - eventSuggestions.length]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      isUserTypingRef.current = false;
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isUserTypingRef.current = true;
    setSearchValue(e.target.value);
    // Show dropdown immediately as soon as gemeinde suggestions exist for new value
    if (e.target.value.trim().length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        isUserTypingRef.current = false;
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isTodayActive = filters.dateFrom === todayStr && filters.dateTo === todayStr;

  const handleTodayToggle = () => {
    if (isTodayActive) {
      // Deactivate: clear dateFrom, restore default dateTo (6 months)
      const defaultDateTo = new Date();
      defaultDateTo.setMonth(defaultDateTo.getMonth() + 6);
      trackEvent('filter_change', { filter_type: 'heute', value: 'off' });
      onFiltersChange({ ...filters, dateFrom: undefined, dateTo: defaultDateTo.toISOString().slice(0, 10) });
    } else {
      trackEvent('filter_change', { filter_type: 'heute', value: 'on' });
      onFiltersChange({ ...filters, dateFrom: todayStr, dateTo: todayStr });
    }
  };

  const activeFilterCount = [
    filters.category,
    filters.sourceName,
    filters.district,
    filters.dateFrom,
    filters.dateTo,
    filters.search,
  ].filter(Boolean).length;

  const clearFilters = () => {
    isUserTypingRef.current = false;
    abortControllerRef.current?.abort();
    setSearchValue('');
    setShowSuggestions(false);
    setSuggestions([]);
    setEventSuggestions([]);
    // Restore default dateTo (6 months) when clearing
    const defaultDateTo = new Date();
    defaultDateTo.setMonth(defaultDateTo.getMonth() + 6);
    onFiltersChange({ dateTo: defaultDateTo.toISOString().slice(0, 10) });
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      {/* Search with Autocomplete */}
      <div className="relative min-w-[200px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Events suchen..."
          value={searchValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0 || eventSuggestions.length > 0) setShowSuggestions(true); }}
          autoComplete="off"
          className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none transition-all duration-200 ${
            eveningMode
              ? 'border-gray-700 bg-gray-800/50 text-gray-200 focus:border-gray-500 placeholder-gray-500'
              : 'border-slate-200 bg-white text-slate-700 focus:border-slate-400 placeholder-slate-400'
          }`}
        />

        {/* Suggestions Dropdown — rendered as portal to escape overflow clipping */}
        {showSuggestions && typeof document !== 'undefined' && createPortal(
          <SuggestionsDropdown
            suggestions={suggestions}
            eventSuggestions={eventSuggestions}
            selectedIndex={selectedIndex}
            eveningMode={eveningMode}
            inputRef={inputRef}
            suggestionsRef={suggestionsRef}
            onSelect={handleSelectGemeinde}
            onSelectEvent={handleSelectEvent}
            onHover={setSelectedIndex}
          />,
          document.body
        )}
      </div>

      {/* Heute Button */}
      <button
        onClick={handleTodayToggle}
        className={`text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 cursor-pointer min-h-[44px] transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
          eveningMode
            ? isTodayActive
              ? 'border-amber-500/30 bg-amber-900/10 text-amber-200 focus:ring-amber-500/50'
              : 'border-gray-700 bg-gray-800/50 text-gray-300 focus:ring-gray-600'
            : isTodayActive
              ? 'border-slate-800 bg-slate-800 text-white focus:ring-slate-600'
              : 'border-slate-200 bg-white text-slate-600 focus:ring-slate-400'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Heute
      </button>

      <CategoryFilter
        value={filters.category}
        onChange={(category) => { if (category) trackEvent('filter_change', { filter_type: 'category', value: category }); onFiltersChange({ ...filters, category, tags: undefined }); }}
        eveningMode={eveningMode}
      />

      {/* Source filter — god role only */}
      {isGod && (
        <SourceFilter
          value={filters.sourceName}
          onChange={(sourceName) => { if (sourceName) trackEvent('filter_change', { filter_type: 'source', value: sourceName }); onFiltersChange({ ...filters, sourceName }); }}
          eveningMode={eveningMode}
        />
      )}

      <DistrictFilter
        value={filters.district}
        onChange={(district) => { if (district) trackEvent('filter_change', { filter_type: 'district', value: district }); onFiltersChange({ ...filters, district }); }}
        bundeslandId={bundeslandId}
        eveningMode={eveningMode}
      />

      <DateRangeFilter
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onChange={(dateFrom, dateTo) => { if (dateFrom) trackEvent('filter_change', { filter_type: 'date', value: `${dateFrom}-${dateTo}` }); onFiltersChange({ ...filters, dateFrom, dateTo }); }}
        eveningMode={eveningMode}
      />

      {activeFilterCount > 0 && (
        <button
          onClick={clearFilters}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all whitespace-nowrap active:scale-95 ${
            eveningMode
              ? 'text-amber-400 hover:bg-amber-900/20'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Filter zurücksetzen ({activeFilterCount})
        </button>
      )}
    </div>
  );
}

function SuggestionsDropdown({
  suggestions, eventSuggestions, selectedIndex, eveningMode, inputRef, suggestionsRef, onSelect, onSelectEvent, onHover
}: {
  suggestions: Gemeinde[];
  eventSuggestions: EventSuggestion[];
  selectedIndex: number;
  eveningMode?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestionsRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (g: Gemeinde) => void;
  onSelectEvent: (ev: EventSuggestion) => void;
  onHover: (i: number) => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const updatePos = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [inputRef]);

  const borderClass = eveningMode ? 'border-gray-700' : 'border-slate-100';
  const hoverClass = eveningMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-50';
  const activeClass = eveningMode ? 'bg-gray-700' : 'bg-blue-50';
  const labelClass = eveningMode ? 'text-gray-500' : 'text-slate-400';

  return (
    <div
      ref={suggestionsRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className={`border rounded-xl overflow-hidden shadow-xl ${
        eveningMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-200'
      }`}
    >
      {/* Event suggestions */}
      {eventSuggestions.length > 0 && (
        <>
          <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${labelClass} ${eveningMode ? 'bg-gray-800/80' : 'bg-slate-50'}`}>
            Events
          </div>
          {eventSuggestions.map((ev, i) => (
            <button
              key={ev.id}
              onClick={() => onSelectEvent(ev)}
              onMouseEnter={() => onHover(i)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-100
                ${i === selectedIndex ? activeClass : hoverClass}
                ${(i !== eventSuggestions.length - 1 || suggestions.length > 0) ? `border-b ${borderClass}` : ''}
              `}
            >
              <svg className={`w-3.5 h-3.5 shrink-0 ${labelClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className={`truncate flex-1 ${eveningMode ? 'text-gray-200' : 'text-slate-800'}`}>{ev.title}</span>
              {ev.category && (
                <span className={`text-[10px] shrink-0 ${labelClass}`}>{ev.category}</span>
              )}
            </button>
          ))}
        </>
      )}

      {/* Gemeinde suggestions */}
      {suggestions.length > 0 && (
        <>
          <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${labelClass} ${eveningMode ? 'bg-gray-800/80' : 'bg-slate-50'}`}>
            Orte
          </div>
          {suggestions.map((g, i) => {
            const flatIndex = eventSuggestions.length + i;
            return (
              <button
                key={`${g.n}-${g.p}`}
                onClick={() => onSelect(g)}
                onMouseEnter={() => onHover(flatIndex)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-100
                  ${flatIndex === selectedIndex ? activeClass : hoverClass}
                  ${i !== suggestions.length - 1 ? `border-b ${borderClass}` : ''}
                `}
              >
                <svg className={`w-3.5 h-3.5 shrink-0 ${labelClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className={eveningMode ? 'text-gray-200' : 'text-slate-800'}>{g.n}</span>
                <span className={`text-xs ${labelClass}`}>{g.b}</span>
                <span className={`text-xs ml-auto ${eveningMode ? 'text-gray-600' : 'text-slate-300'}`}>{g.p}</span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
