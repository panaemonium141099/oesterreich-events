import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4CardV, V4CardHero } from '@/components/Events/v4';
import Link from 'next/link';

interface WeekendSectionProps {
  events: Array<Event & { state: V4EventState }>;
}

function dateRangeLabel(): string {
  const start = new Date();
  const end = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const startStr = start.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${startStr.replace(/\.$/,'')} – ${endStr.replace(/\.$/,'')}`;
}

export function WeekendSection({ events }: WeekendSectionProps) {
  if (events.length === 0) {
    return (
      <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
        <p className="text-[var(--v4-ink-70)] text-sm">Aktuell keine Events im 7-Tage-Fenster.</p>
      </section>
    );
  }

  const [hero, ...rest] = events;
  const firstRow = rest.slice(0, 3);
  const secondRow = rest.slice(3, 6);

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            {dateRangeLabel()}
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Heute &amp; Wochenende
          </h2>
        </div>
        <Link
          href="/entdecken"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Alle Events ansehen
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>

      <V4CardHero event={hero} priority/>

      {firstRow.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {firstRow.map(ev => <V4CardV key={ev.id} event={ev}/>)}
        </div>
      )}
      {secondRow.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {secondRow.map(ev => <V4CardV key={ev.id} event={ev}/>)}
        </div>
      )}
    </section>
  );
}
