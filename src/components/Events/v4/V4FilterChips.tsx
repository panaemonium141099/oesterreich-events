'use client';

/**
 * V4FilterChips — 9 toggleable filter chips used by /entdecken (Filter
 * mode) and /map (overlay). Multi-select; parent owns state via the
 * `active` Set + `onToggle` callback.
 *
 * The chip keys are stable strings used in URL params (?chip=tickets,free).
 */

export const FILTER_CHIPS = [
  { key: 'tickets',   label: 'Tickets verfügbar' },
  { key: 'free',      label: 'Gratis' },
  { key: 'doorsale',  label: 'Abendkasse' },
  { key: 'today',     label: 'Heute' },
  { key: 'weekend',   label: 'Wochenende' },
  { key: 'concerts',  label: 'Konzerte' },
  { key: 'festivals', label: 'Festivals' },
  { key: 'nearby',    label: 'In deiner Nähe' },
  { key: 'mine',      label: 'Meine Künstler' },
] as const;

export type V4FilterChipKey = typeof FILTER_CHIPS[number]['key'];

interface V4FilterChipsProps {
  active: Set<string>;
  onToggle: (key: V4FilterChipKey) => void;
}

export function V4FilterChips({ active, onToggle }: V4FilterChipsProps) {
  return (
    <div className="flex gap-2 flex-wrap" data-v4-filter-chips>
      {FILTER_CHIPS.map(chip => {
        const isActive = active.has(chip.key);
        return (
          <button
            key={chip.key}
            type="button"
            data-active={isActive}
            data-chip={chip.key}
            onClick={() => onToggle(chip.key)}
            className={
              'press-haptic inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold tracking-[-0.005em] border transition-colors ' +
              (isActive
                ? 'bg-[rgba(212,184,150,0.14)] text-[var(--v4-ticket)] border-[rgba(212,184,150,0.34)]'
                : 'text-[var(--v4-ink-70)] border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)]')
            }
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
