import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  addViennaDays,
  toViennaDate,
  viennaDayDiff,
  viennaDayRange,
  viennaDayStart,
  viennaFields,
  viennaToday,
  viennaWeekday,
} from '@/lib/utils/event-time';
import { applyDatePreset, detectActivePreset } from '@/components/MapV3/datePresets';
import { groupEvents } from '@/components/MapV3/EventListView';
import { getDateRange } from '@/lib/landing-slugs';
import { parseQuery } from '@/lib/search/smart-query';
import { inferDayOfWeek, detectSeries } from '@/lib/series-detection';
import { computeStudentScore } from '@/lib/utils/student-score';
import { buildCitableIntro } from '@/lib/seo/event-intro';
import type { Event } from '@/types/events';

// Tages-Zuordnung in Wien, unabhängig von der Zone der Runtime.
//
// vitest läuft in UTC wie der Prod-Server. Die Grenzfälle liegen genau dort,
// wo UTC und Wien auf verschiedene Kalendertage fallen:
//   - 22:30Z = 00:30 Wien am Folgetag (Sommerzeit),
//   - 23:30Z = 00:30 Wien am Folgetag (Winterzeit),
//   - Umstellungstage 25.10.2026 (25 h) und 28.03.2027 (23 h).

afterEach(() => {
  vi.useRealTimers();
});

function at(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

describe('Wien-Kalenderhelfer', () => {
  it('viennaFields liefert Wien-Ortszeit statt Runtime-Zeit', () => {
    expect(viennaFields(new Date('2026-10-06T22:30:00Z'))).toEqual({
      year: 2026, month: 10, day: 7, hour: 0, minute: 30, weekday: 3,
    });
    expect(viennaFields(new Date('2026-12-31T23:30:00Z'))).toMatchObject({ year: 2027, month: 1, day: 1 });
  });

  it('viennaToday kippt um Mitternacht Wien, nicht um Mitternacht UTC', () => {
    expect(viennaToday(new Date('2026-10-06T21:59:59Z'))).toBe('2026-10-06');
    expect(viennaToday(new Date('2026-10-06T22:00:00Z'))).toBe('2026-10-07');
    expect(viennaToday(new Date('2026-12-06T23:30:00Z'))).toBe('2026-12-07');
  });

  it('viennaWeekday für Tag-Strings und Instants', () => {
    expect(viennaWeekday('2026-10-11')).toBe(0); // Sonntag
    expect(viennaWeekday('2026-10-10')).toBe(6); // Samstag
    expect(viennaWeekday(new Date('2026-10-11T22:30:00Z'))).toBe(1); // Mo 00:30 Wien
  });

  it('addViennaDays / viennaDayDiff rechnen über Monats-, Jahres- und DST-Grenzen', () => {
    expect(addViennaDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addViennaDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addViennaDays('2027-03-27', 2)).toBe('2027-03-29');
    expect(addViennaDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addViennaDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(viennaDayDiff('2027-03-27', '2027-03-29')).toBe(2);
    expect(viennaDayDiff('2026-10-26', '2026-10-24')).toBe(-2);
  });

  it('viennaDayStart = 00:00 Wien als Instant', () => {
    expect(viennaDayStart('2026-10-07').toISOString()).toBe('2026-10-06T22:00:00.000Z');
    expect(viennaDayStart('2026-12-07').toISOString()).toBe('2026-12-06T23:00:00.000Z');
    expect(viennaDayStart('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(viennaDayStart('2026-10-26').toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(viennaDayStart('2027-03-28').toISOString()).toBe('2027-03-27T23:00:00.000Z');
    expect(viennaDayStart('2027-03-29').toISOString()).toBe('2027-03-28T22:00:00.000Z');
  });

  it('viennaDayRange: Umstellungstage haben 25 bzw. 23 Stunden', () => {
    const autumn = viennaDayRange('2026-10-25');
    expect(autumn.next.getTime() - autumn.start.getTime()).toBe(25 * 3600_000);
    expect(autumn.end.toISOString()).toBe('2026-10-25T22:59:59.999Z');
    const spring = viennaDayRange('2027-03-28');
    expect(spring.next.getTime() - spring.start.getTime()).toBe(23 * 3600_000);
    expect(toViennaDate(spring.start)).toBe('2027-03-28');
    expect(toViennaDate(spring.end)).toBe('2027-03-28');
    expect(toViennaDate(spring.next)).toBe('2027-03-29');
  });
});

describe('Karten-Filter "Wann" (datePresets)', () => {
  it('heute/morgen um 00:30 Wien gehören schon zum neuen Tag', () => {
    at('2026-10-06T22:30:00Z'); // Mi 07.10. 00:30 Wien
    expect(applyDatePreset('heute')).toEqual({ dateFrom: '2026-10-07', dateTo: '2026-10-07' });
    expect(applyDatePreset('morgen')).toEqual({ dateFrom: '2026-10-08', dateTo: '2026-10-08' });
  });

  it('Montag 00:30 Wien: Wochenende ist das kommende, Woche beginnt heute', () => {
    at('2026-10-11T22:30:00Z'); // Mo 12.10. 00:30 Wien, in UTC noch Sonntag
    expect(applyDatePreset('wochenende')).toEqual({ dateFrom: '2026-10-17', dateTo: '2026-10-18' });
    expect(applyDatePreset('woche')).toEqual({ dateFrom: '2026-10-12', dateTo: '2026-10-18' });
    expect(detectActivePreset('2026-10-12', '2026-10-12')).toBe('heute');
  });

  it('morgen über die Frühjahrsumstellung', () => {
    at('2027-03-27T23:30:00Z'); // So 28.03. 00:30 Wien (Winterzeit)
    expect(applyDatePreset('heute')).toEqual({ dateFrom: '2027-03-28', dateTo: '2027-03-28' });
    expect(applyDatePreset('morgen')).toEqual({ dateFrom: '2027-03-29', dateTo: '2027-03-29' });
    expect(applyDatePreset('wochenende')).toEqual({ dateFrom: '2027-03-27', dateTo: '2027-03-28' });
  });
});

describe('Listen-Gruppen heute/morgen (EventListView)', () => {
  const ev = (id: string, start_date: string) => ({ id, start_date }) as unknown as Event;

  it('Event um 00:30 Wien landet bei "morgen", 23:30 Wien bei "heute"', () => {
    at('2026-10-06T10:00:00Z'); // Di 06.10. 12:00 Wien
    const groups = groupEvents([
      ev('spaet', '2026-10-06T21:30:00Z'), // Di 23:30 Wien
      ev('nacht', '2026-10-06T22:30:00Z'), // Mi 00:30 Wien
    ]);
    const byId = Object.fromEntries(groups.flatMap((g) => g.events.map((e) => [e.id, g.id])));
    expect(byId).toEqual({ spaet: 'heute', nacht: 'morgen' });
    expect(toViennaDate(groups[0].sub!)).toBe('2026-10-06');
    expect(toViennaDate(groups[1].sub!)).toBe('2026-10-07');
  });

  it('Samstag 00:30 Wien zählt zum Wochenende, nicht zur Woche', () => {
    at('2026-10-06T10:00:00Z');
    const groups = groupEvents([ev('sa', '2026-10-09T22:30:00Z')]); // Sa 10.10. 00:30 Wien
    expect(groups.map((g) => g.id)).toEqual(['wochenende']);
  });
});

describe('Landing-Zeitfilter (getDateRange)', () => {
  it('heute um 00:30 Wien', () => {
    at('2026-10-06T22:30:00Z');
    const r = getDateRange('heute');
    expect(r.from).toBe('2026-10-07');
    expect(r.to).toBe('2026-10-08');
    expect(r.fromIso).toBe('2026-10-06T22:00:00.000Z');
    expect(r.toIso).toBe('2026-10-07T22:00:00.000Z');
  });

  it('Wochenende am Umstellungs-Wochenende (Sa 00:00 bis Mo 00:00 Wien)', () => {
    at('2026-10-21T10:00:00Z'); // Mi
    const r = getDateRange('wochenende');
    expect(r.from).toBe('2026-10-24');
    expect(r.to).toBe('2026-10-26');
    expect(r.fromIso).toBe('2026-10-23T22:00:00.000Z');
    expect(r.toIso).toBe('2026-10-25T23:00:00.000Z');
  });
});

describe('Smart-Suche Datumsfenster (parseQuery)', () => {
  it('"heute" = 00:00–23:59:59.999 Wien', () => {
    const { filters } = parseQuery('konzert heute', new Date('2026-10-06T22:30:00Z'));
    expect(filters.afterDate?.toISOString()).toBe('2026-10-06T22:00:00.000Z');
    expect(filters.beforeDate?.toISOString()).toBe('2026-10-07T21:59:59.999Z');
  });

  it('"morgen" am Tag der Herbstumstellung', () => {
    const { filters } = parseQuery('party morgen', new Date('2026-10-24T10:00:00Z'));
    expect(filters.afterDate?.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(filters.beforeDate?.toISOString()).toBe('2026-10-25T22:59:59.999Z');
  });

  it('"am wochenende" Montag 00:30 Wien = kommendes Sa–So', () => {
    const { filters } = parseQuery('am wochenende', new Date('2026-10-11T22:30:00Z'));
    expect(toViennaDate(filters.afterDate!)).toBe('2026-10-17');
    expect(toViennaDate(filters.beforeDate!)).toBe('2026-10-18');
  });

  it('Wochentag "samstag" zählt ab dem Wien-Tag', () => {
    const { filters } = parseQuery('samstag', new Date('2026-10-09T22:30:00Z')); // Sa 00:30 Wien
    expect(toViennaDate(filters.afterDate!)).toBe('2026-10-10');
    expect(filters.afterDate?.toISOString()).toBe('2026-10-09T22:00:00.000Z');
  });
});

describe('Serien-Erkennung nach Wien-Wochentag und -Uhrzeit', () => {
  it('Freitag 00:30 Wien ist Freitag, nicht Donnerstag', () => {
    const r = inferDayOfWeek([
      { title: 'Late', start_date: '2026-10-08T22:30:00Z' },
      { title: 'Late', start_date: '2026-10-15T22:30:00Z' },
    ]);
    expect(r?.day).toBe(5);
  });

  it('Uhrzeit bleibt über die Zeitumstellung gleich (Wien-Wandzeit)', () => {
    const events = [
      '2026-10-13T18:00:00Z', // Di 20:00 Sommerzeit
      '2026-10-20T18:00:00Z',
      '2026-10-27T19:00:00Z', // Di 20:00 Winterzeit
      '2026-11-03T19:00:00Z',
      '2026-11-10T19:00:00Z',
    ].map((start_date) => ({ title: 'Quiz', start_date, city: 'Wien' }));
    expect(detectSeries(events)[0].series.start_time).toBe('20:00:00');
  });
});

describe('Studenten-Score nach Wien-Wochentag', () => {
  it('Donnerstag 00:30 Wien zählt als Ausgeh-Tag, Mittwoch 00:30 nicht', () => {
    const base = { title: 'X', category: null, price_min: null, price_text: null };
    const wed = computeStudentScore({ ...base, start_date: '2026-10-06T22:30:00Z' });
    const thu = computeStudentScore({ ...base, start_date: '2026-10-07T22:30:00Z' });
    expect(thu).toBeGreaterThan(wed);
  });
});

describe('Event-Intro: Enddatum nur bei anderem Wien-Tag', () => {
  const base = { title: 'Nachtkonzert', location_name: 'Arena', category: 'musik' };

  it('Start 00:30, Ende 05:00 Wien am selben Tag: kein "läuft bis"', () => {
    const s = buildCitableIntro({
      ...base,
      start_date: '2026-10-06T22:30:00Z',
      end_date: '2026-10-07T03:00:00Z',
    } as never);
    expect(s).not.toContain('läuft bis');
  });
});
