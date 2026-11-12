'use client';

/**
 * Inhalt des Künstlerblatts, geteilt vom Sheet auf /artists und der Seite
 * /kuenstler/[slug]: Porträt, Name, Spielart, Folgen, alle Termine in
 * Österreich mit Link zur Event-Seite und Ticketlink (Eventim-Affiliate,
 * `data-track="ticket_click"` wie die TicketBox), Künstler derselben
 * Spielart, Quellenzeile.
 *
 * `onOpen` öffnet verwandte Künstler im Sheet; ohne `onOpen` sind sie
 * Links auf ihre Seiten (Künstlerseite).
 */

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { formatEventDate } from '@/lib/utils/event-time';
import { genreLabel } from '@/lib/artists/genre-labels';
import { programTitle, type DirectoryArtist } from '@/lib/artists/directory';
import { ArtistAvatar, FollowButton, dayLabel, venueLabel } from './artist-ui';
import { DE_LOCALE } from '@/lib/site/intl';

export const artistHref = (artist: Pick<DirectoryArtist, 'slug'>) => `/kuenstler/${artist.slug}`;

export function ArtistProfile({ artist, related, followed, signedIn, onToggle, onOpen, page = false }: {
  artist: DirectoryArtist;
  related: DirectoryArtist[];
  followed: boolean;
  signedIn: boolean;
  onToggle: (artist: DirectoryArtist) => void;
  onOpen?: (artist: DirectoryArtist) => void;
  /** Als Seite: H1 statt H2, größeres Porträt, Link zur Seite entfällt. */
  page?: boolean;
}) {
  const t = useTranslations('Artists');
  const locale = useLocale();
  const intl = locale === 'de' ? DE_LOCALE : 'en-GB';
  const count = artist.events.length;
  const Heading = page ? 'h1' : 'h2';
  const ticketHref = (eventTicket: string | null | undefined) => eventTicket || artist.evoLink || null;

  return (
    <>
      <div className={`flex items-center gap-4 ${page ? 'mb-5' : 'mr-10 mb-4'}`}>
        <ArtistAvatar artist={artist} size={page ? 112 : 72} className={page ? 'text-[40px] md:!h-[140px] md:!w-[140px]' : 'text-[26px]'} />
        <div className="min-w-0 flex-1">
          <Heading id="artist-sheet-title" className={`m-0 font-extrabold tracking-[-0.03em] leading-[1.1] text-[var(--v4-ink)] ${page ? 'text-[30px] md:text-[40px]' : 'text-[24px]'}`}>
            {artist.name}
          </Heading>
          <p className="m-0 mt-1 text-[13px] text-[var(--v4-ink-50)]">
            {`${genreLabel(artist.genre, artist.kind, locale)}, ${count === 0 ? t('sheetNoDates') : count === 1 ? t('sheetDateOne') : t('sheetDates', { count })}`}
          </p>
        </div>
      </div>
      <div className="mb-4 flex items-center gap-3">
        <FollowButton name={artist.name} followed={followed} signedIn={signedIn} onToggle={() => onToggle(artist)} large />
        {!page && (
          <Link href={artistHref(artist)} className="text-[13px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]" data-track="artist_page" data-track-id={artist.id}>
            {t('pageOpen')} ›
          </Link>
        )}
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
          <div className={`grid gap-2.5 ${page ? 'grid-cols-3 md:grid-cols-6' : 'grid-cols-4'}`}>
            {related.map(r => {
              const inner = (
                <>
                  <ArtistAvatar artist={r} size={56} className="text-[20px]" />
                  <span className="block w-full truncate text-[12.5px] font-bold leading-tight text-[var(--v4-ink)]">{r.name}</span>
                  <span suppressHydrationWarning className="block text-[11px] text-[var(--v4-ink-50)]">{r.events[0] ? dayLabel(r.events[0].start_date, locale, t) : ''}</span>
                </>
              );
              const cls = 'press-haptic flex min-w-0 flex-col items-center gap-1.5 text-center';
              return onOpen ? (
                <button key={r.id} type="button" onClick={() => onOpen(r)} aria-label={t('open', { name: r.name })} className={cls}>{inner}</button>
              ) : (
                <Link key={r.id} href={artistHref(r)} aria-label={t('open', { name: r.name })} className={cls}>{inner}</Link>
              );
            })}
          </div>
        </div>
      )}

      <p className="m-0 mt-6 text-[12px] leading-[1.5] text-[var(--v4-ink-50)]">{t('source')}</p>
    </>
  );
}
