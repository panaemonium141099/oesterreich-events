/**
 * fn-18 Task 4 — Cross-Link-Sektionen (Komponenten-Verhalten).
 *
 * Max-3-Slicing + Link-Ziele der beiden Richtungen (Aktivitaet -> Events,
 * Event -> Aktivitaeten) und das >=3-Gate der Hub-Sektion. Loader gemockt
 * (DB existiert noch nicht); next-intl liefert Key-Echos.
 */

import { describe, it, expect, vi } from 'vitest';

const loadNearbyActivitiesCached = vi.fn();
const loadNearbyFutureEventsCached = vi.fn();
vi.mock('@/lib/activities/nearby-loaders', () => ({
  loadNearbyActivitiesCached: (...args: unknown[]) => loadNearbyActivitiesCached(...args),
  loadNearbyFutureEventsCached: (...args: unknown[]) => loadNearbyFutureEventsCached(...args),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

const { NearbyEventsSection } = await import('@/components/Activities/NearbyEventsSection');
const { GemeindeActivitiesSection, EventNearbyActivities } = await import(
  '@/components/Activities/NearbyActivitiesSection'
);
const { activityTagLabel, deriveActivityChips } = await import('@/lib/activities/tag-labels');

/** Sammelt alle href-Props aus einem (nicht gerenderten) JSX-Baum. */
function collectHrefs(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) collectHrefs(child, out);
    return out;
  }
  const el = node as { props?: Record<string, unknown> };
  if (!el.props) return out;
  if (typeof el.props.href === 'string') out.push(el.props.href);
  collectHrefs(el.props.children, out);
  return out;
}

function activity(i: number) {
  return {
    id: `a-${i}`,
    slug: `aktivitaet-${i}-abcdef123456`,
    name: `Aktivität ${i}`,
    tags: ['schwimmen'],
    town: 'Testdorf',
    lat: 47.8,
    lng: 16.5,
    price_hint: null,
    images: null,
    _distance_km: i,
  };
}

function futureEvent(i: number) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title: `Event ${i}`,
    slug: `event-${i}`,
    start_date: '2027-06-01T19:00:00+00:00',
    location_name: 'Halle',
    address: null,
    postal_code: '7100',
    bundesland: 'burgenland',
    latitude: 47.8,
    longitude: 16.5,
    category: 'Musik',
    image_url: null,
    _distance_km: 1.2,
  };
}

describe('NearbyEventsSection (ActivityExtrasSlot-Inhalt)', () => {
  it('max 3 Events, Links auf /events/*', async () => {
    loadNearbyFutureEventsCached.mockResolvedValue([1, 2, 3, 4, 5].map(futureEvent));
    const tree = await NearbyEventsSection({ lat: 47.8, lng: 16.5 });
    const hrefs = collectHrefs(tree);
    expect(hrefs).toHaveLength(3);
    for (const href of hrefs) expect(href).toMatch(/^\/events\//);
    expect(loadNearbyFutureEventsCached).toHaveBeenCalledWith(47.8, 16.5, 10);
  });

  it('rendert null ohne Events', async () => {
    loadNearbyFutureEventsCached.mockResolvedValue([]);
    expect(await NearbyEventsSection({ lat: 47.8, lng: 16.5 })).toBeNull();
  });
});

describe('EventNearbyActivities (Event-Detail-Andockstelle)', () => {
  it('max 3 Aktivitaeten, Links auf /aktivitaet/*, Radius 10', async () => {
    loadNearbyActivitiesCached.mockResolvedValue([1, 2, 3, 4].map(activity));
    const tree = await EventNearbyActivities({ lat: 47.8, lng: 16.5 });
    const hrefs = collectHrefs(tree);
    expect(hrefs).toHaveLength(3);
    for (const href of hrefs) expect(href).toMatch(/^\/aktivitaet\//);
    expect(loadNearbyActivitiesCached).toHaveBeenCalledWith(47.8, 16.5, 10);
  });

  it('rendert null ohne Aktivitaeten', async () => {
    loadNearbyActivitiesCached.mockResolvedValue([]);
    expect(await EventNearbyActivities({ lat: 47.8, lng: 16.5 })).toBeNull();
  });
});

describe('GemeindeActivitiesSection (Hub, >=3-Gate)', () => {
  it('null bei < 3 Aktivitaeten', () => {
    expect(
      GemeindeActivitiesSection({ activities: [1, 2].map(activity), gemeindeName: 'Testdorf' }),
    ).toBeNull();
  });

  it('rendert ab 3 Aktivitaeten mit /aktivitaet/-Links', () => {
    const tree = GemeindeActivitiesSection({
      activities: [1, 2, 3].map(activity),
      gemeindeName: 'Testdorf',
    });
    const hrefs = collectHrefs(tree);
    expect(hrefs).toHaveLength(3);
    for (const href of hrefs) expect(href).toMatch(/^\/aktivitaet\//);
  });
});

describe('tag-labels', () => {
  it('kuratierte Labels + Fallback-Prettifier', () => {
    expect(activityTagLabel('thermen-special')).toBe('Therme');
    expect(activityTagLabel('unbekannter-tag')).toBe('Unbekannter Tag');
  });

  it('Chips: Haeufigkeit vor Alphabet, dedupliziert, gekappt', () => {
    const chips = deriveActivityChips(
      [
        { tags: ['wandern', 'schwimmen'] },
        { tags: ['schwimmen'] },
        { tags: ['klettern'] },
      ],
      2,
    );
    expect(chips).toEqual(['Schwimmen & Baden', 'Klettern']);
  });
});
