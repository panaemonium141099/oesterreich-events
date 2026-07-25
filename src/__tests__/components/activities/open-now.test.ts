import { describe, it, expect } from 'vitest';
import { isOpenAt, isOpenNow, toViennaInstant, type ViennaInstant } from '@/components/Activities/open-now';
import type { NormalizedOpeningWindow } from '@/lib/activities/opening';

/** Mo=1, Di=2, Mi=4, Do=8, Fr=16, Sa=32, So=64 (E8-Bitmaske). */
const MO = 1, DI = 2, SA = 32, SO = 64;

function win(overrides: Partial<NormalizedOpeningWindow> = {}): NormalizedOpeningWindow {
  return {
    from: '2026-05-01',
    to: '2026-10-26',
    timeFrom: '09:00',
    timeTo: '17:00',
    weekdays: null,
    ...overrides,
  };
}

/** 2026-07-22 ist ein Mittwoch (Bit 4). */
function at(date: string, minutes: number, weekdayBit: number): ViennaInstant {
  return { date, minutes, weekdayBit };
}

describe('isOpenAt — E8-Vertrag', () => {
  it('offen innerhalb von Saison, Wochentag und Uhrzeit', () => {
    expect(isOpenAt([win()], at('2026-07-22', 10 * 60, 4))).toBe(true);
  });

  it('geschlossen vor timeFrom / ab timeTo (Ende exklusiv)', () => {
    expect(isOpenAt([win()], at('2026-07-22', 8 * 60 + 59, 4))).toBe(false);
    expect(isOpenAt([win()], at('2026-07-22', 17 * 60, 4))).toBe(false);
    expect(isOpenAt([win()], at('2026-07-22', 9 * 60, 4))).toBe(true);
  });

  it('geschlossen ausserhalb der Saison (inklusive Grenzen from/to)', () => {
    expect(isOpenAt([win()], at('2026-04-30', 10 * 60, 4))).toBe(false);
    expect(isOpenAt([win()], at('2026-05-01', 10 * 60, 4))).toBe(true);
    expect(isOpenAt([win()], at('2026-10-26', 10 * 60, 1))).toBe(true);
    expect(isOpenAt([win()], at('2026-10-27', 10 * 60, 2))).toBe(false);
  });

  it('Wochentags-Bitmaske: nur gesetzte Tage sind offen, null = alle Tage', () => {
    const weekend = win({ weekdays: SA | SO });
    expect(isOpenAt([weekend], at('2026-07-25', 10 * 60, SA))).toBe(true);
    expect(isOpenAt([weekend], at('2026-07-22', 10 * 60, 4))).toBe(false);
    expect(isOpenAt([win({ weekdays: null })], at('2026-07-22', 10 * 60, 4))).toBe(true);
  });

  it("timeFrom==timeTo=='00:00' = durchgehend geoeffnet (Durchgehend-Regel)", () => {
    const allDay = win({ timeFrom: '00:00', timeTo: '00:00' });
    expect(isOpenAt([allDay], at('2026-07-22', 0, 4))).toBe(true);
    expect(isOpenAt([allDay], at('2026-07-22', 23 * 60 + 59, 4))).toBe(true);
  });

  it('gleiche Nicht-Null-Zeiten = Null-Laenge, nie offen', () => {
    const zero = win({ timeFrom: '12:00', timeTo: '12:00' });
    expect(isOpenAt([zero], at('2026-07-22', 12 * 60, 4))).toBe(false);
  });

  it('Mitternachts-Fenster (22:00–02:00): Abendteil heute, Morgenteil zaehlt auf Vortag', () => {
    const night = win({ timeFrom: '22:00', timeTo: '02:00', weekdays: SA });
    // Samstag 23:00 -> offen
    expect(isOpenAt([night], at('2026-07-25', 23 * 60, SA))).toBe(true);
    // Sonntag 01:00 -> offen (Fenster startete Samstag)
    expect(isOpenAt([night], at('2026-07-26', 1 * 60, SO))).toBe(true);
    // Sonntag 03:00 -> zu
    expect(isOpenAt([night], at('2026-07-26', 3 * 60, SO))).toBe(false);
    // Montag 01:00 -> zu (Sonntag ist kein Starttag)
    expect(isOpenAt([night], at('2026-07-27', 1 * 60, MO))).toBe(false);
  });

  it('Mitternachts-Fenster am Saisonende: Morgenteil des letzten Saisontags gilt noch', () => {
    const night = win({ from: '2026-07-01', to: '2026-07-25', timeFrom: '22:00', timeTo: '02:00', weekdays: null });
    // 26.07. 01:00 — Saison endete 25.07., Fenster startete am 25.07. -> offen
    expect(isOpenAt([night], at('2026-07-26', 1 * 60, SO))).toBe(true);
    // 26.07. 23:00 -> zu (26.07. selbst ist ausserhalb der Saison)
    expect(isOpenAt([night], at('2026-07-26', 23 * 60, SO))).toBe(false);
  });

  it('leeres/fehlendes Feld -> false (Badge rendert dann gar nicht)', () => {
    expect(isOpenAt([], at('2026-07-22', 10 * 60, 4))).toBe(false);
    expect(isOpenAt(null, at('2026-07-22', 10 * 60, 4))).toBe(false);
    expect(isOpenAt(undefined, at('2026-07-22', 10 * 60, 4))).toBe(false);
  });

  it('mehrere Fenster: irgendeins offen genuegt', () => {
    const morning = win({ timeFrom: '08:00', timeTo: '12:00' });
    const evening = win({ timeFrom: '18:00', timeTo: '22:00' });
    expect(isOpenAt([morning, evening], at('2026-07-22', 19 * 60, 4))).toBe(true);
    expect(isOpenAt([morning, evening], at('2026-07-22', 14 * 60, 4))).toBe(false);
  });
});

describe('toViennaInstant — Europe/Vienna-Projektion', () => {
  it('projiziert UTC-Sommer korrekt (CEST = UTC+2)', () => {
    // 2026-07-22T08:30Z == 10:30 Wien, Mittwoch
    const instant = toViennaInstant(new Date('2026-07-22T08:30:00Z'));
    expect(instant).toEqual({ date: '2026-07-22', minutes: 10 * 60 + 30, weekdayBit: 4 });
  });

  it('projiziert UTC-Winter korrekt (CET = UTC+1) inkl. Datumswechsel', () => {
    // 2026-12-31T23:30Z == 2027-01-01 00:30 Wien, Freitag
    const instant = toViennaInstant(new Date('2026-12-31T23:30:00Z'));
    expect(instant).toEqual({ date: '2027-01-01', minutes: 30, weekdayBit: 16 });
  });
});

describe('isOpenNow', () => {
  it('kombiniert Projektion + Fensterpruefung', () => {
    // 10:30 Wien am Mittwoch, Fenster 09:00-17:00 -> offen
    expect(isOpenNow([win()], new Date('2026-07-22T08:30:00Z'))).toBe(true);
    // 20:30 Wien -> zu
    expect(isOpenNow([win()], new Date('2026-07-22T18:30:00Z'))).toBe(false);
  });
});
