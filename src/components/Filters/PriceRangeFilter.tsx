'use client';

interface PriceRangeFilterProps {
  priceMin: number | undefined;
  priceMax: number | undefined;
  onChange: (priceMin: number | undefined, priceMax: number | undefined) => void;
}

export function PriceRangeFilter({ priceMin, priceMax, onChange }: PriceRangeFilterProps) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        placeholder="Min €"
        value={priceMin ?? ''}
        onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : undefined, priceMax)}
        className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <span className="text-slate-400 text-xs">-</span>
      <input
        type="number"
        min={0}
        placeholder="Max €"
        value={priceMax ?? ''}
        onChange={e => onChange(priceMin, e.target.value ? parseFloat(e.target.value) : undefined)}
        className="w-20 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}
