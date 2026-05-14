import type { Festival } from '@/types/festivals';
import { V4FestivalCard } from '@/components/Events/v4';
import Link from 'next/link';

interface FestivalsSectionProps {
  festivals: Array<Festival & { lineupMatch: boolean }>;
}

export function FestivalsSection({ festivals }: FestivalsSectionProps) {
  if (festivals.length === 0) return null;

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Sommer · Line-ups verfügbar
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Festivals mit Line-up
          </h2>
        </div>
        <Link
          href="/entdecken?category=festival"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Alle Festivals
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {festivals.map(f => (
          <V4FestivalCard key={f.id} festival={f} lineupMatch={f.lineupMatch}/>
        ))}
      </div>
    </section>
  );
}
