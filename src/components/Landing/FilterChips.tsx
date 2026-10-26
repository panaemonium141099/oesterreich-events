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
    <nav className="flex gap-2 overflow-x-auto pb-1 thin-scroll">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          aria-current={chip.active ? 'page' : undefined}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
            chip.active
              ? 'bg-[var(--v4-ink)] text-[#0a0a0c] border border-transparent'
              : 'border border-[var(--v4-hairline-3)] hover:border-[var(--v4-hairline-4)] text-[var(--v4-ink)]'
          }`}
        >
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}
