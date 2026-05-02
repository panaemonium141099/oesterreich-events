/**
 * Date-preset → (dateFrom, dateTo) mapping for the "Wann" filter block.
 *
 * Single source of truth so the topbar's Heute-toggle, the FilterDrawer's
 * preset chips, and the URL `?date=` param all agree on what "Wochenende"
 * means. Previously the FilterBar's `handleTodayToggle` and the
 * DateRangeFilter's manual inputs could overwrite each other (Bug #2 the
 * user confirmed) — this module centralizes the math.
 *
 * All dates are formatted as ISO YYYY-MM-DD in the local timezone (we use
 * the user's clock, not UTC, because event start_dates are stored as
 * naive local timestamps).
 */
import type { DatePresetId } from './tokens';

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

function toLocalIso(d: Date): string {
  // toISOString uses UTC — for "today" we want the user's local day.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Default upper bound when no explicit "wann" preset is active. Six months
 * out — keeps the fetch reasonable while still showing the whole festival
 * season.
 */
export function defaultDateTo(): string {
  return toLocalIso(new Date(Date.now() + SIX_MONTHS_MS));
}

/**
 * Map a preset chip selection onto concrete (dateFrom, dateTo). Returns
 * `null` for `'custom'` — the caller should render an explicit date
 * picker for that branch.
 */
export function applyDatePreset(id: DatePresetId): { dateFrom?: string; dateTo?: string } | null {
  const now = new Date();
  const today = toLocalIso(now);

  switch (id) {
    case 'jetzt':
    case 'heute':
      return { dateFrom: today, dateTo: today };

    case 'morgen': {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      const tomorrow = toLocalIso(t);
      return { dateFrom: tomorrow, dateTo: tomorrow };
    }

    case 'wochenende': {
      // Saturday + Sunday of the upcoming weekend (or the current one if
      // it's Saturday/Sunday already).
      const day = now.getDay(); // 0 Sun, 6 Sat
      const sat = new Date(now);
      const daysToSat = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
      sat.setDate(sat.getDate() + daysToSat);
      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);
      return { dateFrom: toLocalIso(sat), dateTo: toLocalIso(sun) };
    }

    case 'woche': {
      // Today through end of week (next Sunday).
      const day = now.getDay();
      const sun = new Date(now);
      const daysToSun = day === 0 ? 0 : 7 - day;
      sun.setDate(sun.getDate() + daysToSun);
      return { dateFrom: today, dateTo: toLocalIso(sun) };
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

  const now = new Date();
  const today = toLocalIso(now);

  if (dateFrom === today && dateTo === today) return 'heute';

  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  const tomorrow = toLocalIso(t);
  if (dateFrom === tomorrow && dateTo === tomorrow) return 'morgen';

  const day = now.getDay();
  const sat = new Date(now);
  const daysToSat = day === 6 ? 0 : day === 0 ? -1 : 6 - day;
  sat.setDate(sat.getDate() + daysToSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  if (dateFrom === toLocalIso(sat) && dateTo === toLocalIso(sun)) return 'wochenende';

  const sunWk = new Date(now);
  const daysToSun = day === 0 ? 0 : 7 - day;
  sunWk.setDate(sunWk.getDate() + daysToSun);
  if (dateFrom === today && dateTo === toLocalIso(sunWk)) return 'woche';

  return null;
}
