/**
 * Event Series Detection — identifies recurring events and groups them.
 *
 * Detects patterns like weekly pub quizzes, monthly karaoke nights, etc.
 * by analyzing events that share the same normalized title (optionally at
 * the same venue) and occur on a consistent day of the week.
 *
 * Pipeline:
 * 1. Group events by (normalizedTitle, venue_id | city)
 * 2. Within each group, analyze day-of-week distribution
 * 3. If a dominant day exists (>= threshold of events fall on it),
 *    create/return an EventSeries candidate
 * 4. Assign event_series_id to matching events
 */

export {
  detectSeries,
  groupEventsForSeries,
  inferRecurrenceRule,
  inferDayOfWeek,
  type SeriesCandidate,
  type SeriesEvent,
  type SeriesDetectionOptions,
} from './detect';
