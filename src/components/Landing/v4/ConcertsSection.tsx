import type { Event } from '@/types/events';
import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4CardV } from '@/components/Events/v4';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface ConcertsSectionProps {
  events: Array<Event & { state: V4EventState }>;
}

export function ConcertsSection({ events }: ConcertsSectionProps) {
  const t = useTranslations('Landing.Concerts');
  if (events.length === 0) return null;

  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            {t('eyebrow')}
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            {t('title')}
          </h2>
        </div>
        <Link
          href="/entdecken?category=music"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          {t('viewAll')}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {events.map(ev => <V4CardV key={ev.id} event={ev}/>)}
      </div>
    </section>
  );
}
