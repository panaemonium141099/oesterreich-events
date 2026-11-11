'use client';

/**
 * ArtistsLive — Kachel „Diese Woche live" der Tagesausgabe (fn-30.4).
 *
 * Drei Feed-Künstler mit Termin in den nächsten sieben Tagen stehen im
 * statischen HTML (Rotation aus getLandingData). Nach dem Laden, und nur
 * wenn ein sb-*-auth-token-Cookie sichtbar ist, holt die Kachel
 * `/api/me/landing`: gefolgte Künstler mit Termin rücken nach vorn, rotierte
 * gefolgte werden als „Folgst du" markiert. Getauscht wird ohne
 * Höhensprung (gleiche Zeilenzahl, gleiche Zeilenhöhe).
 *
 * Knopf: anonym ein Link zum Login (`redirect=/`), eingeloggt POST bzw.
 * DELETE auf `/api/artists/follow` mit optimistischem Zustand und
 * Rückrollen bei Nicht-2xx. Die Beschriftung wechselt („Folgen"/„Folgst
 * du"), deshalb kein aria-pressed, dafür ein aria-label mit Namen. Fester
 * Platz je Zeile: Grid-Spalte 88 px, Ziel 30 px hoch.
 *
 * Hinweistext ohne Mail-Versprechen: dispatchMatchAlertEmails in
 * artist-matching.ts schickt nur mit RESEND_API_KEY und ausdrücklich
 * eingeschaltetem E-Mail-Kanal (channel_email, Standard aus).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Link as LocaleLink } from '@/i18n/navigation';
import { hasSupabaseAuthCookie } from '@/lib/ads/ads-allowed';
import { normalizeArtistName } from '@/lib/artists/normalize-name';
import { buildEventUrlV2 } from '@/lib/utils/slugify';
import { EVENT_TZ, addViennaDays, formatEventDate, parseEventDate, toViennaDate, viennaToday } from '@/lib/utils/event-time';
import { ARTISTS_LIVE_ROWS, mergeArtistsLive } from '@/lib/v4/followed-live';
import type { LandingArtistLive } from '@/lib/v4/landing-picks';
import type { Event } from '@/types/events';

interface MeLandingLive {
  signedIn: boolean;
  followedLive?: LandingArtistLive[];
  followedNames?: string[];
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** „Heute 20:00 · Gasometer", „Sa. 19:30 · Bad Ischl"; ohne Uhrzeit nur der Tag. */
export function artistWhenLabel(event: Event, locale: string, t: Translate, now: Date = new Date()): string {
  const d = parseEventDate(event.start_date);
  if (!d) return event.location_name ?? '';
  const intl = locale === 'de' ? 'de-AT' : 'en-GB';
  const day = toViennaDate(d);
  const today = viennaToday(now);
  const dayLabel = day === today
    ? t('today')
    : day === addViennaDays(today, 1)
      ? t('tomorrow')
      : d.toLocaleDateString(intl, { weekday: 'short', timeZone: EVENT_TZ });
  const { time } = formatEventDate(event, intl);
  const when = time ? `${dayLabel} ${time}` : dayLabel;
  return event.location_name ? `${when} · ${event.location_name}` : when;
}

const BUTTON_CLASS = 'press-haptic inline-flex h-[30px] w-[88px] min-w-[88px] items-center justify-center whitespace-nowrap rounded-full border text-[12px] font-bold transition-colors';
const BUTTON_IDLE = 'border-[var(--v4-hairline-4)] text-[var(--v4-ink)] hover:bg-[var(--v4-hairline-1)]';
const BUTTON_ON = 'border-[var(--v4-match)] bg-[var(--v4-match)] text-[#0a0a0c]';

export function ArtistsLive({ artists }: { artists: LandingArtistLive[] }) {
  const t = useTranslations('Landing.ArtistsLive');
  const locale = useLocale();
  const [rows, setRows] = useState<LandingArtistLive[]>(() => artists.slice(0, ARTISTS_LIVE_ROWS));
  const [signedIn, setSignedIn] = useState(false);
  const [followed, setFollowed] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseAuthCookie()) return; // anonym: Rotation bleibt, 0 Requests

    const controller = new AbortController();
    fetch('/api/me/landing', { signal: controller.signal, credentials: 'same-origin' })
      .then(r => (r.ok ? (r.json() as Promise<MeLandingLive>) : null))
      .then(data => {
        if (!data?.signedIn) return;
        setFollowed(new Set((data.followedNames ?? []).map(normalizeArtistName)));
        setRows(mergeArtistsLive(data.followedLive ?? [], artists));
        setSignedIn(true);
      })
      .catch(() => {
        // Personalisierung ist Kür: bei Fehlern bleibt die Rotation stehen.
      });
    return () => controller.abort();
  }, [artists]);

  async function toggleFollow(artist: LandingArtistLive) {
    const key = normalizeArtistName(artist.name);
    const wasFollowed = followed.has(key);
    setNotice(null);
    // Optimistisch: der Zustand wechselt sofort, der Server-Roundtrip steht
    // nie zwischen Klick und Anzeige; bei Nicht-2xx rollt er zurück.
    setFollowed(prev => {
      const next = new Set(prev);
      if (wasFollowed) next.delete(key); else next.add(key);
      return next;
    });
    try {
      const res = await fetch('/api/artists/follow', {
        method: wasFollowed ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(
          wasFollowed
            ? { artist_name: artist.name }
            : { artist_name: artist.name, spotify_image_url: artist.image ?? undefined, source: 'manual' },
        ),
      });
      // 404 beim Entfolgen heißt: war schon nicht mehr gefolgt, Zustand stimmt.
      if (!res.ok && !(wasFollowed && res.status === 404)) throw new Error(String(res.status));
    } catch {
      setFollowed(prev => {
        const next = new Set(prev);
        if (wasFollowed) next.add(key); else next.delete(key);
        return next;
      });
      setNotice(t('error'));
    }
  }

  if (rows.length === 0) return null;

  return (
    <section
      className="flex h-full flex-col rounded-3xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] px-4 pt-4 pb-3 md:px-5 md:pt-5"
      aria-labelledby="artists-live-title"
      data-testid="artists-live"
    >
      <div className="mb-1.5 flex items-baseline gap-2">
        <h2 id="artists-live-title" className="text-[15px] font-extrabold tracking-[-0.02em] text-[var(--v4-ink)]">
          {t('title')}
        </h2>
        <LocaleLink
          href="/artists"
          className="ml-auto text-[12px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]"
          data-track="landing_artists_all"
        >
          {t('all')} ›
        </LocaleLink>
      </div>

      <ul className="flex flex-1 flex-col justify-evenly">
        {rows.map(artist => {
          const isFollowed = signedIn && followed.has(normalizeArtistName(artist.name));
          return (
            <li
              key={artist.artistId}
              className="grid h-[48px] grid-cols-[36px_minmax(0,1fr)_88px] items-center gap-2.5 border-t border-[var(--v4-hairline-1)] first:border-t-0"
            >
              <span
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--v4-hairline-2)] bg-[var(--v4-surface)] text-[13px] font-bold text-[var(--v4-ink-70)]"
                aria-hidden="true"
              >
                {artist.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={artist.image} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover"/>
                ) : artist.name.charAt(0)}
              </span>
              <Link
                href={buildEventUrlV2(artist.event)}
                className="min-w-0"
                data-track="landing_artist_event"
                data-track-id={artist.event.id}
              >
                <span className="block truncate text-[13.5px] font-bold leading-tight text-[var(--v4-ink)]">{artist.name}</span>
                <span className="block truncate text-[11.5px] text-[var(--v4-ink-50)]" suppressHydrationWarning>
                  {artistWhenLabel(artist.event, locale, t)}
                </span>
              </Link>
              {signedIn ? (
                <button
                  type="button"
                  onClick={() => toggleFollow(artist)}
                  aria-label={isFollowed ? t('unfollowAria', { name: artist.name }) : t('followAria', { name: artist.name })}
                  className={`${BUTTON_CLASS} ${isFollowed ? BUTTON_ON : BUTTON_IDLE}`}
                  data-track="landing_artist_follow"
                  data-track-id={artist.name}
                >
                  {isFollowed ? t('following') : t('follow')}
                </button>
              ) : (
                <LocaleLink
                  href="/auth/login?redirect=/"
                  aria-label={t('followAria', { name: artist.name })}
                  className={`${BUTTON_CLASS} ${BUTTON_IDLE}`}
                  data-track="landing_artist_follow"
                  data-track-id={artist.name}
                >
                  {t('follow')}
                </LocaleLink>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-1.5 text-[11.5px] text-[var(--v4-ink-50)]" role="status">
        {notice ?? t('hint')}
      </p>
    </section>
  );
}
