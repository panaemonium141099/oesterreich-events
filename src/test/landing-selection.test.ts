import { describe, it, expect } from 'vitest';
import { pickFestivals, arrangeBySharpness } from '@/lib/v4/get-landing-data';

const fest = (
  id: string,
  starts_at: string,
  ends_at: string,
  over: Partial<{ date_status: string; state: string | null; parent_event: { country: string | null } | null }> = {},
) => ({ id, slug: id, canonical_name: id, starts_at, ends_at, date_status: 'confirmed', state: 'Wien', parent_event: null, ...over });

describe('pickFestivals (Tagesausgabe)', () => {
  const today = '2026-09-24';
  const pool = [
    fest('vorbei', '2026-09-10', '2026-09-20'),
    fest('laeuft', '2026-09-16', '2026-09-26'),
    fest('heute', '2026-09-24', '2026-10-18'),
    fest('a', '2026-10-01', '2026-10-03'),
    fest('b', '2026-10-15', '2026-10-18'),
    fest('c', '2026-10-21', '2026-11-08'),
    fest('d', '2026-10-22', '2026-11-03'),
  ];

  it('zeigt Festivals, die noch nicht vorbei sind (ends_at >= Wiener Tag), auch laufende', () => {
    const ids = pickFestivals(pool, today, 10).map(f => f.id);
    expect(ids).not.toContain('vorbei');
    expect(ids).toContain('laeuft');
    expect(ids).toContain('heute');
  });

  it('liefert chronologisch die ersten vier', () => {
    expect(pickFestivals(pool, today).map(f => f.id)).toEqual(['laeuft', 'heute', 'a', 'b']);
  });

  it('lässt nur bestätigte Termine zu', () => {
    const ids = pickFestivals([...pool, fest('vage', '2026-09-25', '2026-09-27', { date_status: 'expected' })], today, 10).map(f => f.id);
    expect(ids).not.toContain('vage');
  });

  it('Land über das Elternevent, sonst über state in den neun Bundesländern', () => {
    const rows = [
      fest('parent-at', '2026-09-25', '2026-09-27', { state: 'Bayern', parent_event: { country: 'AT' } }),
      fest('parent-de', '2026-09-25', '2026-09-27', { state: 'Bayern', parent_event: { country: 'DE' } }),
      fest('state-noe', '2026-09-25', '2026-09-27', { state: 'niederösterreich' }),
      fest('state-de', '2026-09-25', '2026-09-27', { state: 'Bayern' }),
      fest('ohne', '2026-09-25', '2026-09-27', { state: null }),
    ];
    expect(pickFestivals(rows, today, 10).map(f => f.id).sort()).toEqual(['parent-at', 'state-noe']);
  });

  it('kommt mit null-Terminen zurecht', () => {
    const rows = [fest('tba', '2026-10-01', '2026-10-02'), { ...fest('x', '2026-10-01', '2026-10-02'), ends_at: null }];
    expect(pickFestivals(rows, today).map(f => f.id)).toEqual(['tba']);
  });
});

describe('arrangeBySharpness', () => {
  const ev = (id: string, event_score: number, image_width: number) => ({ id, event_score, image_width });

  it('Hero ist das bestgescorte scharfe Event, danach Score mit scharf bei Gleichstand', () => {
    const sharp = [ev('s70', 70, 1080), ev('s65', 65, 700)];
    const rest = [ev('k75', 75, 222), ev('k70', 70, 222), ev('s70', 70, 1080)];
    expect(arrangeBySharpness(sharp, rest).map(e => e.id)).toEqual(['s70', 'k75', 'k70', 's65']);
  });

  it('bevorzugt scharfe Bilder bei gleichem Score', () => {
    const sharp = [ev('hero', 80, 1080), ev('s70', 70, 900)];
    const rest = [ev('k70', 70, 222)];
    expect(arrangeBySharpness(sharp, rest).map(e => e.id)).toEqual(['hero', 's70', 'k70']);
  });

  it('kommt mit fehlgeschlagenen Queries (null) zurecht', () => {
    expect(arrangeBySharpness(null, [ev('r1', 50, 222)]).map(e => e.id)).toEqual(['r1']);
    expect(arrangeBySharpness(null, null)).toEqual([]);
  });
});
