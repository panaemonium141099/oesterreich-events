import { describe, expect, it, vi } from 'vitest';
import de from '../../../../messages/de.json';
import { planShelves } from '@/components/Discover/v4/shelves-select';
import { discoverPointIds, toAppDiscover, type AppDiscoverContext } from '@/lib/app-api/discover';
import type { AppTranslate } from '@/lib/app-api/landing';
import type { Event } from '@/types/events';

// setup.ts ersetzt next-intl durch eine Attrappe; hier zählen die echten Texte.
const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl');

const ctx: AppDiscoverContext = {
  t: createTranslator({ locale: 'de', messages: de }) as unknown as AppTranslate,
  locale: 'de',
  origin: 'https://example.test',
};

const TODAY = '2026-11-05'; // Donnerstag

/** Punkt des Karten-Snapshots: Kurz-ID, kein Titel, kein Bild. */
function point(short: string, over: Partial<Event> = {}): Event {
  return {
    id: short,
    title: null,
    slug: null,
    start_date: '2026-11-05T19:00:00+00:00',
    end_date: null,
    category: 'Musik',
    bundesland: 'wien',
    district: null,
    price_tier: null,
    price_text: null,
    event_score: 50,
    image_url: null,
    location_name: null,
    ...over,
  } as unknown as Event;
}

/** Zeile der Details-RPC: volle UUID, Titel, Bild. */
function detail(short: string, over: Partial<Event> = {}): [string, Partial<Event>] {
  return [
    short,
    {
      id: `${short.slice(0, 8)}-${short.slice(8, 12)}-4000-8000-000000000000`,
      slug: `event-${short}`,
      title: `Event ${short}`,
      image_url: `https://img.example/${short}.jpg`,
      location_name: 'Gasometer',
      address: null,
      postal_code: '1110',
      start_date: '2026-11-05T19:00:00+00:00',
      end_date: null,
      price_text: null,
      ...over,
    },
  ];
}

const A = 'aaaaaaaaaaaa';
const B = 'bbbbbbbbbbbb';
const C = 'cccccccccccc';

describe('toAppDiscover', () => {
  it('füllt die Punkte mit Details und nimmt die volle UUID', () => {
    const points = [point(A, { event_score: 90 }), point(B, { event_score: 80 })];
    const plan = planShelves(points, TODAY);
    const out = toAppDiscover(
      { plan, today: TODAY, details: new Map([detail(A), detail(B)]), allEvents: points },
      ctx,
    );
    expect(out.picks.map(e => e.id)).toEqual([
      'aaaaaaaa-aaaa-4000-8000-000000000000',
      'bbbbbbbb-bbbb-4000-8000-000000000000',
    ]);
    expect(out.picks[0]).toMatchObject({ title: `Event ${A}`, time: '20:00', place: 'Gasometer · Wien' });
  });

  it('zeigt Top-Picks nur mit Bild und nicht noch einmal unter „Heute Abend"', () => {
    const points = [point(A, { event_score: 90 }), point(B, { event_score: 80 }), point(C, { event_score: 70 })];
    const plan = planShelves(points, TODAY);
    const out = toAppDiscover(
      {
        plan,
        today: TODAY,
        details: new Map([detail(A), detail(B, { image_url: null }), detail(C)]),
        allEvents: points,
      },
      ctx,
    );
    expect(out.picks.map(e => e.title)).toEqual([`Event ${A}`, `Event ${C}`]);
    expect(out.tonight.events.map(e => e.title)).toEqual([`Event ${B}`]);
    // Der Zähler nennt alle Events des Tages, nicht nur die gezeigten.
    expect(out.tonight).toMatchObject({ count: 3, sub: '3 Events', day: TODAY });
  });

  it('lässt Punkte ohne Details weg, statt leere Karten zu zeigen', () => {
    const points = [point(A), point(B)];
    const plan = planShelves(points, TODAY);
    const out = toAppDiscover({ plan, today: TODAY, details: new Map([detail(A)]), allEvents: points }, ctx);
    expect(out.picks).toHaveLength(1);
  });

  it('zählt je Region und benennt Wochenende und Kategorien', () => {
    const points = [
      point(A),
      point(B, { bundesland: 'steiermark', start_date: '2026-11-07T18:00:00+00:00', category: 'Kultur & Bühne' }),
    ];
    const plan = planShelves(points, TODAY);
    const out = toAppDiscover(
      { plan, today: TODAY, details: new Map([detail(A), detail(B)]), allEvents: points },
      ctx,
    );
    expect(out.weekend.sub).toBe('Sa 7. Nov. bis So 8. Nov.');
    expect(out.weekend.range).toEqual({ from: '2026-11-07', to: '2026-11-08' });
    expect(out.weekend.events).toHaveLength(1);
    const counts = Object.fromEntries(out.regions.map(r => [r.id, r.count]));
    expect(counts.wien).toBe(1);
    expect(counts.steiermark).toBe(1);
    expect(counts.tirol).toBe(0);
    expect(out.categoryCounts).toEqual([
      { category: 'Musik', label: 'Musik', count: 1 },
      { category: 'Kultur & Bühne', label: 'Kultur & Bühne', count: 1 },
    ]);
  });
});

describe('discoverPointIds', () => {
  it('nennt jeden gezeigten Punkt einmal', () => {
    const plan = planShelves([point(A), point(B, { price_tier: 'gratis' })], TODAY);
    expect(discoverPointIds(plan).sort()).toEqual([A, B]);
  });
});
