'use client';

/**
 * ViewToggle — Pill-segmented switch between Karte and Liste view.
 *
 * The single control that flips the entire /map body between the Mapbox
 * surface and the grouped list. Mockup: white pill with 1px hairline and
 * soft shadow; active option = ink fill + white text.
 *
 * Position is decided by the parent: top-center of the map area on
 * desktop, bottom-center floating above the safe-area on mobile.
 */
import { T } from './tokens';

export type MapViewMode = 'map' | 'list';

interface ViewToggleProps {
  view: MapViewMode;
  onViewChange: (v: MapViewMode) => void;
  size?: 'md' | 'sm';
}

export function ViewToggle({ view, onViewChange, size = 'md' }: ViewToggleProps) {
  const sm = size === 'sm';
  const opts: { k: MapViewMode; label: string; icon: 'map' | 'list' }[] = [
    { k: 'map', label: 'Karte', icon: 'map' },
    { k: 'list', label: 'Liste', icon: 'list' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Ansicht wechseln"
      style={{
        display: 'inline-flex',
        padding: 3,
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: 9999,
        boxShadow: T.shadow,
      }}
    >
      {opts.map((o) => {
        const active = view === o.k;
        return (
          <button
            key={o.k}
            role="tab"
            aria-selected={active}
            onClick={() => onViewChange(o.k)}
            className="press-haptic"
            style={{
              padding: sm ? '6px 12px' : '7px 14px',
              borderRadius: 9999,
              border: 'none',
              cursor: 'pointer',
              background: active ? T.ink : 'transparent',
              color: active ? '#fff' : T.ink70,
              fontSize: sm ? 12 : 12.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 0.18s, color 0.18s',
              letterSpacing: '-0.005em',
              minHeight: 36,
            }}
          >
            {o.icon === 'map' ? <MapIcon size={sm ? 12 : 13} /> : <ListIcon size={sm ? 12 : 13} />}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Mockup uses Lucide stroke icons; inlined here to avoid a new dependency.
function MapIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1,6 9,3 15,6 23,3 23,18 15,21 9,18 1,21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}
function ListIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
