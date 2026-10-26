import type { ReactNode } from 'react';
import type { Event } from '@/types/events';
import { ShelfCard } from '@/components/Discover/v4/shelf-ui';

/**
 * Vollständige Liste eines SEO-Hubs als Poster-Raster (2/3/5 Spalten wie
 * die Liste auf /entdecken). Steht unter den Regalen; jedes Event der
 * Seite ist hier verlinkt, auch wenn kein Regal es zeigt.
 */
export function HubEventGrid({ title, sub, events, children, id }: {
  title: string;
  sub?: string;
  events: Event[];
  /** Nachlade-Knopf o. Ä. unter dem Raster. */
  children?: ReactNode;
  id?: string;
}) {
  if (events.length === 0 && !children) return null;
  return (
    <section id={id} className="mt-10 mb-12 scroll-mt-24">
      <div className="flex items-baseline gap-3 pb-4 mb-[22px] border-b border-[var(--v4-hairline-2)]">
        <h2 className="m-0 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{title}</h2>
        {sub && <span className="text-[13.5px] text-[var(--v4-ink-50)]">{sub}</span>}
      </div>
      <div className="v4-poster-grid">
        {events.map((e) => <ShelfCard key={e.id} ev={e} grid />)}
      </div>
      {children}
    </section>
  );
}
