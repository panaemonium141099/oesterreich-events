'use client';

/**
 * Plakatwand: die Seite /artists (Variante B der Mockups in
 * docs/design/kuenstler-redesign, Entscheidung 2026-11-02).
 *
 * Das Verzeichnis (Künstler aus dem Eventim-Feed mit Termin in Österreich,
 * get-artists-directory.ts) steht im statischen HTML und ist für alle
 * gleich. Diese Insel macht daraus Regale (planArtistShelves), das
 * Verzeichnis von A bis Z, die Suche und das Künstlerblatt; eingeloggt kommt
 * die Reihe „Deine Künstler“ dazu.
 *
 * Personalisierung nur mit sb-*-auth-token-Cookie (wie ArtistsLive auf der
 * Startseite): dann `/api/artists/following`, sonst kein Request, und die
 * Folgen-Knöpfe führen zum Login. Folgen und Entfolgen laufen optimistisch
 * über POST bzw. DELETE `/api/artists/follow` und rollen bei Nicht-2xx
 * zurück. Die Suche läuft zuerst im Verzeichnis (sofort, ohne Request);
 * ohne Treffer und eingeloggt sucht ein Knopf bei Spotify
 * (`/api/artists/search`, Spotify-Link über `/api/artists/by-url`), damit
 * man auch Künstlern ohne Termin folgen kann.
 */

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Shelf } from '@/components/Discover/v4/shelf-ui';
import { normalizeArtistName } from '@/lib/artists/normalize-name';
import {
  alphabetical,
  artistSlug,
  letterOf,
  planArtistShelves,
  relatedArtists,
  searchDirectory,
  type ArtistShelf,
  type DirectoryArtist,
} from '@/lib/artists/directory';
import { ArtistSheet } from './ArtistSheet';
import { ArtistAvatar, ArtistCard, ArtistRow, FollowButton, LOGIN_HREF, dayLabel } from './artist-ui';
import { TOAST_CLASS, useFollowed, type FollowedArtist } from './use-followed';

interface SpotifyArtist {
  id: string;
  name: string;
  image_url: string | null;
  genres?: string[] | null;
}

const SHELF_TITLE: Record<ArtistShelf['key'], string> = {
  week: 'shelfWeek',
  tour: 'shelfTour',
  konzert: 'shelfKonzert',
  kabarett: 'shelfKabarett',
  buehne: 'shelfBuehne',
  klassik: 'shelfKlassik',
  sonstiges: 'shelfKonzert',
};

const LETTERS = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const SPOTIFY_LINK = /open\.spotify\.com\/|^spotify:/i;

/** Ein gefolgter Künstler ohne Termin im Verzeichnis, damit Reihe und Blatt ihn zeigen können. */
function followedOnly(f: FollowedArtist): DirectoryArtist {
  return { id: `followed:${f.id}`, name: f.artist_name, slug: artistSlug(f.artist_name), image: f.spotify_image_url, evoLink: null, kind: 'sonstiges', genre: null, events: [] };
}

export function ArtistsWall({ artists, today }: { artists: DirectoryArtist[]; today: string }) {
  const t = useTranslations('Artists');
  const locale = useLocale();

  const { signedIn, followed, isFollowed, toggle, toast } = useFollowed();
  const [open, setOpen] = useState<DirectoryArtist | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [spotify, setSpotify] = useState<{ state: 'idle' | 'searching' | 'done' | 'error'; results: SpotifyArtist[] }>({ state: 'idle', results: [] });

  const byName = useMemo(() => new Map(artists.map(a => [normalizeArtistName(a.name), a])), [artists]);
  const shelves = useMemo(() => planArtistShelves(artists, today), [artists, today]);
  const sorted = useMemo(() => alphabetical(artists), [artists]);
  const letters = useMemo(() => new Set(sorted.map(a => letterOf(a.name))), [sorted]);
  const directory = letter ? sorted.filter(a => letterOf(a.name) === letter) : sorted;
  const localHits = useMemo(() => searchDirectory(artists, query), [artists, query]);

  const toggleArtist = useCallback((a: DirectoryArtist) => { void toggle(a.name, a.image); }, [toggle]);
  const openArtist = useCallback((a: DirectoryArtist) => setOpen(a), []);
  const closeSheet = useCallback(() => setOpen(null), []);

  async function searchSpotify() {
    const q = query.trim();
    if (!q || !signedIn) return;
    setSpotify({ state: 'searching', results: [] });
    try {
      const res = SPOTIFY_LINK.test(q)
        ? await fetch('/api/artists/by-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ url: q }) })
        : await fetch(`/api/artists/search?q=${encodeURIComponent(q)}&limit=6`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { artists?: SpotifyArtist[]; artist?: SpotifyArtist };
      setSpotify({ state: 'done', results: data.artists ?? (data.artist ? [data.artist] : []) });
    } catch {
      setSpotify({ state: 'error', results: [] });
    }
  }

  // Deine Künstler: gefolgte mit ihrem Termin aus dem Verzeichnis, Termine zuerst.
  const mine = useMemo(() => {
    const list = [...followed.values()].map(f => byName.get(normalizeArtistName(f.artist_name)) ?? followedOnly(f));
    return list.sort((a, b) => {
      const ad = a.events[0]?.start_date ?? '9';
      const bd = b.events[0]?.start_date ?? '9';
      return ad.localeCompare(bd) || a.name.localeCompare(b.name, 'de');
    });
  }, [followed, byName]);
  const weekEnd = useMemo(() => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString(); }, [today]);

  const searching = query.trim().length >= 2;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 md:px-14">
      <header className="grid items-end gap-3.5 pt-6 pb-3.5 md:grid-cols-[1fr_auto] md:gap-x-10 md:pt-7">
        <div>
          <h1 className="m-0 text-[32px] font-extrabold tracking-[-0.04em] leading-none text-[var(--v4-ink)] md:text-[40px]">{t('title')}</h1>
          <p className="m-0 mt-2 text-[14px] text-[var(--v4-ink-50)]">{artists.length > 0 ? t('sub', { count: artists.length }) : t('subEmpty')}</p>
        </div>
        <div className="relative w-full md:w-[400px]">
          <label htmlFor="artist-search" className="sr-only">{t('searchLabel')}</label>
          <input
            id="artist-search"
            type="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setSpotify({ state: 'idle', results: [] }); }}
            onKeyDown={e => { if (e.key === 'Enter' && localHits.length === 0) void searchSpotify(); }}
            placeholder={t('searchPlaceholder')}
            autoComplete="off"
            className="h-[46px] w-full rounded-full border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] px-5 text-[15px] text-[var(--v4-ink)] placeholder:text-[var(--v4-ink-50)] focus:border-[var(--v4-hairline-4)] focus:outline-none"
          />
          {searching && (
            <div className="absolute inset-x-0 top-[52px] z-20 overflow-hidden rounded-[14px] border border-[var(--v4-hairline-3)] bg-[var(--v4-surface-elevated)] shadow-xl" data-testid="artist-search-results">
              {localHits.length > 0 ? (
                <div className="px-3">
                  {localHits.map(a => (
                    <ArtistRow key={a.id} artist={a} followed={isFollowed(a.name)} signedIn={signedIn} onOpen={a2 => { setOpen(a2); }} onToggle={toggleArtist} />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-[13px] text-[var(--v4-ink-70)]">
                  <p className="m-0">{t('searchNoHit')}</p>
                  {signedIn ? (
                    <>
                      <p className="m-0 mt-1 text-[12.5px] text-[var(--v4-ink-50)]">{t('searchSpotifyHint')}</p>
                      {spotify.state === 'idle' && (
                        <button type="button" onClick={() => void searchSpotify()} className="press-haptic mt-2.5 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-[#0a0a0c]">
                          {t('searchSpotify')}
                        </button>
                      )}
                      {spotify.state === 'searching' && <p className="m-0 mt-2 animate-pulse text-[12.5px]">{t('searchSearching')}</p>}
                      {spotify.state === 'error' && <p className="m-0 mt-2 text-[12.5px] text-[var(--v4-alert)]">{t('searchError')}</p>}
                      {spotify.state === 'done' && spotify.results.length === 0 && <p className="m-0 mt-2 text-[12.5px]">{t('searchSpotifyEmpty')}</p>}
                      {spotify.results.length > 0 && (
                        <div className="mt-2 border-t border-[var(--v4-hairline-2)]">
                          {spotify.results.map(s => (
                            <div key={s.id} className="grid grid-cols-[40px_minmax(0,1fr)_88px] items-center gap-3 py-2 border-t border-[var(--v4-hairline-1)] first:border-t-0">
                              <ArtistAvatar artist={{ name: s.name, image: s.image_url }} size={40} />
                              <span className="min-w-0">
                                <span className="block truncate text-[14px] font-bold text-[var(--v4-ink)]">{s.name}</span>
                                <span className="block truncate text-[12px] text-[var(--v4-ink-50)]">{(s.genres ?? []).slice(0, 2).join(', ') || t('mineNoDate')}</span>
                              </span>
                              <FollowButton name={s.name} followed={isFollowed(s.name)} signedIn={signedIn} onToggle={() => void toggle(s.name, s.image_url, s.id)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Link href={LOGIN_HREF} className="mt-1.5 inline-block text-[13px] font-bold text-[var(--v4-ink)]">{t('searchSignIn')}</Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {signedIn && (
        <section aria-labelledby="mine-title" className="mt-4 border-y border-[var(--v4-hairline-2)] py-4" data-testid="artists-mine">
          <div className="mb-3 flex items-baseline gap-2.5">
            <h2 id="mine-title" className="m-0 text-[19px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{t('mineTitle')}</h2>
            {mine.length > 0 && (
              <span className="hidden text-[13px] text-[var(--v4-ink-50)] md:inline">
                {t('mineCount', { withDates: mine.filter(a => a.events.length > 0).length, total: mine.length })}
              </span>
            )}
            <Link href="/settings/notifications" className="ml-auto text-[13px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]">{t('mineNotifications')}</Link>
          </div>
          {mine.length === 0 ? (
            <p className="m-0 text-[14px] leading-[1.5] text-[var(--v4-ink-70)]">{t('mineEmpty')}</p>
          ) : (
            <div className="thin-scroll flex gap-4 overflow-x-auto pb-1">
              {mine.map(a => {
                const next = a.events[0];
                const soon = !!next && next.start_date < weekEnd;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setOpen(a)}
                    aria-label={t('open', { name: a.name })}
                    className="press-haptic flex w-[92px] shrink-0 flex-col items-center gap-1.5 text-center"
                  >
                    <ArtistAvatar artist={a} size={64} className="text-[22px]" />
                    <span className="block w-full truncate text-[12.5px] font-bold leading-tight text-[var(--v4-ink)]">{a.name}</span>
                    <span suppressHydrationWarning className={`block w-full truncate text-[11.5px] ${soon ? 'font-bold text-[var(--v4-match)]' : 'text-[var(--v4-ink-50)]'}`}>
                      {next ? dayLabel(next.start_date, locale, t) : t('mineNoDate')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {shelves.map(shelf => (
        <Shelf
          key={shelf.key}
          title={t(SHELF_TITLE[shelf.key])}
          sub={shelf.key === 'tour' ? t('shelfTourSub') : t('shelfByDate')}
        >
          {shelf.artists.map(a => (
            <ArtistCard key={a.id} artist={a} followed={isFollowed(a.name)} signedIn={signedIn} onOpen={openArtist} onToggle={toggleArtist} />
          ))}
        </Shelf>
      ))}

      {sorted.length > 0 && (
        <section aria-labelledby="directory-title" className="mt-10 border-t border-[var(--v4-hairline-2)] pt-5">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 id="directory-title" className="m-0 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{t('directoryTitle')}</h2>
            <span className="hidden text-[13.5px] text-[var(--v4-ink-50)] md:inline">{t('directorySub')}</span>
          </div>
          <div role="group" aria-label={t('directoryLetters')} className="mb-3.5 flex flex-wrap gap-0.5">
            <button
              type="button"
              onClick={() => setLetter(null)}
              aria-pressed={letter === null}
              className={`h-7 rounded-md px-2 text-[12.5px] font-bold ${letter === null ? 'bg-white text-[#0a0a0c]' : 'text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]'}`}
            >
              {t('directoryAll')}
            </button>
            {LETTERS.map(l => (
              <button
                key={l}
                type="button"
                disabled={!letters.has(l)}
                onClick={() => setLetter(l)}
                aria-pressed={letter === l}
                className={`grid h-7 w-7 place-items-center rounded-md text-[12.5px] font-bold disabled:text-[var(--v4-ink-30)] ${letter === l ? 'bg-white text-[#0a0a0c]' : 'text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2 lg:grid-cols-3">
            {directory.map(a => (
              <ArtistRow key={a.id} artist={a} followed={isFollowed(a.name)} signedIn={signedIn} onOpen={openArtist} onToggle={toggleArtist} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-[12px] text-[var(--v4-ink-50)]">{t('source')}</p>

      {open && (
        <ArtistSheet
          artist={open}
          related={relatedArtists(artists, open)}
          followed={isFollowed(open.name)}
          signedIn={signedIn}
          onToggle={toggleArtist}
          onOpen={openArtist}
          onClose={closeSheet}
        />
      )}

      <div role="status" aria-live="polite" className={`${TOAST_CLASS} ${toast ? 'opacity-100' : 'translate-y-3 opacity-0'}`}>
        {toast}
      </div>
    </div>
  );
}
