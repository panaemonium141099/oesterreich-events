import { describe, it, expect } from 'vitest';
import { buildEventParams, filterByBundesland, dedupeEvents, narrowEvents } from '@/lib/v4/use-filtered-events';
import type { Event } from '@/types/events';

const ev = (o: Partial<Event>): Event => ({ id: Math.random().toString(36), title: 'X', start_date: '2026-10-01T18:00:00Z', ...o }) as Event;

describe('buildEventParams', () => {
  it('sendet Tags, Datum und Länderwahl wie die Liste', () => {
    const p = buildEventParams({ tags: ['weinfest', 'kirtag'], dateTo: '2026-11-13', atOnly: false }, ['all']);
    expect(p.get('tags')).toBe('weinfest,kirtag');
    expect(p.get('dateTo')).toBe('2026-11-13');
    expect(p.get('countries')).toBe('AT,DE,CH');
    expect(p.get('bundesland')).toBe('all');
  });
  it('mehrere Bundesländer als bundeslands', () => {
    const p = buildEventParams({}, ['wien', 'burgenland']);
    expect(p.get('bundeslands')).toBe('wien,burgenland');
  });
});

describe('Client-Filter (Liste und Vorschau)', () => {
  it('fasst gleichen Titel am gleichen Tag zusammen, Punkte ohne Titel nicht', () => {
    const rows = [ev({ title: 'Sturmfest' }), ev({ title: 'sturmfest ' }), ev({ title: null as unknown as string }), ev({ title: null as unknown as string })];
    expect(dedupeEvents(rows)).toHaveLength(3);
  });
  it('filtert Bundesland, Datum und Kategorie', () => {
    const rows = [
      ev({ bundesland: 'Burgenland', category: 'Musik', start_date: '2026-10-01T18:00:00Z' }),
      ev({ bundesland: 'Wien', category: 'Musik', start_date: '2026-10-01T18:00:00Z' }),
      ev({ bundesland: 'Burgenland', category: 'Musik', start_date: '2026-12-01T18:00:00Z' }),
    ];
    const bl = filterByBundesland(rows, ['burgenland']);
    expect(bl).toHaveLength(2);
    expect(narrowEvents(bl, { dateTo: '2026-11-13', categories: ['Musik'] })).toHaveLength(1);
  });
});
