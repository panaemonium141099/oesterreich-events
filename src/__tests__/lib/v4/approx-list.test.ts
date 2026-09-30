import { describe, it, expect } from 'vitest';
import type { Event } from '@/types/events';
import { approxClusterAction, orderLoadedPages, sortApproxEvents } from '@/lib/v4/approx-list';

const point = (id: string, start_date: string | null) => ({ id, start_date, title: null }) as unknown as Event;

describe('approxClusterAction', () => {
  it('zoomt, solange sich der Cluster innerhalb des Kartenzooms noch teilt', () => {
    expect(approxClusterAction(14, 18)).toBe('zoom');
    expect(approxClusterAction(18, 18)).toBe('zoom');
  });

  it('öffnet die Liste, wenn Zoomen den Cluster nicht mehr auflöst', () => {
    // Punkte auf identischer Koordinate: supercluster meldet clusterMaxZoom + 1.
    expect(approxClusterAction(23, 18)).toBe('list');
    expect(approxClusterAction(19, 18)).toBe('list');
  });
});

describe('sortApproxEvents', () => {
  it('sortiert nach Termin, bei gleichem Tag nach ID', () => {
    const sorted = sortApproxEvents([
      point('c', '2026-10-05T00:00:00.000Z'),
      point('b', '2026-10-01T00:00:00.000Z'),
      point('a', '2026-10-05T00:00:00.000Z'),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('stellt Events ohne Datum ans Ende und lässt die Eingabe unverändert', () => {
    const input = [point('x', null), point('y', '2026-10-01T00:00:00.000Z')];
    expect(sortApproxEvents(input).map((e) => e.id)).toEqual(['y', 'x']);
    expect(input.map((e) => e.id)).toEqual(['x', 'y']);
  });
});

describe('orderLoadedPages', () => {
  const loaded = (id: string, start_date: string) => ({ id, start_date, title: id }) as unknown as Event;

  it('ordnet eine geladene Seite nach der echten Startzeit', () => {
    const page = [
      loaded('a', '2026-09-30T07:20:00+00:00'),
      loaded('b', '2026-09-30T23:10:00+00:00'),
      loaded('c', '2026-09-30T07:00:00+00:00'),
    ];
    expect(orderLoadedPages(page, 24).map((e) => e.id)).toEqual(['c', 'a', 'b']);
  });

  it('lässt Seiten, die noch laden, in Punkt-Reihenfolge und mischt keine Seiten', () => {
    const events = [
      loaded('a', '2026-10-02T10:00:00+00:00'),
      loaded('b', '2026-10-01T10:00:00+00:00'),
      point('c', '2026-10-03T00:00:00.000Z'),
      loaded('d', '2026-09-30T10:00:00+00:00'),
    ];
    // Seite 1 (a, b) ist geladen und wird geordnet; Seite 2 (c, d) lädt noch.
    expect(orderLoadedPages(events, 2).map((e) => e.id)).toEqual(['b', 'a', 'c', 'd']);
  });
});
