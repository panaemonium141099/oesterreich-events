/**
 * Beschriftungen der Künstlerseiten (Tag, Ort, Saal), pur: von der
 * Plakatwand (`src/components/Artists/v4/artist-ui.tsx`) und von der
 * App-API (`src/lib/app-api/artists.ts`) genutzt.
 */
import type { DirectoryEvent } from '@/lib/artists/directory';
import { bundeslandDisplayName } from '@/lib/i18n/bundesland-names';
import { DE_LOCALE } from '@/lib/site/intl';
import { EVENT_TZ, addViennaDays, toViennaDate, viennaToday } from '@/lib/utils/event-time';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** „Di 3. Nov.“ (de) bzw. „Tue 3 Nov“ (en); heute und morgen in Worten. */
export function dayLabel(iso: string, locale: string, t: Translate, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = toViennaDate(d);
  const today = viennaToday(now);
  if (day === today) return t('today');
  if (day === addViennaDays(today, 1)) return t('tomorrow');
  const fmt = locale === 'de' ? DE_LOCALE : 'en-GB';
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
