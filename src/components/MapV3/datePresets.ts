/**
 * Date-preset → (dateFrom, dateTo) mapping for the "Wann" filter block.
 *
 * Single source of truth so the topbar's Heute-toggle, the FilterDrawer's
 * preset chips, and the URL `?date=` param all agree on what "Wochenende"
 * means. Previously the FilterBar's `handleTodayToggle` and the
 * DateRangeFilter's manual inputs could overwrite each other (Bug #2 the
 * user confirmed) — this module centralizes the math.
 *
 * All dates are Vienna calendar days (YYYY-MM-DD), independent of the
 * runtime zone: the server renders in UTC, the browser in the visitor's
 * zone, and both must agree on "heute" — see event-time.ts.
 */
import type { DatePresetId } from './tokens';
import { addViennaDays, viennaToday, viennaWeekday } from '@/lib/utils/event-time';

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

/**
 * Default upper bound when no explicit "wann" preset is active. Six months
 * out — keeps the fetch reasonable while still showing the whole festival
 * season.
 */
export function defaultDateTo(): string {
  return viennaToday(new Date(Date.now() + SIX_MONTHS_MS));
}

/**
 * Map a preset chip selection onto concrete (dateFrom, dateTo). Returns
 * `null` for `'custom'` — the caller should render an explicit date
 * picker for that branch.
 */
export function applyDatePreset(id: DatePresetId): { dateFrom?: string; dateTo?: string } | null {
  const today = viennaToday();

  switch (id) {
    case 'jetzt':
    case 'heute':
      // Both presets show today's events. They look semantically different
      // ("Jetzt" feels more immediate) but the API has no concept of
      // "happening right now" so we map them to the same range. The
      // FilterDrawer tracks which chip the user picked separately.
      return { dateFrom: today, dateTo: today };

    case 'morgen': {
      const tomorrow = addViennaDays(today, 1);
      return { dateFrom: tomorrow, dateTo: tomorrow };
    }

    case 'wochenende': {
      // Saturday + Sunday of the upcoming weekend (or the current one if
      // it's Saturday/Sunday already).
      const day = viennaWeekday(today); // 0 Sun, 6 Sat
      const daysToSat = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
      const sat = addViennaDays(today, daysToSat);
      return { dateFrom: sat, dateTo: addViennaDays(sat, 1) };
    }

    case 'woche': {
      // Mon–Sun of the current ISO week. Distinct from "wochenende" so the
      // two chips can be told apart on a Saturday (where today→Sun would
      // otherwise collide with Sat→Sun and the visual would jump).
      const day = viennaWeekday(today); // 0 Sun, 1 Mon, ..., 6 Sat
      const daysToMon = day === 0 ? -6 : 1 - day;
      const mon = addViennaDays(today, daysToMon);
      return { dateFrom: mon, dateTo: addViennaDays(mon, 6) };
    }

    case 'custom':
      return null;
  }
}

/**
 * Reverse-lookup: given the current dateFrom/dateTo, infer which preset
 * chip should appear active. `null` means no preset matches (custom range
 * or no date filter).
 */
export function detectActivePreset(
  dateFrom?: string,
  dateTo?: string,
): DatePresetId | null {
  if (!dateFrom && !dateTo) return null;

  const today = viennaToday();

  if (dateFrom === today && dateTo === today) return 'heute';

  const tomorrow = addViennaDays(today, 1);
  if (dateFrom === tomorrow && dateTo === tomorrow) return 'morgen';

  const day = viennaWeekday(today);
  const daysToSat = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
  const sat = addViennaDays(today, daysToSat);
  if (dateFrom === sat && dateTo === addViennaDays(sat, 1)) return 'wochenende';

  const daysToSun = day === 0 ? 0 : 7 - day;
  if (dateFrom === today && dateTo === addViennaDays(today, daysToSun)) return 'woche';

  return null;
}
