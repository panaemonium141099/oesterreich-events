/**
 * Core series detection logic.
 *
 * Groups events by normalized title + location context, then detects
 * weekly recurrence patterns based on day-of-week consistency.
 */

import { normalizeTitle } from '../dedup/fingerprint';
import type { EventSeriesInsert } from '@/types/venues';

/**
 * Minimal event shape required by the series detection pipeline.
 */
export interface SeriesEvent {
  id?: string;
  title: string;
  start_date: string;
  venue_id?: string | null;
  city?: string | null;
  location_name?: string | null;
  category?: string | null;
}

/**
 * A candidate event series detected from a group of recurring events.
 */
export interface SeriesCandidate {
  /** The insert payload for the event_series table. */
  series: EventSeriesInsert;
  /** Events that belong to this series. */
  events: SeriesEvent[];
  /** Confidence score 0-1 based on pattern strength. */
  confidence: number;
}

/**
 * Options for series detection.
 */
export interface SeriesDetectionOptions {
  /**
   * Minimum number of events in a group to consider it a series.
   * Default: 3
   */
  minOccurrences?: number;

  /**
   * Minimum fraction of events in a group that must fall on the dominant
   * day of week for the pattern to be considered valid.
   * Default: 0.6 (60%)
   */
  dayConsistencyThreshold?: number;

  /**
   * Whether to require venue_id match (true) or fall back to city match (false).
   * Default: false (use venue_id when available, fall back to city)
   */
  requireVenue?: boolean;
}

const DEFAULT_OPTIONS: Required<SeriesDetectionOptions> = {
  minOccurrences: 3,
  dayConsistencyThreshold: 0.6,
  requireVenue: false,
};

/**
 * Day-of-week names for RRULE BYDAY values.
 * Index 0 = Sunday, matching JS Date.getDay().
 */
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Build a grouping key for series detection.
 *
 * Groups events by normalized title + location context.
 * Location context is venue_id if available, otherwise city.
 */
function groupKey(event: SeriesEvent): string {
  const titleNorm = normalizeTitle(event.title);
  const location = event.venue_id ?? extractCity(event) ?? 'unknown';
  return `${titleNorm}||${location}`;
}

/**
 * Extract city from event (city field or location_name).
 */
function extractCity(event: SeriesEvent): string | null {
  if (event.city) return event.city.toLowerCase().trim();
  if (event.location_name) {
    const parts = event.location_name.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 1].trim().toLowerCase();
    }
  }
  return null;
}

/**
 * Parse a start_date string into a Date object.
 */
function parseDate(startDate: string): Date {
  return new Date(startDate);
}

/**
 * Get the day of week (0=Sun, 6=Sat) from a start_date string.
 */
function getDayOfWeek(startDate: string): number {
  return parseDate(startDate).getUTCDay();
}

/**
 * Find the most common time (HH:MM) from a set of events.
 * Returns the time in HH:MM:SS format, or null if no valid times found.
 */
function findTypicalStartTime(events: SeriesEvent[]): string | null {
  const timeCounts = new Map<string, number>();

  for (const event of events) {
    const date = parseDate(event.start_date);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    // Only count events that have a specific time (not midnight/00:00 unless many)
    const timeKey = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    timeCounts.set(timeKey, (timeCounts.get(timeKey) ?? 0) + 1);
  }

  if (timeCounts.size === 0) return null;

  // Find the most common time
  let bestTime: string | null = null;
  let bestCount = 0;
  for (const [time, count] of timeCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestTime = time;
    }
  }

  return bestTime;
}

/**
 * Group events by normalized title + location context for series analysis.
 *
 * Exported for testing and pipeline use.
 */
export function groupEventsForSeries(
  events: SeriesEvent[],
  options?: Pick<SeriesDetectionOptions, 'requireVenue'>
): Map<string, SeriesEvent[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const groups = new Map<string, SeriesEvent[]>();

  for (const event of events) {
    // Skip events without a parseable date
    const date = parseDate(event.start_date);
    if (isNaN(date.getTime())) continue;

    // If requireVenue is set, skip events without a venue_id
    if (opts.requireVenue && !event.venue_id) continue;

    const key = groupKey(event);
    const group = groups.get(key) ?? [];
    group.push(event);
    groups.set(key, group);
  }

  return groups;
}

/**
 * Infer the dominant day of week from a group of events.
 *
 * Returns the day (0-6) and the fraction of events on that day,
 * or null if no clear pattern exists.
 */
export function inferDayOfWeek(events: SeriesEvent[]): {
  day: number;
  fraction: number;
} | null {
  if (events.length === 0) return null;

  const dayCounts = new Array<number>(7).fill(0);

  for (const event of events) {
    const day = getDayOfWeek(event.start_date);
    dayCounts[day]++;
  }

  let bestDay = 0;
  let bestCount = 0;
  for (let d = 0; d < 7; d++) {
    if (dayCounts[d] > bestCount) {
      bestCount = dayCounts[d];
      bestDay = d;
    }
  }

  if (bestCount === 0) return null;

  return {
    day: bestDay,
    fraction: bestCount / events.length,
  };
}

/**
 * Infer an iCal RRULE string from the detected pattern.
 *
 * Currently supports:
 * - FREQ=WEEKLY;BYDAY=XX for weekly recurring events
 *
 * Returns null if no clear recurrence pattern detected.
 */
export function inferRecurrenceRule(
  dayOfWeek: number | null,
  fraction: number,
  threshold: number = DEFAULT_OPTIONS.dayConsistencyThreshold
): string | null {
  if (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6) return null;
  if (fraction < threshold) return null;

  return `FREQ=WEEKLY;BYDAY=${RRULE_DAYS[dayOfWeek]}`;
}

/**
 * Run the full series detection pipeline on a list of events.
 *
 * Returns a list of SeriesCandidate objects, each representing a
 * detected recurring event pattern with its member events.
 *
 * Does NOT write to any database. Callers decide what to do with results.
 */
export function detectSeries(
  events: SeriesEvent[],
  options?: SeriesDetectionOptions
): SeriesCandidate[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const groups = groupEventsForSeries(events, opts);
  const candidates: SeriesCandidate[] = [];

  for (const [, group] of groups) {
    // Skip groups below minimum occurrence threshold
    if (group.length < opts.minOccurrences) continue;

    const dayResult = inferDayOfWeek(group);
    if (!dayResult) continue;

    const { day, fraction } = dayResult;
    if (fraction < opts.dayConsistencyThreshold) continue;

    // Use the first event's title as the series title (most representative)
    const representativeTitle = group[0].title;
    const titleNormalized = normalizeTitle(representativeTitle);
    const startTime = findTypicalStartTime(group);
    const rrule = inferRecurrenceRule(day, fraction, opts.dayConsistencyThreshold);

    // Determine venue_id: use the most common venue_id in the group
    const venueId = findMostCommonVenueId(group);

    // Determine category: use the most common category in the group
    const category = findMostCommonCategory(group);

    // Confidence is based on:
    // - Day consistency (how many events fall on the dominant day)
    // - Number of occurrences (more = stronger signal)
    const occurrenceBonus = Math.min(group.length / 10, 0.2); // up to +0.2 for 10+ events
    const confidence = Math.min(fraction * 0.8 + occurrenceBonus, 1.0);

    const series: EventSeriesInsert = {
      venue_id: venueId ?? null,
      title: representativeTitle,
      title_normalized: titleNormalized,
      recurrence_rule: rrule,
      category: category,
      day_of_week: day,
      start_time: startTime,
    };

    candidates.push({
      series,
      events: group,
      confidence,
    });
  }

  // Sort by confidence descending, then by number of events descending
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.events.length - a.events.length;
  });

  return candidates;
}

/**
 * Find the most common venue_id in a group of events.
 * Returns null if no events have a venue_id.
 */
function findMostCommonVenueId(events: SeriesEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.venue_id) {
      counts.set(event.venue_id, (counts.get(event.venue_id) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = id;
    }
  }
  return best;
}

/**
 * Find the most common category in a group of events.
 * Returns null if no events have a category.
 */
function findMostCommonCategory(events: SeriesEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.category) {
      counts.set(event.category, (counts.get(event.category) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  let best: string | null = null;
  let bestCount = 0;
  for (const [cat, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = cat;
    }
  }
  return best;
}
