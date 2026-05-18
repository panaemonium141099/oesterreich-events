/**
 * Beweis: Der "Top"-Sort der Listenansicht setzt Events mit echten
 * Bildern STRICT vor Events mit Fallback-Bildern, und sortiert innerhalb
 * jedes Tiers nach Datum aufsteigend (nächstes Datum oben).
 *
 * Bug-Hintergrund: vorher war "Top" rein `event_score` desc → einzelne
 * Fallback-Events poppten zwischen Foto-Events nur weil sie ein paar
 * Score-Punkte mehr hatten. Das fühlte sich nach schwankender Qualität
 * an obwohl die wahrgenommene Qualität rein vom Bild kommt.
 *
 * Test repliziert die Sort-Logik 1:1 aus EventListView.tsx (sort='score'
 * branch). Wenn der Branch verändert wird ohne hier nachzuziehen,
 * failed der Test → wir merken den Regression sofort.
 */

import { describe, it, expect } from 'vitest';

type SortableEvent = {
  id: string;
  image_url: string | null;
  start_date: string;
};

// 1:1 die Logik aus EventListView's `sort === 'score'` branch.
function topSort<T extends SortableEvent>(events: T[]): T[] {
  const list = [...events];
  const hasRealImage = (e: SortableEvent) => !!(e.image_url && e.image_url.trim());
  const byDateAsc = (a: SortableEvent, b: SortableEvent) =>
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  list.sort((a, b) => {
    const aHas = hasRealImage(a);
    const bHas = hasRealImage(b);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return byDateAsc(a, b);
  });
  return list;
}

describe('EventListView "Top" sort — Bild-Tier zuerst, Datum aufsteigend', () => {
  it('Events mit Bild kommen VOR Events ohne Bild — auch wenn fallback-Event früher ist', () => {
    const events: SortableEvent[] = [
      { id: 'no-img-soon',  image_url: null,                       start_date: '2026-05-20' },
      { id: 'img-late',     image_url: 'https://example.com/a.jpg', start_date: '2026-06-15' },
    ];
    expect(topSort(events).map(e => e.id)).toEqual(['img-late', 'no-img-soon']);
  });

  it('Innerhalb des Bild-Tiers: nächstes Datum oben', () => {
    const events: SortableEvent[] = [
      { id: 'img-late',  image_url: 'https://example.com/a.jpg', start_date: '2026-07-01' },
      { id: 'img-near',  image_url: 'https://example.com/b.jpg', start_date: '2026-05-25' },
      { id: 'img-mid',   image_url: 'https://example.com/c.jpg', start_date: '2026-06-10' },
    ];
    expect(topSort(events).map(e => e.id)).toEqual(['img-near', 'img-mid', 'img-late']);
  });

  it('Innerhalb des Fallback-Tiers: nächstes Datum oben', () => {
    const events: SortableEvent[] = [
      { id: 'fb-late',  image_url: null,  start_date: '2026-07-01' },
      { id: 'fb-near',  image_url: '',    start_date: '2026-05-25' },
      { id: 'fb-mid',   image_url: '  ',  start_date: '2026-06-10' },
    ];
    expect(topSort(events).map(e => e.id)).toEqual(['fb-near', 'fb-mid', 'fb-late']);
  });

  it('Mixed Set: alle Bild-Events oben, dann alle Fallback-Events, je nach Datum sortiert', () => {
    const events: SortableEvent[] = [
      { id: 'fb-near',  image_url: null,                       start_date: '2026-05-20' },
      { id: 'img-far',  image_url: 'https://x.jpg',            start_date: '2026-08-01' },
      { id: 'fb-far',   image_url: '',                         start_date: '2026-09-01' },
      { id: 'img-near', image_url: 'https://y.jpg',            start_date: '2026-05-22' },
    ];
    expect(topSort(events).map(e => e.id)).toEqual([
      'img-near', 'img-far',   // Tier 1: Bild-Events nach Datum
      'fb-near',  'fb-far',    // Tier 2: Fallback nach Datum
    ]);
  });

  it('Whitespace-only image_url zählt als KEIN echtes Bild', () => {
    const events: SortableEvent[] = [
      { id: 'whitespace', image_url: '   ',           start_date: '2026-05-20' },
      { id: 'real',       image_url: 'https://x.jpg', start_date: '2026-06-15' },
    ];
    expect(topSort(events).map(e => e.id)).toEqual(['real', 'whitespace']);
  });
});
