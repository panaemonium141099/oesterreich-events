'use client';

/**
 * Künstlerblatt (Plakatwand, 2026-11): Porträt, Name, Spielart, Folgen,
 * alle Termine in Österreich mit Link zur Event-Seite und Ticketlink
 * (Eventim-Affiliate, `data-track="ticket_click"` wie die TicketBox),
 * darunter Künstler derselben Spielart, Quellenzeile.
 *
 * Am Desktop ein Panel am rechten Rand, am Handy ein Sheet von unten.
 * Per Portal an <body>: innerhalb der Seite läge ein fixed-Overlay unter
 * V4TopNav und V4TabBar (Stacking-Context durch view-transition-name,
 * Mobile-Audit 2026-10-22). Escape schließt, Fokus geht auf den
 * Schließen-Knopf, der Seitenscroll steht still.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatEventDate } from '@/lib/utils/event-time';
import { genreLabel } from '@/lib/artists/genre-labels';
import { programTitle, type DirectoryArtist } from '@/lib/artists/directory';
import { ArtistAvatar, FollowButton, dayLabel, venueLabel } from './artist-ui';

export function ArtistSheet({ artist, related, followed, signedIn, onToggle, onOpen, onClose }: {
  artist: DirectoryArtist;
  related: DirectoryArtist[];
  followed: boolean;
  signedIn: boolean;
  onToggle: (artist: DirectoryArtist) => void;
  onOpen: (artist: DirectoryArtist) => void;
  onClose: () => void;
}) {
  const t = useTranslations('Artists');
  const locale = useLocale();
  const intl = locale === 'de' ? 'de-AT' : 'en-GB';
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const count = artist.events.length;
  const ticketHref = (eventTicket: string | null | undefined) => eventTicket || artist.evoLink || null;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="artist-sheet-title"
        className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[18px] border-t border-[var(--v4-hairline-3)] bg-[var(--v4-surface)] px-4 pt-5 pb-24 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[520px] md:rounded-none md:border-t-0 md:border-l md:px-7 md:pt-7 md:pb-10"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="absolute right-3.5 top-3 grid h-[34px] w-[34px] place-items-center rounded-full border border-[var(--v4-hairline-3)] text-[20px] leading-none text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
        >
          ×
        </button>

        <div className="mr-10 mb-4 flex items-center gap-4">
          <ArtistAvatar artist={artist} size={72} className="text-[26px]" />
          <div className="min-w-0 flex-1">
            <h2 id="artist-sheet-title" className="m-0 text-[24px] font-extrabold tracking-[-0.03em] leading-[1.1] text-[var(--v4-ink)]">{artist.name}</h2>
            <p className="m-0 mt-1 text-[13px] text-[var(--v4-ink-50)]">
              {`${genreLabel(artist.genre, artist.kind, locale)}, ${count === 0 ? t('sheetNoDates') : count === 1 ? t('sheetDateOne') : t('sheetDates', { count })}`}
            </p>
          </div>
        </div>
        <div className="mb-4">
          <FollowButton name={artist.name} followed={followed} signedIn={signedIn} onToggle={() => onToggle(artist)} large />
        </div>

        {count > 0 ? (
          <ul className="m-0 list-none border-t border-[var(--v4-hairline-2)] p-0">
            {artist.events.map(e => {
              const { time } = formatEventDate(e, intl);
              const program = programTitle(artist, e);
              const venue = venueLabel(e, locale);
              const tickets = ticketHref(e.ticket_url);
              return (
                <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--v4-hairline-2)] py-2.5">
                  <Link href={buildEventUrlV2(e)} className="press-haptic grid min-w-0 grid-cols-[56px_minmax(0,1fr)] items-center gap-3" data-track="artist_event" data-track-id={e.id}>
                    <span suppressHydrationWarning className="block text-[14px] font-extrabold tracking-[-0.01em] leading-tight text-[var(--v4-ink)]">
                      {dayLabel(e.start_date, locale, t)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--v4-ink)]">{program ?? venue}</span>
                      <span className="block truncate text-[12px] text-[var(--v4-ink-50)]">
                        {[time, program ? venue : (e.city ?? null)].filter(Boolean).join(', ')}
                      </span>
                    </span>
                  </Link>
                  {tickets ? (
                    <a
                      href={tickets}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      aria-label={t('ticketsAria', { title: e.title })}
                      data-track="ticket_click"
                      data-track-id={e.id}
                      data-track-provider="eventim"
                      className="press-haptic whitespace-nowrap rounded-full border border-[var(--v4-hairline-3)] px-3 py-[7px] text-[12.5px] font-bold text-[var(--v4-ink)] hover:border-[var(--v4-hairline-4)]"
                    >
                      {t('tickets')}
                    </a>
                  ) : <span />}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 border-y border-[var(--v4-hairline-2)] py-3.5 text-[14px] leading-[1.5] text-[var(--v4-ink-70)]">
            {t('sheetEmpty', { name: artist.name })}
          </p>
        )}

        {related.length > 0 && (
          <div className="mt-6">
            <h3 className="m-0 mb-2.5 text-[15px] font-extrabold tracking-[-0.02em] text-[var(--v4-ink)]">{t('related')}</h3>
            <div className="grid grid-cols-4 gap-2.5">
              {related.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onOpen(r)}
                  aria-label={t('open', { name: r.name })}
                  className="press-haptic flex min-w-0 flex-col items-center gap-1.5 text-center"
                >
                  <ArtistAvatar artist={r} size={56} className="text-[20px]" />
                  <span className="block w-full truncate text-[12.5px] font-bold leading-tight text-[var(--v4-ink)]">{r.name}</span>
                  <span suppressHydrationWarning className="block text-[11px] text-[var(--v4-ink-50)]">{r.events[0] ? dayLabel(r.events[0].start_date, locale, t) : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="m-0 mt-6 text-[12px] leading-[1.5] text-[var(--v4-ink-50)]">{t('source')}</p>
      </div>
    </div>,
    document.body,
  );
}
