import { describe, it, expect } from 'vitest';
import {
  detectSeries,
  groupEventsForSeries,
  inferRecurrenceRule,
  inferDayOfWeek,
  type SeriesEvent,
} from '@/lib/series-detection';

/**
 * Helper to create events on consecutive weeks at the same day/time.
 */
function weeklyEvents(
  title: string,
  startDate: string,
  count: number,
  opts?: Partial<SeriesEvent>
): SeriesEvent[] {
  const events: SeriesEvent[] = [];
  const base = new Date(startDate);
  for (let i = 0; i < count; i++) {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() + i * 7);
    events.push({
      title,
      start_date: date.toISOString(),
      city: 'Wien',
      ...opts,
    });
  }
  return events;
}

describe('groupEventsForSeries', () => {
  it('should group events by normalized title + city', () => {
    const events: SeriesEvent[] = [
      { title: 'Pub Quiz Night', start_date: '2026-04-07T19:00:00Z', city: 'Wien' },
      { title: 'pub quiz night', start_date: '2026-04-14T19:00:00Z', city: 'Wien' },
      { title: 'Pub-Quiz Night!', start_date: '2026-04-21T19:00:00Z', city: 'Wien' },
      { title: 'Karaoke Night', start_date: '2026-04-08T21:00:00Z', city: 'Wien' },
    ];

    const groups = groupEventsForSeries(events);
    expect(groups.size).toBe(2);

    // Find the pub quiz group
    let pubQuizCount = 0;
    let karaokeCount = 0;
    for (const [, group] of groups) {
      if (group[0].title.toLowerCase().includes('pub quiz')) {
        pubQuizCount = group.length;
      } else {
        karaokeCount = group.length;
      }
    }
    expect(pubQuizCount).toBe(3);
    expect(karaokeCount).toBe(1);
  });

  it('should group by venue_id when available', () => {
    const events: SeriesEvent[] = [
      { title: 'Trivia Night', start_date: '2026-04-07T19:00:00Z', venue_id: 'venue-1', city: 'Wien' },
      { title: 'Trivia Night', start_date: '2026-04-14T19:00:00Z', venue_id: 'venue-1', city: 'Wien' },
      { title: 'Trivia Night', start_date: '2026-04-07T19:00:00Z', venue_id: 'venue-2', city: 'Wien' },
    ];

    const groups = groupEventsForSeries(events);
    // Two groups: same title but different venues
    expect(groups.size).toBe(2);
  });

  it('should skip events with invalid dates', () => {
    const events: SeriesEvent[] = [
      { title: 'Good Event', start_date: '2026-04-07T19:00:00Z', city: 'Wien' },
      { title: 'Bad Event', start_date: 'not-a-date', city: 'Wien' },
    ];

    const groups = groupEventsForSeries(events);
    let totalEvents = 0;
    for (const [, group] of groups) {
      totalEvents += group.length;
    }
    expect(totalEvents).toBe(1);
  });

  it('should respect requireVenue option', () => {
    const events: SeriesEvent[] = [
      { title: 'Event A', start_date: '2026-04-07T19:00:00Z', city: 'Wien' },
      { title: 'Event B', start_date: '2026-04-07T19:00:00Z', venue_id: 'v1', city: 'Wien' },
    ];

    const groups = groupEventsForSeries(events, { requireVenue: true });
    let totalEvents = 0;
    for (const [, group] of groups) {
      totalEvents += group.length;
    }
    expect(totalEvents).toBe(1); // only Event B has venue_id
  });
});

describe('inferDayOfWeek', () => {
  it('should detect dominant day of week', () => {
    // All on Tuesdays (April 7, 14, 21, 28 2026 are Tuesdays)
    const events = weeklyEvents('Pub Quiz', '2026-04-07T19:00:00Z', 4);

    const result = inferDayOfWeek(events);
    expect(result).not.toBeNull();
    expect(result!.day).toBe(2); // Tuesday
    expect(result!.fraction).toBe(1.0);
  });

  it('should handle mixed days with a dominant pattern', () => {
    const events: SeriesEvent[] = [
      // 3 on Tuesdays
      { title: 'Quiz', start_date: '2026-04-07T19:00:00Z', city: 'Wien' },
      { title: 'Quiz', start_date: '2026-04-14T19:00:00Z', city: 'Wien' },
      { title: 'Quiz', start_date: '2026-04-21T19:00:00Z', city: 'Wien' },
      // 1 on Wednesday (outlier)
      { title: 'Quiz', start_date: '2026-04-08T19:00:00Z', city: 'Wien' },
    ];

    const result = inferDayOfWeek(events);
    expect(result).not.toBeNull();
    expect(result!.day).toBe(2); // Tuesday is dominant
    expect(result!.fraction).toBe(0.75); // 3 of 4
  });

  it('should return null for empty events', () => {
    expect(inferDayOfWeek([])).toBeNull();
  });
});

describe('inferRecurrenceRule', () => {
  it('should generate RRULE for weekly pattern', () => {
    expect(inferRecurrenceRule(2, 1.0)).toBe('FREQ=WEEKLY;BYDAY=TU');
    expect(inferRecurrenceRule(5, 0.8)).toBe('FREQ=WEEKLY;BYDAY=FR');
    expect(inferRecurrenceRule(0, 0.9)).toBe('FREQ=WEEKLY;BYDAY=SU');
  });

  it('should return null when fraction is below threshold', () => {
    expect(inferRecurrenceRule(2, 0.4)).toBeNull();
    expect(inferRecurrenceRule(2, 0.5)).toBeNull();
  });

  it('should return null for invalid day', () => {
    expect(inferRecurrenceRule(null, 1.0)).toBeNull();
    expect(inferRecurrenceRule(-1, 1.0)).toBeNull();
    expect(inferRecurrenceRule(7, 1.0)).toBeNull();
  });

  it('should respect custom threshold', () => {
    expect(inferRecurrenceRule(2, 0.5, 0.5)).toBe('FREQ=WEEKLY;BYDAY=TU');
    expect(inferRecurrenceRule(2, 0.49, 0.5)).toBeNull();
  });
});

describe('detectSeries', () => {
  it('should detect a weekly series', () => {
    // 5 Tuesday pub quizzes
    const events = weeklyEvents('Pub Quiz at Flex', '2026-04-07T19:00:00Z', 5, {
      city: 'Wien',
      category: 'Bildung',
    });

    const candidates = detectSeries(events);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].series.title).toBe('Pub Quiz at Flex');
    expect(candidates[0].series.day_of_week).toBe(2); // Tuesday
    expect(candidates[0].series.recurrence_rule).toBe('FREQ=WEEKLY;BYDAY=TU');
    expect(candidates[0].series.category).toBe('Bildung');
    expect(candidates[0].events).toHaveLength(5);
    expect(candidates[0].confidence).toBeGreaterThan(0);
  });

  it('should detect multiple series', () => {
    const pubQuiz = weeklyEvents('Pub Quiz', '2026-04-07T19:00:00Z', 4, { city: 'Wien' });
    const karaoke = weeklyEvents('Karaoke Night', '2026-04-10T21:00:00Z', 4, { city: 'Wien' });

    const candidates = detectSeries([...pubQuiz, ...karaoke]);
    expect(candidates).toHaveLength(2);

    const titles = candidates.map(c => c.series.title_normalized);
    expect(titles).toContain('pub quiz');
    expect(titles).toContain('karaoke night');
  });

  it('should NOT detect series below minimum occurrences', () => {
    const events = weeklyEvents('Rare Event', '2026-04-07T19:00:00Z', 2, { city: 'Wien' });

    const candidates = detectSeries(events);
    expect(candidates).toHaveLength(0);
  });

  it('should allow custom minOccurrences', () => {
    const events = weeklyEvents('Small Series', '2026-04-07T19:00:00Z', 2, { city: 'Wien' });

    const candidates = detectSeries(events, { minOccurrences: 2 });
    expect(candidates).toHaveLength(1);
  });

  it('should NOT detect series with inconsistent day pattern', () => {
    // Events scattered across different days — no dominant day
    const events: SeriesEvent[] = [
      { title: 'Random Event', start_date: '2026-04-06T19:00:00Z', city: 'Wien' }, // Mon
      { title: 'Random Event', start_date: '2026-04-08T19:00:00Z', city: 'Wien' }, // Wed
      { title: 'Random Event', start_date: '2026-04-10T19:00:00Z', city: 'Wien' }, // Fri
      { title: 'Random Event', start_date: '2026-04-12T19:00:00Z', city: 'Wien' }, // Sun
    ];

    const candidates = detectSeries(events);
    expect(candidates).toHaveLength(0);
  });

  it('should use venue_id for grouping when available', () => {
    const venue1Events = weeklyEvents('Open Mic', '2026-04-07T20:00:00Z', 4, {
      venue_id: 'venue-1',
      city: 'Wien',
    });
    const venue2Events = weeklyEvents('Open Mic', '2026-04-07T20:00:00Z', 4, {
      venue_id: 'venue-2',
      city: 'Wien',
    });

    const candidates = detectSeries([...venue1Events, ...venue2Events]);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].series.venue_id).not.toBe(candidates[1].series.venue_id);
  });

  it('should find most common venue_id in group', () => {
    const events: SeriesEvent[] = [
      ...weeklyEvents('Quiz Night', '2026-04-07T19:00:00Z', 3, { venue_id: 'venue-a', city: 'Wien' }),
    ];

    const candidates = detectSeries(events);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].series.venue_id).toBe('venue-a');
  });

  it('should extract typical start time', () => {
    const events = weeklyEvents('Late Night Show', '2026-04-07T21:30:00Z', 4, { city: 'Wien' });

    const candidates = detectSeries(events);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].series.start_time).toBe('21:30:00');
  });

  it('should sort candidates by confidence descending', () => {
    // Strong pattern: 6 consistent events
    const strong = weeklyEvents('Strong Pattern', '2026-04-07T19:00:00Z', 6, { city: 'Wien' });
    // Weaker pattern: 3 events with 1 outlier
    const weak: SeriesEvent[] = [
      { title: 'Weak Pattern', start_date: '2026-04-07T19:00:00Z', city: 'Graz' },
      { title: 'Weak Pattern', start_date: '2026-04-14T19:00:00Z', city: 'Graz' },
      { title: 'Weak Pattern', start_date: '2026-04-21T19:00:00Z', city: 'Graz' },
      { title: 'Weak Pattern', start_date: '2026-04-08T19:00:00Z', city: 'Graz' }, // outlier
    ];

    const candidates = detectSeries([...strong, ...weak], { minOccurrences: 3 });
    expect(candidates).toHaveLength(2);
    expect(candidates[0].confidence).toBeGreaterThanOrEqual(candidates[1].confidence);
  });

  it('should handle empty event list', () => {
    expect(detectSeries([])).toHaveLength(0);
  });

  it('should handle events with title normalization (punctuation, casing)', () => {
    const events: SeriesEvent[] = [
      { title: 'Pub-Quiz @ Flex!', start_date: '2026-04-07T19:00:00Z', city: 'Wien' },
      { title: 'pub quiz flex', start_date: '2026-04-14T19:00:00Z', city: 'Wien' },
      { title: 'PUB QUIZ FLEX', start_date: '2026-04-21T19:00:00Z', city: 'Wien' },
    ];

    const candidates = detectSeries(events);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].events).toHaveLength(3);
  });

  it('should set venue_id to null when no events have venues', () => {
    const events = weeklyEvents('Community Meetup', '2026-04-07T18:00:00Z', 3, { city: 'Linz' });

    const candidates = detectSeries(events);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].series.venue_id).toBeNull();
  });
});
