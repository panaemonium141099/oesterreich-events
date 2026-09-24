import { describe, it, expect } from 'vitest';
import type { Event } from '@/types/events';
import { pickSeasonEvents, SEASON_ROTATION_POOL } from '@/lib/v4/get-landing-data';

const ev = (id: string, title = `Event ${id}`) => ({ id, title } as unknown as Event);
const NOW = new Date('2026-09-24T12:00:00Z');

describe('pickSeasonEvents', () => {
  it('stellt gepinnte Events vor die Rotation und markiert sie', () => {
    const picks = pickSeasonEvents([ev('p1'), ev('p2')], [ev('a'), ev('b'), ev('c')], new Set(), 4, NOW);
    expect(picks.slice(0, 2).map(e => [e.id, e.featured])).toEqual([['p1', true], ['p2', true]]);
    expect(picks).toHaveLength(4);
    expect(picks.slice(2).every(e => !e.featured)).toBe(true);
  });

  it('zeigt kein Event doppelt, weder per ID noch per Titel', () => {
    const picks = pickSeasonEvents(
      [ev('p1', 'Heuriger Müller')],
      [ev('p1', 'Heuriger Müller'), ev('x', 'heuriger müller '), ev('a'), ev('b'), ev('c')],
      new Set(), 4, NOW,
    );
    expect(picks.map(e => e.id).sort()).toEqual(['a', 'b', 'c', 'p1']);
  });

  it('lässt Events der Wochenend-Sektion aus', () => {
    const picks = pickSeasonEvents([], [ev('a'), ev('b'), ev('c'), ev('d')], new Set(['a', 'b']), 4, NOW);
    expect(picks.map(e => e.id).sort()).toEqual(['c', 'd']);
  });

  it('rotiert nur innerhalb der besten SEASON_ROTATION_POOL Events, stabil pro Stunde', () => {
    const pool = Array.from({ length: 30 }, (_, i) => ev(`e${i}`));
    const top = new Set(pool.slice(0, SEASON_ROTATION_POOL).map(e => e.id));
    const a = pickSeasonEvents([], pool, new Set(), 4, NOW);
    expect(a.every(e => top.has(e.id))).toBe(true);
    expect(pickSeasonEvents([], pool, new Set(), 4, new Date(NOW.getTime() + 60_000))).toEqual(a);
  });

  it('füllt mit Pins allein, wenn es genug davon gibt', () => {
    const picks = pickSeasonEvents([ev('1'), ev('2'), ev('3'), ev('4'), ev('5')], [ev('a')], new Set(), 4, NOW);
    expect(picks.map(e => e.id)).toEqual(['1', '2', '3', '4']);
  });
});
