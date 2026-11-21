/**
 * Künstler-Verzeichnis für die native App: Plakatwand und Künstlerblatt als
 * anzeigefertige Werte. Auswahl und Regale sind die der Website
 * (`src/lib/artists/directory.ts`: Häuser und Reihen bleiben draußen,
 * Regale Diese Woche live, Auf Tour, je Spielart, dazu A bis Z); hier
 * kommen nur Beschriftungen dazu (`labels.ts`, `genre-labels.ts`).
 *
 * Pur: keine Abfragen. Die Liste ist bewusst schlank (ein Termin je
 * Künstler), alle Termine liefert erst das Blatt.
 */
import {
  alphabetical,
  artistBySlug,
  letterOf,
  planArtistShelves,
  programTitle,
  relatedArtists,
  type ArtistShelf,
  type DirectoryArtist,
  type DirectoryEvent,
} from '@/lib/artists/directory';
import { genreLabel } from '@/lib/artists/genre-labels';
import { placeLabel, venueLabel } from '@/lib/artists/labels';
import { normalizeArtistName } from '@/lib/artists/normalize-name';
import { shortViennaDay } from '@/lib/landing/day-labels';
import { DE_LOCALE } from '@/lib/site/intl';
import { decodeEntities } from '@/lib/utils/decode-entities';
import { formatEventDate, toViennaDate } from '@/lib/utils/event-time';
import type { AppTranslate } from './landing';

export const APP_ARTISTS_VERSION = 1;

export interface AppArtistsContext {
  /** Übersetzer über alle Namespaces (`t('Artists.shelfWeek')`). */
  t: AppTranslate;
  locale: 'de';
  origin: string;
}

export interface AppArtist {
  id: string;
  name: string;
  slug: string;
  /** Schlüssel des Folgen-Abgleichs: gleich `followed_artists.artist_name_normalized`. */
  key: string;
  image: string | null;
  /** „Kabarett", „Rock", „Konzerte". */
  genreLabel: string;
  /** Anfangsbuchstabe im Verzeichnis, „#" für Ziffern und Rest. */
  letter: string;
  /** Zahl der kommenden Termine in Österreich. */
  dates: number;
  /** Nächster Termin; „Heute" und „Morgen" setzt die App aus `day`. */
  next: { startsAt: string; day: string; dayShort: string; place: string } | null;
}

export interface AppArtistShelf {
  key: ArtistShelf['key'];
  title: string;
  sub: string;
  /** IDs aus `artists`, in Regal-Reihenfolge. */
  ids: string[];
}

export interface AppArtistsDirectory {
  version: typeof APP_ARTISTS_VERSION;
  /** Wiener Tag, an dem das Verzeichnis gebaut wurde. */
  today: string;
  /** „1.234 Künstler mit Terminen in Österreich in den nächsten drei Monaten". */
  sub: string;
  shelves: AppArtistShelf[];
  /** Alle Künstler von A bis Z. */
  artists: AppArtist[];
}

export interface AppArtistEvent {
  id: string;
  startsAt: string;
  day: string;
  dayShort: string;
  /** Programmtitel, sonst Saal und Ort. */
  title: string;
  /** Uhrzeit und Saal bzw. Ort. */
  sub: string;
  /** Ticketlink des Termins, sonst der Künstlerseite bei oeticket. */
  ticketUrl: string | null;
}

export interface AppArtistDetail {
  version: typeof APP_ARTISTS_VERSION;
  artist: AppArtist;
  /** „Kabarett, 5 Termine in Österreich". */
  summary: string;
  /** Adresse der Künstlerseite auf der Website, zum Teilen. */
  url: string;
  events: AppArtistEvent[];
  related: AppArtist[];
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

function dayOf(event: DirectoryEvent): string {
  return toViennaDate(new Date(event.start_date));
}

export function toAppArtist(artist: DirectoryArtist, ctx: AppArtistsContext): AppArtist {
  const next = artist.events[0];
  const day = next ? dayOf(next) : '';
  return {
    id: artist.id,
    name: artist.name,
    slug: artist.slug,
    key: normalizeArtistName(artist.name),
    image: artist.image,
    genreLabel: genreLabel(artist.genre, artist.kind, ctx.locale),
    letter: letterOf(artist.name),
    dates: artist.events.length,
    next: next
      ? {
          startsAt: next.start_date,
          day,
          dayShort: shortViennaDay(day, ctx.locale),
          place: decodeEntities(placeLabel(next, ctx.locale)),
        }
      : null,
  };
}

export function toAppArtistsDirectory(
  artists: DirectoryArtist[],
  today: string,
  ctx: AppArtistsContext,
): AppArtistsDirectory {
  const t = (key: string, values?: Record<string, string | number>) => ctx.t(`Artists.${key}`, values);
  return {
    version: APP_ARTISTS_VERSION,
    today,
    sub: artists.length > 0 ? t('sub', { count: artists.length }) : t('subEmpty'),
    shelves: planArtistShelves(artists, today).map(shelf => ({
      key: shelf.key,
      title: t(SHELF_TITLE[shelf.key]),
      sub: shelf.key === 'tour' ? t('shelfTourSub') : t('shelfByDate'),
      ids: shelf.artists.map(a => a.id),
    })),
    artists: alphabetical(artists).map(a => toAppArtist(a, ctx)),
  };
}

/** Das Künstlerblatt zu einem Slug; null, wenn niemand im Verzeichnis so heißt. */
export function toAppArtistDetail(
  artists: DirectoryArtist[],
  slug: string,
  ctx: AppArtistsContext,
): AppArtistDetail | null {
  const artist = artistBySlug(artists, slug);
  if (!artist) return null;
  const t = (key: string, values?: Record<string, string | number>) => ctx.t(`Artists.${key}`, values);
  const count = artist.events.length;
  const dates = count === 0 ? t('sheetNoDates') : count === 1 ? t('sheetDateOne') : t('sheetDates', { count });

  return {
    version: APP_ARTISTS_VERSION,
    artist: toAppArtist(artist, ctx),
    summary: `${genreLabel(artist.genre, artist.kind, ctx.locale)}, ${dates}`,
    url: `${ctx.origin}/kuenstler/${artist.slug}`,
    events: artist.events.map(event => {
      const day = dayOf(event);
      const program = programTitle(artist, event);
      const venue = venueLabel(event, ctx.locale);
      const { time } = formatEventDate(event, DE_LOCALE);
      return {
        id: event.id,
        startsAt: event.start_date,
        day,
        dayShort: shortViennaDay(day, ctx.locale),
        title: decodeEntities(program ?? venue),
        sub: decodeEntities([time, program ? venue : (event.city ?? null)].filter(Boolean).join(', ')),
        ticketUrl: event.ticket_url || artist.evoLink || null,
      };
    }),
    related: relatedArtists(artists, artist).map(a => toAppArtist(a, ctx)),
  };
}
