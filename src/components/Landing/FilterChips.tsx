import { Link } from '@/i18n/navigation';

export interface FilterChip {
  label: string;
  href: string;
  active: boolean;
}

interface FilterChipsProps {
  chips: FilterChip[];
}

/**
 * Horizontal scrollable filter chips for landing pages.
 * Each chip is a real <Link> for SEO — no client-side filtering.
 */
export function FilterChips({ chips }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            chip.active
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  );
}
