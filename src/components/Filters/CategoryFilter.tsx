'use client';

import { CATEGORIES } from '@/lib/categories';

interface CategoryFilterProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  eveningMode?: boolean;
}

export function CategoryFilter({ value, onChange, eveningMode }: CategoryFilterProps) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || undefined)}
      style={eveningMode ? { colorScheme: 'dark' } : undefined}
      className={`text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 appearance-none cursor-pointer min-w-[140px] transition-all duration-200 ${
        eveningMode
          ? value
            ? 'border-amber-500/30 bg-amber-900/10 text-amber-200 focus:ring-amber-500/50'
            : 'border-gray-700 bg-gray-800/50 text-gray-300 focus:ring-gray-600'
          : value
            ? 'border-slate-800 bg-slate-800 text-white focus:ring-slate-600'
            : 'border-slate-200 bg-white text-slate-600 focus:ring-slate-400'
      }`}
    >
      <option value="">Alle Kategorien</option>
      {CATEGORIES.map(cat => (
        <option key={cat} value={cat}>{cat}</option>
      ))}
    </select>
  );
}
