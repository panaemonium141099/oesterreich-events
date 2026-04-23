'use client';

interface TagChipProps {
  tag: string;
  onClick?: () => void;
  eveningMode?: boolean;
  /** Smaller variant for EventCard */
  size?: 'sm' | 'md';
}

// Colors for the 11 v3-Hauptkategorien + Sonstiges. Mapped from the old
// 14-cat colors so legacy paths (WeeklyHighlights, old URLs) still render
// something sensible while the DB migration is in flight.
// See docs/TAXONOMY.md §2.
const TAG_COLORS: Record<string, { light: string; dark: string }> = {
  // v3 Hauptkategorien
  'Musik': { light: 'bg-purple-100 text-purple-700', dark: 'bg-purple-900/50 text-purple-300' },
  'Kultur & Bühne': { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-900/50 text-amber-300' },
  'Nightlife & Party': { light: 'bg-violet-100 text-violet-700', dark: 'bg-violet-900/50 text-violet-300' },
  'Essen & Trinken': { light: 'bg-rose-100 text-rose-700', dark: 'bg-rose-900/50 text-rose-300' },
  'Märkte & Feste': { light: 'bg-orange-100 text-orange-700', dark: 'bg-orange-900/50 text-orange-300' },
  'Sport & Bewegung': { light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-900/50 text-blue-300' },
  'Natur & Abenteuer': { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-900/50 text-emerald-300' },
  'Wissen & Karriere': { light: 'bg-cyan-100 text-cyan-700', dark: 'bg-cyan-900/50 text-cyan-300' },
  'Familie & Kinder': { light: 'bg-pink-100 text-pink-700', dark: 'bg-pink-900/50 text-pink-300' },
  'Community & Freizeit': { light: 'bg-yellow-100 text-yellow-700', dark: 'bg-yellow-900/50 text-yellow-300' },
  'Wellness & Spiritualität': { light: 'bg-teal-100 text-teal-700', dark: 'bg-teal-900/50 text-teal-300' },
  'Sonstiges': { light: 'bg-slate-100 text-slate-700', dark: 'bg-gray-700 text-gray-300' },

  // Legacy v1/v2 names — kept as aliases so anything reading old DB values
  // before the migration runs still renders a color. Remove after cleanup.
  'Kultur': { light: 'bg-amber-100 text-amber-700', dark: 'bg-amber-900/50 text-amber-300' },
  'Nightlife': { light: 'bg-violet-100 text-violet-700', dark: 'bg-violet-900/50 text-violet-300' },
  'Wein & Kulinarik': { light: 'bg-rose-100 text-rose-700', dark: 'bg-rose-900/50 text-rose-300' },
  'Märkte': { light: 'bg-orange-100 text-orange-700', dark: 'bg-orange-900/50 text-orange-300' },
  'Sport': { light: 'bg-blue-100 text-blue-700', dark: 'bg-blue-900/50 text-blue-300' },
  'Natur': { light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-900/50 text-emerald-300' },
  'Bildung': { light: 'bg-cyan-100 text-cyan-700', dark: 'bg-cyan-900/50 text-cyan-300' },
  'Wirtschaft': { light: 'bg-sky-100 text-sky-700', dark: 'bg-sky-900/50 text-sky-300' },
  'Familie': { light: 'bg-pink-100 text-pink-700', dark: 'bg-pink-900/50 text-pink-300' },
  'Feste & Brauchtum': { light: 'bg-orange-100 text-orange-700', dark: 'bg-orange-900/50 text-orange-300' },
  'Gesundheit': { light: 'bg-teal-100 text-teal-700', dark: 'bg-teal-900/50 text-teal-300' },
  'Religion': { light: 'bg-indigo-100 text-indigo-700', dark: 'bg-indigo-900/50 text-indigo-300' },
  'Rave': { light: 'bg-violet-100 text-violet-700', dark: 'bg-violet-900/50 text-violet-300' },
};

const TAG_GLOW_COLORS: Record<string, string> = {
  // v3
  'Musik': '168,85,247',
  'Kultur & Bühne': '245,158,11',
  'Nightlife & Party': '139,92,246',
  'Essen & Trinken': '244,63,94',
  'Märkte & Feste': '249,115,22',
  'Sport & Bewegung': '59,130,246',
  'Natur & Abenteuer': '16,185,129',
  'Wissen & Karriere': '6,182,212',
  'Familie & Kinder': '236,72,153',
  'Community & Freizeit': '234,179,8',
  'Wellness & Spiritualität': '20,184,166',
  'Sonstiges': '148,163,184',
  // Legacy aliases
  'Kultur': '245,158,11',
  'Nightlife': '139,92,246',
  'Wein & Kulinarik': '244,63,94',
  'Märkte': '249,115,22',
  'Sport': '59,130,246',
  'Natur': '16,185,129',
  'Bildung': '6,182,212',
  'Wirtschaft': '14,165,233',
  'Familie': '236,72,153',
  'Feste & Brauchtum': '249,115,22',
  'Gesundheit': '20,184,166',
  'Religion': '99,102,241',
  'Rave': '139,92,246',
};

export function TagChip({ tag, onClick, eveningMode, size = 'md' }: TagChipProps) {
  const colors = TAG_COLORS[tag] || TAG_COLORS['Sonstiges'];
  const colorClass = eveningMode ? colors.dark : colors.light;
  const glowColor = TAG_GLOW_COLORS[tag] || TAG_GLOW_COLORS['Sonstiges'];

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-2 py-0.5'
    : 'text-xs px-2.5 py-1';

  const isClickable = !!onClick;

  return (
    <span
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      className={`
        inline-flex items-center font-medium rounded-full whitespace-nowrap
        transition-all duration-200 motion-reduce:transition-none
        ${sizeClasses}
        ${colorClass}
        ${isClickable ? 'cursor-pointer hover:scale-105 active:scale-95 motion-reduce:transform-none min-h-[44px] min-w-[44px] justify-center' : ''}
        ${eveningMode ? 'animate-pulse-glow' : ''}
      `}
      style={eveningMode ? { '--glow-color': glowColor } as React.CSSProperties : undefined}
    >
      {tag}
    </span>
  );
}

export function TagOverflow({ count, eveningMode, size = 'md' }: { count: number; eveningMode?: boolean; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-2 py-0.5'
    : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full whitespace-nowrap
        ${sizeClasses}
        ${eveningMode ? 'bg-white/[0.06] text-white/40' : 'bg-slate-100 text-slate-500'}
      `}
    >
      +{count}
    </span>
  );
}

export { TAG_COLORS, TAG_GLOW_COLORS };
