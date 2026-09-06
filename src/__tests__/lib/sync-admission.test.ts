/**
 * Eingangsprüfung im gemeinsamen Schreibpfad.
 *
 * `filterValidEvents` ist die Stelle, an der ein Kandidat gar nicht erst
 * geschrieben wird. Sie ersetzt die frühere `slice(0, 10)`-Prüfung, die
 * ein Event von 18:00 bis 17:00 desselben Tages durchliess.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { filterValidEvents } from '@/lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';

const base: ScrapedEvent = {
  source_name: 'test',
  source_id: 'a',
  source_url: 'https://example.at/a',
  title: 'Testkonzert',
  start_date: '2026-10-01T19:00:00+02:00',
  location_name: 'Musikheim',
} as ScrapedEvent;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-06T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('filterValidEvents', () => {
  it('lässt ein gültiges künftiges Event durch', () => {
    const r = filterValidEvents([base]);
    expect(r.valid).toHaveLength(1);
    expect(r.rejected).toBe(0);
  });

  it('verwirft ein rückwärts laufendes Zeitintervall', () => {
    const r = filterValidEvents([
      { ...base, start_date: '2026-10-01T18:00:00+02:00', end_date: '2026-10-01T17:00:00+02:00' },
    ]);
    expect(r.valid).toHaveLength(0);
    expect(r.rejectionReasons.end_before_start).toBe(1);
  });

  it('lässt Start-mit-Uhrzeit + datums-only-Ende durch', () => {
    const r = filterValidEvents([
      { ...base, start_date: '2026-10-01T18:00:00+02:00', end_date: '2026-10-01T00:00:00Z' },
    ]);
    expect(r.valid).toHaveLength(1);
  });

  it('verwirft vergangene Events, behält heutige', () => {
    const r = filterValidEvents([
      { ...base, source_id: 'past', start_date: '2026-09-01T19:00:00+02:00' },
      { ...base, source_id: 'today', start_date: '2026-09-06T19:00:00+02:00' },
    ]);
    expect(r.valid.map(e => e.source_id)).toEqual(['today']);
    expect(r.rejectionReasons.start_in_past).toBe(1);
  });

  it('verwirft Events ohne Titel oder ohne Datum und meldet die Gründe', () => {
    const r = filterValidEvents([
      { ...base, source_id: 'no-title', title: '  ' },
      { ...base, source_id: 'no-date', start_date: '' },
      { ...base, source_id: 'bad-date', start_date: 'nächsten Sommer' },
    ] as ScrapedEvent[]);
    expect(r.valid).toHaveLength(0);
    expect(r.rejected).toBe(3);
    expect(r.rejectionReasons.missing_title).toBe(1);
    expect(r.rejectionReasons.missing_start_date).toBe(1);
    expect(r.rejectionReasons.invalid_start_date).toBe(1);
  });

  it('verwirft NICHT wegen fehlender Ortsangabe — darüber entscheidet erst der aufgelöste Ort', () => {
    const r = filterValidEvents([{ ...base, location_name: undefined }]);
    expect(r.valid).toHaveLength(1);
  });
});
