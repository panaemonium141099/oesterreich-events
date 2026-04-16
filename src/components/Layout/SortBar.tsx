'use client';

import { motion, useReducedMotion } from 'framer-motion';

export type SortMode =
  | 'distance'
  | 'alpha-asc'
  | 'alpha-desc'
  | 'date-asc'
  | 'date-desc';

interface SortBarProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
  hasLocation: boolean;
  eveningMode?: boolean;
}

export function SortBar({ value, onChange, hasLocation, eveningMode }: SortBarProps) {
  const reduceMotion = useReducedMotion();
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 500, damping: 38 };

  const alphaActive = value === 'alpha-asc' || value === 'alpha-desc';
  const dateActive = value === 'date-asc' || value === 'date-desc';

  return (
    <div
      className={`flex items-center gap-1 p-0.5 rounded-lg border text-xs ${
        eveningMode
          ? 'border-gray-700/60 bg-gray-800/40'
          : 'border-slate-200 bg-slate-50/80'
      }`}
      role="group"
      aria-label="Sortierung"
    >
      <SortChip
        active={value === 'distance'}
        disabled={!hasLocation}
        onClick={() => hasLocation && onChange('distance')}
        eveningMode={eveningMode}
        layoutId="sort-indicator"
        layoutTransition={layoutTransition}
        title={hasLocation ? 'Nach Entfernung sortieren' : 'Standort nicht freigegeben'}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="font-medium">Nähe</span>
      </SortChip>

      <SortChip
        active={alphaActive}
        onClick={() => onChange(value === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc')}
        eveningMode={eveningMode}
        layoutId="sort-indicator"
        layoutTransition={layoutTransition}
        title={
          !alphaActive
            ? 'Alphabetisch sortieren (A-Z)'
            : value === 'alpha-asc'
              ? 'Alphabetisch: aktuell A-Z, klicken für Z-A'
              : 'Alphabetisch: aktuell Z-A, klicken für A-Z'
        }
        aria-label={
          alphaActive
            ? value === 'alpha-asc'
              ? 'Alphabetisch A bis Z, klicken für Z bis A'
              : 'Alphabetisch Z bis A, klicken für A bis Z'
            : 'Alphabetisch sortieren'
        }
      >
        <span className="font-semibold tracking-tight">A</span>
        <DirArrow up={!alphaActive || value === 'alpha-asc'} />
      </SortChip>

      <SortChip
        active={dateActive}
        onClick={() => onChange(value === 'date-asc' ? 'date-desc' : 'date-asc')}
        eveningMode={eveningMode}
        layoutId="sort-indicator"
        layoutTransition={layoutTransition}
        title={
          !dateActive
            ? 'Nach Datum sortieren (bald zuerst)'
            : value === 'date-asc'
              ? 'Datum: bald zuerst, klicken für später zuerst'
              : 'Datum: später zuerst, klicken für bald zuerst'
        }
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <DirArrow up={!dateActive || value === 'date-asc'} />
      </SortChip>
    </div>
  );
}

interface SortChipProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  eveningMode?: boolean;
  children: React.ReactNode;
  title?: string;
  'aria-label'?: string;
  layoutId?: string;
  layoutTransition?: { duration?: number } | { type: 'spring'; stiffness: number; damping: number };
}

function SortChip({
  active,
  disabled,
  onClick,
  eveningMode,
  children,
  title,
  'aria-label': ariaLabel,
  layoutId,
  layoutTransition,
}: SortChipProps) {
  const baseText = eveningMode ? 'text-gray-400' : 'text-slate-600';
  const activeText = eveningMode ? 'text-white' : 'text-slate-900';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={active}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : active
            ? activeText
            : `${baseText} ${eveningMode ? 'hover:text-gray-200' : 'hover:text-slate-800'} cursor-pointer`
      }`}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          transition={layoutTransition}
          className={`absolute inset-0 rounded-md ${
            eveningMode ? 'bg-white/10 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]' : 'bg-white shadow-sm ring-1 ring-slate-200/60'
          }`}
          aria-hidden="true"
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
        {children}
      </span>
    </button>
  );
}

function DirArrow({ up }: { up: boolean }) {
  return (
    <svg
      className="w-3 h-3 transition-transform duration-200"
      style={{ transform: up ? 'rotate(0deg)' : 'rotate(180deg)' }}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
    </svg>
  );
}
