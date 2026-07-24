import { describe, it, expect } from 'vitest';
import { normalizeOpeningTimes, WEEKDAY_BITS } from '@/lib/activities/opening';

describe('normalizeOpeningTimes (Epic-E8-Vertrag)', () => {
  it('Fixture 1: Mountaincart-Saisonfenster (Deskline-Rohformat, live 2026-07-24)', () => {
    // Saisonbetrieb wie beim Kletterpark/Mountaincart: Fruehjahr nur Do-Sa,
    // Hochsaison Do/Fr/Sa — Deskline liefert dateFrom/dateTo als naive
    // Timestamps und weekdays bereits als Mo=1..So=64-Bitmaske.
    const raw = [
      { dateFrom: '2026-04-15T00:00:00', dateTo: '2026-06-30T00:00:00', timeFrom: '13:00', timeTo: '18:00', weekdays: 32 },
      { dateFrom: '2026-07-01T00:00:00', dateTo: '2026-08-31T00:00:00', timeFrom: '13:00', timeTo: '18:00', weekdays: 56 },
    ];
    expect(normalizeOpeningTimes(raw)).toEqual([
      { from: '2026-04-15', to: '2026-06-30', timeFrom: '13:00', timeTo: '18:00', weekdays: 32 },
      { from: '2026-07-01', to: '2026-08-31', timeFrom: '13:00', timeTo: '18:00', weekdays: 56 },
    ]);
  });

  it('Fixture 2: Supermarkt-Wochentags-Bitmaske (Mo-Fr + Sa getrennt)', () => {
    const moBisFr =
      WEEKDAY_BITS.mo + WEEKDAY_BITS.di + WEEKDAY_BITS.mi + WEEKDAY_BITS.do + WEEKDAY_BITS.fr;
    const raw = [
      { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '08:00', timeTo: '19:00', weekdays: moBisFr },
      { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '08:00', timeTo: '18:00', weekdays: WEEKDAY_BITS.sa },
    ];
    const result = normalizeOpeningTimes(raw)!;
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ from: '2026-01-01', to: '2026-12-31', timeFrom: '08:00', timeTo: '18:00', weekdays: 32 });
    expect(result[1]).toEqual({ from: '2026-01-01', to: '2026-12-31', timeFrom: '08:00', timeTo: '19:00', weekdays: 31 });
  });

  it('Fixture 3: Ladestation durchgehend (00:00/00:00, weekdays 0 -> null)', () => {
    // Real beobachtetes Muster ("Sport Embacher", blsalzb): weekdays 0 =
    // keine Wochentags-Einschraenkung.
    const raw = [
      { dateFrom: '2026-06-18T00:00:00', dateTo: '2026-12-20T00:00:00', timeFrom: '00:00', timeTo: '00:00', weekdays: 0 },
    ];
    expect(normalizeOpeningTimes(raw)).toEqual([
      { from: '2026-06-18', to: '2026-12-20', timeFrom: '00:00', timeTo: '00:00', weekdays: null },
    ]);
  });

  it('weekdays 127 (alle Tage explizit) wird zu null normalisiert', () => {
    const raw = [
      { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00', weekdays: 127 },
    ];
    expect(normalizeOpeningTimes(raw)![0].weekdays).toBeNull();
  });

  it('malformte weekdays verwerfen das Fenster (nie stillschweigend "alle Tage")', () => {
    const base = { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00' };
    expect(normalizeOpeningTimes([{ ...base }])).toBeNull();                    // fehlend
    expect(normalizeOpeningTimes([{ ...base, weekdays: '31' }])).toBeNull();    // String
    expect(normalizeOpeningTimes([{ ...base, weekdays: 255 }])).toBeNull();     // > 127
    expect(normalizeOpeningTimes([{ ...base, weekdays: -1 }])).toBeNull();      // negativ
    expect(normalizeOpeningTimes([{ ...base, weekdays: 3.5 }])).toBeNull();     // nicht-ganzzahlig
    // Explizite 0/127 bleiben valide (alle Tage).
    expect(normalizeOpeningTimes([{ ...base, weekdays: 0 }])![0].weekdays).toBeNull();
  });

  it('akzeptiert HH:MM:SS und normalisiert auf HH:MM', () => {
    const raw = [
      { dateFrom: '2026-05-01T00:00:00', dateTo: '2026-10-31T00:00:00', timeFrom: '09:00:00', timeTo: '17:30:00', weekdays: 96 },
    ];
    expect(normalizeOpeningTimes(raw)![0]).toMatchObject({ timeFrom: '09:00', timeTo: '17:30' });
  });

  it('ueberspringt unparsebare Eintraege, behaelt valide', () => {
    const raw = [
      { dateFrom: 'kaputt', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00', weekdays: 1 },
      { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00', weekdays: 1 },
      null,
      42,
    ];
    expect(normalizeOpeningTimes(raw)).toEqual([
      { from: '2026-01-01', to: '2026-12-31', timeFrom: '09:00', timeTo: '17:00', weekdays: 1 },
    ]);
  });

  it('Garbage-Suffixe und invalide Zeitanteile im Datum verwerfen den Eintrag', () => {
    const base = { timeFrom: '09:00', timeTo: '17:00', weekdays: 1 };
    expect(normalizeOpeningTimes([{ ...base, dateFrom: '2026-02-28garbage', dateTo: '2026-12-31T00:00:00' }])).toBeNull();
    expect(normalizeOpeningTimes([{ ...base, dateFrom: '2026-02-28T99:99:99', dateTo: '2026-12-31T00:00:00' }])).toBeNull();
    // Exaktes Datum ohne Zeitanteil bleibt valide.
    expect(normalizeOpeningTimes([{ ...base, dateFrom: '2026-02-28', dateTo: '2026-12-31' }])).not.toBeNull();
  });

  it('nicht existierende Kalenderdaten werden verworfen (2026-13-40, 2026-02-30)', () => {
    const raw = [
      { dateFrom: '2026-13-40T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00', weekdays: 1 },
      { dateFrom: '2026-02-30T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00', weekdays: 1 },
      { dateFrom: '2026-02-28T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00', weekdays: 1 },
    ];
    expect(normalizeOpeningTimes(raw)).toEqual([
      { from: '2026-02-28', to: '2026-12-31', timeFrom: '09:00', timeTo: '17:00', weekdays: 1 },
    ]);
  });

  it('invalide Uhrzeiten werden verworfen (24:30, 09:75)', () => {
    const base = { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', weekdays: 1 };
    expect(normalizeOpeningTimes([{ ...base, timeFrom: '24:30', timeTo: '17:00' }])).toBeNull();
    expect(normalizeOpeningTimes([{ ...base, timeFrom: '09:00', timeTo: '09:75' }])).toBeNull();
    expect(normalizeOpeningTimes([{ ...base, timeFrom: '09:00:99', timeTo: '17:00' }])).toBeNull();
    expect(normalizeOpeningTimes([{ ...base, timeFrom: '23:59', timeTo: '00:00' }])).not.toBeNull();
  });

  it('fehlende/leere Zeiten werden NIE als durchgehend publiziert (Fenster verworfen)', () => {
    const base = { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', weekdays: 1 };
    expect(normalizeOpeningTimes([{ ...base }])).toBeNull();
    expect(normalizeOpeningTimes([{ ...base, timeFrom: '', timeTo: '' }])).toBeNull();
    expect(normalizeOpeningTimes([{ ...base, timeFrom: '09:00' }])).toBeNull();
    expect(normalizeOpeningTimes([{ ...base, timeFrom: null, timeTo: '17:00' }])).toBeNull();
    // Nur EXPLIZITES 00:00/00:00 aus der Quelle bedeutet durchgehend.
    expect(normalizeOpeningTimes([{ ...base, timeFrom: '00:00', timeTo: '00:00' }])).toEqual([
      { from: '2026-01-01', to: '2026-12-31', timeFrom: '00:00', timeTo: '00:00', weekdays: 1 },
    ]);
  });

  it('dateTo vor dateFrom -> Eintrag verworfen', () => {
    const raw = [
      { dateFrom: '2026-10-01T00:00:00', dateTo: '2026-05-01T00:00:00', timeFrom: '09:00', timeTo: '17:00', weekdays: 1 },
    ];
    expect(normalizeOpeningTimes(raw)).toBeNull();
  });

  it('null/leer/kein Array -> null', () => {
    expect(normalizeOpeningTimes(null)).toBeNull();
    expect(normalizeOpeningTimes(undefined)).toBeNull();
    expect(normalizeOpeningTimes([])).toBeNull();
    expect(normalizeOpeningTimes('nix')).toBeNull();
    expect(normalizeOpeningTimes([{ dateFrom: 'x' }])).toBeNull();
  });

  it('dedupliziert identische Fenster und sortiert deterministisch', () => {
    const w = { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00', weekdays: 5 };
    const early = { dateFrom: '2025-06-01T00:00:00', dateTo: '2025-09-30T00:00:00', timeFrom: '10:00', timeTo: '16:00', weekdays: 5 };
    const result = normalizeOpeningTimes([w, early, { ...w }])!;
    expect(result).toHaveLength(2);
    expect(result[0].from).toBe('2025-06-01');
    expect(result[1].from).toBe('2026-01-01');
  });

  it('weekdays sortieren numerisch (5 vor 31), null (alle Tage) zuerst', () => {
    const base = { dateFrom: '2026-01-01T00:00:00', dateTo: '2026-12-31T00:00:00', timeFrom: '09:00', timeTo: '17:00' };
    const result = normalizeOpeningTimes([
      { ...base, weekdays: 31 },
      { ...base, weekdays: 5 },
      { ...base, weekdays: 127 },
    ])!;
    expect(result.map((w) => w.weekdays)).toEqual([null, 5, 31]);
  });
});
