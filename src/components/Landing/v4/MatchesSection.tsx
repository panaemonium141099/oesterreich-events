import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4CardH } from '@/components/Events/v4';
import Link from 'next/link';

interface MatchesSectionProps {
  events: Array<Event & { state: V4EventState }>;
}

export function MatchesSection({ events }: MatchesSectionProps) {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Deine Lieblingskünstler · spielen demnächst
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Auftritte deiner Lieblingskünstler
          </h2>
        </div>
        <Link
          href="/artists"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Alle Auftritte
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
          <p className="text-[14px]">Noch keine Auftritte gefunden — folge weiteren Künstlern.</p>
          <Link href="/artists" className="press-haptic inline-block mt-3 text-[13px] font-semibold text-[var(--v4-ink)] underline underline-offset-2">
            Künstler suchen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map(ev => <V4CardH key={ev.id} event={ev}/>)}
        </div>
      )}
    </section>
  );
}
