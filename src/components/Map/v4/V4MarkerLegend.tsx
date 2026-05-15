/**
 * V4MarkerLegend — small floating legend panel for /map's marker
 * color system. Color never alone — every dot has a text label.
 * Mount it as an absolute-positioned child of the Mapbox container.
 */

const ITEMS = [
  { color: 'var(--v4-ticket)', label: 'Tickets verfügbar' },
  { color: 'var(--v4-match)',  label: 'Künstler im Line-up' },
  { color: 'var(--v4-go)',     label: 'In deinem Plan' },
  { color: 'var(--v4-ink-50)', label: 'Kein Online-Verkauf bekannt' },
];

export function V4MarkerLegend() {
  return (
    <div
      data-v4-marker-legend
      className="absolute bottom-4 left-4 px-3.5 py-2.5 rounded-xl bg-[rgba(10,10,12,0.85)] backdrop-blur border border-[var(--v4-hairline-2)] flex gap-3.5 flex-wrap text-[11px] text-[var(--v4-ink-70)] pointer-events-none"
    >
      {ITEMS.map(item => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}
