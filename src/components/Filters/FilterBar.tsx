'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { EventFilters } from '@/types/events';
import { CategoryFilter } from './CategoryFilter';
import { TagFilter } from './TagFilter';
import { DistrictFilter } from './DistrictFilter';
import { DateRangeFilter } from './DateRangeFilter';
import { trackEvent } from '@/lib/analytics';

interface Gemeinde {
  n: string;
  b: string;
  i: string;
  p: string;
  lat: number;
  lng: number;
}

interface FilterBarProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  eveningMode?: boolean;
  bundeslandId?: string;
  onGemeindeSelect?: (gemeinde: { name: string; bundeslandId: string; lat: number; lng: number }) => void;
}

export function FilterBar({ filters, onFiltersChange, eveningMode, bundeslandId, onGemeindeSelect }: FilterBarProps) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [suggestions, setSuggestions] = useState<Gemeinde[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [gemeinden, setGemeinden] = useState<Gemeinde[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load gemeinden data on mount
  useEffect(() => {
    fetch('/gemeinden.json')
      .then(r => r.json())
      .then(setGemeinden)
      .catch(() => {});
  }, []);

  // Filter suggestions
  useEffect(() => {
    if (!searchValue.trim() || searchValue.length < 2 || gemeinden.length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
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
      .slice(0, 6);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
    setSelectedIndex(-1);
  }, [searchValue, gemeinden]);

  const handleSelectGemeinde = (g: Gemeinde) => {
    setSearchValue(g.n);
    setShowSuggestions(false);
    onFiltersChange({ ...filters, search: g.n });
    onGemeindeSelect?.({ name: g.n, bundeslandId: g.i, lat: g.lat, lng: g.lng });
  };

  const handleSearch = () => {
    setShowSuggestions(false);
    if (searchValue?.trim()) {
      trackEvent('search', { query: searchValue.trim() });
    }
    onFiltersChange({ ...filters, search: searchValue || undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectGemeinde(suggestions[selectedIndex]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeFilterCount = [
    filters.category,
    filters.tags && filters.tags.length > 0 ? true : undefined,
    filters.district,
    filters.dateFrom,
    filters.dateTo,
    filters.search,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchValue('');
    setShowSuggestions(false);
    onFiltersChange({});
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
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
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
            selectedIndex={selectedIndex}
            eveningMode={eveningMode}
            inputRef={inputRef}
            suggestionsRef={suggestionsRef}
            onSelect={handleSelectGemeinde}
            onHover={setSelectedIndex}
          />,
          document.body
        )}
      </div>

      <CategoryFilter
        value={filters.category}
        onChange={(category) => { if (category) trackEvent('filter_change', { filter_type: 'category', value: category }); onFiltersChange({ ...filters, category, tags: undefined }); }}
        eveningMode={eveningMode}
      />

      <TagFilter
        value={filters.tags}
        onChange={(tags) => { if (tags) trackEvent('filter_change', { filter_type: 'tags', value: tags.join(',') }); onFiltersChange({ ...filters, tags, category: undefined }); }}
        eveningMode={eveningMode}
      />

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
  suggestions, selectedIndex, eveningMode, inputRef, suggestionsRef, onSelect, onHover
}: {
  suggestions: Gemeinde[];
  selectedIndex: number;
  eveningMode?: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  suggestionsRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (g: Gemeinde) => void;
  onHover: (i: number) => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const updatePos = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [inputRef]);

  return (
    <div
      ref={suggestionsRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className={`border rounded-xl overflow-hidden shadow-xl ${
        eveningMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-200'
      }`}
    >
      {suggestions.map((g, i) => (
        <button
          key={`${g.n}-${g.p}`}
          onClick={() => onSelect(g)}
          onMouseEnter={() => onHover(i)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-100
            ${i === selectedIndex
              ? eveningMode ? 'bg-gray-700' : 'bg-blue-50'
              : eveningMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-50'
            }
            ${i !== suggestions.length - 1
              ? eveningMode ? 'border-b border-gray-700' : 'border-b border-slate-100'
              : ''
            }`}
        >
          <svg className={`w-3.5 h-3.5 shrink-0 ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className={eveningMode ? 'text-gray-200' : 'text-slate-800'}>{g.n}</span>
          <span className={`text-xs ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>{g.b}</span>
          <span className={`text-xs ml-auto ${eveningMode ? 'text-gray-600' : 'text-slate-300'}`}>{g.p}</span>
        </button>
      ))}
    </div>
  );
}
