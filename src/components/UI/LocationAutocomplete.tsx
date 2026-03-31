'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface LocationResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    state?: string;
    country?: string;
  };
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (location: { name: string; address: string; lat: number; lng: number }) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Ort suchen...',
  label,
  className = '',
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const search = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'at',
        'accept-language': 'de',
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': 'OesterreichEvents/1.0' },
      });
      const data: LocationResult[] = await res.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
      setSelectedIndex(-1);
    } catch {
      setSuggestions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, search]);

  const handleSelect = (result: LocationResult) => {
    const addr = result.address;
    const city = addr?.city || addr?.town || addr?.village || addr?.municipality || '';
    const road = addr?.road ? `${addr.road}${addr.house_number ? ` ${addr.house_number}` : ''}` : '';
    const shortName = road && city ? `${road}, ${city}` : city || result.display_name.split(',')[0];
    const fullAddress = road && city && addr?.postcode
      ? `${road}, ${addr.postcode} ${city}`
      : result.display_name.split(',').slice(0, 3).join(',').trim();

    onChange(shortName);
    setShowSuggestions(false);
    onSelect?.({
      name: shortName,
      address: fullAddress,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && suggestions[selectedIndex]) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatSuggestion = (result: LocationResult) => {
    const parts = result.display_name.split(',').map(s => s.trim());
    const main = parts[0];
    const secondary = parts.slice(1, 3).join(', ');
    return { main, secondary };
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs text-white/40 mb-1.5">{label}</label>
      )}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20 transition-colors"
        />
        {loading && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-white/10 border-t-white/40 rounded-full animate-spin motion-reduce:animate-none" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1.5 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto"
        >
          {suggestions.map((result, i) => {
            const { main, secondary } = formatSuggestion(result);
            return (
              <button
                key={`${result.lat}-${result.lon}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-100 ${
                  i === selectedIndex ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                } ${i !== suggestions.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
              >
                <svg className="w-4 h-4 text-white/25 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm text-white/80 truncate">{main}</p>
                  <p className="text-xs text-white/30 truncate">{secondary}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
