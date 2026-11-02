'use client';

/**
 * Bausteine der Plakatwand (/artists, 2026-11): Porträt, Folgen-Knopf,
 * Poster-Karte fürs Regal, Zeile fürs Verzeichnis. Der Folgen-Knopf hat
 * überall dieselbe Größe und Stelle (88 × 30 px rechts, amber wenn aktiv,
 * wie die Kachel „Diese Woche live“ auf der Startseite); anonym ist er ein
 * Link zum Login.
 *
 * Bilder sind oeticket-Porträts (222 px) und Spotify-Bilder (i.scdn.co,
 * nicht in den remotePatterns), deshalb plain <img> wie in ArtistsLive.
 */

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { genreLabel } from '@/lib/artists/genre-labels';
import type { DirectoryArtist, DirectoryEvent } from '@/lib/artists/directory';
import { EVENT_TZ, addViennaDays, toViennaDate, viennaToday } from '@/lib/utils/event-time';

export const LOGIN_HREF = '/auth/login?redirect=/artists';

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** „Di 3. Nov.“ (de) bzw. „Tue 3 Nov“ (en); heute und morgen in Worten. */
export function dayLabel(iso: string, locale: string, t: Translate, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = toViennaDate(d);
  const today = viennaToday(now);
  if (day === today) return t('today');
  if (day === addViennaDays(today, 1)) return t('tomorrow');
  const fmt = locale === 'de' ? 'de-AT' : 'en-GB';
  const parts = new Intl.DateTimeFormat(fmt, { weekday: 'short', day: 'numeric', month: 'short', timeZone: EVENT_TZ }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const weekday = get('weekday').replace(/\.$/, '');
  return locale === 'de' ? `${weekday} ${get('day')}. ${get('month')}` : `${weekday} ${get('day')} ${get('month')}`;
}

/** Ort einer Karte: Post-Ort, sonst Bundesland, sonst Saal. */
export function placeLabel(e: DirectoryEvent, locale: string): string {
  if (e.city) return e.city;
  if (e.bundesland) return bundeslandDisplayName(e.bundesland, locale);
  return e.location_name ?? '';
}

/** Saal und Ort fürs Blatt: „Orpheum Wien, Wien“ wird „Orpheum Wien“. */
export function venueLabel(e: DirectoryEvent, locale: string): string {
  const venue = (e.location_name ?? '').trim();
  const place = placeLabel(e, locale);
  if (!venue) return place;
  if (!place || venue.toLowerCase().includes(place.toLowerCase())) return venue;
  return `${venue}, ${place}`;
}

export function ArtistAvatar({ artist, size, className = '' }: { artist: Pick<DirectoryArtist, 'name' | 'image'>; size: number; className?: string }) {
  const style = { width: size, height: size };
  return artist.image ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={artist.image}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={style}
      className={`shrink-0 rounded-full object-cover bg-[var(--v4-surface-inset)] ${className}`}
    />
  ) : (
    <span
      aria-hidden="true"
      style={style}
      className={`shrink-0 inline-flex items-center justify-center rounded-full border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-inset)] font-bold text-[var(--v4-ink-50)] ${className}`}
    >
      {artist.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

const BUTTON_CLASS = 'press-haptic inline-flex h-[30px] w-[88px] min-w-[88px] items-center justify-center whitespace-nowrap rounded-full border text-[12px] font-bold transition-colors';
const BUTTON_IDLE = 'border-[var(--v4-hairline-4)] text-[var(--v4-ink)] hover:bg-[var(--v4-hairline-1)]';
const BUTTON_ON = 'border-[var(--v4-match)] bg-[var(--v4-match)] text-[#0a0a0c]';

export function FollowButton({ name, followed, signedIn, onToggle, large = false }: {
  name: string;
  followed: boolean;
  signedIn: boolean;
  onToggle: () => void;
  /** Größerer Knopf im Blatt (110 × 38). */
  large?: boolean;
}) {
  const t = useTranslations('Artists');
  const size = large ? 'h-[38px] w-[110px] min-w-[110px] text-[13.5px]' : '';
  if (!signedIn) {
    return (
      <Link
        href={LOGIN_HREF}
        aria-label={t('followAria', { name })}
        className={`${BUTTON_CLASS} ${BUTTON_IDLE} ${size}`}
        data-track="artist_follow"
        data-track-id={name}
        onClick={e => e.stopPropagation()}
      >
        {t('follow')}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onToggle(); }}
      aria-label={followed ? t('unfollowAria', { name }) : t('followAria', { name })}
      className={`${BUTTON_CLASS} ${followed ? BUTTON_ON : BUTTON_IDLE} ${size}`}
      data-track="artist_follow"
      data-track-id={name}
    >
      {followed ? t('following') : t('follow')}
    </button>
  );
}

export interface ArtistItemProps {
  artist: DirectoryArtist;
  followed: boolean;
  signedIn: boolean;
  onOpen: (artist: DirectoryArtist) => void;
  onToggle: (artist: DirectoryArtist) => void;
}

/** Poster-Karte fürs Regal: Porträt, Name auf dem Bild, Terminzahl, darunter Datum, Ort und Folgen. */
export function ArtistCard({ artist, followed, signedIn, onOpen, onToggle }: ArtistItemProps) {
  const t = useTranslations('Artists');
  const locale = useLocale();
  const next = artist.events[0];
  const count = artist.events.length;
  return (
    <div className="shrink-0 snap-start w-[156px] md:w-[200px]">
      <button
        type="button"
        onClick={() => onOpen(artist)}
        aria-label={t('open', { name: artist.name })}
        data-track="artist_open"
        data-track-id={artist.id}
        className="press-haptic relative block w-full aspect-square rounded-[14px] overflow-hidden bg-[var(--v4-surface-inset)] text-left"
      >
        {artist.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={artist.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[48px] font-extrabold text-[var(--v4-ink-30)]">
            {artist.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050506]/95" />
        {count > 1 && (
          <span className={`absolute left-2.5 top-2.5 rounded-md px-[7px] py-1 text-[11.5px] font-extrabold ${followed ? 'bg-[var(--v4-match)] text-[#0a0a0c]' : 'bg-white text-[#0a0a0c]'}`}>
            {t('dates', { count })}
          </span>
        )}
        <span className="absolute left-3 right-3 bottom-2.5 text-white">
          <span className="block text-[16px] md:text-[19px] font-extrabold tracking-[-0.03em] leading-[1.05] line-clamp-2">{artist.name}</span>
          <span className="block mt-1 text-[12px] font-semibold text-white/70">{genreLabel(artist.genre, artist.kind, locale)}</span>
        </span>
      </button>
      <div className="mt-2.5 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_88px] items-center gap-2">
        <p suppressHydrationWarning className="m-0 text-[12.5px] text-[var(--v4-ink-50)] truncate">
          <span className="font-bold text-[var(--v4-ink)]">{dayLabel(next.start_date, locale, t)}</span>, {placeLabel(next, locale)}
        </p>
        <FollowButton name={artist.name} followed={followed} signedIn={signedIn} onToggle={() => onToggle(artist)} />
      </div>
    </div>
  );
}

/** Zeile fürs Verzeichnis und die Suche: Porträt, Name, nächster Termin, Folgen. */
export function ArtistRow({ artist, followed, signedIn, onOpen, onToggle, soon = false }: ArtistItemProps & { soon?: boolean }) {
  const t = useTranslations('Artists');
  const locale = useLocale();
  const next = artist.events[0];
  const more = artist.events.length - 1;
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_88px] items-center gap-3 py-2 border-t border-[var(--v4-hairline-1)] first:border-t-0">
      <ArtistAvatar artist={artist} size={40} />
      <button
        type="button"
        onClick={() => onOpen(artist)}
        aria-label={t('open', { name: artist.name })}
        data-track="artist_open"
        data-track-id={artist.id}
        className="press-haptic min-w-0 text-left"
      >
        <span className={`block truncate text-[14px] font-bold ${followed ? 'text-[var(--v4-match)]' : 'text-[var(--v4-ink)]'}`}>{artist.name}</span>
        <span suppressHydrationWarning className={`block truncate text-[12px] ${soon ? 'font-bold text-[var(--v4-match)]' : 'text-[var(--v4-ink-50)]'}`}>
          {next
            ? `${dayLabel(next.start_date, locale, t)}, ${placeLabel(next, locale)}${more > 0 ? `, +${more}` : ''}`
            : t('mineNoDate')}
        </span>
      </button>
      <FollowButton name={artist.name} followed={followed} signedIn={signedIn} onToggle={() => onToggle(artist)} />
    </div>
  );
}
