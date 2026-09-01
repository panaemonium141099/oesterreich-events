import Link from 'next/link';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import type { Event } from '@/types/events';

/**
 * "Dieses Event ist vorbei" — Hinweis auf vergangenen Event-Detailseiten
 * (SEO-Fix 2026-09-01).
 *
 * Hintergrund: Wiederkehrende Feste sammeln monatelang Rankings an
 * (Messung: bis 2.224 Impressions/Woche auf Position 5) — nach dem Termin
 * landeten Besucher aber auf einer Seite, die so tat, als stünde das Event
 * noch bevor. Diese Box sagt klar, dass der Termin vorbei ist, und führt
 * weiter: entweder direkt zur nächsten Ausgabe (getSuccessorEvent) oder
 * zu den ähnlichen Events weiter unten auf der Seite.
 */

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

export function V4PastEventNotice({
  eventEnd,
  successor,
}: {
  eventEnd: string;
  successor: Event | null;
}) {
  return (
    <section className="max-w-[1180px] mx-auto px-5 md:px-14 pt-6 md:pt-8">
      <div className="rounded-2xl border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-1.5">
            Termin vorbei
          </p>
          <p className="text-[15px] font-semibold text-[var(--v4-ink)] leading-snug">
            Dieses Event hat am {formatDate(eventEnd)} stattgefunden.
          </p>
          <p className="text-[12.5px] text-[var(--v4-ink-70)] mt-1">
            {successor
              ? 'Die nächste Ausgabe steht schon fest:'
              : 'Weiter unten findest du ähnliche Events in der Nähe.'}
          </p>
        </div>

        {successor ? (
          <Link
            href={buildEventUrlV2(successor)}
            className="press-haptic inline-flex flex-col gap-0.5 rounded-xl bg-[var(--v4-ink)] text-[#0a0a0c] px-4 py-2.5 shrink-0 max-w-full"
          >
            <span className="text-[12.5px] font-bold leading-tight line-clamp-1">
              {successor.title}
            </span>
            <span className="text-[11px] font-semibold opacity-70">
              {formatDate(successor.start_date)}
            </span>
          </Link>
        ) : (
          <a
            href="#similar-events"
            className="press-haptic inline-flex items-center gap-1.5 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)] px-4 py-2 shrink-0"
          >
            Ähnliche Events
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </a>
        )}
      </div>
    </section>
  );
}
