/**
 * Beschriftungen für Wiener Kalendertage (YYYY-MM-DD) auf der Startseite
 * (fn-30.6): „Fr 30. Okt." für Regal-Untertitel und Festival-Zeiträume,
 * „Donnerstag" für die Programmliste. Reine Kalenderrechnung ohne
 * Runtime-Zone: der Tag wird um 12:00 UTC getragen und in Wien formatiert.
 */

import { EVENT_TZ } from '@/lib/utils/event-time';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Gültiger Kalendertag für `/entdecken?von=&bis=`, sonst null. */
export function isoDayParam(value: string | null | undefined): string | null {
  if (!value || !ISO_DAY.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return value;
}

const intlFor = (locale: string) => (locale === 'de' ? 'de-AT' : 'en-GB');
const carrier = (day: string) => new Date(`${day}T12:00:00Z`);

/** „Fr 30. Okt." (de) bzw. „Fri 30 Oct" (en). */
export function shortViennaDay(day: string, locale: string): string {
  const parts = new Intl.DateTimeFormat(intlFor(locale), {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: EVENT_TZ,
  }).formatToParts(carrier(day));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const weekday = get('weekday').replace(/\.$/, '');
  return locale === 'de'
    ? `${weekday} ${get('day')}. ${get('month')}`
    : `${weekday} ${get('day')} ${get('month')}`;
}

/** „Donnerstag" (de) bzw. „Thursday" (en). */
export function weekdayLabel(day: string, locale: string): string {
  return carrier(day).toLocaleDateString(intlFor(locale), { weekday: 'long', timeZone: EVENT_TZ });
}

/** „30. Okt. 2026" (de) bzw. „30 Oct 2026" (en) für Blog-Daten. */
export function shortDateWithYear(day: string, locale: string): string {
  return carrier(day.slice(0, 10)).toLocaleDateString(intlFor(locale), {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: EVENT_TZ,
  });
}

/**
 * Zeitraum eines Festivals: „Fr 5. Jun. bis So 7. Jun."; ein Tag steht
 * allein, ohne Beginn bleibt die Angabe leer.
 */
export function dayRangeLabel(
  from: string | null | undefined,
  to: string | null | undefined,
  locale: string,
  join: (from: string, to: string) => string,
): string {
  const f = isoDayParam(from?.slice(0, 10));
  if (!f) return '';
  const t = isoDayParam(to?.slice(0, 10));
  if (!t || t === f) return shortViennaDay(f, locale);
  return join(shortViennaDay(f, locale), shortViennaDay(t, locale));
}
