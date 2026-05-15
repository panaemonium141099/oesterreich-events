/**
 * V4MatchingEvents — gold-accent card list of upcoming events that
 * match the user's followed artists. Each card mirrors the v4 mockup's
 * "{Artist} spielt bei {Event}" copy plus a ticket-link or plan-link.
 */

import Link from 'next/link';
import Image from 'next/image';

export interface ArtistMatchEvent {
  id: string;
  slug: string | null;
  title: string;
  start_date: string;
  location_name: string | null;
  bundesland: string | null;
  image_url: string | null;
  ticket_url: string | null;
  price_text: string | null;
  matched_artist: string;
  match_kind: 'match' | 'lineup';
}

interface V4MatchingEventsProps {
  events: ArtistMatchEvent[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
}

export function V4MatchingEvents({ events }: V4MatchingEventsProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v4-hairline-3)] p-6 text-center text-[var(--v4-ink-70)]">
        <p className="text-[14px]">Wir warten auf erste Auftritte.</p>
        <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">Sobald deine Künstler in Österreich spielen, taucht es hier auf.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {events.map(ev => {
        const slug = ev.slug ?? ev.id;
        const isFestival = ev.match_kind === 'lineup';
        return (
          <Link
            key={ev.id}
            href={`/events/${slug}`}
            className="press-haptic relative flex gap-3.5 rounded-2xl border border-[rgba(245,185,66,0.34)] bg-[var(--v4-surface-elevated)] p-4 overflow-hidden hover:border-[rgba(245,185,66,0.5)] transition-colors"
          >
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--v4-match)]"/>
            <div className="w-20 aspect-square rounded-xl overflow-hidden bg-[var(--v4-surface)] border border-[var(--v4-hairline-1)] flex-shrink-0 relative">
              {ev.image_url ? (
                <Image src={ev.image_url} alt={ev.title} fill sizes="80px" style={{ objectFit: 'cover' }}/>
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--v4-ink-30)] text-center px-1">{ev.title.slice(0, 24)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[var(--v4-ink)] leading-tight tracking-[-0.015em]">
                <span className="text-[var(--v4-match)]">{ev.matched_artist}</span>
                <span className="text-[var(--v4-ink-70)] font-medium"> {isFestival ? 'im Line-up bei' : 'spielt bei'}</span>{' '}
                {ev.title}
              </p>
              <p className="text-[12px] text-[var(--v4-ink-50)] mt-1">
                {formatDate(ev.start_date)}
                {ev.location_name && ` · ${ev.location_name}`}
                {ev.bundesland && ` · ${ev.bundesland}`}
              </p>
              {ev.ticket_url && ev.price_text && (
                <span className="inline-flex items-center gap-1 mt-2 text-[11.5px] font-semibold text-[var(--v4-ticket)]">
                  Ticket ab {ev.price_text}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
