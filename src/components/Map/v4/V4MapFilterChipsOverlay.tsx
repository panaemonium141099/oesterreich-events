'use client';

/**
 * V4MapFilterChipsOverlay — horizontal-scrollable chip row above the
 * Mapbox container. Subset of FILTER_CHIPS — only the 4 simplest
 * (Tickets / Gratis / Heute / Konzerte) for surface restraint.
 */

const MAP_CHIPS = [
  { key: 'tickets',   label: 'Tickets verfügbar' },
  { key: 'free',      label: 'Gratis' },
  { key: 'today',     label: 'Heute' },
  { key: 'concerts',  label: 'Konzerte' },
] as const;

interface V4MapFilterChipsOverlayProps {
  active: Set<string>;
  onToggle: (key: string) => void;
}

export function V4MapFilterChipsOverlay({ active, onToggle }: V4MapFilterChipsOverlayProps) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-[calc(100%-24px)] overflow-x-auto thin-scroll">
      <div className="flex gap-2 px-3 py-2 rounded-full bg-[rgba(10,10,12,0.85)] backdrop-blur border border-[var(--v4-hairline-2)] whitespace-nowrap">
        {MAP_CHIPS.map(chip => {
          const isActive = active.has(chip.key);
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onToggle(chip.key)}
              data-active={isActive}
              className={
                'press-haptic px-3 py-1 rounded-full text-[12px] font-semibold transition-colors ' +
                (isActive
                  ? 'bg-[rgba(212,184,150,0.18)] text-[var(--v4-ticket)] border border-[rgba(212,184,150,0.40)]'
                  : 'text-[var(--v4-ink-70)] border border-transparent hover:text-[var(--v4-ink)]')
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
