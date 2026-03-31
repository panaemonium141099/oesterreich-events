'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORIES } from '@/lib/categories';
import { TAG_COLORS } from '@/components/UI/TagChip';

interface TagFilterProps {
  value: string[] | undefined;
  onChange: (tags: string[] | undefined) => void;
  eveningMode?: boolean;
}

export function TagFilter({ value, onChange, eveningMode }: TagFilterProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedTags = value || [];

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    onChange(next.length > 0 ? next : undefined);
  };

  const clearAll = () => {
    onChange(undefined);
    setOpen(false);
  };

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

  const hasSelection = selectedTags.length > 0;
  const label = hasSelection
    ? selectedTags.length === 1
      ? selectedTags[0]
      : `${selectedTags.length} Tags`
    : 'Tags';

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 cursor-pointer min-w-[100px] min-h-[44px] transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
          eveningMode
            ? hasSelection
              ? 'border-amber-500/30 bg-amber-900/10 text-amber-200 focus:ring-amber-500/50'
              : 'border-gray-700 bg-gray-800/50 text-gray-300 focus:ring-gray-600'
            : hasSelection
              ? 'border-slate-800 bg-slate-800 text-white focus:ring-slate-600'
              : 'border-slate-200 bg-white text-slate-600 focus:ring-slate-400'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        {label}
        <svg className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <TagDropdown
          categories={CATEGORIES}
          selectedTags={selectedTags}
          onToggle={toggleTag}
          onClear={clearAll}
          eveningMode={eveningMode}
          buttonRef={buttonRef}
          dropdownRef={dropdownRef}
        />,
        document.body
      )}
    </div>
  );
}

function TagDropdown({
  categories,
  selectedTags,
  onToggle,
  onClear,
  eveningMode,
  buttonRef,
  dropdownRef,
}: {
  categories: readonly string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
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
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [buttonRef]);

  return (
    <div
      ref={dropdownRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className={`border rounded-xl overflow-hidden shadow-xl ${
        eveningMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-slate-200'
      }`}
    >
      <div className="max-h-64 overflow-y-auto py-1">
        {categories.map((cat) => {
          const isSelected = selectedTags.includes(cat);
          const colors = TAG_COLORS[cat] || TAG_COLORS['Sonstiges'];
          const colorClass = eveningMode ? colors.dark : colors.light;

          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-100 min-h-[44px]
                ${isSelected
                  ? eveningMode ? 'bg-gray-700' : 'bg-blue-50'
                  : eveningMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-50'
                }`}
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                isSelected
                  ? eveningMode ? 'bg-amber-500 border-amber-500' : 'bg-blue-600 border-blue-600'
                  : eveningMode ? 'border-gray-500' : 'border-slate-300'
              }`}>
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
                {cat}
              </span>
            </button>
          );
        })}
      </div>

      {selectedTags.length > 0 && (
        <div className={`border-t px-3 py-2 ${eveningMode ? 'border-gray-700' : 'border-slate-100'}`}>
          <button
            onClick={onClear}
            className={`text-xs min-h-[44px] w-full text-center transition-colors ${
              eveningMode ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Alle Tags entfernen
          </button>
        </div>
      )}
    </div>
  );
}
