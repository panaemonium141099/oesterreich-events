'use client';

/**
 * V4PlanHero — Cinematic Plan-Hero nach Designer 06b.
 *
 * Volle Bühne mit Eventfoto + dunklem Gradient. Layout:
 *   • Top: Back-Button + (Desktop) Plan teilen / Bearbeiten
 *   • Bottom: Badges (In deinem Plan · Ticket-Termin) + Eyebrow + Titel +
 *     Meta-Zeile (Datum · Ort · Personen)
 *
 * Bild = `image_url` des ersten Events. Fallback: Dark-Surface mit Pattern.
 */

import { useRouter } from 'next/navigation';
import type { PlanWithEvents } from '@/types/plans';

interface Props {
  plan: PlanWithEvents;
}

function HeroBackButton() {
  const router = useRouter();
  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/saved');
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Zurück"
      className="press-haptic w-9 h-9 rounded-full flex items-center justify-center bg-[rgba(10,10,12,0.65)] backdrop-blur border border-[var(--v4-hairline-2)] text-[var(--v4-ink)] hover:bg-[rgba(10,10,12,0.85)]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
      </svg>
    </button>
  );
}

function formatLongDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-AT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function deriveTitle(plan: PlanWithEvents): { lead: string; italic: string } {
  // Wenn der User einen Namen wie "Abend in Wien" gesetzt hat, splitten wir
  // beim letzten Wort und kursivieren es à la Designer.
  const name = plan.name?.trim() || 'Mein Plan';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    const italic = parts.pop() as string;
    return { lead: parts.join(' ') + ' ', italic: italic + '.' };
  }
  return { lead: '', italic: name + '.' };
}

function daysUntil(iso: string): number {
  try {
    const target = new Date(iso + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const ms = target.getTime() - now.getTime();
    return Math.round(ms / (24 * 60 * 60 * 1000));
  } catch { return 0; }
}

export function V4PlanHero({ plan }: Props) {
  const firstEvent = plan.events[0];
  const imageUrl = firstEvent?.image_url || null;
  const { lead, italic } = deriveTitle(plan);
  const dateLabel = formatLongDate(plan.plan_date);
  const days = daysUntil(plan.plan_date);
  const isPast = days < 0;
  const isToday = days === 0;
  const isUpcoming = days > 0;

  const heroBg = imageUrl
    ? `linear-gradient(180deg, rgba(10,10,12,0.30) 0%, rgba(10,10,12,0.20) 40%, rgba(10,10,12,0.95) 100%), url(${imageUrl})`
    : 'linear-gradient(180deg, rgba(10,10,12,0.4) 0%, rgba(10,10,12,0.95) 100%), var(--v4-surface-elevated)';

  return (
    <section className="relative overflow-hidden h-[420px] md:h-[520px]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: heroBg }}
        aria-hidden="true"
      />

      {/* Top bar */}
      <div className="absolute top-4 md:top-6 left-4 md:left-7 right-4 md:right-7 flex items-center gap-2.5 z-10">
        <HeroBackButton/>
        <div className="flex-1"/>
        <button
          type="button"
          aria-label="Plan teilen"
          className="press-haptic hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[rgba(10,10,12,0.55)] backdrop-blur border border-[var(--v4-hairline-2)] text-[12.5px] font-semibold text-[var(--v4-ink)] hover:bg-[rgba(10,10,12,0.75)]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Plan teilen
        </button>
      </div>

      {/* Bottom block */}
      <div className="absolute left-0 right-0 bottom-0 z-10">
        <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-6 md:pb-10">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[color-mix(in_oklab,var(--v4-ticket)_18%,transparent)] border border-[var(--v4-ticket)]/40 text-[11px] font-bold text-[var(--v4-ticket)]">
              {isPast ? 'Vergangen' : isToday ? 'Heute' : isUpcoming ? `In ${days} Tag${days === 1 ? '' : 'en'}` : 'In deinem Plan'}
            </span>
            {plan.tickets_status === 'open' && firstEvent?.ticket_url && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[color-mix(in_oklab,var(--v4-match)_15%,transparent)] border border-[var(--v4-match)]/35 text-[11px] font-bold text-[var(--v4-match)]">
                Tickets offen
              </span>
            )}
          </div>

          <p className="text-[10.5px] uppercase tracking-[0.22em] font-bold text-[var(--v4-ink-70)] mb-2.5">
            Mein Plan &middot; {dateLabel}
          </p>

          <h1 className="m-0 text-[36px] md:text-[60px] font-bold tracking-[-0.035em] text-[var(--v4-ink)] leading-[1.02] mb-3 max-w-[920px]" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
            {lead}
            <span style={{ fontFamily: 'var(--font-display, ui-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 300 }}>{italic}</span>
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] md:text-[15px] text-[var(--v4-ink-70)]">
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {dateLabel}
            </span>
            {firstEvent?.location_name && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {firstEvent.location_name}{firstEvent.bundesland ? `, ${firstEvent.bundesland}` : ''}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {plan.event_count === 1 ? '1 Event' : `${plan.event_count} Events`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
