import { describe, it, expect } from 'vitest';
import { hasNarrowing, planShelves, SHELF_SIZE, PICKS_POOL } from '@/components/Discover/v4/shelves-select';
import type { Event } from '@/types/events';

/** Punkt aus dem Karten-Snapshot (title=null, Tag als T00:00Z). */
function point(id: string, day: string, extra: Partial<Event> = {}): Event {
  return {
    id,
    title: null,
    slug: null,
    start_date: `${day}T00:00:00.000Z`,
    end_date: null,
    category: 'Musik',
    image_url: null,
    location_name: null,
    event_score: 50,
    price_text: null,
    price_min: null,
    price_max: null,
    ...extra,
  } as unknown as Event;
}

// Donnerstag, 22. Oktober 2026 (Wochenende = Sa 24. + So 25.)
const TODAY = '2026-10-22';

describe('planShelves', () => {
  it('sortiert heute und morgen in Picks, nur heute in „Heute Abend"', () => {
    const plan = planShelves([
      point('a', '2026-10-22', { event_score: 10 }),
      point('b', '2026-10-22', { event_score: 90 }),
      point('c', '2026-10-23', { event_score: 70 }),
      point('d', '2026-10-21'), // vergangen
    ], TODAY);
    expect(plan.picksPool.map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(plan.tonight.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('findet das kommende Wochenende über denselben Preset wie der Filter', () => {
    const plan = planShelves([
      point('fr', '2026-10-23'),
      point('sa', '2026-10-24'),
      point('so', '2026-10-25'),
      point('mo', '2026-10-26'),
    ], TODAY);
    expect(plan.weekendFrom).toBe('2026-10-24');
    expect(plan.weekendTo).toBe('2026-10-25');
    expect(plan.weekend.map((e) => e.id).sort()).toEqual(['sa', 'so']);
  });

  it('bildet Kategorie-Regale nach Häufigkeit und lässt Sonstiges aus', () => {
    const events: Event[] = [];
    for (let i = 0; i < 5; i++) events.push(point(`m${i}`, '2026-10-23', { category: 'Musik' }));
    for (let i = 0; i < 8; i++) events.push(point(`k${i}`, '2026-10-23', { category: 'Kultur & Bühne' }));
    for (let i = 0; i < 3; i++) events.push(point(`f${i}`, '2026-10-23', { category: 'Märkte & Feste' }));
    for (let i = 0; i < 9; i++) events.push(point(`s${i}`, '2026-10-23', { category: 'Sonstiges' }));
    for (let i = 0; i < 2; i++) events.push(point(`n${i}`, '2026-10-23', { category: 'Natur & Abenteuer' }));
    // außerhalb des 14-Tage-Horizonts
    events.push(point('late', '2026-11-20', { category: 'Musik' }));
    const plan = planShelves(events, TODAY);
    expect(plan.categories.map((c) => c.category)).toEqual(['Kultur & Bühne', 'Musik', 'Märkte & Feste']);
    expect(plan.categoryCounts.find((c) => c.category === 'Musik')?.count).toBe(5);
    expect(plan.categoryCounts.some((c) => c.category === 'Sonstiges')).toBe(false);
  });

  it('erkennt Gratis am Snapshot-Flag und an Preisfeldern', () => {
    const plan = planShelves([
      point('flag', '2026-10-23', { price_text: 'gratis' }),
      point('tier', '2026-10-23', { price_tier: 'gratis' }),
      point('zero', '2026-10-23', { price_min: 0, price_max: 0 }),
      point('paid', '2026-10-23', { price_min: 12 }),
    ], TODAY);
    expect(plan.free.map((e) => e.id).sort()).toEqual(['flag', 'tier', 'zero']);
  });

  it('kappt jedes Regal auf seine Größe', () => {
    const events = Array.from({ length: 40 }, (_, i) => point(`e${i}`, '2026-10-22', { event_score: i }));
    const plan = planShelves(events, TODAY);
    expect(plan.tonight).toHaveLength(SHELF_SIZE);
    expect(plan.tonightCount).toBe(40);
    expect(plan.picksPool).toHaveLength(PICKS_POOL);
    expect(plan.picksPool[0].id).toBe('e39');
  });
});

describe('hasNarrowing', () => {
  it('ignoriert Anzeige- und Sortierfelder', () => {
    expect(hasNarrowing({}, ['all'])).toBe(false);
    expect(hasNarrowing({ topicLabel: 'Herbst', sort: 'score', tags: [] }, ['all'])).toBe(false);
  });
  it('erkennt Filter und Bundesland-Auswahl', () => {
    expect(hasNarrowing({ search: 'Jazz' }, ['all'])).toBe(true);
    expect(hasNarrowing({ dateFrom: '2026-10-22' }, ['all'])).toBe(true);
    expect(hasNarrowing({}, ['wien'])).toBe(true);
  });
});
