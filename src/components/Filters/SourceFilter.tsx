'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface SourceFilterProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  eveningMode?: boolean;
}

/** Classify source_name into display groups */
const SOURCE_GROUP_RULES: Array<{ label: string; test: (name: string) => boolean }> = [
  { label: 'Universitäten & FH', test: (n) => /^(uni-|tu-|wu-|boku-|meduni-|vetmeduni-|jku-|aau-|montanuni-|donau-uni-|akbild-|kunstuni-|mozarteum-|angewandte-|mdw-|kug-|itu-|fh-|fhg-|fernfh-|campus02-|imc-|mci-|hcw-)/.test(n) },
  { label: 'Pädagogische Hochschulen', test: (n) => /^(ph-|kph-|pph-)/.test(n) },
  { label: 'APIs & Portale', test: (n) => /^(feratel|tourdata|austria-info|wien-ogd|wien-ticket|ntry|bergfex|meetup|tips|gem2go)/.test(n) },
  { label: 'Regional', test: (n) => /^(burgenland|wien|noe|ooe|steiermark|salzburg|kaernten|tirol|vorarlberg)/.test(n) },
];

interface GroupedSource {
  label: string;
  sources: string[];
}

function groupSources(sources: string[]): GroupedSource[] {
  const groups: Map<string, string[]> = new Map();
  const ungrouped: string[] = [];

  for (const s of sources) {
    let matched = false;
    for (const rule of SOURCE_GROUP_RULES) {
      if (rule.test(s)) {
        if (!groups.has(rule.label)) groups.set(rule.label, []);
        groups.get(rule.label)!.push(s);
        matched = true;
        break;
      }
    }
    if (!matched) ungrouped.push(s);
  }

  const result: GroupedSource[] = [];
  for (const rule of SOURCE_GROUP_RULES) {
    const items = groups.get(rule.label);
    if (items && items.length > 0) {
      result.push({ label: rule.label, sources: items.sort() });
    }
  }
  if (ungrouped.length > 0) {
    result.push({ label: 'Sonstige', sources: ungrouped.sort() });
  }
  return result;
}

export function SourceFilter({ value, onChange, eveningMode }: SourceFilterProps) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unique source names once on first open
  useEffect(() => {
    if (!open || sources.length > 0) return;
    fetch('/api/events/sources')
      .then(r => r.json())
      .then((data: string[]) => setSources(data.sort()))
      .catch(() => {});
  }, [open, sources.length]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search) return sources;
    return sources.filter(s => s.toLowerCase().includes(search.toLowerCase()));
  }, [sources, search]);

  const label = value || 'Quelle';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 cursor-pointer min-h-[44px] transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
          eveningMode
            ? value
              ? 'border-amber-500/30 bg-amber-900/10 text-amber-200 focus:ring-amber-500/50'
              : 'border-gray-700 bg-gray-800/50 text-gray-300 focus:ring-gray-600'
            : value
              ? 'border-slate-800 bg-slate-800 text-white focus:ring-slate-600'
              : 'border-slate-200 bg-white text-slate-600 focus:ring-slate-400'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
        {label}
        <svg className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <SourceDropdown
          sources={filtered}
          value={value}
          search={search}
          onSearchChange={setSearch}
          onSelect={(s) => { onChange(s); setOpen(false); setSearch(''); }}
          onClear={() => { onChange(undefined); setOpen(false); setSearch(''); }}
          eveningMode={eveningMode}
          buttonRef={buttonRef}
          dropdownRef={dropdownRef}
        />,
        document.body
      )}
    </div>
  );
}

function SourceDropdown({
  sources, value, search, onSearchChange, onSelect, onClear, eveningMode, buttonRef, dropdownRef,
}: {
  sources: string[];
  value: string | undefined;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (s: string) => void;
  onClear: () => void;
  eveningMode?: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const updatePos = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280) });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [buttonRef]);

  const grouped = useMemo(() => groupSources(sources), [sources]);
  const labelClass = eveningMode ? 'text-gray-500' : 'text-slate-400';

  return (
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className={`border rounded-xl overflow-hidden shadow-xl ${
        eveningMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-200'
      }`}
    >
      {/* Search input */}
      <div className={`p-2 border-b ${eveningMode ? 'border-gray-700' : 'border-slate-100'}`}>
        <input
          type="text"
          placeholder="Quelle suchen... (z.B. uni, fh, feratel)"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          autoFocus
          className={`w-full text-sm px-2 py-1.5 rounded border focus:outline-none ${
            eveningMode
              ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-500'
              : 'border-slate-200 bg-white text-slate-700 placeholder-slate-400'
          }`}
        />
      </div>

      <div className="max-h-72 overflow-y-auto py-1">
        {sources.length === 0 ? (
          <div className={`px-3 py-4 text-sm text-center ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
            Laden...
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              {/* Group header */}
              <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${labelClass} ${eveningMode ? 'bg-gray-800/80' : 'bg-slate-50'} sticky top-0`}>
                {group.label} ({group.sources.length})
              </div>
              {group.sources.map((s) => (
                <button
                  key={s}
                  onClick={() => onSelect(s)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-100 min-h-[34px]
                    ${s === value
                      ? eveningMode ? 'bg-gray-700 text-amber-200' : 'bg-blue-50 text-blue-700'
                      : eveningMode ? 'text-gray-300 hover:bg-gray-700/50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span className="truncate">{s}</span>
                  {s === value && (
                    <svg className="w-3.5 h-3.5 shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {value && (
        <div className={`border-t px-3 py-2 ${eveningMode ? 'border-gray-700' : 'border-slate-100'}`}>
          <button
            onClick={onClear}
            className={`text-xs min-h-[36px] w-full text-center transition-colors ${
              eveningMode ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Filter entfernen
          </button>
        </div>
      )}
    </div>
  );
}
