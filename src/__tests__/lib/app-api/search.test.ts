import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import type { AppTranslate } from '@/lib/app-api/landing';
import { toAppSearch, type AppSearchContext } from '@/lib/app-api/search';
import type { SmartSearchPayload } from '@/lib/search/smart-search';

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppSearchContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
};

const NOW = new Date('2026-11-05T10:00:00Z'); // Donnerstag

function match(id: string, over: Record<string, unknown> = {}) {
  return {
    id: `${id}0000000-0000-4000-8000-000000000000`.slice(0, 36),
    title: `Event ${id}`,
    slug: `event-${id}`,
    start_date: '2026-11-07T19:00:00+00:00', // Samstag, 20:00 Wien
    end_date: null,
    location_name: 'Orpheum',
    postal_code: '8020',
    address: null,
    district: null,
    bundesland: 'steiermark',
    category: 'Musik',
    tags: null,
    audience: null,
    vibe: null,
    occasion_tags: null,
    event_score: 60,
    image_url: `https://img.example/${id}.jpg`,
    price_text: null,
    price_tier: null,
    ...over,
  };
}

function payload(over: Partial<SmartSearchPayload> = {}): SmartSearchPayload {
  return {
    query: 'Konzert am Samstag in Graz',
    parsed: {
      embedded_text: 'konzert',
      after_date: null,
      before_date: null,
      max_price_tier: null,
      signals: [],
      location_district: null,
      location_bundesland: 'steiermark',
      content_types: [],
      unmatched_terms: [],
    },
    matches: [],
    count: 0,
    activityMatches: [],
    ...over,
  } as unknown as SmartSearchPayload;
}

describe('toAppSearch', () => {
  it('rechnet Treffer in Regale mit Karten und nennt weitere Termine einer Reihe', () => {
    const out = toAppSearch(
      payload({ matches: [match('a'), match('b', { series_count: 4 })] as never, count: 2 }),
      ctx,
      NOW,
    );
    expect(out.version).toBe(1);
    expect(out.empty).toBe(false);
    const events = out.shelves.flatMap(shelf => shelf.events);
    expect(events.map(e => e.title).sort()).toEqual(['Event a', 'Event b']);
    expect(events.find(e => e.title === 'Event a')).toMatchObject({ time: '20:00', place: 'Orpheum · Steiermark', moreDates: 0 });
    expect(events.find(e => e.title === 'Event b')?.moreDates).toBe(3);
    for (const shelf of out.shelves) expect(shelf.title.length).toBeGreaterThan(0);
  });

  it('meldet eine leere Suche als leer und schreibt trotzdem einen Satz', () => {
    const out = toAppSearch(payload(), ctx, NOW);
    expect(out.empty).toBe(true);
    expect(out.shelves).toEqual([]);
    expect(out.summary.length).toBeGreaterThan(0);
  });

  it('zeigt Ausflugsziele als Karten mit Bildnachweis', () => {
    const out = toAppSearch(
      payload({
        activityMatches: [
          {
            id: 'p1',
            slug: 'therme-x',
            name: 'Therme X',
            description_short: null,
            tags: ['therme'],
            setting: 'indoor',
            town: 'Bad Blumau',
            gemeinde_slug: null,
            bundesland: 'steiermark',
            images: [{ urls: ['https://cdn.example/t.jpg'], copyright: 'TVB Muster' }],
            price_hint: null,
            online_bookable: false,
            distance_km: null,
            _similarity: 0.8,
          },
        ] as never,
      }),
      ctx,
      NOW,
    );
    expect(out.empty).toBe(false);
    expect(out.activities).toEqual([
      expect.objectContaining({
        slug: 'therme-x',
        image: 'https://cdn.example/t.jpg',
        credit: 'TVB Muster',
        place: 'Bad Blumau · Steiermark',
      }),
    ]);
  });

  it('reicht Chips und Nachfragen der Website durch', () => {
    const out = toAppSearch(payload({ matches: [match('a')] as never, count: 1 }), ctx, NOW);
    expect(out.chips.some(chip => chip.label === 'Steiermark')).toBe(true);
    expect(out.refine.length).toBeGreaterThan(0);
    for (const chip of out.refine) expect(chip.append.trim()).not.toBe('');
  });
});
