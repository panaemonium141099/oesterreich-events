import Link from 'next/link';
import Image from 'next/image';
import type { Event } from '@/types/events';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

export function V4PlanTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Noch keine Events im Plan.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Klick auf &bdquo;Bearbeiten&ldquo; um Events dazu zu nehmen.</p>
      </div>
    );
  }
  return (
    <ol className="relative flex flex-col gap-4 pl-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-px before:bg-[var(--v4-hairline-3)]">
      {events.map(ev => {
        const date = new Date(ev.start_date).toLocaleString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return (
          <li key={ev.id} className="relative">
            <span className="absolute -left-[18px] top-3 w-3 h-3 rounded-full bg-[var(--v4-match)] border-2 border-[var(--v4-surface)]" aria-hidden="true"/>
            <Link href={buildEventUrlV2(ev)} className="press-haptic flex gap-3 rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-3.5 hover:border-[var(--v4-hairline-3)] transition-colors">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-[var(--v4-surface-inset)] border border-[var(--v4-hairline-1)] flex-shrink-0">
                {ev.image_url ? (
                  <Image src={ev.image_url} alt="" fill sizes="80px" style={{ objectFit: 'cover' }}/>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--v4-ink-30)] px-1 text-center">{ev.title.slice(0, 24)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)] mb-1">{date}</p>
                <h3 className="text-[15px] font-semibold text-[var(--v4-ink)] leading-tight tracking-[-0.015em] line-clamp-2">{ev.title}</h3>
                {ev.location_name && <p className="text-[12.5px] text-[var(--v4-ink-70)] mt-0.5 line-clamp-1">{ev.location_name}</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
