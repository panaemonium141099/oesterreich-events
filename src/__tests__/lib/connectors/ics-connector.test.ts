/**
 * Tests for ICS Connector — node-ical parser with RRULE expansion + DST handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ICSConnector, paramValue } from '@/lib/connectors/ics-connector';

// ── Test ICS fixtures ─────────────────────────────────────────────────────────

/** Single non-recurring event in Europe/Vienna timezone */
const SINGLE_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-CALNAME:Test Calendar
X-WR-TIMEZONE:Europe/Vienna
BEGIN:VEVENT
UID:single-event-001@test
DTSTART;TZID=Europe/Vienna:20260410T190000
DTEND;TZID=Europe/Vienna:20260410T230000
SUMMARY:Pub Quiz Night
DESCRIPTION:Weekly pub quiz at The Irish Harp.
LOCATION:The Irish Harp, Graz
CATEGORIES:Nightlife,Quiz
URL:https://example.com/pubquiz
ORGANIZER;CN=Quiz Master:mailto:quiz@example.com
GEO:47.0707;15.4395
END:VEVENT
END:VCALENDAR`;

/** Recurring weekly event with RRULE (every Friday for 10 weeks) */
const RECURRING_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-TIMEZONE:Europe/Vienna
BEGIN:VEVENT
UID:recurring-001@test
DTSTART;TZID=Europe/Vienna:20260403T210000
DTEND;TZID=Europe/Vienna:20260404T030000
SUMMARY:Techno Friday
DESCRIPTION:Weekly techno night.
LOCATION:Club Underground, Wien
RRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=10
CATEGORIES:Nightlife,Techno
END:VEVENT
END:VCALENDAR`;

/** All-day event (DATE type, no time component) */
const ALL_DAY_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:allday-001@test
DTSTART;VALUE=DATE:20260415
DTEND;VALUE=DATE:20260416
SUMMARY:Spring Festival
DESCRIPTION:Annual spring festival in the park.
LOCATION:Stadtpark, Wien
END:VEVENT
END:VCALENDAR`;

/** Event with no LOCATION or GEO — should use defaults */
const MINIMAL_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:minimal-001@test
DTSTART:20260420T100000Z
SUMMARY:Online Webinar
END:VEVENT
END:VCALENDAR`;

/** Event with EXDATE — one occurrence excluded */
const EXDATE_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-TIMEZONE:Europe/Vienna
BEGIN:VEVENT
UID:exdate-001@test
DTSTART;TZID=Europe/Vienna:20260406T180000
DTEND;TZID=Europe/Vienna:20260406T200000
SUMMARY:Monday Meetup
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=5
EXDATE;TZID=Europe/Vienna:20260413T180000
END:VEVENT
END:VCALENDAR`;

/** Event far in the past — should be excluded */
const PAST_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:past-001@test
DTSTART:20200101T100000Z
DTEND:20200101T120000Z
SUMMARY:Past Event
END:VEVENT
END:VCALENDAR`;

/** DST transition event — CET to CEST boundary (last Sunday of March) */
const DST_TRANSITION_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-TIMEZONE:Europe/Vienna
BEGIN:VEVENT
UID:dst-001@test
DTSTART;TZID=Europe/Vienna:20270328T020000
DTEND;TZID=Europe/Vienna:20270328T040000
SUMMARY:DST Boundary Event
DESCRIPTION:Event crossing the CET to CEST transition.
END:VEVENT
END:VCALENDAR`;

/** Empty calendar — no events */
const EMPTY_CALENDAR_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
X-WR-CALNAME:Empty Calendar
END:VCALENDAR`;

/** Event with ParameterValue summary (has params) */
const PARAMETERIZED_EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:param-001@test
DTSTART:20260412T140000Z
SUMMARY;LANGUAGE=de:Restmüllabholung
DESCRIPTION;LANGUAGE=de:Restmüll wird abgeholt.
LOCATION;LANGUAGE=de:Hauptstraße 1, Wien
END:VEVENT
END:VCALENDAR`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ICSConnector', () => {
  let connector: ICSConnector;

  beforeEach(() => {
    // Fix "now" to April 5, 2026 for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-05T12:00:00+02:00'));

    connector = new ICSConnector({
      sourceName: 'test-venue',
      sourceUrl: 'https://test-venue.at',
      defaultBundesland: 'steiermark',
      defaultLocationName: 'Test Venue Default',
      defaultLatitude: 47.07,
      defaultLongitude: 15.44,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fromString — single events', () => {
    it('parses a single non-recurring event with full metadata', () => {
      const result = connector.fromString(SINGLE_EVENT_ICS);

      expect(result.calendarName).toBe('Test Calendar');
      expect(result.rawEventCount).toBe(1);
      expect(result.expandedEventCount).toBe(1);
      expect(result.warnings).toHaveLength(0);
      expect(result.events).toHaveLength(1);

      const evt = result.events[0];
      expect(evt.title).toBe('Pub Quiz Night');
      expect(evt.description).toContain('pub quiz');
      expect(evt.location_name).toBe('The Irish Harp, Graz');
      expect(evt.source_name).toBe('test-venue');
      expect(evt.source_url).toBe('https://example.com/pubquiz');
      expect(evt.tags).toEqual(['Nightlife', 'Quiz']);
      expect(evt.organizer).toBe('Quiz Master');
      // GEO coordinates from VEVENT
      expect(evt.latitude).toBeCloseTo(47.0707, 3);
      expect(evt.longitude).toBeCloseTo(15.4395, 3);
      // Date in ISO format
      expect(evt.start_date).toMatch(/2026-04-10/);
      expect(evt.end_date).toMatch(/2026-04-10/);
    });

    it('parses an all-day event', () => {
      const result = connector.fromString(ALL_DAY_EVENT_ICS);

      expect(result.events).toHaveLength(1);
      const evt = result.events[0];
      expect(evt.title).toBe('Spring Festival');
      expect(evt.start_date).toMatch(/2026-04-15/);
    });

    it('uses default location/coords when event has none', () => {
      const result = connector.fromString(MINIMAL_EVENT_ICS);

      expect(result.events).toHaveLength(1);
      const evt = result.events[0];
      expect(evt.title).toBe('Online Webinar');
      expect(evt.location_name).toBe('Test Venue Default');
      expect(evt.latitude).toBe(47.07);
      expect(evt.longitude).toBe(15.44);
      expect(evt.bundesland).toBe('steiermark');
    });

    it('filters out past events', () => {
      const result = connector.fromString(PAST_EVENT_ICS);

      expect(result.rawEventCount).toBe(1);
      expect(result.expandedEventCount).toBe(0);
      expect(result.events).toHaveLength(0);
    });
  });

  describe('fromString — recurring events (RRULE)', () => {
    it('expands weekly recurring events within the 90-day window', () => {
      const result = connector.fromString(RECURRING_EVENT_ICS);

      // RRULE: every Friday for 10 weeks starting April 3
      // April 5 is our "now", so April 3 is before range start but still within the
      // 90-day window. All 10 Fridays: Apr 3, 10, 17, 24, May 1, 8, 15, 22, 29, Jun 5
      // Depending on range start (start of day April 5), Apr 3 is before range, so 9 instances.
      expect(result.rawEventCount).toBe(1);
      expect(result.expandedEventCount).toBeGreaterThanOrEqual(8);
      expect(result.expandedEventCount).toBeLessThanOrEqual(10);

      // All events should be Techno Friday
      for (const evt of result.events) {
        expect(evt.title).toBe('Techno Friday');
        expect(evt.location_name).toBe('Club Underground, Wien');
      }

      // Check that dates are on Fridays
      for (const evt of result.events) {
        const dt = new Date(evt.start_date);
        expect(dt.getDay()).toBe(5); // Friday
      }
    });

    it('respects EXDATE exclusions', () => {
      const result = connector.fromString(EXDATE_EVENT_ICS);

      // RRULE: weekly on Monday for 5 weeks starting April 6
      // EXDATE: April 13 excluded
      // Expected Mondays within range: Apr 6, (13 excluded), 20, 27, May 4
      // Apr 6 is after our range start (Apr 5), so it should be included
      // That gives us 4 instances (5 minus 1 excluded)
      expect(result.expandedEventCount).toBe(4);

      // Verify April 13 is NOT in the results
      const dates = result.events.map(e => e.start_date.slice(0, 10));
      expect(dates).not.toContain('2026-04-13');
    });
  });

  describe('fromString — empty/edge cases', () => {
    it('returns empty for an empty calendar', () => {
      const result = connector.fromString(EMPTY_CALENDAR_ICS);

      expect(result.calendarName).toBe('Empty Calendar');
      expect(result.rawEventCount).toBe(0);
      expect(result.expandedEventCount).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('handles malformed ICS gracefully', () => {
      const result = connector.fromString('NOT A VALID ICS FILE');

      expect(result.rawEventCount).toBe(0);
      expect(result.events).toHaveLength(0);
    });
  });

  describe('fromString — DST handling', () => {
    it('parses events near DST transition correctly', () => {
      // March 28, 2027 is near a DST transition in Europe/Vienna
      // Extend the window to cover this date
      const longConnector = new ICSConnector({
        sourceName: 'test-dst',
        expandDays: 365,
      });

      const result = longConnector.fromString(DST_TRANSITION_ICS);

      expect(result.events).toHaveLength(1);
      const evt = result.events[0];
      expect(evt.title).toBe('DST Boundary Event');
      // The ISO date should correctly represent the Vienna local time
      expect(evt.start_date).toMatch(/2027-03-28/);
    });
  });

  describe('fromString — ParameterValue handling', () => {
    it('extracts values from parameterized fields', () => {
      const result = connector.fromString(PARAMETERIZED_EVENT_ICS);

      expect(result.events).toHaveLength(1);
      const evt = result.events[0];
      // node-ical may return string or {val, params} — our connector handles both
      expect(evt.title).toBe('Restmüllabholung');
    });
  });

  describe('source_id generation', () => {
    it('generates stable source_ids from UID + date', () => {
      const result = connector.fromString(SINGLE_EVENT_ICS);

      const evt = result.events[0];
      expect(evt.source_id).toMatch(/^ics-test-venue-/);
      expect(evt.source_id).toContain('2026-04-10');

      // Parse again — same source_id
      const result2 = connector.fromString(SINGLE_EVENT_ICS);
      expect(result2.events[0].source_id).toBe(evt.source_id);
    });
  });

  describe('category detection', () => {
    it('auto-categorizes events from title/description', () => {
      const result = connector.fromString(SINGLE_EVENT_ICS);

      // "Pub Quiz Night" should get categorized
      const evt = result.events[0];
      expect(evt.category).toBeTruthy();
    });
  });

  describe('maxEvents safety limit', () => {
    it('stops expansion when maxEvents is reached', () => {
      const limitedConnector = new ICSConnector({
        sourceName: 'test-limit',
        maxEvents: 3,
      });

      const result = limitedConnector.fromString(RECURRING_EVENT_ICS);

      expect(result.expandedEventCount).toBeLessThanOrEqual(3);
      expect(result.warnings.some(w => w.includes('max events limit'))).toBe(true);
    });
  });
});

describe('paramValue utility', () => {
  it('returns string for plain string input', () => {
    expect(paramValue('Hello')).toBe('Hello');
  });

  it('extracts val from ParameterValue object', () => {
    expect(paramValue({ val: 'Test', params: { LANGUAGE: 'en' } })).toBe('Test');
  });

  it('returns undefined for null/undefined', () => {
    expect(paramValue(null)).toBeUndefined();
    expect(paramValue(undefined)).toBeUndefined();
  });
});
