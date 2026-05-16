'use client';

/**
 * V4PlanEventPreview — "Worum geht's?" Sektion nach Designer 06b.
 *
 * Eine Karte pro Event mit Bild links + Content rechts:
 *   • Kategorie-Label
 *   • Italic Display-Titel
 *   • Description (line-clamp)
 *   • Meta-Zeile: Zeit · Ort · Ticket-Hinweis
 *   • CTA "Event-Seite öffnen" oben in der Section-Header-Zeile
 */

import Link from 'next/link';
import type { Event } from '@/types/events';
import { buildEventUrlV2 } from '@/lib/utils/slugify';

interface Props {
  events: Event[];
}

function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'long' });
  } catch { return ''; }
}

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function priceLabel(ev: Event): string | null {
  if (ev.price_text) return ev.price_text;
  if (ev.price_min) return `ab ${ev.price_min} €`;
  return null;
}

export function V4PlanEventPreview({ events }: Props) {
  if (events.length === 0) return null;
  const isSingle = events.length === 1;

  return (
    <section className="mt-8 md:mt-12">
      <div className="flex items-baseline gap-3 mb-4 md:mb-5">
        <span className="text-[10.5px] uppercase tracking-[0.22em] font-bold text-[var(--v4-ink-50)]">
          Worum geht&apos;s
        </span>
        <span className="flex-1 h-px bg-[var(--v4-hairline-1)]"/>
        {isSingle && (
          <Link
            href={buildEventUrlV2(events[0])}
            className="press-haptic inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
          >
            Event-Seite öffnen
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {events.map(ev => <EventCard key={ev.id} ev={ev}/>)}
      </div>
    </section>
  );
}

function EventCard({ ev }: { ev: Event }) {
  const date = formatEventDate(ev.start_date);
  const time = formatEventTime(ev.start_date);
  const price = priceLabel(ev);
  const href = buildEventUrlV2(ev);

  return (
    <Link
      href={href}
      className="press-haptic group block rounded-2xl border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)] overflow-hidden hover:border-[var(--v4-hairline-2)] transition-colors"
    >
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
        <div
          className="bg-cover bg-center bg-[var(--v4-surface-inset)] aspect-[16/9] md:aspect-auto md:min-h-[200px]"
          style={ev.image_url ? { backgroundImage: `url(${ev.image_url})` } : undefined}
          aria-hidden="true"
        />
        <div className="p-5 md:p-6">
          {ev.category && (
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--v4-match)]">
              {ev.category}{ev.tags && ev.tags[0] ? ` · ${ev.tags[0]}` : ''}
            </p>
          )}
          <h3
            className="text-[22px] md:text-[28px] leading-tight tracking-[-0.025em] text-[var(--v4-ink)] mt-2"
            style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 300 }}
          >
            {ev.title}
          </h3>
          {ev.description && (
            <p className="text-[13px] text-[var(--v4-ink-70)] mt-2 leading-relaxed line-clamp-3 max-w-[540px]">
              {ev.description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-[var(--v4-ink-50)]">
            {(date || time) && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {[date, time].filter(Boolean).join(' · ')}
              </span>
            )}
            {ev.location_name && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {ev.location_name}{ev.bundesland ? `, ${ev.bundesland}` : ''}
              </span>
            )}
            {price && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="13" y1="5" x2="13" y2="19"/>
                </svg>
                {price}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
