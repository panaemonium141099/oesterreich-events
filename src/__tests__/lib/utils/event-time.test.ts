import { describe, it, expect } from 'vitest';
import {
  formatEventDate,
  hasKnownStartTime,
  toViennaDate,
  toViennaIso,
  viennaEndDate,
  viennaOffsetMinutes,
} from '@/lib/utils/event-time';

describe('viennaOffsetMinutes', () => {
  it('liefert +120 in der Sommerzeit und +60 im Winter', () => {
    expect(viennaOffsetMinutes(new Date('2026-07-01T12:00:00Z'))).toBe(120);
    expect(viennaOffsetMinutes(new Date('2026-01-01T12:00:00Z'))).toBe(60);
  });

  it('kippt an der DST-Umstellung zur richtigen Stunde', () => {
    // 2026-10-25: 03:00 CEST -> 02:00 CET
    expect(viennaOffsetMinutes(new Date('2026-10-25T00:30:00Z'))).toBe(120);
    expect(viennaOffsetMinutes(new Date('2026-10-25T02:30:00Z'))).toBe(60);
  });
});

describe('toViennaIso / toViennaDate', () => {
  it('schreibt Ortszeit mit explizitem Offset', () => {
    expect(toViennaIso(new Date('2026-10-01T17:00:00Z'))).toBe('2026-10-01T19:00:00+02:00');
    expect(toViennaIso(new Date('2026-12-01T19:00:00Z'))).toBe('2026-12-01T20:00:00+01:00');
  });

  it('nimmt den Wiener Kalendertag, nicht den UTC-Tag', () => {
    expect(toViennaDate(new Date('2026-10-01T22:00:00Z'))).toBe('2026-10-02');
  });
});

describe('viennaEndDate', () => {
  it('laesst ein nacktes Datum unangetastet', () => {
    // Regression: eine zu breite Regel hat "2026-09-17" auf den 16. zurueckgeschoben.
    expect(viennaEndDate(new Date('2026-09-17T00:00:00Z'))).toBe('2026-09-17');
  });

  it('haelt die viennaToUtc-Form auf ihrem gemeinten Tag', () => {
    expect(viennaEndDate(new Date('2026-10-01T22:00:00Z'))).toBe('2026-10-02');
  });

  it('holt nur den synthetischen UTC-Tagesabschluss zurueck', () => {
    expect(viennaEndDate(new Date('2026-08-08T23:59:59Z'))).toBe('2026-08-08');
  });
});

describe('hasKnownStartTime', () => {
  it('akzeptiert eine echte Uhrzeit', () => {
    expect(hasKnownStartTime({ start_date: '2026-10-01T17:00:00+00:00' })).toBe(true);
  });

  it('erkennt beide Platzhalter-Formen', () => {
    expect(hasKnownStartTime({ start_date: '2026-10-01T00:00:00+00:00' })).toBe(false);
    expect(hasKnownStartTime({ start_date: '2026-10-01T22:00:00+00:00' })).toBe(false);
  });

  it('respektiert is_all_day und duration_type', () => {
    expect(hasKnownStartTime({ start_date: '2026-10-01T14:00:00Z', is_all_day: true })).toBe(false);
    expect(hasKnownStartTime({ start_date: '2026-10-01T14:00:00Z', duration_type: 'ganztag' })).toBe(false);
  });

  it('ist bei unparsebarem Datum false statt zu werfen', () => {
    expect(hasKnownStartTime({ start_date: 'irgendwann' })).toBe(false);
  });
});

describe('formatEventDate', () => {
  it('zeigt Wiener Ortszeit, nicht die Serverzeit', () => {
    // Kern des Bugs: ohne timeZone rendert der Server "17:00" statt "19:00".
    const f = formatEventDate({ start_date: '2026-10-01T17:00:00+00:00' }, 'de-AT');
    expect(f.time).toBe('19:00');
    expect(f.label).toContain('19:00');
  });

  it('laesst die Uhrzeit weg statt eine zu erfinden', () => {
    const f = formatEventDate({ start_date: '2026-10-01T00:00:00+00:00' }, 'de-AT');
    expect(f.time).toBeNull();
    expect(f.label).not.toContain('02:00');
  });

  it('benennt den Tag in der jeweiligen Sprache', () => {
    const de = formatEventDate({ start_date: '2026-10-01T17:00:00+00:00' }, 'de-AT');
    const en = formatEventDate({ start_date: '2026-10-01T17:00:00+00:00' }, 'en-GB');
    expect(de.date).toContain('Donnerstag');
    expect(en.date).toContain('Thursday');
  });

  it('liefert leere Werte bei unparsebarem Datum', () => {
    expect(formatEventDate({ start_date: 'kaputt' }, 'de-AT')).toEqual({ date: '', time: null, label: '' });
  });
});
