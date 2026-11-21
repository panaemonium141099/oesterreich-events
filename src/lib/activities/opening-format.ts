/**
 * Öffnungszeiten und Saison eines Ausflugsziels als Text: Zeitraum,
 * Wochentage, Uhrzeit. Pur; von `ActivityFacts` der Website und von der
 * App-API (`src/lib/app-api/activities.ts`) genutzt. Bis 2026-11 privat in
 * `ActivityFacts.tsx`, unverändert hierher gezogen.
 */
import type { NormalizedOpeningWindow } from '@/lib/activities/opening';
import { WEEKDAY_BITS } from '@/lib/activities/opening';

const WEEKDAY_LABELS: ReadonlyArray<{ bit: number; label: string }> = [
  { bit: WEEKDAY_BITS.mo, label: 'Mo' },
  { bit: WEEKDAY_BITS.di, label: 'Di' },
  { bit: WEEKDAY_BITS.mi, label: 'Mi' },
  { bit: WEEKDAY_BITS.do, label: 'Do' },
  { bit: WEEKDAY_BITS.fr, label: 'Fr' },
  { bit: WEEKDAY_BITS.sa, label: 'Sa' },
  { bit: WEEKDAY_BITS.so, label: 'So' },
];

export function formatOpeningDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function formatOpeningWeekdays(mask: number | null, allDaysLabel: string): string {
  if (mask == null) return allDaysLabel;
  const labels = WEEKDAY_LABELS.filter((w) => (mask & w.bit) !== 0).map((w) => w.label);
  return labels.length > 0 ? labels.join(', ') : allDaysLabel;
}

export function formatOpeningWindow(w: NormalizedOpeningWindow, allDaysLabel: string, openEndLabel: string) {
  const season =
    w.from === w.to ? formatOpeningDate(w.from) : `${formatOpeningDate(w.from)} – ${formatOpeningDate(w.to)}`;
  const time =
    w.timeFrom === '00:00' && w.timeTo === '00:00'
      ? openEndLabel
      : `${w.timeFrom}–${w.timeTo}`;
  return { season, days: formatOpeningWeekdays(w.weekdays, allDaysLabel), time };
}
