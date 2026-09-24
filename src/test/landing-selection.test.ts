import { describe, it, expect } from 'vitest';
import { pickFestivals, arrangeBySharpness } from '@/lib/v4/get-landing-data';

const fest = (id: string, starts_at: string, ends_at: string, lineup_status = 'fetched') =>
  ({ id, starts_at, ends_at, lineup_status });

describe('pickFestivals', () => {
  const now = new Date('2026-09-24T10:00:00Z');
  const pool = [
    fest('laeuft', '2026-09-16', '2026-09-26'),
    fest('serie', '2026-01-28', '2026-12-17'),
    fest('heute', '2026-09-24', '2026-10-18'),
    fest('a', '2026-10-01', '2026-10-03'),
    fest('b', '2026-10-15', '2026-10-18'),
    fest('c', '2026-10-21', '2026-11-08'),
    fest('d', '2026-10-22', '2026-11-03'),
    fest('e', '2026-11-25', '2027-01-06'),
    fest('f', '2027-02-08', '2027-02-19'),
  ];

  it('zeigt nur Festivals, die heute oder später beginnen', () => {
    const ids = pickFestivals(pool, 10, now).map(f => f.id);
    expect(ids).not.toContain('laeuft');
    expect(ids).not.toContain('serie');
    expect(ids).toContain('heute');
  });

  it('sortiert die Auswahl chronologisch', () => {
    const starts = pickFestivals(pool, 4, now).map(f => f.starts_at);
    expect(starts).toEqual([...starts].sort());
  });

  it('rotiert stündlich', () => {
    const selections = new Set<string>();
    for (let h = 0; h < 24; h++) {
      const at = new Date(now.getTime() + h * 3_600_000);
      selections.add(pickFestivals(pool, 4, at).map(f => f.id).join(','));
    }
    expect(selections.size).toBeGreaterThan(1);
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
